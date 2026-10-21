import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Department, Ticket, AuditLog

client = TestClient(app)

def get_admin_token():
    res = client.post("/api/auth/login", json={"email": "admin@careops.hospital", "password": "password123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["access_token"]

def get_staff_token():
    res = client.post("/api/auth/login", json={"login_identifier": "EMP-MNT-1002", "password": "password123"})
    assert res.status_code == 200, f"Staff login failed: {res.text}"
    return res.json()["access_token"]

def test_centralized_auth_and_three_portals():
    """Verify centralized identity across Admin, Staff, and Patient roles."""
    # 1. Admin login
    admin_token = get_admin_token()
    headers = {"Authorization": f"Bearer {admin_token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["role"] in ["admin", "superadmin"]

    # 2. Staff login
    staff_token = get_staff_token()
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    staff_me = client.get("/api/auth/me", headers=staff_headers)
    assert staff_me.status_code == 200
    assert staff_me.json()["role"] == "staff"

    # 3. Patient self-registration & login
    unique_pat_email = f"patient_{uuid.uuid4().hex[:6]}@example.com"
    reg_payload = {
        "email": unique_pat_email,
        "name": "John Master Test",
        "password": "Password123!",
        "role": "patient",
        "phone": "+91 99999 88888"
    }
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 200
    
    pat_res = client.post("/api/auth/login", json={"email": unique_pat_email, "password": "Password123!"})
    assert pat_res.status_code == 200
    assert pat_res.json()["user"]["role"] == "patient"

    # 4. Privilege escalation attempt during self-registration must be rejected or demoted
    hacker_payload = {
        "email": f"hacker_{uuid.uuid4().hex[:6]}@example.com",
        "name": "Hacker Trying Admin",
        "password": "Password123!",
        "role": "admin"
    }
    hack_res = client.post("/api/auth/register", json=hacker_payload)
    if hack_res.status_code == 200:
        assert hack_res.json()["user"]["role"] in ["staff", "patient"]  # Server-side demotion
    else:
        assert hack_res.status_code in [400, 403]

def test_no_profile_pictures_in_system():
    """Verify avatar_url is None across users and no avatar image uploads exist."""
    db = SessionLocal()
    users_with_avatar = db.query(User).filter(User.avatar_url.isnot(None), User.avatar_url != "").all()
    count = len(users_with_avatar)
    db.close()
    assert count == 0, f"Found {count} users with avatar_url set! Must be 0."

def test_department_lifecycle_and_safe_deletion():
    """Verify full department CRUD, dependency checking, and safe deletion guard."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a test department with unique ID and code
    test_dept_id = f"cardio_{uuid.uuid4().hex[:6]}"
    test_dept_code = f"C_{uuid.uuid4().hex[:4].upper()}"

    create_res = client.post("/api/departments", json={
        "id": test_dept_id,
        "name": f"Cardiology Unit {test_dept_id}",
        "code": test_dept_code,
        "description": "Cardiology department for testing safe deletion",
        "icon": "heart-pulse"
    }, headers=headers)
    assert create_res.status_code == 200, create_res.text

    # 2. Edit department
    update_res = client.put(f"/api/departments/{test_dept_id}", json={
        "name": f"Cardiology Intensive Care {test_dept_id}",
        "code": f"CI_{test_dept_code[:4]}",
        "description": "Updated cardiology intensive care unit",
        "icon": "heart-pulse"
    }, headers=headers)
    assert update_res.status_code == 200

    # 3. Toggle Status (Deactivate / Reactivate)
    toggle_res = client.patch(f"/api/departments/{test_dept_id}/status", json={"is_active": False}, headers=headers)
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] is False

    toggle_back = client.patch(f"/api/departments/{test_dept_id}/status", json={"is_active": True}, headers=headers)
    assert toggle_back.status_code == 200
    assert toggle_back.json()["is_active"] is True

    # 4. Check dependencies (should be clean initially)
    deps_res = client.get(f"/api/departments/{test_dept_id}/dependencies", headers=headers)
    assert deps_res.status_code == 200
    assert deps_res.json()["can_delete"] is True or deps_res.json()["can_safely_delete"] is True
    assert deps_res.json()["active_staff_count"] == 0

    # 5. Clean safe deletion
    del_res = client.delete(f"/api/departments/{test_dept_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

def test_department_deletion_blocked_when_dependencies_exist():
    """Verify that deleting a department with active staff or tickets is strictly blocked."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 'maintenance' department has active staff and tickets
    deps_res = client.get("/api/departments/maintenance/dependencies", headers=headers)
    assert deps_res.status_code == 200
    assert deps_res.json()["can_delete"] is False

    # Attempt delete must be blocked with HTTP 400
    del_res = client.delete("/api/departments/maintenance", headers=headers)
    assert del_res.status_code == 400
    assert "Cannot delete department" in del_res.json()["detail"]

def test_staff_email_assignment_and_central_store():
    """Verify updating a staff member's email updates the central database and records an audit log."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    staff_member = db.query(User).filter(User.role == "staff").first()
    assert staff_member is not None
    original_email = staff_member.email
    staff_id = staff_member.id
    db.close()

    new_test_email = f"staff_{staff_id}_{uuid.uuid4().hex[:6]}@careops.hospital"

    # Update staff email
    update_res = client.put(f"/api/staff/{staff_id}", json={
        "email": new_test_email,
        "name": staff_member.name,
        "phone": staff_member.phone,
        "department_id": staff_member.department_id,
        "designation": staff_member.designation
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["email"] == new_test_email

    # Re-fetch from database to verify central persistence
    db = SessionLocal()
    refetched = db.query(User).filter(User.id == staff_id).first()
    assert refetched.email == new_test_email

    # Verify audit log was recorded
    audit = db.query(AuditLog).filter(
        AuditLog.action == "STAFF_EMAIL_ASSIGNMENT_UPDATED"
    ).order_by(AuditLog.id.desc()).first()
    assert audit is not None
    assert str(staff_id) in audit.details

    # Revert back to original email
    client.put(f"/api/staff/{staff_id}", json={
        "email": original_email,
        "name": staff_member.name,
        "phone": staff_member.phone,
        "department_id": staff_member.department_id,
        "designation": staff_member.designation
    }, headers=headers)
    db.close()

def test_patient_privacy_staff_isolation():
    """Verify that public tracking endpoints do not leak internal staff names, avatars, or notes."""
    db = SessionLocal()
    ticket = db.query(Ticket).first()
    assert ticket is not None
    tkt_num = ticket.ticket_number
    db.close()

    # Public tracking endpoint
    track_res = client.get(f"/api/patient/ticket/{tkt_num}")
    assert track_res.status_code == 200
    data = track_res.json()
    assert "assigned_staff_name" not in data or data.get("assigned_staff_name") is None
    assert "assigned_staff_avatar" not in data or data.get("assigned_staff_avatar") is None
    assert "internal_notes" not in data
