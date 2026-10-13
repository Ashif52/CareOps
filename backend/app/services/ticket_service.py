from datetime import datetime, timezone, timedelta
import json
import secrets
import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models import (
    Ticket, User, Department, Room, Evidence, AIVerificationJob,
    TicketNote, AuditLog, SLAPolicy
)
from app.services.sla_engine import SLAEngine
from app.services.whatsapp_service import WhatsAppService

def utc_now():
    return datetime.now(timezone.utc)

def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

class TicketService:
    @staticmethod
    def generate_ticket_number(db: Session, dept_code: str) -> str:
        count = db.query(Ticket).count() + 1
        return f"TKT-{dept_code.upper()}-{count:04d}"

    @staticmethod
    def auto_assign_staff(db: Session, department_id: str) -> Optional[User]:
        """Finds active staff member with lowest active ticket load in the given department"""
        active_staff = db.query(User).filter(
            User.department_id == department_id,
            User.role == "staff",
            User.is_active == True
        ).all()
        
        if not active_staff:
            return None
            
        least_busy_staff = None
        lowest_count = float("inf")
        
        for staff in active_staff:
            active_count = db.query(Ticket).filter(
                Ticket.assigned_staff_id == staff.id,
                Ticket.status.in_(["assigned", "acknowledged", "in_progress"])
            ).count()
            if active_count < lowest_count:
                lowest_count = active_count
                least_busy_staff = staff
                
        return least_busy_staff

    @staticmethod
    def create_patient_ticket(
        db: Session,
        room: Room,
        department: Department,
        category: str,
        description: str,
        voice_url: Optional[str] = None,
        voice_transcription: Optional[str] = None,
        patient_contact: Optional[str] = None,
        photo_url: Optional[str] = None
    ) -> Ticket:
        """Creates a ticket submitted by a patient from a room QR code with tracking token and WhatsApp notification"""
        priority = "high" if department.id in ["medical", "doctors", "nursing"] else "medium"
        ack_dl, res_dl = SLAEngine.calculate_deadlines(db, department.id, priority)
        
        ticket_number = TicketService.generate_ticket_number(db, department.code)
        assigned_staff = TicketService.auto_assign_staff(db, department.id)
        
        initial_status = "assigned" if assigned_staff else "submitted"
        tracking_token = secrets.token_urlsafe(16)
        
        ticket = Ticket(
            ticket_number=ticket_number,
            title=f"{category} Issue - {room.room_number}",
            description=description,
            voice_recording_url=voice_url,
            voice_transcription=voice_transcription,
            department_id=department.id,
            room_id=room.id,
            room_number=room.room_number,
            category=category,
            priority=priority,
            status=initial_status,
            assigned_staff_id=assigned_staff.id if assigned_staff else None,
            assigned_supervisor_id=department.supervisor_id,
            assigned_at=utc_now() if assigned_staff else None,
            sla_acknowledgement_deadline=ack_dl,
            sla_resolution_deadline=res_dl,
            patient_contact=patient_contact,
            patient_tracking_token=tracking_token,
            is_demo=getattr(room, "is_demo", False)
        )
        db.add(ticket)
        db.flush()
        
        # Save photo if provided as initial before-evidence
        if photo_url:
            evidence = Evidence(
                ticket_id=ticket.id,
                stage="before",
                media_type="image",
                file_url=photo_url,
                equipment_type=category,
                notes="Patient submitted photo at ticket creation",
                is_demo=ticket.is_demo
            )
            db.add(evidence)
            
        # Initial patient-visible progress note
        welcome_note = TicketNote(
            ticket_id=ticket.id,
            author_name="CareOps System",
            content=f"Request registered for {department.name}. Assigned to care team.",
            is_internal=False
        )
        db.add(welcome_note)
        
        # Audit log
        audit = AuditLog(
            ticket_id=ticket.id,
            action="TICKET_CREATED_PATIENT_QR",
            actor_name=f"Patient ({room.room_number})",
            actor_role="patient",
            details=json.dumps({
                "room": room.room_number,
                "category": category,
                "assigned_staff": assigned_staff.name if assigned_staff else "Unassigned",
                "patient_contact": patient_contact
            })
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)

        # Trigger WhatsApp Event 1: Complaint created
        tracking_url = f"/track/{ticket.ticket_number}?token={ticket.patient_tracking_token}"
        try:
            WhatsAppService.on_complaint_created(db, ticket, tracking_url)
            if assigned_staff:
                WhatsAppService.on_ticket_assigned(db, ticket, assigned_staff)
        except Exception:
            pass

        return ticket

    @staticmethod
    def acknowledge_ticket(db: Session, ticket: Ticket, user: User, note: Optional[str] = None) -> Ticket:
        # Idempotent
        if ticket.status in ["acknowledged", "in_progress", "resolution_submitted", "closed"]:
            return ticket

        if ticket.status not in ["submitted", "assigned"]:
            raise HTTPException(status_code=400, detail=f"Cannot acknowledge ticket in '{ticket.status}' status")
            
        now = utc_now()
        ticket.status = "acknowledged"
        ticket.acknowledged_at = now
        ticket.assigned_staff_id = user.id

        # Calculate estimated arrival time: active after acknowledgement
        eta_minutes = 15  # Default arrival SLA
        if ticket.sla_acknowledgement_deadline and ticket.sla_resolution_deadline:
            # Dynamically compute based on remaining resolution time or queue
            remaining_mins = max(10, int((to_utc(ticket.sla_resolution_deadline) - now).total_seconds() / 60))
            eta_minutes = min(20, max(10, remaining_mins // 3))

        ticket.estimated_arrival_minutes = eta_minutes
        ticket.estimated_arrival_at = now + timedelta(minutes=eta_minutes)
        ticket.en_route_at = now
        
        note_entry = TicketNote(
            ticket_id=ticket.id,
            author_id=user.id,
            author_name=user.name,
            content=note or f"Ticket acknowledged by {user.name}. Staff en route to {ticket.room_number} (Estimated arrival: {eta_minutes} mins).",
            is_internal=False
        )
        db.add(note_entry)
        
        audit = AuditLog(
            ticket_id=ticket.id,
            action="TICKET_ACKNOWLEDGED",
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            details=json.dumps({
                "acknowledged_at": ticket.acknowledged_at.isoformat(),
                "estimated_arrival_minutes": eta_minutes
            })
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)

        # Trigger WhatsApp Event 3: Staff acknowledged
        tracking_url = f"/track/{ticket.ticket_number}?token={ticket.patient_tracking_token or ''}"
        try:
            WhatsAppService.on_staff_acknowledged(db, ticket, eta_minutes, tracking_url)
        except Exception:
            pass

        return ticket

    @staticmethod
    def start_work(db: Session, ticket: Ticket, user: User, note: Optional[str] = None) -> Ticket:
        if ticket.status in ["in_progress", "resolution_submitted", "closed"]:
            return ticket

        if ticket.status not in ["assigned", "acknowledged"]:
            raise HTTPException(status_code=400, detail=f"Cannot start work from '{ticket.status}' status")
            
        now = utc_now()
        ticket.status = "in_progress"
        ticket.in_progress_at = now
        ticket.work_started_at = now
        
        note_entry = TicketNote(
            ticket_id=ticket.id,
            author_id=user.id,
            author_name=user.name,
            content=note or f"Work actively initiated at {ticket.room_number}.",
            is_internal=False
        )
        db.add(note_entry)
        
        audit = AuditLog(
            ticket_id=ticket.id,
            action="TICKET_WORK_STARTED",
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            details=json.dumps({"work_started_at": ticket.work_started_at.isoformat()})
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)

        # Trigger WhatsApp Event 4: Work started
        tracking_url = f"/track/{ticket.ticket_number}?token={ticket.patient_tracking_token or ''}"
        try:
            WhatsAppService.on_work_started(db, ticket, tracking_url)
        except Exception:
            pass

        return ticket

    @staticmethod
    def submit_resolution(
        db: Session,
        ticket: Ticket,
        user: User,
        summary: str,
        parts: Optional[str] = None,
        test_notes: Optional[str] = None
    ) -> Ticket:
        if ticket.status not in ["in_progress", "acknowledged"]:
            raise HTTPException(status_code=400, detail=f"Cannot submit resolution from '{ticket.status}' status")
            
        now = utc_now()
        ticket.status = "resolution_submitted"
        ticket.resolution_submitted_at = now
        ticket.work_completed_at = now
        ticket.resolution_summary = summary
        ticket.parts_replaced = parts
        ticket.functional_test_notes = test_notes
        
        note_entry = TicketNote(
            ticket_id=ticket.id,
            author_id=user.id,
            author_name=user.name,
            content=f"Resolution submitted: {summary}. Awaiting inspection / sign-off.",
            is_internal=False
        )
        db.add(note_entry)
        
        audit = AuditLog(
            ticket_id=ticket.id,
            action="RESOLUTION_SUBMITTED",
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            details=json.dumps({
                "summary": summary,
                "parts": parts,
                "test_notes": test_notes,
                "work_completed_at": ticket.work_completed_at.isoformat()
            })
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)

        # Trigger WhatsApp Event 5: Work completed
        tracking_url = f"/track/{ticket.ticket_number}?token={ticket.patient_tracking_token or ''}"
        try:
            WhatsAppService.on_work_completed(db, ticket, tracking_url)
        except Exception:
            pass

        return ticket

    @staticmethod
    def close_ticket(db: Session, ticket: Ticket, user: User, approval_note: Optional[str] = None) -> Ticket:
        if user.role not in ["admin", "supervisor"]:
            raise HTTPException(status_code=403, detail="Final ticket closure requires Supervisor or Administrator authority")
            
        now = utc_now()
        ticket.status = "closed"
        ticket.closed_at = now
        ticket.is_escalated = False
        
        note_entry = TicketNote(
            ticket_id=ticket.id,
            author_id=user.id,
            author_name=user.name,
            content=f"Ticket inspected and officially closed by {user.name} ({user.role.capitalize()}). {approval_note or ''}",
            is_internal=False
        )
        db.add(note_entry)
        
        audit = AuditLog(
            ticket_id=ticket.id,
            action="TICKET_CLOSED",
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            details=json.dumps({"closed_at": ticket.closed_at.isoformat(), "approval_note": approval_note})
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)

        # Trigger WhatsApp Event 6: Ticket closed / Feedback invite
        tracking_url = f"/track/{ticket.ticket_number}?token={ticket.patient_tracking_token or ''}"
        try:
            WhatsAppService.on_work_completed(db, ticket, tracking_url)
        except Exception:
            pass

        return ticket
