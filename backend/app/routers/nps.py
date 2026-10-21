from datetime import datetime, timezone, timedelta
from typing import Optional, List
import io
import csv
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.models import NPSResponse, Ticket, Department, User, AuditLog
from app.services.auth_service import get_current_user, require_permission
from app.services.rbac_service import has_permission

router = APIRouter(prefix="/nps", tags=["NPS & Patient Experience"])

# ---------------------------------------------------------
# Schemas
# ---------------------------------------------------------

class FeedbackSubmitRequest(BaseModel):
    ticket_id: Optional[int] = None
    tracking_token: Optional[str] = None
    department_id: Optional[str] = None
    room_number: Optional[str] = None
    patient_name: Optional[str] = None
    patient_contact: Optional[str] = None
    source: Optional[str] = "Hospital Master Feedback QR"
    emoji_rating: str = Field(..., description="'unhappy', 'okay', or 'happy'")
    nps_score: Optional[int] = Field(None, ge=0, le=10, description="0 to 10 standard NPS")
    feedback_comment: Optional[str] = None

class NPSResponseItem(BaseModel):
    id: int
    ticket_id: Optional[int] = None
    ticket_number: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    room_number: Optional[str] = None
    patient_contact: Optional[str] = None
    source: Optional[str] = None
    emoji_rating: str
    nps_score: Optional[int] = None
    feedback_comment: Optional[str] = None
    is_critical: bool
    resolution_status: Optional[str] = "unresolved"
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------
# Public Feedback Submission (Patient-Facing)
# ---------------------------------------------------------

@router.post("/submit")
def submit_patient_feedback(
    payload: FeedbackSubmitRequest,
    db: Session = Depends(get_db)
):
    """
    Submits patient feedback after ticket reaches completion/closure,
    or general hospital care feedback scanned from the Hospital Master Feedback QR.
    Supports 3-emoji satisfaction + optional 0-10 formal NPS rating.
    """
    if payload.emoji_rating not in ["unhappy", "okay", "happy"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid emoji rating. Must be 'unhappy', 'okay', or 'happy'."
        )

    ticket = None
    if payload.tracking_token:
        ticket = db.query(Ticket).filter(Ticket.patient_tracking_token == payload.tracking_token).first()
    elif payload.ticket_id:
        ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()

    department_id = payload.department_id or (ticket.department_id if ticket else None)
    room_number = payload.room_number or (ticket.room_number if ticket else None)
    patient_contact = payload.patient_contact or (ticket.patient_contact if ticket else None)
    source = payload.source or ("Bedside QR Code" if ticket else "Hospital Master Feedback QR")

    # Combine name with comment if provided
    final_comment = payload.feedback_comment
    if payload.patient_name:
        name_prefix = f"Feedback from: {payload.patient_name.strip()}"
        final_comment = f"{name_prefix} — {final_comment}" if final_comment else name_prefix

    # Calculate criticality
    # Critical if patient picked unhappy emoji OR gave a formal NPS score of 0-6 (Detractor)
    is_critical = (payload.emoji_rating == "unhappy") or (payload.nps_score is not None and payload.nps_score <= 6)

    response_entry = NPSResponse(
        ticket_id=ticket.id if ticket else None,
        patient_contact=patient_contact,
        department_id=department_id,
        room_number=room_number,
        emoji_rating=payload.emoji_rating,
        nps_score=payload.nps_score,
        feedback_comment=final_comment,
        source=source,
        is_critical=is_critical,
        is_demo=False
    )
    db.add(response_entry)

    # Record audit log if critical feedback received
    if is_critical:
        audit = AuditLog(
            ticket_id=ticket.id if ticket else None,
            action="CRITICAL_PATIENT_FEEDBACK_RECEIVED",
            actor_name=f"Patient Feedback ({source})",
            actor_role="patient",
            details=f"Received critical feedback. Emoji: {payload.emoji_rating}, Formal NPS: {payload.nps_score}. Dept: {department_id or 'Hospital-Wide'}. Comment: {final_comment or 'None'}"
        )
        db.add(audit)

    db.commit()
    db.refresh(response_entry)

    return {
        "success": True,
        "message": "Thank you for helping us improve our care services.",
        "response_id": response_entry.id
    }


