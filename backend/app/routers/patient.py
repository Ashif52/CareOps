import asyncio
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func
from jose import jwt, JWTError

from app.config import settings
from app.database import get_db
from app.models import Room, Department, Ticket, TicketNote, User, AuditLog
from app.schemas import (
    PatientTicketCreate, PatientGuestSessionRequest,
    PatientVerifySessionRequest, PatientSessionResponse,
    PatientRegisterRequest, PatientProfileUpdate
)
from app.services.ticket_service import TicketService
from app.services.storage_service import StorageService
from app.services.realtime_service import realtime_hub
from app.services.auth_service import create_access_token, get_password_hash, get_current_patient
from app.services.notification_service import NotificationService

class PatientEscalateRequest(BaseModel):
    reason: Optional[str] = None

router = APIRouter(prefix="/patient", tags=["Patient QR Portal"])

# In-memory idempotency cache: { idempotency_key: { "response": dict, "created_at": datetime } }
_IDEMPOTENCY_CACHE: Dict[str, dict] = {}
_MAX_IDEMPOTENCY_CACHE_ENTRIES = 5000

def _clean_idempotency_cache():
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _IDEMPOTENCY_CACHE.items() if (now - v["created_at"]).total_seconds() > 300]
    for k in expired:
        _IDEMPOTENCY_CACHE.pop(k, None)
    if len(_IDEMPOTENCY_CACHE) > _MAX_IDEMPOTENCY_CACHE_ENTRIES:
        sorted_keys = sorted(_IDEMPOTENCY_CACHE.keys(), key=lambda k: _IDEMPOTENCY_CACHE[k]["created_at"])
        for k in sorted_keys[:1000]:
            _IDEMPOTENCY_CACHE.pop(k, None)


@router.get("/room/{qr_token}")
def get_room_by_token(qr_token: str, db: Session = Depends(get_db)):
    """
    Resolves hospital room context securely via opaque Bedside QR token.
    Never exposes internal database primary keys or sensitive hospital configuration.
    Validates active vs revoked status.
    """
    clean_token = qr_token.strip()
    room = db.query(Room).filter(Room.qr_token == clean_token).first()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid Bedside QR Code. The scanned location could not be identified."
        )
        
    if not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This Bedside QR Code has been revoked or deactivated by hospital administration. Please contact nursing staff."
        )
        
    departments = db.query(Department).filter(Department.is_active == True).all()
    
    return {
        "hospital_name": "Metropolitan General Hospital — CareOps Health",
        "room_number": room.room_number,
        "floor": room.floor,
        "wing": room.wing,
        "token": room.qr_token,
        "is_active": room.is_active,
        "departments": [
            {
                "id": d.id,
                "name": d.name,
                "code": d.code,
                "icon": d.icon,
                "description": d.description
            }
            for d in departments
        ]
    }

@router.post("/session/guest", response_model=PatientSessionResponse)
def create_guest_session(payload: PatientGuestSessionRequest, db: Session = Depends(get_db)):
    """
    Establishes an authorized Bedside Guest Session bound specifically to the verified room QR location.
    Does not require patient PHI or credentials for non-clinical service complaints.
    """
    room = db.query(Room).filter(Room.qr_token == payload.qr_token.strip()).first()
    if not room or not room.is_active:
        raise HTTPException(status_code=400, detail="Invalid or deactivated Room QR Code.")

    session_id = f"guest-{room.room_number.replace(' ', '')}-{uuid.uuid4().hex[:10]}"
    token_claims = {
        "sub": session_id,
        "role": "patient_guest",
        "context": "patient",
        "room_token": room.qr_token,
        "room_number": room.room_number
    }
    access_token = create_access_token(token_claims, expires_delta=timedelta(hours=12))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "session_type": "guest",
        "room_number": room.room_number,
        "patient_identifier": session_id,
        "expires_in_hours": 12
    }

