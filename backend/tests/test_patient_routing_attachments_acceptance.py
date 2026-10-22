"""
CareOps AI - Acceptance Tests for Patient Email Routing & Secure Attachments
Covers Requirements from Master Modification Prompt:
1. Patient email validation & routing (exclusive to patient and department supervisor).
2. No admin personal mailbox broadcast.
3. Three automatic patient operational emails (Request received, Work started, Work completed).
4. Idempotent lifecycle emails (deduplication on retries/multiple clicks).
5. Photo and video capture & upload security (magic bytes inspection, rejection of executables/scripts).
6. Voice note preservation.
7. Permission-controlled email correction.
"""

import base64
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Department, Ticket, AuditLog, EmailLog, Room, Evidence

client = TestClient(app)

def get_token_for(email_or_login: str, password: str = "password123") -> str:
    payload = {"email": email_or_login, "password": password} if "@" in email_or_login else {"login_identifier": email_or_login, "password": password}
    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 200, f"Login failed for {email_or_login}: {res.text}"
    return res.json()["access_token"]

def get_active_room_token() -> str:
    db = SessionLocal()
    room = db.query(Room).filter(Room.is_active == True).first()
    assert room is not None
    token = room.qr_token
    db.close()
    return token

# Clean Base64 strings for valid and invalid media
VALID_PNG_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
VALID_MP4_BASE64 = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQ=="
MALICIOUS_EXE_BASE64 = "data:application/octet-stream;base64,TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAA4fug4AtAnNIbgBTM0hVGhpcyBwcm9ncmFtIGNhbm5vdCBiZSBydW4gaW4gRE9TIG1vZGUuDQ0KJAAAAAAAAAA="
MALICIOUS_SCRIPT_BASE64 = "data:text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+"

def test_patient_email_validation():
    """Verify invalid email format is rejected with HTTP 400 and valid email is accepted."""
    room_token = get_active_room_token()
    
    # Invalid email
    bad_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "housekeeping",
        "category": "Housekeeping & Room Sanitization",
        "description": "Floor needs cleaning",
        "patient_contact": "+91 98765 43210",
        "patient_email": "invalid-email-address"
    })
    assert bad_res.status_code == 400, f"Expected 400 for invalid email, got {bad_res.status_code}"
    assert "email" in bad_res.json()["detail"].lower()

    # Valid email
    good_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "housekeeping",
        "category": "Housekeeping & Room Sanitization",
        "description": "Spill on floor",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.verified@hospital.org"
    })
    assert good_res.status_code == 200
    tkt_id = good_res.json()["id"]

    db = SessionLocal()
    tkt = db.query(Ticket).filter(Ticket.id == tkt_id).first()
    assert tkt.patient_email == "patient.verified@hospital.org"
    db.close()

def test_email_routing_isolation_and_no_admin_broadcast():
    """
    Verify:
    1. Patient receives Email 1 (Request received).
    2. ONLY Maintenance supervisors receive internal alert.
    3. Admins / work_email do NOT receive broadcast of patient request.
    4. Unrelated departments (e.g. Dietitian, Nursing) receive nothing.
    """
    room_token = get_active_room_token()
    patient_email = "patient.routing.test@hospital.org"

    submit_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Lighting / Electrical",
        "description": "Flickering hallway light fixture",
        "patient_contact": "+91 98765 43210",
        "patient_email": patient_email
    })
    assert submit_res.status_code == 200
    ticket_id = submit_res.json()["id"]

    db = SessionLocal()
    # Check patient email 1
    patient_email_log = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_request_received"
    ).first()
    assert patient_email_log is not None, "Patient request received email was not generated!"
    assert patient_email_log.recipient_email == patient_email
    assert "TKT-" in patient_email_log.subject
    assert "track" in patient_email_log.body_html.lower()

    # Check supervisor alert: routed ONLY to maintenance supervisor
    sup_email_log = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "supervisor_new_request_alert"
    ).all()
    assert len(sup_email_log) >= 1
    recipients = {log.recipient_email for log in sup_email_log}
    assert "mohan.supervisor@careops.hospital" in recipients or "younus.supervisor@careops.hospital" in recipients

    # Check NO admin_new_ticket_alert was generated (eliminating personal mailbox broadcast)
    admin_alert_log = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "admin_new_ticket_alert"
    ).first()
    assert admin_alert_log is None, "admin_new_ticket_alert broadcast was unexpectedly sent to admins!"

    # Check NO email sent to dietitian supervisor
    diet_sup_log = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.recipient_email == "dietitian.lead@careops.hospital"
    ).first()
    assert diet_sup_log is None, "Unrelated department supervisor received email!"
    db.close()

