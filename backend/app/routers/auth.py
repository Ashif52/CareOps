import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, AuditLog
from app.schemas import LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import verify_password, create_access_token, get_current_user
from app.services.rbac_service import get_user_permissions

router = APIRouter(prefix="/auth", tags=["Authentication"])

def utc_now():
    return datetime.now(timezone.utc)

@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    email_clean = creds.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    
    # Generic rejection for unknown user to prevent enumeration
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 1. Check if account is locked
    if getattr(user, "account_status", "active") == "locked" or (user.failed_login_attempts and user.failed_login_attempts >= 3):
        # Record security event
        audit = AuditLog(
            action="LOGIN_REJECTED_LOCKED_ACCOUNT",
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            details=json.dumps({
                "email": user.email,
                "reason": "Login rejected because account is in locked state",
                "locked_at": str(user.locked_at) if user.locked_at else None
            })
        )
        db.add(audit)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is locked due to consecutive failed authentication attempts. Please contact a hospital administrator to unlock."
        )
        
    # 2. Check if account is inactive
    if not user.is_active or getattr(user, "account_status", "active") == "inactive":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact hospital administration."
        )
        
    # 3. Verify password
    if not verify_password(creds.password, user.hashed_password):
        # Atomic server-side increment of failed attempts
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        failures = user.failed_login_attempts
        
        if failures >= 3:
            user.account_status = "locked"
            user.locked_at = utc_now()
            user.locked_reason = "Exceeded 3 consecutive failed authentication attempts"
            
            audit = AuditLog(
                action="ACCOUNT_LOCKED_AUTO",
                actor_id=user.id,
                actor_name=user.name,
                actor_role=user.role,
                details=json.dumps({
                    "email": user.email,
                    "consecutive_failures": failures,
                    "threshold": 3,
                    "locked_at": str(user.locked_at)
                })
            )
            db.add(audit)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account has been locked after 3 consecutive failed login attempts. Please contact a hospital administrator to unlock."
            )
        else:
            audit = AuditLog(
                action="LOGIN_FAILED",
                actor_id=user.id,
                actor_name=user.name,
                actor_role=user.role,
                details=json.dumps({
                    "email": user.email,
                    "consecutive_failures": failures,
                    "attempts_remaining": 3 - failures
                })
            )
            db.add(audit)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid email or password. Attempt {failures} of 3 before account lockout.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    # 4. Authentication Succeeded!
    # Reset failure counter and update last login
    user.failed_login_attempts = 0
    user.last_login_at = utc_now()
    db.commit()
    
    token = create_access_token(data={"sub": str(user.id), "role": user.role, "dept": user.department_id})
    user_perms = get_user_permissions(user)
    
    user_dict = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "department_id": user.department_id,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "employee_id": user.employee_id,
        "designation": user.designation,
        "account_status": user.account_status,
        "failed_login_attempts": user.failed_login_attempts,
        "locked_at": user.locked_at,
        "locked_reason": user.locked_reason,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "permissions": user_perms
    }
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_dict
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    user_perms = get_user_permissions(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "department_id": current_user.department_id,
        "phone": current_user.phone,
        "avatar_url": current_user.avatar_url,
        "is_active": current_user.is_active,
        "employee_id": current_user.employee_id,
        "designation": current_user.designation,
        "account_status": current_user.account_status,
        "failed_login_attempts": current_user.failed_login_attempts,
        "locked_at": current_user.locked_at,
        "locked_reason": current_user.locked_reason,
        "last_login_at": current_user.last_login_at,
        "created_at": current_user.created_at,
        "permissions": user_perms
    }

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """Returns quick login credentials for demonstration and role workspace testing"""
    users = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "id": u.id,
            "employee_id": u.employee_id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "department_id": u.department_id,
            "designation": u.designation,
            "account_status": u.account_status,
            "demo_password": "password123"
        }
        for u in users
    ]
