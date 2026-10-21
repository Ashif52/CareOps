"""
CareOps AI - Email Administration, Delivery Logs & SMTP Diagnostic Router
Allows Hospital Administrators to inspect outbound emails, test SMTP transport,
retry failed deliveries, and view real-time delivery status.
"""

from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import EmailLog, User, EscalationSetting, Ticket
from app.services.auth_service import get_current_user
from app.services.email_service import EmailService

router = APIRouter(prefix="/emails", tags=["Email & Delivery Administration"])


class SMTPTestRequest(BaseModel):
    to_email: Optional[str] = None
    recipient_email: Optional[str] = None


class MaintenanceNoticeRequest(BaseModel):
    ticket_id: Optional[int] = None
    recipient_email: Optional[str] = None


class SMTPConfigUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_use_ssl: Optional[bool] = None
    work_email: Optional[str] = None
    maintenance_email: Optional[str] = None


@router.get("")
def list_email_logs(
    status_filter: Optional[str] = Query(None, alias="status"),
    email_type: Optional[str] = None,
    recipient: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin inspects outbound email logs with pagination and filters."""
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Administrator privileges required.")

    query = db.query(EmailLog)
    if status_filter and status_filter != "all":
        query = query.filter(EmailLog.status == status_filter)
    if email_type and email_type != "all":
        query = query.filter(EmailLog.email_type == email_type)
    if recipient:
        query = query.filter(EmailLog.recipient_email.ilike(f"%{recipient.strip()}%"))

    total = query.count()
    logs = query.order_by(desc(EmailLog.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": log.id,
                "recipient_email": log.recipient_email,
                "recipient_name": log.recipient_name,
                "subject": log.subject,
                "email_type": log.email_type,
                "ticket_id": log.ticket_id,
                "status": log.status,
                "attempts": log.attempts,
                "max_attempts": log.max_attempts,
                "last_attempt_at": log.last_attempt_at.isoformat() if log.last_attempt_at else None,
                "sent_at": log.sent_at.isoformat() if log.sent_at else None,
                "error_message": log.error_message,
                "smtp_host_used": log.smtp_host_used,
                "created_at": log.created_at.isoformat() if log.created_at else None
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1
    }


@router.get("/stats")
def get_email_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Aggregate email delivery metrics for Admin Dashboard."""
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    total = db.query(EmailLog).count()
    sent = db.query(EmailLog).filter(EmailLog.status == "sent").count()
    failed = db.query(EmailLog).filter(EmailLog.status == "failed").count()
    queued = db.query(EmailLog).filter(EmailLog.status == "queued").count()
    retrying = db.query(EmailLog).filter(EmailLog.status == "retrying").count()

    cfg = EmailService.get_smtp_config(db)

    return {
        "total": total,
        "total_emails": total,
        "sent": sent,
        "failed": failed,
        "queued": queued,
        "retrying": retrying,
        "success_rate": round((sent / total * 100), 1) if total > 0 else 100.0,
        "delivery_rate": round((sent / total * 100), 1) if total > 0 else 100.0,
        "smtp_configured": bool(cfg.get("smtp_host")),
        "smtp_host": cfg.get("smtp_host") or "127.0.0.1",
        "smtp_port": cfg.get("smtp_port") or 587,
        "sender_email": cfg.get("smtp_from") or "hospital-alerts@careops.ai",
    }


@router.post("/test")
def test_smtp_delivery(
    payload: SMTPTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Triggers an actual SMTP handshake and test email dispatch to test connectivity."""
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Admin required.")

    target = payload.to_email or payload.recipient_email
    if not target:
        raise HTTPException(status_code=400, detail="Recipient email is required.")

    result = EmailService.test_smtp_connection(db, target)
    return result


@router.post("/send-maintenance-notice")
def send_maintenance_notice(
    payload: MaintenanceNoticeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dispatches the rich official Happy Care maintenance confirmation notice
    with the exact WhatsApp notice text, live tracking CTA button, and 5-step resolution timeline.
    """
    if current_user.role not in ["admin", "superadmin", "supervisor", "staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Find ticket
    if payload.ticket_id:
        ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
    else:
        # Get latest maintenance ticket or latest ticket
        ticket = db.query(Ticket).filter(Ticket.department_id == "maintenance").order_by(Ticket.id.desc()).first()
        if not ticket:
            ticket = db.query(Ticket).order_by(Ticket.id.desc()).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="No hospital tickets found to send notice for.")

    target_email = (payload.recipient_email or ticket.patient_email or current_user.email).strip().lower()
    if not target_email:
        raise HTTPException(status_code=400, detail="Target recipient email is required.")

    log = EmailService.send_ticket_timeline_email(
        db=db,
        ticket=ticket,
        recipient_email=target_email,
        recipient_name=ticket.patient_user.name if ticket.patient_user else "Hospital Patient"
    )

    return {
        "success": True,
        "message": f"Maintenance timeline notice enqueued for {target_email} for ticket {ticket.ticket_number}.",
        "ticket_number": ticket.ticket_number,
        "recipient_email": target_email,
        "email_log_id": log.id
    }


@router.post("/retry")
def retry_failed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-attempts delivery for all queued or failed emails."""
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    result = EmailService.retry_failed_emails(db)
    return {
        "success": True,
        "message": f"Enqueued {result['retried_count']} emails for delivery re-attempt.",
        "stats": result
    }


@router.get("/config")
def get_smtp_configuration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Inspect current active SMTP configuration (with password masked)."""
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    cfg = EmailService.get_smtp_config(db)
    return {
        "smtp_host": cfg["smtp_host"] or "",
        "smtp_port": cfg["smtp_port"],
        "smtp_user": cfg["smtp_user"] or "",
        "smtp_from": cfg["smtp_from"],
        "smtp_use_ssl": cfg["smtp_use_ssl"],
        "work_email": cfg["work_email"] or "",
        "maintenance_email": cfg["maintenance_email"] or "",
        "has_password": bool(cfg["smtp_password"])
    }


@router.put("/config")
def update_smtp_configuration(
    payload: SMTPConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin updates SMTP parameters and saves them in the persistent database."""
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    db_conf = db.query(EscalationSetting).filter(EscalationSetting.id == 1).first()
    if not db_conf:
        db_conf = EscalationSetting(id=1)
        db.add(db_conf)

    if payload.smtp_host is not None:
        db_conf.smtp_host = payload.smtp_host.strip()
    if payload.smtp_port is not None:
        db_conf.smtp_port = payload.smtp_port
    if payload.smtp_user is not None:
        db_conf.smtp_user = payload.smtp_user.strip()
    if payload.smtp_password is not None and payload.smtp_password.strip():
        db_conf.smtp_password = payload.smtp_password.strip()
    if payload.smtp_from is not None:
        db_conf.smtp_from = payload.smtp_from.strip()
    if payload.smtp_use_ssl is not None:
        db_conf.smtp_use_ssl = payload.smtp_use_ssl
    if payload.work_email is not None:
        db_conf.work_email = payload.work_email.strip()
    if payload.maintenance_email is not None:
        db_conf.maintenance_email = payload.maintenance_email.strip()

    db.commit()
    db.refresh(db_conf)

    return {
        "success": True,
        "message": "SMTP configuration updated successfully."
    }
