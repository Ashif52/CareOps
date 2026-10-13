import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, or_, desc

from app.database import get_db
from app.models import (
    User, Ticket, Evidence, AIVerificationJob, TicketNote,
    EscalationLog, AuditLog, Department, Room, SLAPolicy,
    NPSResponse, WhatsAppMessage, MaintenanceAuditLog, SystemSecuritySetting
)
from app.services.auth_service import require_roles, get_current_user, get_password_hash
from app.services.rbac_service import (
    get_user_permissions, get_role_permissions, get_permission_matrix_catalog,
    PERMISSIONS_CATALOG
)

logger = logging.getLogger("careops.system")
router = APIRouter(prefix="/system", tags=["System & Superadmin"])

# ==============================================================================
# PYDANTIC SCHEMAS FOR SUPERADMIN OPERATIONS
# ==============================================================================

class MaintenancePreviewRequest(BaseModel):
    categories: List[str]

class MaintenancePurgeRequest(BaseModel):
    categories: List[str]
    confirm_phrase: str  # Must match "CONFIRM_CLEAR"

class AdminCreateRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    designation: Optional[str] = "Hospital Administrator"
    password: Optional[str] = "CareOpsAdmin2026!"
    permissions: Optional[List[str]] = None

class AdminUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None

class AdminPermissionsUpdateRequest(BaseModel):
    permissions: List[str]

class SecuritySettingsUpdateRequest(BaseModel):
    max_failed_logins: Optional[int] = 3
    lockout_duration_minutes: Optional[int] = 30
    session_timeout_minutes: Optional[int] = 60
    require_password_symbols: Optional[bool] = True
    require_password_min_length: Optional[int] = 8
    whatsapp_provider: Optional[str] = "meta_business_api"
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None
    whatsapp_api_token: Optional[str] = None
    ai_vision_provider: Optional[str] = "mock"
    ai_vision_model: Optional[str] = "careops-vision-default"
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None


# ==============================================================================
# 1. DATABASE MAINTENANCE & DEMO CLEARING (SUPERADMIN ONLY)
# ==============================================================================

VALID_CATEGORIES = {
    "demo_patients": "Demo patients and synthetic patient submissions",
    "demo_tickets": "Demo tickets and ticket status history",
    "demo_notifications": "Demo WhatsApp notifications and delivery logs",
    "demo_nps": "Demo NPS & patient experience responses",
    "demo_analytics": "Demo analytics, generated test records and alerts",
    "demo_ai_verifications": "Demo AI vision analyses and synthetic verification jobs"
}

def _get_category_counts(db: Session) -> Dict[str, int]:
    # Tickets flagged as demo or matching demo prefix
    demo_tickets_query = db.query(Ticket).filter(
        or_(Ticket.is_demo == True, Ticket.ticket_number.like("TKT-%-00%"))
    )
    demo_ticket_ids = [t.id for t in demo_tickets_query.all()]

    counts = {
        "demo_patients": db.query(Room).filter(Room.is_demo == True).count() or len(demo_ticket_ids),
        "demo_tickets": len(demo_ticket_ids),
        "demo_notifications": db.query(WhatsAppMessage).filter(
            or_(WhatsAppMessage.is_demo == True, WhatsAppMessage.ticket_id.in_(demo_ticket_ids))
        ).count(),
        "demo_nps": db.query(NPSResponse).filter(
            or_(NPSResponse.is_demo == True, NPSResponse.ticket_id.in_(demo_ticket_ids))
        ).count(),
        "demo_analytics": db.query(EscalationLog).filter(EscalationLog.ticket_id.in_(demo_ticket_ids)).count(),
        "demo_ai_verifications": db.query(AIVerificationJob).filter(
            or_(AIVerificationJob.is_demo == True, AIVerificationJob.ticket_id.in_(demo_ticket_ids))
        ).count()
    }
    return counts

