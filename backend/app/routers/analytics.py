from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from app.database import get_db
from app.models import Ticket, Department, AIVerificationJob, EscalationLog, AuditLog, User, DepartmentSupervisor
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics & KPIs"])

def utc_now():
    return datetime.now(timezone.utc)

def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

@router.get("/dashboard")
def get_dashboard_metrics(
    timeframe: str = Query("7d", description="Timeframe: '24h', '7d', '30d', '90d'"),
    department_id: Optional[str] = Query(None, description="Optional department filter (admins/superadmin only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    now = utc_now()
    
    # 1. Determine Timeframe Window
    if timeframe == "24h":
        delta = timedelta(hours=24)
        num_buckets = 6
        bucket_duration = timedelta(hours=4)
        bucket_format = "%H:%M"
    elif timeframe == "30d":
        delta = timedelta(days=30)
        num_buckets = 6
        bucket_duration = timedelta(days=5)
        bucket_format = "%b %d"
    elif timeframe == "90d":
        delta = timedelta(days=90)
        num_buckets = 6
        bucket_duration = timedelta(days=15)
        bucket_format = "%b %d"
    else:  # default "7d"
        delta = timedelta(days=7)
        num_buckets = 7
        bucket_duration = timedelta(days=1)
        bucket_format = "%a"

    period_start = now - delta
    prev_period_start = period_start - delta
    prev_period_end = period_start

    # 2. Enforce Role-Based Scoping & Department Isolation
    user_role = current_user.role
    effective_dept_id = department_id

    # Supervisors can ONLY see their supervised department(s)
    if user_role == "supervisor":
        # Get supervised department IDs
        supervised_depts = [r.department_id for r in db.query(DepartmentSupervisor).filter(DepartmentSupervisor.user_id == current_user.id).all()]
        if current_user.department_id and current_user.department_id not in supervised_depts:
            supervised_depts.append(current_user.department_id)
        
        dept_obj = db.query(Department).filter(Department.supervisor_id == current_user.id).first()
        if dept_obj and dept_obj.id not in supervised_depts:
            supervised_depts.append(dept_obj.id)
            
        if not supervised_depts:
            supervised_depts = [current_user.department_id] if current_user.department_id else []

        if department_id and department_id not in supervised_depts:
            raise HTTPException(status_code=403, detail="Unauthorized access to external department analytics")
        effective_dept_id = department_id or (supervised_depts[0] if supervised_depts else None)

    # Staff can ONLY see their assigned department / assigned tickets
    elif user_role == "staff":
        effective_dept_id = current_user.department_id

    # 3. Base Ticket Query with Scoping
    base_query = db.query(Ticket)
    if effective_dept_id:
        base_query = base_query.filter(Ticket.department_id == effective_dept_id)
    if user_role == "staff":
        # Staff scoped to their own tasks
        base_query = base_query.filter(
            or_(
                Ticket.assigned_staff_id == current_user.id,
                Ticket.department_id == current_user.department_id
            )
        )

    all_tickets = base_query.all()
    open_tickets = [t for t in all_tickets if t.status != "closed"]

    # 4. Calculate 8 Overview KPIs
    total_open = len(open_tickets)
    unacknowledged_count = sum(1 for t in open_tickets if t.status in ["submitted", "assigned"])
    in_progress_count = sum(1 for t in open_tickets if t.status in ["acknowledged", "in_progress"])
    awaiting_verification_count = sum(1 for t in open_tickets if t.status == "resolution_submitted")

    due_soon_count = 0
    overdue_count = 0
    for t in open_tickets:
        if t.sla_resolution_deadline:
            dl = to_utc(t.sla_resolution_deadline)
            if dl < now:
                overdue_count += 1
            elif dl < (now + timedelta(minutes=60)):
                due_soon_count += 1

    # Completed tickets in selected timeframe
    completed_in_period = [
        t for t in all_tickets 
        if t.status == "closed" and t.closed_at and to_utc(t.closed_at) >= period_start
    ]
    completed_count = len(completed_in_period)

    # Average resolution time (minutes)
    if completed_in_period:
        total_res_minutes = sum(
            max(0, (to_utc(ct.closed_at) - to_utc(ct.created_at)).total_seconds() / 60)
            for ct in completed_in_period
            if ct.closed_at and ct.created_at
        )
        avg_res_time = round(total_res_minutes / len(completed_in_period), 1)
    else:
        avg_res_time = 0.0

    # SLA compliance percentage for tickets in scope
    total_tickets_count = len(all_tickets)
    if total_tickets_count > 0:
        non_overdue = max(0, total_tickets_count - overdue_count)
        sla_compliance_rate = round((non_overdue / total_tickets_count) * 100, 1)
    else:
        sla_compliance_rate = 100.0

    # Pending AI verification reviews
    ai_query = db.query(AIVerificationJob).filter(AIVerificationJob.human_decision.is_(None))
    if effective_dept_id:
        ai_query = ai_query.join(Ticket, AIVerificationJob.ticket_id == Ticket.id).filter(Ticket.department_id == effective_dept_id)
    pending_ai = ai_query.count()

    # Previous period comparison for delta KPI badges
    prev_completed = [
        t for t in all_tickets
        if t.status == "closed" and t.closed_at and prev_period_start <= to_utc(t.closed_at) < prev_period_end
    ]
    prev_created = [
        t for t in all_tickets
        if t.created_at and prev_period_start <= to_utc(t.created_at) < prev_period_end
    ]
    curr_created = [
        t for t in all_tickets
        if t.created_at and to_utc(t.created_at) >= period_start
    ]

    def calc_delta_pct(curr: float, prev: float) -> Optional[float]:
        if prev == 0:
            return 100.0 if curr > 0 else 0.0
        return round(((curr - prev) / prev) * 100, 1)

    kpi_comparisons = {
        "created_delta_pct": calc_delta_pct(len(curr_created), len(prev_created)),
        "completed_delta_pct": calc_delta_pct(len(completed_in_period), len(prev_completed)),
    }

    # 5. Required Chart 1 & 7: Time Bucket Trends (Volume Over Time & Incoming vs Resolved)
    buckets = []
    for i in range(num_buckets):
        b_start = period_start + (i * bucket_duration)
        b_end = b_start + bucket_duration
        label = b_start.strftime(bucket_format)
        
        created_b = sum(
            1 for t in all_tickets 
            if t.created_at and b_start <= to_utc(t.created_at) < b_end
        )
        resolved_b = sum(
            1 for t in all_tickets 
            if t.closed_at and b_start <= to_utc(t.closed_at) < b_end
        )
        buckets.append({
            "bucket_index": i,
            "label": label,
            "date": b_start.strftime("%Y-%m-%d"),
            "created": created_b,
            "resolved": resolved_b,
            "total_volume": created_b
        })

    # Backward compatibility volume_trends
    volume_trends = [
        {"day": b["label"], "created": b["created"], "resolved": b["resolved"]}
        for b in buckets
    ]

    # 6. Required Chart 2: Tickets by Department (Open, In-Progress, Overdue, Completed)
    dept_query = db.query(Department).filter(Department.is_active == True)
    if effective_dept_id:
        dept_query = dept_query.filter(Department.id == effective_dept_id)
    departments = dept_query.all()

    chart_tickets_by_department = []
    dept_workload = []
    sla_by_dept = []
    chart_avg_res_by_dept = []

    for d in departments:
        d_tickets = [t for t in all_tickets if t.department_id == d.id]
        d_open = sum(1 for t in d_tickets if t.status in ["submitted", "assigned"])
        d_in_progress = sum(1 for t in d_tickets if t.status in ["acknowledged", "in_progress", "resolution_submitted"])
        d_overdue = sum(
            1 for t in d_tickets 
            if t.status != "closed" and t.sla_resolution_deadline and to_utc(t.sla_resolution_deadline) < now
        )
        d_completed = sum(1 for t in d_tickets if t.status == "closed")
        
        chart_tickets_by_department.append({
            "department_id": d.id,
            "department_name": d.name,
            "code": d.code,
            "open": d_open,
            "in_progress": d_in_progress,
            "overdue": d_overdue,
            "completed": d_completed,
            "total": len(d_tickets)
        })

        dept_workload.append({
            "department_id": d.id,
            "department_name": d.name,
            "code": d.code,
            "count": d_open + d_in_progress + d_overdue
        })

        # SLA compliance rate for this department
        if d_tickets:
            d_compliant = max(0, len(d_tickets) - d_overdue)
            d_rate = round((d_compliant / len(d_tickets)) * 100, 1)
        else:
            d_rate = 100.0
        sla_by_dept.append({
            "department_id": d.id,
            "department_name": d.name,
            "compliance_rate": d_rate
        })

        # Average resolution time for this department
        d_closed = [t for t in d_tickets if t.status == "closed" and t.closed_at and t.created_at]
        if d_closed:
            d_avg_mins = round(
                sum((to_utc(t.closed_at) - to_utc(t.created_at)).total_seconds() / 60 for t in d_closed) / len(d_closed),
                1
            )
        else:
            d_avg_mins = 0.0
        chart_avg_res_by_dept.append({
            "department_id": d.id,
            "department_name": d.name,
            "avg_resolution_minutes": d_avg_mins
        })

    # 7. Required Chart 3: Ticket Status Distribution (Doughnut Chart)
    status_order = [
        ("submitted", "Submitted", "#64748B"),
        ("assigned", "Assigned", "#3B82F6"),
        ("acknowledged", "Acknowledged", "#0284C7"),
        ("in_progress", "In Progress", "#F59E0B"),
        ("resolution_submitted", "Awaiting Verification", "#8B5CF6"),
        ("closed", "Closed / Verified", "#10B981")
    ]
    status_distribution = []
    total_for_status = len(all_tickets)
    for st_key, st_label, st_color in status_order:
        c = sum(1 for t in all_tickets if t.status == st_key)
        pct = round((c / total_for_status) * 100, 1) if total_for_status > 0 else 0.0
        status_distribution.append({
            "status": st_key,
            "label": st_label,
            "count": c,
            "percentage": pct,
            "color": st_color
        })

    # 8. Required Chart 4: SLA Performance (Compliant vs Breached)
    breached_count = overdue_count
    compliant_count = max(0, total_tickets_count - breached_count)
    
    # SLA breakdown by priority
    priority_sla = []
    for prio in ["critical", "high", "medium", "low"]:
        prio_tickets = [t for t in all_tickets if t.priority == prio]
        prio_overdue = sum(
            1 for t in prio_tickets 
            if t.status != "closed" and t.sla_resolution_deadline and to_utc(t.sla_resolution_deadline) < now
        )
        prio_compliant = max(0, len(prio_tickets) - prio_overdue)
        priority_sla.append({
            "priority": prio,
            "total": len(prio_tickets),
            "compliant": prio_compliant,
            "breached": prio_overdue,
            "compliance_rate": round((prio_compliant / len(prio_tickets)) * 100, 1) if prio_tickets else 100.0
        })

    sla_performance = {
        "compliant_count": compliant_count,
        "breached_count": breached_count,
        "compliance_rate": sla_compliance_rate,
        "by_priority": priority_sla
    }

    # 9. Required Chart 6: Workload Distribution (Assigned vs Unassigned & Staff Workload)
    unassigned_tickets = sum(1 for t in open_tickets if not t.assigned_staff_id)
    assigned_tickets = sum(1 for t in open_tickets if t.assigned_staff_id)

    # Individual staff workload if authorized
    staff_workload_list = []
    if user_role in ["admin", "superadmin", "supervisor"]:
        staff_query = db.query(User).filter(User.role == "staff", User.is_active == True)
        if effective_dept_id:
            staff_query = staff_query.filter(User.department_id == effective_dept_id)
        staff_members = staff_query.all()
        for sm in staff_members:
            active_tasks = sum(1 for t in open_tickets if t.assigned_staff_id == sm.id)
            completed_tasks = sum(1 for t in all_tickets if t.assigned_staff_id == sm.id and t.status == "closed")
            staff_workload_list.append({
                "staff_id": sm.id,
                "name": sm.name,
                "email": sm.email,
                "department_id": sm.department_id,
                "active_tasks": active_tasks,
                "completed_tasks": completed_tasks
            })
        staff_workload_list.sort(key=lambda x: x["active_tasks"], reverse=True)

    workload_distribution = {
        "assigned_tickets": assigned_tickets,
        "unassigned_tickets": unassigned_tickets,
        "staff_workload": staff_workload_list[:10]
    }

    # 10. Priority Overdue Tickets List
    overdue_list = []
    for t in open_tickets:
        if t.sla_resolution_deadline:
            dl = to_utc(t.sla_resolution_deadline)
            if dl < now:
                overdue_list.append({
                    "id": t.id,
                    "ticket_number": t.ticket_number,
                    "title": t.title,
                    "room_number": t.room_number,
                    "department_id": t.department_id,
                    "priority": t.priority,
                    "status": t.status,
                    "sla_resolution_deadline": dl.isoformat(),
                    "minutes_overdue": int((now - dl).total_seconds() / 60)
                })
    overdue_list.sort(key=lambda x: x["minutes_overdue"], reverse=True)

    # 11. System Health Indicators for Superadmin/Admin
    system_health = {
        "status": "healthy" if overdue_count < 5 else "attention_required",
        "total_active_staff": len(staff_workload_list) if staff_workload_list else db.query(User).filter(User.role == "staff", User.is_active == True).count(),
        "total_departments": len(departments),
        "ai_queue_length": pending_ai,
        "server_time_utc": now.isoformat()
    }

    return {
        # Core 8 KPIs
        "kpis": {
            "total_open_tickets": total_open,
            "unacknowledged_tickets": unacknowledged_count,
            "in_progress_tickets": in_progress_count,
            "overdue_tickets": overdue_count,
            "awaiting_verification": awaiting_verification_count,
            "completed_tickets": completed_count,
            "avg_resolution_time_minutes": avg_res_time,
            "sla_compliance_rate": sla_compliance_rate,
            "tickets_due_soon": due_soon_count,
            "pending_ai_verifications": pending_ai,
            "comparisons": kpi_comparisons
        },
        # 7 High-Fidelity Charts
        "charts": {
            "volume_over_time": buckets,
            "tickets_by_department": chart_tickets_by_department,
            "status_distribution": status_distribution,
            "sla_performance": sla_performance,
            "avg_resolution_time_by_department": chart_avg_res_by_dept,
            "workload_distribution": workload_distribution,
            "ticket_trends": buckets
        },
        # Backward-compatible structures
        "department_workload": dept_workload,
        "sla_by_department": sla_by_dept,
        "volume_trends": volume_trends,
        "priority_overdue": overdue_list[:10],
        "system_health": system_health,
        "scoped_department": effective_dept_id,
        "timeframe": timeframe
    }
