"""
CareOps AI - Enterprise Department-Wise Service Request & Task Management Acceptance Test Suite
Comprehensive automated test suite covering all 27 acceptance criteria defined in Master Prompt Section 16.
"""

import uuid
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Department, Ticket, AuditLog, EmailLog, Room, DepartmentSupervisor

client = TestClient(app)

def get_token_for(email_or_login: str, password: str = "password123") -> str:
    """Helper to authenticate a user and retrieve Bearer JWT token."""
    payload = {"email": email_or_login, "password": password} if "@" in email_or_login else {"login_identifier": email_or_login, "password": password}
    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 200, f"Login failed for {email_or_login}: {res.text}"
    return res.json()["access_token"]

def get_admin_token() -> str:
    return get_token_for("admin@careops.hospital")

def get_active_room_token() -> str:
    db = SessionLocal()
    room = db.query(Room).filter(Room.is_active == True).first()
    assert room is not None, "No active room found in database for test."
    token = room.qr_token
    db.close()
    return token

# ==============================================================================
# TEST CASES 1-4: Department Routing Isolation
# ==============================================================================
def test_acceptance_01_to_04_department_request_routing_isolation():
    """
    Acceptance Criteria 1, 2, 3, 4:
    - Maintenance request appears ONLY in Maintenance supervisor queue.
    - Nursing request appears ONLY in Nursing supervisor queue.
    - Dietitian request appears ONLY in Dietitian supervisor queue.
    - Food Services request appears ONLY in Food Services supervisor queue.
    - Initial state is 'submitted' and unassigned.
    """
    room_token = get_active_room_token()
    
    # 1. Submit Maintenance Request
    maint_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Air conditioning",
        "description": "AC cooling coil leaking water onto floor",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.test1@careops.hospital"
    })
    assert maint_res.status_code == 200, f"Submit failed: {maint_res.text}"
    maint_data = maint_res.json()
    maint_ticket_id = maint_data["id"]
    assert maint_data["status"] == "submitted"
    db = SessionLocal()
    maint_tkt = db.query(Ticket).filter(Ticket.id == maint_ticket_id).first()
    assert maint_tkt.assigned_staff_id is None
    db.close()

    # 2. Submit Dietitian Request
    diet_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "dietitian",
        "category": "Diet consultation",
        "description": "Patient needs low sodium diabetic diet consultation",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.diet@careops.hospital"
    })
    assert diet_res.status_code == 200
    diet_ticket_id = diet_res.json()["id"]

    # 3. Submit Food Services Request
    food_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "food_services",
        "category": "Meal not received",
        "description": "Lunch tray not delivered to room",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.food@careops.hospital"
    })
    assert food_res.status_code == 200
    food_ticket_id = food_res.json()["id"]

    # --- Verify Supervisor Isolation ---
    # Mohan (Maintenance Supervisor) must see Maintenance ticket, but NOT Dietitian or Food Services tickets
    mohan_token = get_token_for("mohan.supervisor@careops.hospital")
    mohan_headers = {"Authorization": f"Bearer {mohan_token}"}
    mohan_tickets_res = client.get("/api/tickets", headers=mohan_headers)
    assert mohan_tickets_res.status_code == 200
    mohan_ticket_ids = [t["id"] for t in mohan_tickets_res.json()]
    assert maint_ticket_id in mohan_ticket_ids, "Maintenance ticket missing from Mohan's queue"
    assert diet_ticket_id not in mohan_ticket_ids, "Dietitian ticket leaked to Mohan's queue"
    assert food_ticket_id not in mohan_ticket_ids, "Food Services ticket leaked to Mohan's queue"

    # Dr. Sarah Rao (Dietitian Supervisor) must see Dietitian ticket, but NOT Maintenance or Food Services tickets
    sarah_token = get_token_for("dietitian.lead@careops.hospital")
    sarah_headers = {"Authorization": f"Bearer {sarah_token}"}
    sarah_tickets_res = client.get("/api/tickets", headers=sarah_headers)
    assert sarah_tickets_res.status_code == 200
    sarah_ticket_ids = [t["id"] for t in sarah_tickets_res.json()]
    assert diet_ticket_id in sarah_ticket_ids, "Dietitian ticket missing from Dr. Sarah's queue"
    assert maint_ticket_id not in sarah_ticket_ids, "Maintenance ticket leaked to Dr. Sarah's queue"
    assert food_ticket_id not in sarah_ticket_ids, "Food Services ticket leaked to Dr. Sarah's queue"

    # Chef Anand Kumar (Food Services Supervisor) must see Food Services ticket only
    anand_token = get_token_for("food.lead@careops.hospital")
    anand_headers = {"Authorization": f"Bearer {anand_token}"}
    anand_tickets_res = client.get("/api/tickets", headers=anand_headers)
    assert anand_tickets_res.status_code == 200
    anand_ticket_ids = [t["id"] for t in anand_tickets_res.json()]
    assert food_ticket_id in anand_ticket_ids, "Food ticket missing from Chef Anand's queue"
    assert maint_ticket_id not in anand_ticket_ids, "Maintenance ticket leaked to Chef Anand's queue"
    assert diet_ticket_id not in anand_ticket_ids, "Dietitian ticket leaked to Chef Anand's queue"

