"""
Tests for CareOps AI SMTPS and Mobile Escalation Routing
Validates that patient and SLA escalations are routed to:
- Configured WORK_EMAIL
- Maintenance Department Email
- Maintenance Department Mobile Number
via secure SMTPS.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.config import settings
from app.models import Ticket, Department, Room, EscalationLog, AuditLog, User, EscalationSetting
from app.services.notification_service import NotificationService
from app.services.sla_engine import SLAEngine

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_notification_service_routes_to_work_email_and_maintenance(db_session: Session):
    """
    Validates that NotificationService includes WORK_EMAIL when set,
    the Maintenance Department Email, and the Maintenance Mobile Number.
    """
    # Temporarily configure WORK_EMAIL
    original_work_email = settings.WORK_EMAIL
    settings.WORK_EMAIL = "operations.lead@hospital-network.com"
    esc = db_session.query(EscalationSetting).filter(EscalationSetting.id == 1).first()
    original_db_work_email = esc.work_email if esc else None
    if esc:
        esc.work_email = "operations.lead@hospital-network.com"
        db_session.commit()

    try:
        # Clean up any leftover test tickets first
        db_session.query(Ticket).filter(Ticket.ticket_number == "TEST-MNT-ESCALATE-1").delete()
        db_session.commit()

        # Create a sample maintenance ticket
        dept = db_session.query(Department).filter(Department.id == "maintenance").first()
        room = db_session.query(Room).first()
        
        ticket = Ticket(
            ticket_number="TEST-MNT-ESCALATE-1",
            title="Urgent AC Breakdown",
            description="Patient room AC smoking and hot air blowing.",
            department_id="maintenance",
            room_id=room.id if room else 1,
            room_number=room.room_number if room else "501",
            category="HVAC",
            priority="urgent",
            status="submitted",
            patient_contact="+91 98765 43210"
        )
        db_session.add(ticket)
        db_session.commit()
        db_session.refresh(ticket)

        res = NotificationService.send_escalation_alert(
            db=db_session,
            ticket=ticket,
            escalation_level=1,
            reason="Patient requested emergency room intervention.",
            trigger_source="TEST_UNIT"
        )

        assert res["ticket_number"] == "TEST-MNT-ESCALATE-1"
        assert res["escalation_level"] == 1
        assert "operations.lead@hospital-network.com" in res["recipients"]
        assert settings.MAINTENANCE_DEPARTMENT_EMAIL in res["recipients"]
        assert res["maintenance_mobile"] is not None
        assert "+91" in res["maintenance_mobile"]

        # Check EscalationLog created
        esc_log = db_session.query(EscalationLog).filter(EscalationLog.ticket_id == ticket.id).first()
        assert esc_log is not None
        assert esc_log.escalation_level == 1
        assert "operations.lead@hospital-network.com" in esc_log.trigger_reason

        # Check AuditLog created
        audit_log = db_session.query(AuditLog).filter(
            AuditLog.ticket_id == ticket.id,
            AuditLog.action == "ESCALATION_SMTPS_DISPATCHED"
        ).first()
        assert audit_log is not None

    finally:
        settings.WORK_EMAIL = original_work_email
        if esc:
            esc.work_email = original_db_work_email
            db_session.commit()


def test_patient_escalate_endpoint(db_session: Session):
    """
    Validates that a patient can trigger an emergency escalation via
    POST /api/patient/ticket/{ticket_number}/escalate, which updates
    the ticket state and returns SMTPS dispatch details.
    """
    # Create a fresh patient ticket
    db_session.query(Ticket).filter(Ticket.ticket_number == "TEST-PAT-ESC-99").delete()
    db_session.commit()

    room = db_session.query(Room).first()
    ticket = Ticket(
        ticket_number="TEST-PAT-ESC-99",
        title="Plumbing Leak in Bathroom",
        description="Water overflowing from bathroom drain.",
        department_id="maintenance",
        room_id=room.id if room else 1,
        room_number=room.room_number if room else "302",
        category="Plumbing",
        priority="high",
        status="assigned",
        patient_contact="+91 98888 77777"
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    # Call patient escalation endpoint
    response = client.post(
        f"/api/patient/ticket/{ticket.ticket_number}/escalate",
        json={"reason": "Water is entering patient bedroom, please hurry."}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["ticket_number"] == "TEST-PAT-ESC-99"
    assert data["escalation_level"] >= 1
    assert "dispatch" in data
    assert settings.MAINTENANCE_DEPARTMENT_EMAIL in data["dispatch"]["recipients"]
    assert data["dispatch"]["maintenance_mobile"] is not None

    # Verify status endpoint reflects escalation
    status_res = client.get(f"/api/patient/ticket/{ticket.ticket_number}")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_escalated"] is True
    assert status_data["escalation_level"] >= 1
    assert "Water is entering patient bedroom" in status_data["escalation_reason"]
