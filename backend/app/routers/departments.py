from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Department, User, Ticket
from app.schemas import DepartmentResponse, DepartmentCreate
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/departments", tags=["Departments & Staff"])

@router.get("", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db)):
    departments = db.query(Department).filter(Department.is_active == True).all()
    results = []
    for d in departments:
        active_tkt_count = db.query(Ticket).filter(
            Ticket.department_id == d.id,
            Ticket.status != "closed"
        ).count()
        staff_count = db.query(User).filter(
            User.department_id == d.id,
            User.is_active == True
        ).count()
        
        results.append({
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "description": d.description,
            "icon": d.icon,
            "supervisor_id": d.supervisor_id,
            "is_active": d.is_active,
            "created_at": d.created_at,
            "active_ticket_count": active_tkt_count,
            "staff_count": staff_count
        })
    return results

@router.post("", response_model=DepartmentResponse)
def create_department(
    payload: DepartmentCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    existing = db.query(Department).filter(Department.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department with this ID already exists")
        
    dept = Department(
        id=payload.id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        icon=payload.icon,
        supervisor_id=payload.supervisor_id,
        is_active=payload.is_active
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/{department_id}/staff")
def get_department_staff(department_id: str, db: Session = Depends(get_db)):
    staff = db.query(User).filter(
        User.department_id == department_id,
        User.is_active == True
    ).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "role": s.role,
            "phone": s.phone,
            "avatar_url": s.avatar_url
        }
        for s in staff
    ]