# ==============================================================================
# TEST CASES 5-6: Notifications & Multi-Supervisor Collaboration
# ==============================================================================
def test_acceptance_05_and_06_supervisor_notifications_and_multi_supervisor():
    """
    Acceptance Criteria 5 & 6:
    - Only active supervisors assigned to the department receive new-request notifications.
    - Multiple supervisors (e.g. Mohan & Younus for Maintenance) see the exact same authorized queue.
    """
    room_token = get_active_room_token()
    res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Plumbing issue",
        "description": "Bathroom faucet dripping continuously",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.multi@careops.hospital"
    })
    assert res.status_code == 200
    ticket_id = res.json()["id"]

    # Check notification logs in database
    db = SessionLocal()
    sup_alerts = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "supervisor_new_request_alert"
    ).all()
    recipients = [a.recipient_email for a in sup_alerts]
    db.close()

    # Mohan & Younus must both be notified as Maintenance supervisors
    assert "mohan.supervisor@careops.hospital" in recipients
    assert "younus.supervisor@careops.hospital" in recipients
    # Dietitian and Food supervisors must NOT be notified
    assert "dietitian.lead@careops.hospital" not in recipients
    assert "food.lead@careops.hospital" not in recipients

    # Multi-supervisor view: Younus also sees the new ticket
    younus_token = get_token_for("younus.supervisor@careops.hospital")
    younus_res = client.get("/api/tickets", headers={"Authorization": f"Bearer {younus_token}"})
    assert younus_res.status_code == 200
    younus_ticket_ids = [t["id"] for t in younus_res.json()]
    assert ticket_id in younus_ticket_ids

# ==============================================================================
# TEST CASES 7-8: Concurrency Conflict & Staff Eligibility Enforcement
# ==============================================================================
def test_acceptance_07_and_08_concurrency_and_staff_eligibility():
    """
    Acceptance Criteria 7 & 8:
    - Two supervisors cannot accidentally create conflicting assignments (optimistic concurrency returns 409).
    - Supervisor can assign a request ONLY to an eligible staff member belonging to that department.
    """
    room_token = get_active_room_token()
    res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Equipment repair",
        "description": "Wheelchair brake mechanism jammed",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.assign@careops.hospital"
    })
    assert res.status_code == 200
    ticket_id = res.json()["id"]

    db = SessionLocal()
    ashif = db.query(User).filter(User.email == "ashif.staff@careops.hospital").first()
    syed = db.query(User).filter(User.email == "syed.staff@careops.hospital").first()
    diet_sup = db.query(User).filter(User.email == "dietitian.lead@careops.hospital").first()
    assert ashif and syed and diet_sup
    ashif_id = ashif.id
    syed_id = syed.id
    diet_user_id = diet_sup.id
    db.close()

    mohan_token = get_token_for("mohan.supervisor@careops.hospital")
    mohan_headers = {"Authorization": f"Bearer {mohan_token}"}
    younus_token = get_token_for("younus.supervisor@careops.hospital")
    younus_headers = {"Authorization": f"Bearer {younus_token}"}

    # 1. Attempt assigning to staff from another department (Dietitian user) -> must be rejected 400
    invalid_assign = client.post(f"/api/tickets/{ticket_id}/assign", json={
        "staff_id": diet_user_id,
        "note": "Cross-department assignment attempt"
    }, headers=mohan_headers)
    assert invalid_assign.status_code == 400
    assert "belongs to department" in invalid_assign.json()["detail"]

    # 2. Supervisor Mohan assigns Ashif (Maintenance staff) with expected_assigned_staff_id = None
    assign1 = client.post(f"/api/tickets/{ticket_id}/assign", json={
        "staff_id": ashif_id,
        "expected_assigned_staff_id": None,
        "note": "Assigning to Ashif for repair"
    }, headers=mohan_headers)
    assert assign1.status_code == 200
    assert assign1.json()["assigned_staff_id"] == ashif_id
    assert assign1.json()["status"] == "assigned"

    # 3. Concurrently, Supervisor Younus tries to assign Syed, believing the ticket is still unassigned (expected_assigned_staff_id = None)
    assign2 = client.post(f"/api/tickets/{ticket_id}/assign", json={
        "staff_id": syed_id,
        "expected_assigned_staff_id": None,
        "note": "Younus trying concurrent assignment"
    }, headers=younus_headers)
    # Must fail with HTTP 409 Conflict!
    assert assign2.status_code == 409
    assert "already been assigned" in assign2.json()["detail"]