# ---------------------------------------------------------
# Operational NPS Dashboard & Analytics (Staff/Admin)
# ---------------------------------------------------------

@router.get("/dashboard")
def get_nps_dashboard(
    department_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes distinct satisfaction metrics and formal NPS.
    Strictly separates 3-emoji satisfaction from formal 0-10 Net Promoter Score.
    """
    # Enforce RBAC / scope
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin does not have access to operational patient experience dashboards."
        )

    # If supervisor or staff, restrict to their department if assigned
    active_dept_id = department_id
    if current_user.role in ["supervisor", "staff"] and current_user.department_id:
        active_dept_id = current_user.department_id

    query = db.query(NPSResponse)
    if active_dept_id:
        query = query.filter(NPSResponse.department_id == active_dept_id)

    all_responses = query.all()
    total_responses = len(all_responses)

    # 1. Emoji Breakdown
    unhappy_count = sum(1 for r in all_responses if r.emoji_rating == "unhappy")
    okay_count = sum(1 for r in all_responses if r.emoji_rating == "okay")
    happy_count = sum(1 for r in all_responses if r.emoji_rating == "happy")
    
    happy_pct = round((happy_count / total_responses * 100), 1) if total_responses > 0 else 0.0
    okay_pct = round((okay_count / total_responses * 100), 1) if total_responses > 0 else 0.0
    unhappy_pct = round((unhappy_count / total_responses * 100), 1) if total_responses > 0 else 0.0

    # 2. Formal 0-10 NPS Calculation (Promoters: 9-10, Passives: 7-8, Detractors: 0-6)
    nps_rated = [r for r in all_responses if r.nps_score is not None]
    nps_total = len(nps_rated)
    promoters = sum(1 for r in nps_rated if r.nps_score >= 9)
    passives = sum(1 for r in nps_rated if 7 <= r.nps_score <= 8)
    detractors = sum(1 for r in nps_rated if r.nps_score <= 6)

    if nps_total > 0:
        promoter_pct = round((promoters / nps_total * 100), 1)
        detractor_pct = round((detractors / nps_total * 100), 1)
        passive_pct = round((passives / nps_total * 100), 1)
        formal_nps_score = round(promoter_pct - detractor_pct)
    else:
        promoter_pct = 0.0
        detractor_pct = 0.0
        passive_pct = 0.0
        formal_nps_score = 0

    # 3. Response Rate (closed tickets vs responses)
    closed_ticket_query = db.query(Ticket).filter(Ticket.status.in_(["closed", "resolved", "completed"]))
    if active_dept_id:
        closed_ticket_query = closed_ticket_query.filter(Ticket.department_id == active_dept_id)
    total_closed = closed_ticket_query.count()
    response_rate = round((total_responses / total_closed * 100), 1) if total_closed > 0 else 0.0

    # 4. Department-Wise Breakdown
    dept_stats = []
    departments = db.query(Department).all()
    for d in departments:
        dept_responses = [r for r in all_responses if r.department_id == d.id]
        d_total = len(dept_responses)
        d_happy = sum(1 for r in dept_responses if r.emoji_rating == "happy")
        d_crit = sum(1 for r in dept_responses if r.is_critical)
        
        d_nps_rated = [r for r in dept_responses if r.nps_score is not None]
        d_nps_total = len(d_nps_rated)
        if d_nps_total > 0:
            d_p = (sum(1 for r in d_nps_rated if r.nps_score >= 9) / d_nps_total) * 100
            d_det = (sum(1 for r in d_nps_rated if r.nps_score <= 6) / d_nps_total) * 100
            d_score = round(d_p - d_det)
        else:
            d_score = None

        dept_stats.append({
            "department_id": d.id,
            "department_name": d.name,
            "total_responses": d_total,
            "satisfaction_pct": round((d_happy / d_total * 100), 1) if d_total > 0 else 0.0,
            "formal_nps": d_score,
            "critical_count": d_crit
        })

    # 5. 7-Day Trend
    now = datetime.now(timezone.utc)
    trend_7d = []
    for day_idx in range(6, -1, -1):
        target_day = (now - timedelta(days=day_idx)).date()
        day_responses = [
            r for r in all_responses 
            if r.created_at and r.created_at.date() == target_day
        ]
        d_h = sum(1 for r in day_responses if r.emoji_rating == "happy")
        d_o = sum(1 for r in day_responses if r.emoji_rating == "okay")
        d_u = sum(1 for r in day_responses if r.emoji_rating == "unhappy")
        
        trend_7d.append({
            "date": target_day.strftime("%b %d"),
            "happy": d_h,
            "okay": d_o,
            "unhappy": d_u,
            "total": len(day_responses)
        })

    # 6. Critical Low-Satisfaction Alerts
    critical_alerts = []
    crit_query = query.filter(NPSResponse.is_critical == True).order_by(desc(NPSResponse.created_at)).limit(10).all()
    for c in crit_query:
        ticket_obj = db.query(Ticket).filter(Ticket.id == c.ticket_id).first() if c.ticket_id else None
        ticket_num = ticket_obj.ticket_number if ticket_obj else f"TKT-{(c.department_id or 'MED')[:3].upper()}-0{c.id:02d}"
        room_lbl = c.room_number or (ticket_obj.room_number if ticket_obj else "Room-302")
        critical_alerts.append({
            "id": c.id,
            "ticket_id": c.ticket_id,
            "ticket_number": ticket_num,
            "ticket_title": ticket_obj.title if ticket_obj else "Bedside Service Assistance",
            "department_id": c.department_id,
            "department_name": c.department.name if c.department else (c.department_id or "General").capitalize(),
            "room_number": room_lbl,
            "source": getattr(c, "source", None) or f"Bedside QR Placard ({room_lbl})",
            "patient_contact": c.patient_contact or (ticket_obj.patient_contact if ticket_obj else None),
            "assigned_staff_name": ticket_obj.assigned_staff.name if ticket_obj and ticket_obj.assigned_staff else None,
            "emoji_rating": c.emoji_rating,
            "nps_score": c.nps_score,
            "feedback_comment": c.feedback_comment,
            "investigation_notes": getattr(c, "investigation_notes", None),
            "corrective_action": getattr(c, "corrective_action", None),
            "resolution_status": getattr(c, "resolution_status", "unresolved") or "unresolved",
            "created_at": c.created_at
        })

    return {
        "tagline": "Every patient voice. Every improvement.",
        "total_responses": total_responses,
        "response_rate_pct": response_rate,
        "emoji_satisfaction": {
            "happy_count": happy_count,
            "okay_count": okay_count,
            "unhappy_count": unhappy_count,
            "happy_pct": happy_pct,
            "okay_pct": okay_pct,
            "unhappy_pct": unhappy_pct
        },
        "formal_nps": {
            "score": formal_nps_score,
            "total_rated": nps_total,
            "promoters": promoters,
            "passives": passives,
            "detractors": detractors,
            "promoter_pct": promoter_pct,
            "detractor_pct": detractor_pct,
            "passive_pct": passive_pct
        },
        "departments": dept_stats,
        "trend_7d": trend_7d,
        "critical_alerts": critical_alerts
    }


# ---------------------------------------------------------
# Response List & Export
# ---------------------------------------------------------

class FeedbackActionRequest(BaseModel):
    investigation_notes: Optional[str] = None
    corrective_action: Optional[str] = None
    resolution_status: Optional[str] = None

@router.get("/responses")
def list_nps_responses(
    department_id: Optional[str] = None,
    emoji_rating: Optional[str] = None,
    is_critical: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists feedback entries with enriched room, source, and ticket details"""
    if current_user.role == "superadmin":
        raise HTTPException(status_code=403, detail="Super Admin does not access operational patient feedback.")

    query = db.query(NPSResponse)
    if department_id:
        query = query.filter(NPSResponse.department_id == department_id)
    if emoji_rating:
        query = query.filter(NPSResponse.emoji_rating == emoji_rating)
    if is_critical is not None:
        query = query.filter(NPSResponse.is_critical == is_critical)

    total = query.count()
    items = query.order_by(desc(NPSResponse.created_at)).offset(offset).limit(limit).all()

    # Pre-fetch tickets and depts
    result = []
    for item in items:
        ticket_obj = db.query(Ticket).filter(Ticket.id == item.ticket_id).first() if item.ticket_id else None
        dept_obj = db.query(Department).filter(Department.id == item.department_id).first() if item.department_id else None
        room_lbl = item.room_number or (ticket_obj.room_number if ticket_obj else "Room-204")
        ticket_num = ticket_obj.ticket_number if ticket_obj else f"TKT-{(item.department_id or 'MED')[:3].upper()}-0{item.id:02d}"

        result.append({
            "id": item.id,
            "ticket_id": item.ticket_id,
            "ticket_number": ticket_num,
            "ticket_title": ticket_obj.title if ticket_obj else "Direct Patient Bedside Submission",
            "ticket_description": ticket_obj.description if ticket_obj else None,
            "department_id": item.department_id,
            "department_name": dept_obj.name if dept_obj else (item.department_id or "General").capitalize(),
            "room_number": room_lbl,
            "source": getattr(item, "source", None) or f"Bedside QR Code ({room_lbl})",
            "patient_contact": item.patient_contact or (ticket_obj.patient_contact if ticket_obj else None),
            "assigned_staff_name": ticket_obj.assigned_staff.name if ticket_obj and ticket_obj.assigned_staff else None,
            "emoji_rating": item.emoji_rating,
            "nps_score": item.nps_score,
            "feedback_comment": item.feedback_comment,
            "investigation_notes": getattr(item, "investigation_notes", None),
            "corrective_action": getattr(item, "corrective_action", None),
            "resolution_status": getattr(item, "resolution_status", "unresolved") or ("critical_attention" if item.is_critical else "acknowledged"),
            "resolved_by": getattr(item, "resolved_by", None),
            "resolved_at": getattr(item, "resolved_at", None),
            "is_critical": item.is_critical,
            "created_at": item.created_at
        })

    return {
        "total": total,
        "items": result,
        "limit": limit,
        "offset": offset
    }


@router.put("/responses/{response_id}/action")
def update_nps_action(
    response_id: int,
    payload: FeedbackActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates supervisor investigation notes and corrective actions for patient feedback"""
    if current_user.role == "superadmin":
        raise HTTPException(status_code=403, detail="Super Admin cannot edit operational feedback actions.")

    entry = db.query(NPSResponse).filter(NPSResponse.id == response_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Feedback entry not found")

    if payload.investigation_notes is not None:
        entry.investigation_notes = payload.investigation_notes
    if payload.corrective_action is not None:
        entry.corrective_action = payload.corrective_action
    if payload.resolution_status is not None:
        entry.resolution_status = payload.resolution_status
        if payload.resolution_status in ["resolved", "contacted_patient"]:
            entry.resolved_by = current_user.name
            entry.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(entry)
    return {
        "success": True,
        "message": "Patient voice investigation and corrective action saved successfully.",
        "entry_id": entry.id
    }


@router.get("/export")
def export_nps_csv(
    department_id: Optional[str] = None,
    current_user: User = Depends(require_permission("nps.export")),
    db: Session = Depends(get_db)
):
    """Exports patient feedback responses to CSV"""
    query = db.query(NPSResponse)
    if department_id:
        query = query.filter(NPSResponse.department_id == department_id)

    records = query.order_by(desc(NPSResponse.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Response ID", "Ticket ID", "Room Number", "Department",
        "Emoji Rating", "Formal NPS Score (0-10)", "Is Critical", "Comment", "Created At"
    ])

    for r in records:
        writer.writerow([
            r.id,
            r.ticket_id or "",
            r.room_number or "",
            r.department_id or "",
            r.emoji_rating,
            r.nps_score if r.nps_score is not None else "",
            "Yes" if r.is_critical else "No",
            r.feedback_comment or "",
            r.created_at.isoformat() if r.created_at else ""
        ])

    output.seek(0)
    filename = f"nps_feedback_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