def test_full_email_lifecycle_and_deduplication():
    """
    Test 3 operational emails:
    1. Request received
    2. Work started (when staff starts work)
    3. Work completed (when staff completes work)
    Verify idempotency / deduplication on repeated triggers.
    """
    room_token = get_active_room_token()
    patient_email = "patient.lifecycle@hospital.org"

    # 1. Create Ticket
    sub_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Lighting / Electrical",
        "description": "Lifecycle test request",
        "patient_contact": "+91 98765 43210",
        "patient_email": patient_email
    })
    assert sub_res.status_code == 200
    ticket_id = sub_res.json()["id"]

    # 2. Supervisor Assigns Staff
    mohan_token = get_token_for("mohan.supervisor@careops.hospital")
    ashif = SessionLocal().query(User).filter(User.email == "ashif.staff@careops.hospital").first()
    assert ashif is not None

    assign_res = client.post(f"/api/tickets/{ticket_id}/assign", json={
        "staff_id": ashif.id,
        "note": "Assigned for repair"
    }, headers={"Authorization": f"Bearer {mohan_token}"})
    assert assign_res.status_code == 200

    # 3. Staff Acknowledges & Starts Work -> Triggers Patient Email 2
    ashif_token = get_token_for("ashif.staff@careops.hospital")
    ashif_headers = {"Authorization": f"Bearer {ashif_token}"}

    client.post(f"/api/tickets/{ticket_id}/acknowledge", headers=ashif_headers)
    start_res = client.post(f"/api/tickets/{ticket_id}/start-work", headers=ashif_headers)
    assert start_res.status_code == 200

    db = SessionLocal()
    started_emails = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_work_started"
    ).all()
    assert len(started_emails) == 1
    assert "Work Started" in started_emails[0].subject
    assert started_emails[0].recipient_email == patient_email

    # Trigger second start work attempt to verify deduplication
    db.close()
    client.post(f"/api/tickets/{ticket_id}/start-work", headers=ashif_headers)
    db = SessionLocal()
    started_emails_after = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_work_started"
    ).all()
    assert len(started_emails_after) == 1, "Duplicate work started email generated!"

    # 4. Staff Completes Work -> Triggers Patient Email 3
    complete_res = client.post(f"/api/tickets/{ticket_id}/submit-resolution", json={
        "resolution_summary": "Fixture thoroughly inspected and replaced.",
        "parts_replaced": "LED tube lamp 18W",
        "functional_test_notes": "Tested for 15 minutes, light steady."
    }, headers=ashif_headers)
    assert complete_res.status_code == 200

    completed_emails = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_work_completed"
    ).all()
    assert len(completed_emails) == 1
    assert "Work Completed" in completed_emails[0].subject
    assert completed_emails[0].recipient_email == patient_email
    assert "Resolution Summary" in completed_emails[0].body_html

    # Repeated resolution submission does not duplicate email
    db.close()
    client.post(f"/api/tickets/{ticket_id}/submit-resolution", json={
        "resolution_summary": "Re-submitting test.",
    }, headers=ashif_headers)
    db = SessionLocal()
    completed_emails_after = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_work_completed"
    ).all()
    assert len(completed_emails_after) == 1, "Duplicate work completed email generated!"
    db.close()