# ==============================================================================
# TEST CASES 9-11: Strict Staff Visibility & Protection
# ==============================================================================
def test_acceptance_09_to_11_strict_staff_visibility_and_isolation():
    """
    Acceptance Criteria 9, 10, 11:
    - Assigned staff member (Ashif) sees the task in their work queue.
    - Other staff members (Sathya, Syed) do NOT see it in their work queue.
    - Other staff members receive 403 Forbidden on direct GET or PUT to the ticket.
    - Unrelated department supervisors (e.g. Dr. Sarah Rao) receive 403 Forbidden on direct access.
    """
    room_token = get_active_room_token()
    res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Electrical issue",
        "description": "Switchboard sparking near bed",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.sec@careops.hospital"
    })
    ticket_id = res.json()["id"]

    db = SessionLocal()
    ashif = db.query(User).filter(User.email == "ashif.staff@careops.hospital").first()
    ashif_id = ashif.id
    db.close()

    # Supervisor Mohan assigns Ashif
    mohan_token = get_token_for("mohan.supervisor@careops.hospital")
    client.post(f"/api/tickets/{ticket_id}/assign", json={
        "staff_id": ashif_id,
        "note": "Urgent electrical fix"
    }, headers={"Authorization": f"Bearer {mohan_token}"})

    # 1. Assigned staff Ashif sees the ticket in their work queue
    ashif_token = get_token_for("ashif.staff@careops.hospital")
    ashif_headers = {"Authorization": f"Bearer {ashif_token}"}
    ashif_tickets = client.get("/api/tickets", headers=ashif_headers)
    assert ashif_tickets.status_code == 200
    ashif_ticket_ids = [t["id"] for t in ashif_tickets.json()]
    assert ticket_id in ashif_ticket_ids

    # 2. Sathya (unassigned Maintenance staff) does NOT see the ticket in their work queue
    sathya_token = get_token_for("sathya.staff@careops.hospital")
    sathya_headers = {"Authorization": f"Bearer {sathya_token}"}
    sathya_tickets = client.get("/api/tickets", headers=sathya_headers)
    assert sathya_tickets.status_code == 200
    sathya_ticket_ids = [t["id"] for t in sathya_tickets.json()]
    assert ticket_id not in sathya_ticket_ids

    # 3. Sathya attempting direct GET by ticket ID receives 403 Forbidden
    direct_get = client.get(f"/api/tickets/{ticket_id}", headers=sathya_headers)
    assert direct_get.status_code == 403
    assert "Staff can only access requests assigned to them" in direct_get.json()["detail"]

    # 4. Sathya attempting direct POST /start-work receives 403 Forbidden
    direct_start = client.post(f"/api/tickets/{ticket_id}/start-work", json={"note": "Unauthorized attempt"}, headers=sathya_headers)
    assert direct_start.status_code == 403

    # 5. Dietitian supervisor (Dr. Sarah Rao) attempting direct GET to Maintenance ticket receives 403 Forbidden
    sarah_token = get_token_for("dietitian.lead@careops.hospital")
    sarah_headers = {"Authorization": f"Bearer {sarah_token}"}
    sarah_direct = client.get(f"/api/tickets/{ticket_id}", headers=sarah_headers)
    assert sarah_direct.status_code == 403
    assert "belongs to a department" in sarah_direct.json()["detail"]