@router.post("/maintenance/preview")
def preview_maintenance_clearing(
    payload: MaintenancePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """
    SUPERADMIN-ONLY:
    Calculates eligible record counts before any destructive action.
    Explains dependencies and guarantees retention of protected production data.
    """
    counts = _get_category_counts(db)
    selected_counts = {}
    total_affected = 0

    for cat in payload.categories:
        if cat in counts:
            c = counts[cat]
            selected_counts[cat] = {
                "label": VALID_CATEGORIES.get(cat, cat),
                "count": c
            }
            total_affected += c

    return {
        "selected_categories": payload.categories,
        "affected_counts": selected_counts,
        "total_records_affected": total_affected,
        "dependencies_explanation": (
            "Clearing demo data will safely cascade through child records (evidence, notes, delivery logs). "
            "Staff accounts, hospital rooms, production patient data, legal retention records, and immutable audit logs "
            "will be strictly preserved."
        ),
        "required_confirmation_phrase": "CONFIRM_CLEAR"
    }

@router.post("/maintenance/purge")
def execute_maintenance_clearing(
    payload: MaintenancePurgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """
    SUPERADMIN-ONLY:
    Safely purges ONLY the selected demo/test categories in an atomic transaction.
    Requires explicit typed confirmation phrase 'CONFIRM_CLEAR'.
    Creates a durable audit log.
    """
    if payload.confirm_phrase != "CONFIRM_CLEAR":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation phrase mismatch. You must explicitly type 'CONFIRM_CLEAR' to confirm this operation."
        )

    if not payload.categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data categories selected for maintenance."
        )

    counts_before = _get_category_counts(db)
    purged_counts = {}

    try:
        # Find demo ticket IDs
        demo_tickets = db.query(Ticket).filter(
            or_(Ticket.is_demo == True, Ticket.ticket_number.like("TKT-%-00%"))
        ).all()
        demo_ticket_ids = [t.id for t in demo_tickets]

        if "demo_ai_verifications" in payload.categories:
            ai_q = db.query(AIVerificationJob).filter(
                or_(AIVerificationJob.is_demo == True, AIVerificationJob.ticket_id.in_(demo_ticket_ids))
            )
            count = ai_q.count()
            ai_q.delete(synchronize_session=False)
            purged_counts["demo_ai_verifications"] = count

        if "demo_notifications" in payload.categories:
            wm_q = db.query(WhatsAppMessage).filter(
                or_(WhatsAppMessage.is_demo == True, WhatsAppMessage.ticket_id.in_(demo_ticket_ids))
            )
            count = wm_q.count()
            wm_q.delete(synchronize_session=False)
            purged_counts["demo_notifications"] = count

        if "demo_nps" in payload.categories:
            nps_q = db.query(NPSResponse).filter(
                or_(NPSResponse.is_demo == True, NPSResponse.ticket_id.in_(demo_ticket_ids))
            )
            count = nps_q.count()
            nps_q.delete(synchronize_session=False)
            purged_counts["demo_nps"] = count

        if "demo_analytics" in payload.categories:
            esc_q = db.query(EscalationLog).filter(EscalationLog.ticket_id.in_(demo_ticket_ids))
            count = esc_q.count()
            esc_q.delete(synchronize_session=False)
            purged_counts["demo_analytics"] = count

        if "demo_tickets" in payload.categories:
            # Delete child evidence and notes for demo tickets first
            if demo_ticket_ids:
                db.query(Evidence).filter(Evidence.ticket_id.in_(demo_ticket_ids)).delete(synchronize_session=False)
                db.query(TicketNote).filter(TicketNote.ticket_id.in_(demo_ticket_ids)).delete(synchronize_session=False)
                # Nullify audit log foreign keys for demo tickets to preserve audit trails
                try:
                    db.execute(text("UPDATE audit_logs SET ticket_id = NULL WHERE ticket_id IN :ids"), {"ids": tuple(demo_ticket_ids)})
                except Exception:
                    pass
                t_count = len(demo_ticket_ids)
                db.query(Ticket).filter(Ticket.id.in_(demo_ticket_ids)).delete(synchronize_session=False)
                purged_counts["demo_tickets"] = t_count

        if "demo_patients" in payload.categories:
            demo_rooms = db.query(Room).filter(Room.is_demo == True)
            r_count = demo_rooms.count()
            demo_rooms.delete(synchronize_session=False)
            purged_counts["demo_patients"] = r_count

        db.flush()

        # Record durable maintenance audit log
        m_audit = MaintenanceAuditLog(
            actor_id=current_user.id,
            actor_name=current_user.name,
            selected_categories=json.dumps(payload.categories),
            affected_counts=json.dumps(purged_counts),
            confirmation_phrase=payload.confirm_phrase,
            status="completed"
        )
        db.add(m_audit)

        # Also add general AuditLog
        audit = AuditLog(
            action="SUPERADMIN_DATABASE_MAINTENANCE_PURGE",
            actor_id=current_user.id,
            actor_name=current_user.name,
            actor_role="superadmin",
            details=json.dumps({
                "purged_categories": payload.categories,
                "purged_counts": purged_counts,
                "executed_by": current_user.email
            })
        )
        db.add(audit)
        db.commit()

        return {
            "success": True,
            "message": "Database maintenance completed successfully. Specified categories cleared safely.",
            "purged_counts": purged_counts,
            "timestamp": m_audit.created_at.isoformat()
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Maintenance purge failed: {e}")
        # Log failure audit
        try:
            fail_audit = MaintenanceAuditLog(
                actor_id=current_user.id,
                actor_name=current_user.name,
                selected_categories=json.dumps(payload.categories),
                affected_counts=json.dumps({"error": str(e)}),
                confirmation_phrase=payload.confirm_phrase,
                status="failed"
            )
            db.add(fail_audit)
            db.commit()
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database maintenance operation failed: {str(e)}"
        )


