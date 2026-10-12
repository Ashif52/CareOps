import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sqlalchemy import text
from app.database import get_db
from app.models import (
    User, Ticket, Evidence, AIVerificationJob, TicketNote,
    EscalationLog, AuditLog, Department, Room, SLAPolicy
)
from app.services.auth_service import require_roles, get_current_user
from app.seed import seed_demo_tickets

logger = logging.getLogger("careops.system")
router = APIRouter(prefix="/system", tags=["System & Superadmin"])

class ClearDatabaseRequest(BaseModel):
    mode: str = "purge_operational"  # "purge_operational" or "reset_all"
    confirm_phrase: str              # must match "CONFIRM_CLEAR"

@router.post("/clear-database")
def clear_database(
    payload: ClearDatabaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """
    SUPERADMIN-ONLY ACTION:
    Clears database records (tickets, evidence, AI vision logs, audit trails).
    Strictly forbidden for standard admins, supervisors, and staff.
    """
    if payload.confirm_phrase != "CONFIRM_CLEAR":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation phrase mismatch. You must provide 'CONFIRM_CLEAR' to execute database purge."
        )

    try:
        if payload.mode == "purge_operational":
            # 1. Count records before deletion
            tickets_count = db.query(Ticket).count()

            # 2. Nullify ticket references in audit logs first to prevent foreign-key constraints
            try:
                db.execute(text("UPDATE audit_logs SET ticket_id = NULL WHERE ticket_id IS NOT NULL;"))
                db.flush()
            except Exception as e:
                logger.warning(f"Failed to nullify audit_logs.ticket_id: {e}")

            # 3. Delete child entities in strict foreign-key order
            db.query(AIVerificationJob).delete(synchronize_session=False)
            db.query(Evidence).delete(synchronize_session=False)
            db.query(TicketNote).delete(synchronize_session=False)
            db.query(EscalationLog).delete(synchronize_session=False)
            db.query(AuditLog).delete(synchronize_session=False)
            db.flush()
            db.query(Ticket).delete(synchronize_session=False)
            db.flush()

            # 4. Record audit ledger entry documenting superadmin purge
            audit = AuditLog(
                ticket_id=None,
                actor_id=current_user.id,
                actor_name=current_user.name,
                actor_role=current_user.role,
                action="DATABASE_PURGED",
                details=json.dumps({
                    "mode": "purge_operational",
                    "tickets_cleared": tickets_count,
                    "executed_by": current_user.email
                })
            )
            db.add(audit)
            db.commit()

            logger.warning(f"Superadmin {current_user.email} cleared all operational tickets ({tickets_count} deleted).")
            return {
                "success": True,
                "message": f"Successfully purged {tickets_count} tickets and all associated evidence, notes, and logs. Hospital rooms and staff accounts remain intact.",
                "tickets_cleared": tickets_count
            }

        elif payload.mode == "reset_all":
            # Count records before deletion
            tickets_count = db.query(Ticket).count()

            # Nullify ticket references in audit logs first to prevent foreign-key constraints
            try:
                db.execute(text("UPDATE audit_logs SET ticket_id = NULL WHERE ticket_id IS NOT NULL;"))
                db.flush()
            except Exception as e:
                logger.warning(f"Failed to nullify audit_logs.ticket_id: {e}")

            # Delete operational records in strict foreign-key order
            db.query(AIVerificationJob).delete(synchronize_session=False)
            db.query(Evidence).delete(synchronize_session=False)
            db.query(TicketNote).delete(synchronize_session=False)
            db.query(EscalationLog).delete(synchronize_session=False)
            db.query(AuditLog).delete(synchronize_session=False)
            db.flush()
            db.query(Ticket).delete(synchronize_session=False)
            db.flush()

            # Re-seed clean demo records
            seed_demo_tickets(db)

            audit = AuditLog(
                ticket_id=None,
                actor_id=current_user.id,
                actor_name=current_user.name,
                actor_role=current_user.role,
                action="DATABASE_RESET",
                details=json.dumps({
                    "mode": "reset_all",
                    "previous_tickets_cleared": tickets_count,
                    "reseeded_tickets": 5,
                    "executed_by": current_user.email
                })
            )
            db.add(audit)
            db.commit()

            return {
                "success": True,
                "message": f"Database reset completed. Successfully purged {tickets_count} tickets and re-seeded fresh demonstration tickets across all departments.",
                "tickets_cleared": tickets_count
            }

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported clear mode: {payload.mode}"
            )

    except Exception as e:
        db.rollback()
        logger.error(f"Superadmin database clear failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database purge failed: {str(e)}"
        )
