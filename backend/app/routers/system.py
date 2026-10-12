from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import logging

from app.database import get_db
from app.models import (
    User, Ticket, Evidence, AIVerificationJob, TicketNote,
    EscalationLog, AuditLog, Department, Room, SLAPolicy
)
from app.services.auth_service import require_roles, get_current_user

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
            # Count records before deletion
            tickets_count = db.query(Ticket).count()

            # Delete children entities first to preserve relational integrity
            db.query(AIVerificationJob).delete(synchronize_session=False)
            db.query(Evidence).delete(synchronize_session=False)
            db.query(TicketNote).delete(synchronize_session=False)
            db.query(EscalationLog).delete(synchronize_session=False)
            db.query(Ticket).delete(synchronize_session=False)
            db.query(AuditLog).delete(synchronize_session=False)

            # Record audit ledger entry documenting superadmin purge
            audit = AuditLog(
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                action="database_purged",
                entity_type="system",
                entity_id="database",
                details=f"Superadmin {current_user.email} executed operational database purge ({tickets_count} tickets removed)."
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
            # Purge operational records
            tickets_count = db.query(Ticket).count()
            db.query(AIVerificationJob).delete(synchronize_session=False)
            db.query(Evidence).delete(synchronize_session=False)
            db.query(TicketNote).delete(synchronize_session=False)
            db.query(EscalationLog).delete(synchronize_session=False)
            db.query(Ticket).delete(synchronize_session=False)
            db.query(AuditLog).delete(synchronize_session=False)

            # Re-seed clean demo records
            from app.seed import seed_database
            seed_database()

            audit = AuditLog(
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                action="database_reset",
                entity_type="system",
                entity_id="database",
                details=f"Superadmin {current_user.email} reset database to baseline demo state."
            )
            db.add(audit)
            db.commit()

            return {
                "success": True,
                "message": "Database reset completed with clean seed state restored.",
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
