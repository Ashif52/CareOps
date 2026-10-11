from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import SLAPolicy, EscalationLog, Ticket, User
from app.schemas import SLAPolicyResponse
from app.services.auth_service import get_current_user, require_roles
from app.services.sla_engine import SLAEngine

router = APIRouter(prefix="/sla", tags=["SLA & Escalations"])

@router.get("/policies", response_model=List[SLAPolicyResponse])
def get_sla_policies(db: Session = Depends(get_db)):
    return db.query(SLAPolicy).filter(SLAPolicy.is_active == True).all()

@router.post("/check-now")
def run_sla_check(
    current_user: User = Depends(require_roles("admin", "supervisor")),
    db: Session = Depends(get_db)
):
    """Executes on-demand SLA scan across all active tickets"""
    stats = SLAEngine.run_sla_check_cycle(db)
    return {"success": True, "statistics": stats}

@router.get("/escalations")
def get_escalation_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(EscalationLog).order_by(desc(EscalationLog.created_at)).limit(limit).all()
    results = []
    for log in logs:
        ticket = db.query(Ticket).filter(Ticket.id == log.ticket_id).first()
        supervisor = db.query(User).filter(User.id == log.notified_supervisor_id).first() if log.notified_supervisor_id else None
        results.append({
            "id": log.id,
            "ticket_id": log.ticket_id,
            "ticket_number": ticket.ticket_number if ticket else "N/A",
            "ticket_title": ticket.title if ticket else "N/A",
            "room_number": ticket.room_number if ticket else "N/A",
            "department_id": ticket.department_id if ticket else "N/A",
            "escalation_level": log.escalation_level,
            "trigger_reason": log.trigger_reason,
            "notified_supervisor": supervisor.name if supervisor else "Duty Operations Supervisor",
            "delivery_status": log.delivery_status,
            "created_at": log.created_at
        })
    return results