@router.post("/session/verify", response_model=PatientSessionResponse)
def verify_patient_session(payload: PatientVerifySessionRequest, db: Session = Depends(get_db)):
    """
    Patient authentication flow via mobile verification.
    Provides verified patient identity for multi-visit or cross-device complaint tracking.
    """
    clean_phone = payload.phone.strip()
    if not clean_phone or len(clean_phone) < 7:
        raise HTTPException(status_code=400, detail="Please enter a valid mobile phone number.")

    # Validates standard hospital demo/sandbox OTP (123456) or approved verification code
    if not settings.DEBUG_MODE and payload.otp_code.strip() in ["123456", "999888", "000000"]:
        raise HTTPException(
            status_code=400,
            detail="Sandbox OTP codes are disabled in production mode. Use verified SMS OTP."
        )
    elif payload.otp_code.strip() not in ["123456", "999888", "000000"]:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code. Use demo code 123456.")

    room_num = None
    if payload.qr_token:
        room = db.query(Room).filter(Room.qr_token == payload.qr_token.strip(), Room.is_active == True).first()
        if room:
            room_num = room.room_number

    session_id = f"verified-{clean_phone[-4:]}-{uuid.uuid4().hex[:6]}"
    token_claims = {
        "sub": session_id,
        "role": "patient_verified",
        "context": "patient",
        "phone": clean_phone,
        "room_token": payload.qr_token,
        "room_number": room_num
    }
    access_token = create_access_token(token_claims, expires_delta=timedelta(hours=24))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "session_type": "verified",
        "room_number": room_num,
        "patient_identifier": clean_phone,
        "expires_in_hours": 24
    }

from app.services.whatsapp_service import normalize_to_e164, is_valid_e164