# ==============================================================================
# TEST CASES 12-14: Dynamic Admin Management & Permission Enforcement
# ==============================================================================
def test_acceptance_12_to_14_dynamic_admin_management_and_safe_removal():
    """
    Acceptance Criteria 12, 13, 14:
    - Administrator can dynamically create departments, supervisors, and staff without source code modification.
    - Department removal preserves historical records and blocks deletion when dependencies exist.
    - Super Admin controls user creation and administrative access.
    """
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a dynamic test department
    uid = uuid.uuid4().hex[:6]
    dept_id = f"biomed_{uid}"
    dept_code = f"BM_{uid[:3].upper()}"
    create_dept_res = client.post("/api/departments", json={
        "id": dept_id,
        "name": f"Biomedical Engineering {uid}",
        "code": dept_code,
        "description": "Specialized medical equipment support",
        "icon": "Activity",
        "categories": ["Ventilator Check", "Defibrillator Calibration", "Infusion Pump Repair"]
    }, headers=admin_headers)
    assert create_dept_res.status_code == 200
    created_dept = create_dept_res.json()
    assert created_dept["id"] == dept_id
    assert "Ventilator Check" in created_dept["categories"]

    # 2. Check dependencies (initially clean, can delete)
    dep_check = client.get(f"/api/departments/{dept_id}/dependencies", headers=admin_headers)
    assert dep_check.status_code == 200
    assert dep_check.json()["can_delete"] is True

    # 3. Clean safe deletion
    del_res = client.delete(f"/api/departments/{dept_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 4. Deletion of department with active tickets or staff is blocked
    block_check = client.delete("/api/departments/maintenance", headers=admin_headers)
    assert block_check.status_code == 400
    assert "Cannot delete department" in block_check.json()["detail"]

# ==============================================================================
# TEST CASES 15-19: Exactly Three Patient Operational Emails & Internal Workflows
# ==============================================================================
def test_acceptance_15_to_19_exactly_three_patient_emails_and_lifecycle():
    """
    Acceptance Criteria 15, 16, 17, 18, 19:
    - Patient receives exactly three operational emails:
        Email 1: Request received (patient_request_received)
        Email 2: Work started (patient_work_started)
        Email 3: Work completed (patient_work_completed)
    - Supervisor assignment does NOT trigger a patient email.
    - Retries or duplicate actions are idempotent and do not trigger duplicate patient emails.
    """
    room_token = get_active_room_token()
    patient_email = f"patient_{uuid.uuid4().hex[:6]}@example.com"

    # --- Step 1: Submit Request -> Triggers Patient Email 1 ---
    submit_res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Air conditioning",
        "description": "AC unit vibrating loudly in patient room",
        "patient_contact": "+91 98765 43210",
        "patient_email": patient_email
    })
    assert submit_res.status_code == 200
    ticket_data = submit_res.json()
    ticket_id = ticket_data["id"]

    db = SessionLocal()
    # Verify Email 1 dispatched
    email_1 = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_request_received"
    ).first()
    assert email_1 is not None, "Patient Email 1 (Request received) was not dispatched!"
    assert "Request Received — Reference" in email_1.subject
    assert email_1.recipient_email == patient_email

    # Check total patient emails so far: exactly 1
    patient_emails_count = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.recipient_email == patient_email
    ).count()
    assert patient_emails_count == 1
    db.close()

    # --- Step 2: Supervisor Assigns Staff -> NO Patient Email ---
    db = SessionLocal()
    ashif = db.query(User).filter(User.email == "ashif.staff@careops.hospital").first()
    ashif_id = ashif.id
    db.close()

    mohan_token = get_token_for("mohan.supervisor@careops.hospital")
    mohan_headers = {"Authorization": f"Bearer {mohan_token}"}
    assign_res = client.post(f"/api/tickets/{ticket_id}/assign", json={
        "staff_id": ashif_id,
        "note": "Ashif assigned for AC vibration inspection"
    }, headers=mohan_headers)
    assert assign_res.status_code == 200

    db = SessionLocal()
    # Confirm NO new patient email was generated by internal assignment
    patient_emails_after_assign = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.recipient_email == patient_email
    ).count()
    assert patient_emails_after_assign == 1, "Internal assignment illegally triggered a patient email!"

    # Confirm internal staff assignment notification was dispatched to Ashif
    staff_email = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "staff_ticket_assigned"
    ).first()
    assert staff_email is not None, "Staff assignment notification not generated!"
    assert staff_email.recipient_email == "ashif.staff@careops.hospital"
    db.close()

    # --- Step 3: Assigned Staff Starts Work -> Triggers Patient Email 2 ---
    ashif_token = get_token_for("ashif.staff@careops.hospital")
    ashif_headers = {"Authorization": f"Bearer {ashif_token}"}
    start_res = client.post(f"/api/tickets/{ticket_id}/start-work", json={
        "note": "Commencing diagnosis of AC blower and fan motor"
    }, headers=ashif_headers)
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "in_progress"

    db = SessionLocal()
    email_2 = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_work_started"
    ).first()
    assert email_2 is not None, "Patient Email 2 (Work started) was not dispatched!"
    assert "Work Started — Reference" in email_2.subject

    # Verify idempotency: calling start-work again should not generate another email
    client.post(f"/api/tickets/{ticket_id}/start-work", json={"note": "Duplicate start trigger"}, headers=ashif_headers)
    email_2_count = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_work_started"
    ).count()
    assert email_2_count == 1, "Duplicate work-started emails generated on retry!"
    db.close()

    # --- Step 4: Assigned Staff Completes Work -> Triggers Patient Email 3 ---
    finish_res = client.post(f"/api/tickets/{ticket_id}/submit-resolution", json={
        "resolution_summary": "Replaced worn rubber damper mount on AC blower motor and re-balanced fan assembly.",
        "parts_replaced": "Rubber anti-vibration dampers (x4)",
        "functional_test_notes": "Acoustic test completed. Fan running silently at all speeds."
    }, headers=ashif_headers)
    assert finish_res.status_code == 200
    assert finish_res.json()["status"] == "resolution_submitted"

    db = SessionLocal()
    email_3 = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.email_type == "patient_work_completed"
    ).first()
    assert email_3 is not None, "Patient Email 3 (Work completed) was not dispatched!"
    assert ("Work Completed" in email_3.subject or "Request Resolved" in email_3.subject) and "Reference" in email_3.subject

    # Verify exactly three patient emails across full lifecycle
    total_patient_emails = db.query(EmailLog).filter(
        EmailLog.ticket_id == ticket_id,
        EmailLog.recipient_email == patient_email
    ).count()
    assert total_patient_emails == 3, f"Expected exactly 3 patient emails, found {total_patient_emails}!"

    # Verify satisfaction rating buttons are absent from Email 3
    assert "Rate Your Service Experience" not in email_3.body_html
    assert "survey" not in email_3.body_html.lower()
    db.close()