# ==============================================================================
# 2. ADMIN ACCOUNT MANAGEMENT (SUPERADMIN ONLY)
# ==============================================================================

@router.get("/admins")
def list_admin_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: List all Admin accounts and their configured permissions."""
    admins = db.query(User).filter(User.role == "admin").all()
    results = []
    for a in admins:
        perms = get_user_permissions(a)
        results.append({
            "id": a.id,
            "name": a.name,
            "email": a.email,
            "phone": a.phone,
            "designation": a.designation,
            "employee_id": a.employee_id,
            "account_status": a.account_status,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
            "permissions_count": len(perms),
            "permissions": perms
        })
    return results

@router.post("/admins")
def create_admin_account(
    payload: AdminCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Create a new operational Admin account."""
    clean_email = payload.email.lower().strip()
    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(status_code=400, detail=f"Account with email '{clean_email}' already exists.")

    emp_id = f"EMP-ADM-{db.query(User).filter(User.role == 'admin').count() + 1:04d}"
    pw_hash = get_password_hash(payload.password or "CareOpsAdmin2026!")

    # Safe default permissions if none provided
    initial_perms = payload.permissions if payload.permissions is not None else get_role_permissions("admin")

    new_admin = User(
        name=payload.name.strip(),
        email=clean_email,
        phone=payload.phone.strip() if payload.phone else None,
        designation=payload.designation or "Hospital Administrator",
        employee_id=emp_id,
        role="admin",
        account_status="active",
        is_active=True,
        hashed_password=pw_hash,
        permissions_override=json.dumps(initial_perms),
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
    )
    db.add(new_admin)
    db.flush()

    audit = AuditLog(
        action="SUPERADMIN_CREATED_ADMIN",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="superadmin",
        details=json.dumps({
            "created_admin_id": new_admin.id,
            "email": new_admin.email,
            "permissions_count": len(initial_perms)
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(new_admin)

    return {
        "success": True,
        "admin": {
            "id": new_admin.id,
            "name": new_admin.name,
            "email": new_admin.email,
            "employee_id": new_admin.employee_id,
            "account_status": new_admin.account_status,
            "permissions": initial_perms
        }
    }

@router.put("/admins/{admin_id}")
def update_admin_account(
    admin_id: int,
    payload: AdminUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Edit details of an Admin account."""
    admin = db.query(User).filter(User.id == admin_id, User.role == "admin").first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    if payload.name:
        admin.name = payload.name.strip()
    if payload.phone is not None:
        admin.phone = payload.phone.strip() if payload.phone else None
    if payload.designation:
        admin.designation = payload.designation.strip()
    if payload.email:
        clean_email = payload.email.lower().strip()
        existing = db.query(User).filter(User.email == clean_email, User.id != admin.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered to another account.")
        admin.email = clean_email

    audit = AuditLog(
        action="SUPERADMIN_UPDATED_ADMIN",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="superadmin",
        details=json.dumps({"updated_admin_id": admin.id, "email": admin.email})
    )
    db.add(audit)
    db.commit()
    db.refresh(admin)

    return {
        "success": True,
        "admin": {
            "id": admin.id,
            "name": admin.name,
            "email": admin.email,
            "phone": admin.phone,
            "designation": admin.designation,
            "account_status": admin.account_status
        }
    }

@router.post("/admins/{admin_id}/activate")
def activate_admin_account(
    admin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Activate an Admin account."""
    admin = db.query(User).filter(User.id == admin_id, User.role == "admin").first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    admin.is_active = True
    admin.account_status = "active"

    audit = AuditLog(
        action="SUPERADMIN_ACTIVATED_ADMIN",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="superadmin",
        details=json.dumps({"target_admin_id": admin.id, "email": admin.email})
    )
    db.add(audit)
    db.commit()
    return {"success": True, "message": f"Admin account '{admin.email}' activated."}

@router.post("/admins/{admin_id}/deactivate")
def deactivate_admin_account(
    admin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Deactivate an Admin account."""
    admin = db.query(User).filter(User.id == admin_id, User.role == "admin").first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    active_admins = db.query(User).filter(User.role == "admin", User.is_active == True, User.id != admin.id).count()
    if active_admins == 0:
        raise HTTPException(status_code=400, detail="Cannot deactivate the last active Admin account in the hospital system.")

    admin.is_active = False
    admin.account_status = "inactive"

    audit = AuditLog(
        action="SUPERADMIN_DEACTIVATED_ADMIN",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="superadmin",
        details=json.dumps({"target_admin_id": admin.id, "email": admin.email})
    )
    db.add(audit)
    db.commit()
    return {"success": True, "message": f"Admin account '{admin.email}' deactivated."}

@router.get("/admins/{admin_id}/permissions")
def get_admin_permissions(
    admin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Retrieve full permission matrix and active permissions for an Admin."""
    admin = db.query(User).filter(User.id == admin_id, User.role == "admin").first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    effective_perms = get_user_permissions(admin)
    matrix_catalog = get_permission_matrix_catalog(is_superadmin=False)

    return {
        "admin_id": admin.id,
        "admin_name": admin.name,
        "admin_email": admin.email,
        "effective_permissions": effective_perms,
        "matrix_catalog": matrix_catalog
    }

@router.put("/admins/{admin_id}/permissions")
def set_admin_permissions(
    admin_id: int,
    payload: AdminPermissionsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Save persistent permission matrix configuration for an Admin."""
    admin = db.query(User).filter(User.id == admin_id, User.role == "admin").first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found.")

    # Validate that admin cannot be granted superadmin-only permissions
    forbidden_for_admin = {"db_maintenance.execute", "admin.create", "admin.deactivate", "admin.permissions_manage"}
    sanitized_perms = [p for p in payload.permissions if p not in forbidden_for_admin]

    admin.permissions_override = json.dumps(sanitized_perms)

    audit = AuditLog(
        action="SUPERADMIN_CONFIGURED_ADMIN_PERMISSIONS",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="superadmin",
        details=json.dumps({
            "target_admin_id": admin.id,
            "email": admin.email,
            "permissions_count": len(sanitized_perms),
            "permissions": sanitized_perms
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(admin)

    return {
        "success": True,
        "message": f"Updated permissions for Admin '{admin.name}'.",
        "effective_permissions": get_user_permissions(admin)
    }


# ==============================================================================
# 3. SYSTEM SECURITY SETTINGS (SUPERADMIN ONLY)
# ==============================================================================

@router.get("/security-settings")
def get_security_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Fetch current system-level security controls."""
    settings_row = db.query(SystemSecuritySetting).first()
    if not settings_row:
        settings_row = SystemSecuritySetting(id=1)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)

    return {
        "max_failed_logins": settings_row.max_failed_logins,
        "lockout_duration_minutes": settings_row.lockout_duration_minutes,
        "session_timeout_minutes": settings_row.session_timeout_minutes,
        "require_password_symbols": settings_row.require_password_symbols,
        "require_password_min_length": settings_row.require_password_min_length,
        "whatsapp_provider": settings_row.whatsapp_provider,
        "whatsapp_phone_number_id": settings_row.whatsapp_phone_number_id or "",
        "whatsapp_has_token": bool(settings_row.whatsapp_api_token),
        "ai_vision_provider": settings_row.ai_vision_provider,
        "ai_vision_model": settings_row.ai_vision_model,
        "has_openai_key": bool(settings_row.openai_api_key),
        "has_gemini_key": bool(settings_row.gemini_api_key),
        "has_anthropic_key": bool(settings_row.anthropic_api_key),
        "updated_at": settings_row.updated_at.isoformat() if settings_row.updated_at else None
    }

@router.put("/security-settings")
def update_security_settings(
    payload: SecuritySettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Update system-level security controls."""
    settings_row = db.query(SystemSecuritySetting).first()
    if not settings_row:
        settings_row = SystemSecuritySetting(id=1)
        db.add(settings_row)

    if payload.max_failed_logins is not None:
        settings_row.max_failed_logins = payload.max_failed_logins
    if payload.lockout_duration_minutes is not None:
        settings_row.lockout_duration_minutes = payload.lockout_duration_minutes
    if payload.session_timeout_minutes is not None:
        settings_row.session_timeout_minutes = payload.session_timeout_minutes
    if payload.require_password_symbols is not None:
        settings_row.require_password_symbols = payload.require_password_symbols
    if payload.require_password_min_length is not None:
        settings_row.require_password_min_length = payload.require_password_min_length
    if payload.whatsapp_provider:
        settings_row.whatsapp_provider = payload.whatsapp_provider
    if payload.whatsapp_phone_number_id is not None:
        settings_row.whatsapp_phone_number_id = payload.whatsapp_phone_number_id
    if payload.whatsapp_api_token:
        settings_row.whatsapp_api_token = payload.whatsapp_api_token
    if payload.ai_vision_provider:
        settings_row.ai_vision_provider = payload.ai_vision_provider
    if payload.ai_vision_model:
        settings_row.ai_vision_model = payload.ai_vision_model
    if payload.openai_api_key:
        settings_row.openai_api_key = payload.openai_api_key
    if payload.gemini_api_key:
        settings_row.gemini_api_key = payload.gemini_api_key
    if payload.anthropic_api_key:
        settings_row.anthropic_api_key = payload.anthropic_api_key

    audit = AuditLog(
        action="SUPERADMIN_UPDATED_SECURITY_SETTINGS",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="superadmin",
        details=json.dumps({"provider": settings_row.ai_vision_provider, "model": settings_row.ai_vision_model})
    )
    db.add(audit)
    db.commit()
    db.refresh(settings_row)

    return {"success": True, "message": "System security settings updated successfully."}


# ==============================================================================
# 4. PRIVILEGED AUDIT LOGS (SUPERADMIN ONLY)
# ==============================================================================

@router.get("/audit-logs")
def get_superadmin_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("superadmin"))
):
    """SUPERADMIN-ONLY: Privileged audit trails for administrative actions."""
    logs = db.query(AuditLog).filter(
        or_(
            AuditLog.actor_role == "superadmin",
            AuditLog.action.like("SUPERADMIN_%"),
            AuditLog.action.like("ACCOUNT_%"),
            AuditLog.action.like("STAFF_%")
        )
    ).order_by(desc(AuditLog.created_at)).limit(limit).all()

    maintenance_logs = db.query(MaintenanceAuditLog).order_by(desc(MaintenanceAuditLog.created_at)).limit(limit).all()

    return {
        "admin_actions": [
            {
                "id": l.id,
                "action": l.action,
                "actor_name": l.actor_name,
                "actor_role": l.actor_role,
                "details": l.details,
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in logs
        ],
        "maintenance_clearing_history": [
            {
                "id": m.id,
                "actor_name": m.actor_name,
                "selected_categories": json.loads(m.selected_categories) if m.selected_categories else [],
                "affected_counts": json.loads(m.affected_counts) if m.affected_counts else {},
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in maintenance_logs
        ]
    }
