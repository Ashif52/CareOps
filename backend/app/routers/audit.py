import json
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import AuditLog, User
from app.schemas import AuditLogResponse
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    ticket_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(require_roles("admin", "supervisor")),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if ticket_id:
        query = query.filter(AuditLog.ticket_id == ticket_id)
        
    logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()
    results = []
    for log in logs:
        try:
            details_parsed = json.loads(log.details) if log.details else {}
        except Exception:
            details_parsed = log.details
            
        results.append({
            "id": log.id,
            "ticket_id": log.ticket_id,
            "action": log.action,
            "actor_id": log.actor_id,
            "actor_name": log.actor_name,
            "actor_role": log.actor_role,
            "details": details_parsed,
            "created_at": log.created_at
        })
    return results
