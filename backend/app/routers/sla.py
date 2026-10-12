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

from pydantic import BaseModel
from typing import Optional
from app.models import EscalationSetting, AuditLog
from app.services.notification_service import NotificationService
import json

class EscalationSettingsUpdateRequest(BaseModel):
    work_email: Optional[str] = None
    maintenance_email: Optional[str] = None
    maintenance_mobile: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_use_ssl: Optional[bool] = None

class TestSMTPSRequest(BaseModel):
    target_email: Optional[str] = None

@router.get("/escalation-settings")
def get_escalation_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves current database-persisted SMTPS & Maintenance Escalation configuration"""
    return NotificationService.get_effective_settings(db)

@router.put("/escalation-settings")
def update_escalation_settings(
    payload: EscalationSettingsUpdateRequest,
    current_user: User = Depends(require_roles("admin", "superadmin", "supervisor")),
    db: Session = Depends(get_db)
):
    """
    Directly writes escalation and SMTPS settings into the database.
    Updates Work Email, Maintenance Email, Mobile Number, and SMTPS parameters.
    """
    conf = db.query(EscalationSetting).filter(EscalationSetting.id == 1).first()
    if not conf:
        conf = EscalationSetting(id=1)
        db.add(conf)

    if payload.work_email is not None:
        conf.work_email = payload.work_email.strip() if payload.work_email else None
    if payload.maintenance_email is not None:
        conf.maintenance_email = payload.maintenance_email.strip() if payload.maintenance_email else None
    if payload.maintenance_mobile is not None:
        conf.maintenance_mobile = payload.maintenance_mobile.strip() if payload.maintenance_mobile else None
    if payload.smtp_host is not None:
        conf.smtp_host = payload.smtp_host.strip() if payload.smtp_host else None
    if payload.smtp_port is not None:
        conf.smtp_port = payload.smtp_port
    if payload.smtp_user is not None:
        conf.smtp_user = payload.smtp_user.strip() if payload.smtp_user else None
    if payload.smtp_password is not None and payload.smtp_password != "":
        conf.smtp_password = payload.smtp_password
    if payload.smtp_from is not None:
        conf.smtp_from = payload.smtp_from.strip() if payload.smtp_from else None
    if payload.smtp_use_ssl is not None:
        conf.smtp_use_ssl = payload.smtp_use_ssl

    audit = AuditLog(
        action="ESCALATION_SETTINGS_SAVED_TO_DATABASE",
        actor_name=current_user.name,
        actor_role=current_user.role,
        actor_id=current_user.id,
        details=json.dumps({
            "work_email": conf.work_email,
            "maintenance_email": conf.maintenance_email,
            "maintenance_mobile": conf.maintenance_mobile,
            "smtp_host": conf.smtp_host,
            "smtp_port": conf.smtp_port,
            "smtp_use_ssl": conf.smtp_use_ssl
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(conf)

    return {
        "success": True,
        "message": "Settings saved directly to database.",
        "settings": NotificationService.get_effective_settings(db)
    }

@router.post("/test-smtps")
def test_smtps_connection(
    payload: Optional[TestSMTPSRequest] = None,
    current_user: User = Depends(require_roles("admin", "superadmin", "supervisor")),
    db: Session = Depends(get_db)
):
    """Sends a live test alert to verify SMTPS dispatch and mobile routing"""
    target = payload.target_email if payload else None
    res = NotificationService.send_test_alert(db, target_email=target)
    return res