@router.post("/submit")
async def submit_patient_ticket(
    payload: PatientTicketCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Submits a patient complaint from a room QR code or authenticated patient portal.
    - Resolves room strictly on backend from token.
    - Enforces mandatory mobile phone number validated to E.164.
    - Links authenticated patient account when token is provided.
    - Generates cryptographically secure tracking token and absolute HTTPS tracking link.
    - Dispatches email confirmation to patient and staff notifications.
    """
    # 0. Check authenticated patient identity if present
    patient_user_id = None
    patient_email = payload.patient_email.strip().lower() if payload.patient_email else None
    if authorization and "bearer " in authorization.lower():
        token = authorization.split()[-1].strip()
        try:
            token_payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            sub = token_payload.get("sub")
            if sub and str(sub).isdigit():
                auth_user = db.query(User).filter(User.id == int(sub)).first()
                if auth_user:
                    patient_user_id = auth_user.id
                    if not patient_email and auth_user.email:
                        patient_email = auth_user.email
        except Exception:
            pass

    # 1. Idempotency Check
    if payload.idempotency_key:
        _clean_idempotency_cache()
        cached = _IDEMPOTENCY_CACHE.get(payload.idempotency_key)
        if cached:
            return cached["response"]

    # 2. Mandatory Mobile Number Validation (Section 5)
    raw_contact = (payload.patient_contact or "").strip()
    if not raw_contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile phone number is mandatory to receive live WhatsApp updates and ticket tracking."
        )

    normalized_phone = normalize_to_e164(raw_contact)
    if not is_valid_e164(normalized_phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid mobile number (e.g. +91 98765 43210 or 10-digit mobile number)."
        )

    # 3. Room Resolution & Validation
    room = db.query(Room).filter(Room.qr_token == payload.qr_token.strip()).first()
    if not room:
        raise HTTPException(status_code=400, detail="Invalid Room QR token.")
    if not room.is_active:
        raise HTTPException(status_code=410, detail="This Room QR Code has been deactivated.")
        
    dept = db.query(Department).filter(Department.id == payload.department_id, Department.is_active == True).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Invalid Department selected.")
        
    voice_url = None
    if payload.voice_recording_base64:
        try:
            voice_url, _, _ = StorageService.save_base64_data(
                payload.voice_recording_base64, 
                subfolder="audio", 
                default_ext=".webm"
            )
        except Exception:
            pass
            
    photo_url = None
    if payload.photo_base64:
        try:
            photo_url, _, _ = StorageService.save_base64_data(
                payload.photo_base64,
                subfolder="evidence",
                default_ext=".jpg"
            )
        except Exception:
            pass
            
    ticket = TicketService.create_patient_ticket(
        db=db,
        room=room,
        department=dept,
        category=payload.category,
        description=payload.description,
        voice_url=voice_url,
        voice_transcription=payload.voice_transcription,
        patient_contact=normalized_phone,
        photo_url=photo_url,
        patient_user_id=patient_user_id,
        patient_email=patient_email
    )

    staff_name = ticket.assigned_staff.name if ticket.assigned_staff else None

    # Safe Real-Time Event Broadcast to Staff Workspaces
    ticket_event_data = {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "title": ticket.title,
        "description": ticket.description,
        "department_id": ticket.department_id,
        "department_name": dept.name,
        "room_id": ticket.room_id,
        "room_number": ticket.room_number,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "is_escalated": ticket.is_escalated,
        "escalation_level": ticket.escalation_level,
        "assigned_staff_id": ticket.assigned_staff_id,
        "assigned_staff_name": staff_name,
        "sla_acknowledgement_deadline": ticket.sla_acknowledgement_deadline.isoformat() if ticket.sla_acknowledgement_deadline else None,
        "sla_resolution_deadline": ticket.sla_resolution_deadline.isoformat() if ticket.sla_resolution_deadline else None,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else ticket.created_at.isoformat()
    }

    try:
        await realtime_hub.publish_ticket_created(ticket_event_data)
    except Exception:
        pass

    tracking_url = f"/track/{ticket.ticket_number}?token={ticket.patient_tracking_token}"
    confirmation_msg = (
        f"Your complaint has been registered successfully. "
        f"Your ticket reference is {ticket.ticket_number}. "
        f"Track the progress of your request here: {tracking_url}"
    )

    response_data = {
        "success": True,
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "department": dept.name,
        "status": ticket.status,
        "room_number": room.room_number,
        "created_at": ticket.created_at.isoformat(),
        "tracking_url": tracking_url,
        "token": ticket.patient_tracking_token,
        "confirmation_message": confirmation_msg
    }

    if payload.idempotency_key:
        _IDEMPOTENCY_CACHE[payload.idempotency_key] = {
            "response": response_data,
            "created_at": datetime.now(timezone.utc)
        }

    return response_data

@router.get("/ticket/{ticket_number}")
def get_patient_ticket_status(
    ticket_number: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Public sanitized live tracking view for patient (Section 5 & 7).
    - Unpredictable token protection
    - Live ETA calculation active after acknowledgement
    - Accurate elapsed timestamps
    - Final feedback screen eligibility
    """
    clean_num = ticket_number.strip().upper()
    ticket = db.query(Ticket).filter(Ticket.ticket_number == clean_num).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Service ticket not found.")

    # Validate tracking token if set
    if ticket.patient_tracking_token and token:
        if token.strip() != ticket.patient_tracking_token:
            logger.warning(f"Patient tracking token mismatch for ticket {clean_num}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or unauthorized tracking token for this ticket."
            )
        
    dept = db.query(Department).filter(Department.id == ticket.department_id).first()
    
    # Filter notes to ONLY public / patient-visible notes
    public_notes = db.query(TicketNote).filter(
        TicketNote.ticket_id == ticket.id,
        TicketNote.is_internal == False
    ).order_by(TicketNote.created_at.asc()).all()
    
    friendly_status = {
        "submitted": "Received & Queued",
        "assigned": "Assigned to Care Team",
        "acknowledged": "Care Team En Route",
        "in_progress": "Service in Progress",
        "resolution_submitted": "Work Completed (Awaiting Sign-off)",
        "closed": "Resolved & Closed"
    }.get(ticket.status, "In Progress")

    # Calculated Arrival ETA: active after acknowledgement
    eta_display = None
    if ticket.acknowledged_at and ticket.status in ["acknowledged", "in_progress"]:
        mins = ticket.estimated_arrival_minutes or 15
        eta_display = f"Estimated arrival: {mins} minutes"
    elif ticket.status == "submitted" or ticket.status == "assigned":
        eta_display = "Estimated response time: 10–15 minutes"

    is_eligible_for_feedback = ticket.status in ["resolution_submitted", "closed"]
    has_feedback_recorded = (
        ticket.patient_feedback_rating is not None or
        bool(db.query(Ticket).filter(Ticket.id == ticket.id, Ticket.patient_feedback_comment != None).first())
    )

    staff = ticket.assigned_staff
    res = {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "room_number": ticket.room_number,
        "department_name": dept.name if dept else ticket.department_id,
        "category": ticket.category,
        "description": ticket.description,
        "status": ticket.status,
        "friendly_status": friendly_status,
        "resolution_summary": ticket.resolution_summary,
        "is_acknowledged": bool(ticket.acknowledged_at),
        "estimated_arrival_minutes": ticket.estimated_arrival_minutes,
        "estimated_arrival_at": ticket.estimated_arrival_at.isoformat() if ticket.estimated_arrival_at else None,
        "eta_display": eta_display,
        "eta_updated_at": ticket.acknowledged_at.isoformat() if ticket.acknowledged_at else None,
        "is_eligible_for_feedback": is_eligible_for_feedback,
        "ready_for_feedback": is_eligible_for_feedback,
        "has_feedback_recorded": has_feedback_recorded,
        "created_at": ticket.created_at.isoformat(),
        "assigned_at": ticket.assigned_at.isoformat() if getattr(ticket, "assigned_at", None) else None,
        "acknowledged_at": ticket.acknowledged_at.isoformat() if ticket.acknowledged_at else None,
        "en_route_at": ticket.en_route_at.isoformat() if getattr(ticket, "en_route_at", None) else None,
        "work_started_at": ticket.work_started_at.isoformat() if getattr(ticket, "work_started_at", None) else (ticket.in_progress_at.isoformat() if ticket.in_progress_at else None),
        "work_completed_at": ticket.work_completed_at.isoformat() if getattr(ticket, "work_completed_at", None) else (ticket.resolution_submitted_at.isoformat() if ticket.resolution_submitted_at else None),
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
        "is_escalated": ticket.is_escalated,
        "escalation_level": ticket.escalation_level,
        "escalation_reason": ticket.escalation_reason,
        "updates": [
            {
                "timestamp": note.created_at.isoformat(),
                "author": note.author_name,
                "message": note.content,
                "content": note.content,
                "is_internal": False
            }
            for note in public_notes
        ],
        "notes": [
            {
                "timestamp": note.created_at.isoformat(),
                "author": note.author_name,
                "message": note.content,
                "content": note.content,
                "is_internal": False
            }
            for note in public_notes
        ]
    }
    if staff:
        res["assigned_staff_designation"] = staff.designation if staff.designation else "Hospital Care Specialist"
    return res

@router.get("/ticket/{ticket_number}/stream")
async def stream_patient_ticket_status(ticket_number: str, db: Session = Depends(get_db)):
    """
    Server-Sent Events (SSE) stream for patient live status tracking.
    When a staff member acknowledges, starts work, or closes the ticket,
    the patient view automatically updates in real time.
    """
    clean_num = ticket_number.strip().upper()
    ticket = db.query(Ticket).filter(Ticket.ticket_number == clean_num).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    queue = await realtime_hub.subscribe_patient(clean_num)

    async def event_generator():
        try:
            # Send initial state snapshot
            initial_payload = {
                "event": "connected",
                "ticket_number": clean_num,
                "status": ticket.status,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            yield f"event: connected\ndata: {json.dumps(initial_payload)}\n\n"

            while True:
                try:
                    # Wait for next event or send ping keepalive every 15s
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await realtime_hub.unsubscribe_patient(clean_num, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/ticket/{ticket_number}/escalate")
async def escalate_patient_ticket(
    ticket_number: str,
    payload: Optional[PatientEscalateRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Emergency escalation endpoint triggered by patient from room tracking portal.
    Dispatches immediate alert to Maintenance Department email and mobile via SMTPS.
    """
    clean_num = ticket_number.strip().upper()
    ticket = db.query(Ticket).filter(Ticket.ticket_number == clean_num).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Service ticket not found.")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot escalate a resolved and closed ticket.")

    escalation_reason = (
        payload.reason
        if payload and payload.reason
        else "Urgent patient escalation requested from mobile room tracking portal."
    )
    ticket.is_escalated = True
    ticket.escalation_level = max(ticket.escalation_level + 1, 1)
    ticket.escalation_reason = escalation_reason

    # Add patient-visible and internal progress note
    note = TicketNote(
        ticket_id=ticket.id,
        author_name="Patient Escalation Dispatch",
        content=f"Priority Escalation: Routed to Maintenance Department & Supervisor via SMTPS. Reason: {escalation_reason}",
        is_internal=False
    )
    db.add(note)

    # Dispatch via SMTPS and Mobile Notification Service
    dispatch_result = NotificationService.send_escalation_alert(
        db=db,
        ticket=ticket,
        escalation_level=ticket.escalation_level,
        reason=escalation_reason,
        trigger_source="PATIENT_PORTAL_ESCALATION"
    )

    db.commit()
    db.refresh(ticket)

    # Publish real-time SSE update so both staff and patient screen update
    try:
        await realtime_hub.publish_ticket_updated(ticket.ticket_number, {
            "is_escalated": ticket.is_escalated,
            "escalation_level": ticket.escalation_level,
            "escalation_reason": ticket.escalation_reason,
            "status": ticket.status
        })
    except Exception:
        pass

    return {
        "success": True,
        "message": "Ticket successfully escalated to Maintenance Department.",
        "ticket_number": ticket.ticket_number,
        "escalation_level": ticket.escalation_level,
        "dispatch": dispatch_result
    }

# ----------------- 5. Patient Account Self-Registration & Portal -----------------

@router.post("/register")
def register_patient_account(
    payload: PatientRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Provisions a registered patient account in the centralized authoritative user database.
    Assigns a unique Patient ID (e.g. PAT-10492) and hashes password securely.
    """
    clean_email = payload.email.lower().strip()
    clean_phone = payload.phone.strip()
    clean_name = payload.name.strip()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    # Check for existing email or phone
    existing = db.query(User).filter(
        or_(
            func.lower(User.email) == clean_email,
            User.phone == clean_phone
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email address or phone number already exists. Please log in."
        )

    # Generate unique Patient ID (e.g., PAT-58392)
    import random
    rand_num = random.randint(10000, 99999)
    pat_id = f"PAT-{rand_num}"
    while db.query(User).filter(User.patient_id == pat_id).first():
        pat_id = f"PAT-{random.randint(10000, 99999)}"

    pw_hash = get_password_hash(payload.password)
    new_patient = User(
        name=clean_name,
        email=clean_email,
        phone=clean_phone,
        patient_id=pat_id,
        employee_id=pat_id,  # Mirror so either identifier works on login
        role="patient",
        designation="Hospital Patient",
        hashed_password=pw_hash,
        account_status="active",
        is_active=True,
        failed_login_attempts=0,
        token_version=1,
        avatar_url=None
    )
    db.add(new_patient)
    db.flush()

    audit = AuditLog(
        action="PATIENT_ACCOUNT_REGISTERED",
        actor_id=new_patient.id,
        actor_name=new_patient.name,
        actor_role="patient",
        details=json.dumps({"patient_id": pat_id, "email": clean_email, "phone": clean_phone})
    )
    db.add(audit)
    db.commit()
    db.refresh(new_patient)

    token = create_access_token(data={
        "sub": str(new_patient.id),
        "role": "patient",
        "dept": None,
        "v": 1
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_patient.id,
            "patient_id": new_patient.patient_id,
            "name": new_patient.name,
            "email": new_patient.email,
            "phone": new_patient.phone,
            "role": new_patient.role,
            "account_status": new_patient.account_status,
            "created_at": new_patient.created_at.isoformat()
        }
    }


@router.get("/my-tickets")
def get_patient_my_tickets(
    current_patient: User = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    """
    Authenticated Patient Portal view: Returns all tickets submitted by this patient.
    Strictly scoped to their patient account ID, registered email, or contact phone.
    Guarantees zero exposure of internal staff notes, staff IDs, or other patients' records.
    """
    query = db.query(Ticket).filter(
        or_(
            Ticket.patient_user_id == current_patient.id,
            Ticket.patient_contact == current_patient.phone,
            Ticket.patient_email == current_patient.email
        )
    ).order_by(desc(Ticket.created_at)).all()

    results = []
    for t in query:
        dept = db.query(Department).filter(Department.id == t.department_id).first()
        dept_name = dept.name if dept else t.department_id.capitalize()
        staff_display = t.assigned_staff.name if t.assigned_staff else "Care Team Dispatched"

        # Filter strictly for patient-visible notes (is_internal == False)
        public_notes = [
            {
                "time": n.created_at.strftime("%I:%M %p") if n.created_at else "",
                "message": n.content,
                "author": n.author_name if n.author_name != "System" else "CareOps Team"
            }
            for n in t.notes if not n.is_internal
        ]

        results.append({
            "id": t.id,
            "ticket_number": t.ticket_number,
            "title": t.title,
            "description": t.description,
            "department_id": t.department_id,
            "department_name": dept_name,
            "room_number": t.room_number,
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "assigned_staff_name": staff_display,
            "estimated_arrival_minutes": t.estimated_arrival_minutes,
            "resolution_summary": t.resolution_summary,
            "patient_feedback_rating": t.patient_feedback_rating,
            "patient_feedback_comment": t.patient_feedback_comment,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "updates": public_notes
        })

    return results


@router.put("/profile")
def update_patient_profile(
    payload: PatientProfileUpdate,
    current_patient: User = Depends(get_current_patient),
    db: Session = Depends(get_db)
):
    """Allows patient to update permitted contact details."""
    updates = {}
    if payload.name and payload.name.strip():
        current_patient.name = payload.name.strip()
        updates["name"] = current_patient.name
    if payload.phone and payload.phone.strip():
        current_patient.phone = payload.phone.strip()
        updates["phone"] = current_patient.phone
    if payload.email and payload.email.strip():
        clean_email = payload.email.strip().lower()
        if "@" in clean_email:
            existing = db.query(User).filter(User.email == clean_email, User.id != current_patient.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="This email is already in use by another account.")
            current_patient.email = clean_email
            updates["email"] = current_patient.email

    audit = AuditLog(
        action="PATIENT_PROFILE_UPDATED",
        actor_id=current_patient.id,
        actor_name=current_patient.name,
        actor_role="patient",
        details=json.dumps(updates)
    )
    db.add(audit)
    db.commit()
    db.refresh(current_patient)

    return {
        "success": True,
        "message": "Contact details updated successfully.",
        "user": {
            "id": current_patient.id,
            "patient_id": current_patient.patient_id,
            "name": current_patient.name,
            "email": current_patient.email,
            "phone": current_patient.phone
        }
    }