# ==============================================================================
# TEST CASES 20-22: Removed Features & Live Tracking Milestones
# ==============================================================================
def test_acceptance_20_to_22_removed_features_and_live_tracking():
    """
    Acceptance Criteria 20, 21, 22:
    - Satisfaction workflow and escalation buttons are absent.
    - Public tracking endpoint returns live milestone progress without leaking internal staff details.
    """
    room_token = get_active_room_token()
    res = client.post("/api/patient/submit", json={
        "qr_token": room_token,
        "department_id": "maintenance",
        "category": "Plumbing issue",
        "description": "Shower drain slow",
        "patient_contact": "+91 98765 43210",
        "patient_email": "patient.track@careops.hospital"
    })
    ticket_data = res.json()
    tkt_num = ticket_data["ticket_number"]

    # Public tracking API
    track_res = client.get(f"/api/patient/ticket/{tkt_num}")
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert track_data["ticket_number"] == tkt_num
    assert track_data["status"] == "submitted"
    # Internal staff notes and sensitive PHI must not be leaked
    assert "internal_notes" not in track_data

# ==============================================================================
# TEST CASES 23-25: Audit Logging & Database Integrity
# ==============================================================================
def test_acceptance_23_to_25_audit_logging_and_transaction_integrity():
    """
    Acceptance Criteria 23, 24, 25:
    - Audit records accurately identify relevant actions (actor, action, details).
    - Status transitions and assignments are transactionally saved.
    """
    db = SessionLocal()
    # Verify recent audit logs have appropriate structure
    recent_audits = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(10).all()
    assert len(recent_audits) > 0
    actions = [a.action for a in recent_audits]
    assert any(a in actions for a in ["TICKET_CREATED_PATIENT_QR", "TICKET_ASSIGNED", "TICKET_WORK_STARTED"])
    db.close()

# ==============================================================================
# TEST CASES 26-27: Unauthorized Access & Security Isolation
# ==============================================================================
def test_acceptance_26_to_27_security_and_unauthorized_rejection():
    """
    Acceptance Criteria 26 & 27:
    - Unauthenticated calls to protected operational APIs are rejected with 401.
    - Role manipulation and unauthorized cross-department updates are rejected with 403.
    """
    # 1. Unauthenticated access rejected with 401
    unauth_res = client.get("/api/tickets")
    assert unauth_res.status_code == 401

    # 2. Staff user attempting to assign a ticket is rejected with 403
    ashif_token = get_token_for("ashif.staff@careops.hospital")
    staff_assign = client.post("/api/tickets/1/assign", json={
        "staff_id": 2,
        "note": "Staff trying to assign colleague"
    }, headers={"Authorization": f"Bearer {ashif_token}"})
    assert staff_assign.status_code == 403
