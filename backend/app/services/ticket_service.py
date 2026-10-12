from datetime import datetime, timezone
import json
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

def utc_now():
    return datetime.now(timezone.utc)

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
            
        # Find staff with lowest active tickets count
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
        """Creates a ticket submitted by a patient from a room QR code"""
        priority = "high" if department.id in ["doctors", "nursing"] else "medium"
        ack_dl, res_dl = SLAEngine.calculate_deadlines(db, department.id, priority)
        
        ticket_number = TicketService.generate_ticket_number(db, department.code)
        assigned_staff = TicketService.auto_assign_staff(db, department.id)
        
        initial_status = "assigned" if assigned_staff else "submitted"
        
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
            sla_acknowledgement_deadline=ack_dl,
            sla_resolution_deadline=res_dl,
            patient_contact=patient_contact
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
                notes="Patient submitted photo at ticket creation"
            )
            db.add(evidence)
            
        # Initial patient-visible progress note
        welcome_note = TicketNote(
            ticket_id=ticket.id,
            author_name="CareOps System",
            content=f"Request received for {department.name}. Assigned to care team.",
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
                "assigned_staff": assigned_staff.name if assigned_staff else "Unassigned"
            })
        )
        db.add(audit)
        
        db.commit()
        db.refresh(ticket)
        return ticket

    @staticmethod
    def acknowledge_ticket(db: Session, ticket: Ticket, user: User, note: Optional[str] = None) -> Ticket:
        # Idempotent: If already acknowledged, in_progress, resolution_submitted, or closed, return safely
        if ticket.status in ["acknowledged", "in_progress", "resolution_submitted", "closed"]:
            return ticket

        if ticket.status not in ["submitted", "assigned"]:
            raise HTTPException(status_code=400, detail=f"Cannot acknowledge ticket in '{ticket.status}' status")
            
        ticket.status = "acknowledged"
        ticket.acknowledged_at = utc_now()
        ticket.assigned_staff_id = user.id
        
        note_entry = TicketNote(
            ticket_id=ticket.id,
            author_id=user.id,
            author_name=user.name,
            content=note or f"Ticket acknowledged by {user.name}. Staff dispatching to location.",
            is_internal=False  # Patient can see that staff acknowledged
        )
        db.add(note_entry)
        
        audit = AuditLog(
            ticket_id=ticket.id,
            action="TICKET_ACKNOWLEDGED",
            actor_id=user.id,
            actor_name=user.name,
            actor_role=user.role,
            details=json.dumps({"acknowledged_at": ticket.acknowledged_at.isoformat()})
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)
        return ticket

    @staticmethod
    def start_work(db: Session, ticket: Ticket, user: User, note: Optional[str] = None) -> Ticket:
        # Idempotent: If already in_progress or later, return safely
        if ticket.status in ["in_progress", "resolution_submitted", "closed"]:
            return ticket

        if ticket.status not in ["assigned", "acknowledged"]:
            raise HTTPException(status_code=400, detail=f"Cannot start work from '{ticket.status}' status")
            
        ticket.status = "in_progress"
        ticket.in_progress_at = utc_now()
        
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
            details=json.dumps({"in_progress_at": ticket.in_progress_at.isoformat()})
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)
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
            
        ticket.status = "resolution_submitted"
        ticket.resolution_submitted_at = utc_now()
        ticket.resolution_summary = summary
        ticket.parts_replaced = parts
        ticket.functional_test_notes = test_notes
        
        note_entry = TicketNote(
            ticket_id=ticket.id,
            author_id=user.id,
            author_name=user.name,
            content=f"Resolution submitted: {summary}. Awaiting verification / sign-off.",
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
                "test_notes": test_notes
            })
        )
        db.add(audit)
        db.commit()
        db.refresh(ticket)
        return ticket

    @staticmethod
    def close_ticket(db: Session, ticket: Ticket, user: User, approval_note: Optional[str] = None) -> Ticket:
        # Check authorization: supervisor or admin, or policy allows fast track
        if user.role not in ["admin", "supervisor"]:
            raise HTTPException(status_code=403, detail="Final ticket closure requires Supervisor or Administrator authority")
            
        ticket.status = "closed"
        ticket.closed_at = utc_now()
        ticket.is_escalated = False  # Cleared on resolution closure
        
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
        return ticket