def test_photo_and_video_attachments_and_security_validation():
    """
    Verify:
    1. Valid photo (PNG) and video (MP4) attachments accepted and stored as Evidence.
    2. Malicious executables (MZ PE) rejected.
    3. Malicious scripts (PHP) rejected.
    4. Voice note is preserved.
    """
    room_token = get_active_room_token()

    # 1. Malicious executable payload should be rejected
    malicious_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Lighting / Electrical",
        "description": "Test with dangerous attachment",
        "patient_contact": "+91 98765 43210",
        "patient_email": "security.test@hospital.org",
        "attachments": [
            {
                "media_type": "PHOTO",
                "file_name": "malicious.exe",
                "data_base64": MALICIOUS_EXE_BASE64,
                "file_size_bytes": 100
            }
        ]
    })
    assert malicious_res.status_code == 400
    assert "executable" in malicious_res.json()["detail"].lower() or "rejected" in malicious_res.json()["detail"].lower()

    # 2. Malicious script payload should be rejected
    script_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Lighting / Electrical",
        "description": "Test with script attachment",
        "patient_contact": "+91 98765 43210",
        "patient_email": "security.test@hospital.org",
        "attachments": [
            {
                "media_type": "PHOTO",
                "file_name": "hack.php",
                "data_base64": MALICIOUS_SCRIPT_BASE64,
                "file_size_bytes": 100
            }
        ]
    })
    assert script_res.status_code == 400

    # 3. Valid photo and video attachments accepted alongside voice note
    valid_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Lighting / Electrical",
        "description": "Flickering tube light in patient room",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.media@hospital.org",
        "voice_recording_base64": "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAA=",
        "voice_transcription": "Light is flickering loudly",
        "attachments": [
            {
                "media_type": "PHOTO",
                "file_name": "light_fixture.png",
                "data_base64": VALID_PNG_BASE64,
                "file_size_bytes": 100
            },
            {
                "media_type": "VIDEO",
                "file_name": "flicker_recording.mp4",
                "data_base64": VALID_MP4_BASE64,
                "file_size_bytes": 100
            }
        ]
    })
    assert valid_res.status_code == 200
    ticket_id = valid_res.json()["id"]

    db = SessionLocal()
    tkt = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    assert tkt is not None
    assert tkt.voice_recording_url is not None, "Voice note was lost!"
    assert tkt.voice_transcription == "Light is flickering loudly"

    # Verify Evidence records were created
    evidences = db.query(Evidence).filter(Evidence.ticket_id == ticket_id).all()
    assert len(evidences) == 2, f"Expected 2 evidence records, found {len(evidences)}"
    media_types = {e.media_type for e in evidences}
    assert "image" in media_types
    assert "video" in media_types
    for ev in evidences:
        assert ev.stage == "before"
        assert ev.file_url.startswith("/uploads/")
    db.close()

def test_permission_controlled_patient_email_update():
    """
    Verify:
    1. Regular staff CANNOT update patient contact email (HTTP 403).
    2. Supervisor or Administrator CAN update patient contact email.
    3. Invalid email format is rejected (HTTP 400).
    """
    room_token = get_active_room_token()

    submit_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "housekeeping",
        "category": "Housekeeping & Room Sanitization",
        "description": "Email update test",
        "patient_contact": "+91 98765 43210",
        "patient_email": "original.email@hospital.org"
    })
    assert submit_res.status_code == 200
    ticket_id = submit_res.json()["id"]

    staff_token = get_token_for("ashif.staff@careops.hospital")
    admin_token = get_token_for("admin@careops.hospital")

    # Staff attempt should be blocked with 403 Forbidden
    staff_edit_res = client.put(f"/api/tickets/{ticket_id}/contact", json={
        "patient_email": "hacked@evil.com"
    }, headers={"Authorization": f"Bearer {staff_token}"})
    assert staff_edit_res.status_code == 403

    # Admin attempt with invalid email format should be rejected with 400 Bad Request
    bad_email_res = client.put(f"/api/tickets/{ticket_id}/contact", json={
        "patient_email": "not-an-email"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert bad_email_res.status_code == 400

    # Admin attempt with valid corrected email succeeds
    good_edit_res = client.put(f"/api/tickets/{ticket_id}/contact", json={
        "patient_email": "corrected.patient@hospital.org"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert good_edit_res.status_code == 200
    assert good_edit_res.json()["patient_email"] == "corrected.patient@hospital.org"

    db = SessionLocal()
    tkt = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    assert tkt.patient_email == "corrected.patient@hospital.org"
    db.close()
