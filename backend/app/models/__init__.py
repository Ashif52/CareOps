from datetime import datetime, timezone
import json
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Department(Base):
    __tablename__ = "departments"
    
    id = Column(String(50), primary_key=True)  # e.g., "maintenance", "nursing"
    name = Column(String(100), nullable=False)
    code = Column(String(10), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="Wrench")
    supervisor_id = Column(Integer, ForeignKey("users.id", name="fk_dept_supervisor"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    users = relationship("User", back_populates="department", foreign_keys="User.department_id")
    tickets = relationship("Ticket", back_populates="department")
    sla_policies = relationship("SLAPolicy", back_populates="department")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(150), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # "admin", "supervisor", "staff"
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=True)
    phone = Column(String(30), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Enterprise Staff & Security Fields
    employee_id = Column(String(50), unique=True, index=True, nullable=True)
    designation = Column(String(100), nullable=True)
    account_status = Column(String(30), default="active", nullable=False)  # "active", "inactive", "locked", "pending_activation"
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    locked_reason = Column(String(255), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    must_change_password = Column(Boolean, default=False, nullable=False)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    permissions_override = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    department = relationship("Department", back_populates="users", foreign_keys=[department_id])
    assigned_tickets = relationship("Ticket", back_populates="assigned_staff", foreign_keys="Ticket.assigned_staff_id")
    supervised_tickets = relationship("Ticket", back_populates="assigned_supervisor", foreign_keys="Ticket.assigned_supervisor_id")

class Room(Base):
    __tablename__ = "rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(50), nullable=False, unique=True)
    floor = Column(String(50), nullable=False)
    wing = Column(String(50), nullable=False)
    qr_token = Column(String(100), nullable=False, unique=True, index=True)
    bed_count = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    tickets = relationship("Ticket", back_populates="room")

class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    
    # Audio complaint capture
    voice_recording_url = Column(String(255), nullable=True)
    voice_transcription = Column(Text, nullable=True)
    
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=False, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True, index=True)
    room_number = Column(String(50), nullable=False)  # Copied for fast display
    
    category = Column(String(100), nullable=False, index=True)
    priority = Column(String(20), nullable=False, default="medium", index=True)  # low, medium, high, critical
    
    # Workflow status
    status = Column(String(30), nullable=False, default="submitted", index=True)
    # submitted, assigned, acknowledged, in_progress, resolution_submitted, closed, reopened
    
    # Escalation state dimension
    is_escalated = Column(Boolean, default=False, index=True)
    escalation_level = Column(Integer, default=0)  # 0: normal, 1: reminder/warning, 2: supervisor breach
    escalation_reason = Column(Text, nullable=True)
    
    # Assignments
    assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # SLA timers & deadlines
    sla_acknowledgement_deadline = Column(DateTime(timezone=True), nullable=True)
    sla_resolution_deadline = Column(DateTime(timezone=True), nullable=True, index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    in_progress_at = Column(DateTime(timezone=True), nullable=True)
    resolution_submitted_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Resolution details
    resolution_summary = Column(Text, nullable=True)
    parts_replaced = Column(Text, nullable=True)
    functional_test_notes = Column(Text, nullable=True)
    delay_reason = Column(Text, nullable=True)
    revised_eta = Column(DateTime(timezone=True), nullable=True)
    
    # Patient interaction
    patient_contact = Column(String(50), nullable=True)
    patient_feedback_rating = Column(Integer, nullable=True)
    patient_feedback_comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    department = relationship("Department", back_populates="tickets")
    room = relationship("Room", back_populates="tickets")
    assigned_staff = relationship("User", back_populates="assigned_tickets", foreign_keys=[assigned_staff_id])
    assigned_supervisor = relationship("User", back_populates="supervised_tickets", foreign_keys=[assigned_supervisor_id])
    
    evidences = relationship("Evidence", back_populates="ticket", cascade="all, delete-orphan")
    ai_verifications = relationship("AIVerificationJob", back_populates="ticket", cascade="all, delete-orphan")
    notes = relationship("TicketNote", back_populates="ticket", cascade="all, delete-orphan")
    escalations = relationship("EscalationLog", back_populates="ticket", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="ticket", cascade="all, delete-orphan")

class Evidence(Base):
    __tablename__ = "evidences"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    stage = Column(String(20), nullable=False)  # "before", "after"
    media_type = Column(String(20), nullable=False)  # "image", "video"
    file_url = Column(String(255), nullable=False)
    thumbnail_url = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, default=0)
    file_hash = Column(String(64), nullable=True)
    equipment_type = Column(String(100), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    ticket = relationship("Ticket", back_populates="evidences")

class AIVerificationJob(Base):
    __tablename__ = "ai_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    status = Column(String(20), default="completed", index=True)  # pending, processing, completed, failed
    
    before_evidence_id = Column(Integer, ForeignKey("evidences.id"), nullable=True)
    after_evidence_id = Column(Integer, ForeignKey("evidences.id"), nullable=True)
    
    # Structured outcome dimensions
    evidence_relevance = Column(String(50), default="high")  # high, medium, low, mismatch
    equipment_match = Column(String(50), default="confirmed_match")  # confirmed_match, likely_match, mismatch, inconclusive
    visible_fault_assessment = Column(String(50), default="fault_cleared")  # fault_detected, ambiguous, fault_cleared
    after_repair_functional_evidence = Column(String(50), default="movement_observed")  # movement_observed, functional_normal, static_unverified, inconclusive
    media_quality = Column(String(50), default="high")  # high, sufficient, low_quality, blurry
    
    missing_evidence = Column(Text, default="[]")  # JSON string
    inconsistencies = Column(Text, default="[]")  # JSON string
    
    ai_recommendation = Column(String(30), nullable=False)  # likely_resolved, likely_unresolved, inconclusive
    review_requirement = Column(String(40), default="standard_signoff")  # mandatory_human_review, standard_signoff, fast_track_eligible
    confidence_score = Column(Float, default=0.85)
    analysis_notes = Column(Text, nullable=False)
    model_version = Column(String(50), default="careops-vision-v2.4")
    analysis_timestamp = Column(DateTime(timezone=True), default=utc_now)
    
    # Human Review & Supervisor Override
    human_decision = Column(String(30), nullable=True)  # approved, rejected, requested_new_evidence, inconclusive
    human_reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    human_review_notes = Column(Text, nullable=True)
    human_override_reason = Column(Text, nullable=True)
    human_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    ticket = relationship("Ticket", back_populates="ai_verifications")
    human_reviewer = relationship("User", foreign_keys=[human_reviewer_id])

class SLAPolicy(Base):
    __tablename__ = "sla_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=False, index=True)
    priority = Column(String(20), nullable=False, index=True)  # low, medium, high, critical
    ack_target_minutes = Column(Integer, nullable=False)
    resolution_target_minutes = Column(Integer, nullable=False)
    reminder_1_minutes_before = Column(Integer, default=30)
    reminder_2_minutes_before = Column(Integer, default=10)
    escalation_after_deadline_minutes = Column(Integer, default=0)
    requires_closure_approval = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    
    department = relationship("Department", back_populates="sla_policies")

class EscalationLog(Base):
    __tablename__ = "escalation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    escalation_level = Column(Integer, default=1)
    trigger_reason = Column(String(200), nullable=False)
    notified_supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    delivery_status = Column(String(30), default="delivered")  # sent, delivered, failed, simulated
    acknowledged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    ticket = relationship("Ticket", back_populates="escalations")

class TicketNote(Base):
    __tablename__ = "ticket_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True, index=True)  # CRITICAL: Separate internal vs patient-visible
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    ticket = relationship("Ticket", back_populates="notes")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String(100), nullable=False)
    actor_role = Column(String(50), nullable=False)
    details = Column(Text, default="{}")  # JSON
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    
    ticket = relationship("Ticket", back_populates="audit_logs")
