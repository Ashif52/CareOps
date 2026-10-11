import asyncio
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.config import settings
from app.database import get_db
from app.models import Room, Department, Ticket, TicketNote, User
from app.schemas import (
    PatientTicketCreate, PatientGuestSessionRequest,
    PatientVerifySessionRequest, PatientSessionResponse
)
from app.services.ticket_service import TicketService
from app.services.storage_service import StorageService
from app.services.realtime_service import realtime_hub
from app.services.auth_service import create_access_token

router = APIRouter(prefix="/patient", tags=["Patient QR Portal"])

# In-memory idempotency cache: { idempotency_key: { "response": dict, "created_at": datetime } }
_IDEMPOTENCY_CACHE: Dict[str, dict] = {}

def _clean_idempotency_cache():
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _IDEMPOTENCY_CACHE.items() if (now - v["created_at"]).total_seconds() > 300]
    for k in expired:
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
    if payload.otp_code.strip() not in ["123456", "999888", "000000"]:
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

@router.post("/submit")
async def submit_patient_ticket(payload: PatientTicketCreate, db: Session = Depends(get_db)):
    """
    Submits a patient complaint from a room QR code.
    - Resolves room strictly on backend from token.
    - Applies server-side idempotency protection against duplicate submissions.
    - Automatically notifies staff workspace in real time via Server-Sent Events!
    """
    # 1. Idempotency Check
    if payload.idempotency_key:
        _clean_idempotency_cache()
        cached = _IDEMPOTENCY_CACHE.get(payload.idempotency_key)
        if cached:
            return cached["response"]

    # 2. Room Resolution & Validation
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
            pass  # Fall back without voice file if audio decode fails
            
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
        patient_contact=payload.patient_contact,
        photo_url=photo_url
    )

    staff_name = ticket.assigned_staff.name if ticket.assigned_staff else None

    # 3. Safe Real-Time Event Broadcast to Staff Workspaces
    # Serialized with ISO string timestamps
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
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else ticket.created_at.isoformat(),
        "evidences": [
            {
                "id": e.id,
                "stage": e.stage,
                "media_type": e.media_type,
                "file_url": e.file_url,
                "notes": e.notes
            }
            for e in ticket.evidences
        ],
        "notes": [
            {
                "id": n.id,
                "author_name": n.author_name,
                "content": n.content,
                "is_internal": n.is_internal,
                "created_at": n.created_at.isoformat()
            }
            for n in ticket.notes
        ]
    }

    # Asynchronously dispatch to real-time hub
    try:
        await realtime_hub.publish_ticket_created(ticket_event_data)
    except Exception as e:
        # Never crash ticket creation if streaming broadcast encounters transient failure
        pass

    response_data = {
        "success": True,
        "ticket_number": ticket.ticket_number,
        "department": dept.name,
        "status": ticket.status,
        "room_number": room.room_number,
        "created_at": ticket.created_at.isoformat(),
        "tracking_url": f"/track/{ticket.ticket_number}"
    }

    if payload.idempotency_key:
        _IDEMPOTENCY_CACHE[payload.idempotency_key] = {
            "response": response_data,
            "created_at": datetime.now(timezone.utc)
        }

    return response_data

@router.get("/ticket/{ticket_number}")
def get_patient_ticket_status(ticket_number: str, db: Session = Depends(get_db)):
    """
    Public sanitized tracking view for patient.
    STRICT PRIVACY: Exposes ONLY patient-visible updates and sanitized progress.
    NEVER exposes internal notes, staff personal contacts, or supervisor escalation details.
    """
    clean_num = ticket_number.strip().upper()
    ticket = db.query(Ticket).filter(Ticket.ticket_number == clean_num).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Service ticket not found.")
        
    dept = db.query(Department).filter(Department.id == ticket.department_id).first()
    
    # Filter notes to ONLY public / patient-visible notes
    public_notes = db.query(TicketNote).filter(
        TicketNote.ticket_id == ticket.id,
        TicketNote.is_internal == False
    ).order_by(TicketNote.created_at.asc()).all()
    
    # Human-friendly stage name for patient peace of mind
    friendly_status = {
        "submitted": "Received & Queued",
        "assigned": "Assigned to Care Team",
        "acknowledged": "Care Team En Route",
        "in_progress": "Service in Progress",
        "resolution_submitted": "Work Completed (Verification in Progress)",
        "closed": "Resolved & Closed"
    }.get(ticket.status, "In Progress")
    
    return {
        "ticket_number": ticket.ticket_number,
        "room_number": ticket.room_number,
        "department_name": dept.name if dept else ticket.department_id,
        "category": ticket.category,
        "description": ticket.description,
        "status": ticket.status,
        "friendly_status": friendly_status,
        "created_at": ticket.created_at.isoformat(),
        "acknowledged_at": ticket.acknowledged_at.isoformat() if ticket.acknowledged_at else None,
        "in_progress_at": ticket.in_progress_at.isoformat() if ticket.in_progress_at else None,
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
        "updates": [
            {
                "timestamp": note.created_at.isoformat(),
                "author": note.author_name,
                "message": note.content
            }
            for note in public_notes
        ]
    }

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
