"""
Comprehensive Enterprise Staff & Access Management Acceptance Test Suite
Validates IAM lifecycle, 3-attempt lockout policy, RBAC safeguards, and audit trails.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.migrations import run_migrations

def run_acceptance_tests():
    print("=" * 70)
    print("STARTING CAREOPS AI ENTERPRISE IAM & RBAC VERIFICATION SUITE")
    print("=" * 70)

    # 1. Run Migrations & Seed Backfill
    print("\n[STEP 1] Running Schema Migrations & Backfill...")
    run_migrations()
    print("   [OK] Schema migrations completed without errors.")

    client = TestClient(app)

    # 2. Authenticate as Super Admin
    print("\n[STEP 2] Authenticating as Super Admin (Dr. Alistair Vance)...")
    res = client.post("/api/auth/login", json={
        "email": "admin@careops.hospital",
        "password": "password123"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_user = res.json()["user"]
    print(f"   [OK] Super Admin authenticated. Employee ID: {admin_user.get('employee_id')}, Status: {admin_user.get('account_status')}")

    # 3. Retrieve Live Staff Directory & Metrics
    print("\n[STEP 3] Testing Staff Directory & Live Metrics Endpoint (GET /api/staff)...")
    res_dir = client.get("/api/staff", headers=admin_headers)
    assert res_dir.status_code == 200, f"Directory fetch failed: {res_dir.text}"
    data = res_dir.json()
    metrics = data["metrics"]
    print(f"   [OK] Staff directory retrieved. Total in database: {metrics['total_staff']}")
    print(f"   [OK] Live metrics: Active={metrics['active_accounts']}, Inactive={metrics['inactive_accounts']}, Locked={metrics['locked_accounts']}")
    assert metrics["total_staff"] >= 10, "Expected at least 10 staff members in database"

    # 4. Roles & Permissions Metadata
    print("\n[STEP 4] Testing Roles & Granular Permissions (GET /api/staff/meta/roles)...")
    res_roles = client.get("/api/staff/meta/roles", headers=admin_headers)
    assert res_roles.status_code == 200
    roles = res_roles.json()
    role_ids = [r["id"] for r in roles]
    print(f"   [OK] Hospital roles loaded ({len(roles)} roles): {', '.join(role_ids)}")
    assert "admin" in role_ids and "it_admin" in role_ids and "doctor" in role_ids and "nurse" in role_ids

    # 5. Create New Staff Identity
    print("\n[STEP 5] Testing Staff Identity Creation (POST /api/staff)...")
    test_emp_id = "EMP-TEST-9001"
    test_email = "test.specialist@careops.hospital"
    
    # Clean up previous test run if exists
    res_create = client.post("/api/staff", json={
        "name": "Dr. Sarah Jenkins",
        "employee_id": test_emp_id,
        "email": test_email,
        "phone": "+91 98765 99001",
        "department_id": "doctors",
        "designation": "Consultant Neurologist",
        "role": "doctor",
        "initial_password": "InitialSecure2026!",
        "require_password_change": True
    }, headers=admin_headers)
    
    if res_create.status_code == 400 and "already exists" in res_create.text:
        print("   Notice: Test staff already existed from previous run.")
    else:
        assert res_create.status_code == 200, f"Staff creation failed: {res_create.text}"
        new_staff = res_create.json()
        print(f"   [OK] Created Staff: {new_staff['name']} | ID: {new_staff['employee_id']} | Dept: {new_staff['department_id']}")

    # Test Duplicate Check (Uniqueness constraint)
    print("   Testing duplicate employee ID rejection...")
    res_dup = client.post("/api/staff", json={
        "name": "Imposter Staff",
        "employee_id": test_emp_id,
        "email": "different.email@careops.hospital",
        "department_id": "doctors",
        "designation": "Attending",
        "role": "doctor"
    }, headers=admin_headers)
    assert res_dup.status_code == 400, "Expected duplicate employee_id to be rejected"
    print("   [OK] Duplicate Employee ID rejected with 400 Bad Request.")

    # 6. Test 3-Failed-Attempt Authentication Lockout Policy
    print("\n[STEP 6] Testing 3-Consecutive-Failure Lockout Policy...")
    
    # First ensure test account starts with 0 failures and active
    login_target = test_email
    valid_pw = "InitialSecure2026!"
    wrong_pw = "WrongPassword999!"

    print("   - Attempt 1 with invalid credentials:")
    res_f1 = client.post("/api/auth/login", json={"email": login_target, "password": wrong_pw})
    assert res_f1.status_code == 401, f"Expected 401, got {res_f1.status_code}"
    print(f"     Status: {res_f1.status_code} | Message: {res_f1.json()['detail']}")
    assert "Attempt 1 of 3" in res_f1.json()["detail"]

    print("   - Attempt 2 with invalid credentials:")
    res_f2 = client.post("/api/auth/login", json={"email": login_target, "password": wrong_pw})
    assert res_f2.status_code == 401, f"Expected 401, got {res_f2.status_code}"
    print(f"     Status: {res_f2.status_code} | Message: {res_f2.json()['detail']}")
    assert "Attempt 2 of 3" in res_f2.json()["detail"]

    print("   - Attempt 3 with invalid credentials (TRIGGER LOCKOUT):")
    res_f3 = client.post("/api/auth/login", json={"email": login_target, "password": wrong_pw})
    assert res_f3.status_code == 423, f"Expected 423 Locked on 3rd failure, got {res_f3.status_code}: {res_f3.text}"
    print(f"     Status: {res_f3.status_code} (HTTP 423 Locked) | Message: {res_f3.json()['detail']}")
    assert "locked after 3 consecutive failed login attempts" in res_f3.json()["detail"]

    print("   - Attempt 4 with VALID credentials while account is locked:")
    res_f4 = client.post("/api/auth/login", json={"email": login_target, "password": valid_pw})
    assert res_f4.status_code == 423, f"Expected 423 Locked even with valid password, got {res_f4.status_code}"
    print(f"     [OK] CONFIRMED: Valid credentials REJECTED with {res_f4.status_code} while account is locked.")

    # 7. Administrative Unlock
    print("\n[STEP 7] Testing Administrative Unlock Endpoint (POST /api/staff/{id}/unlock)...")
    # Fetch target staff to get ID
    res_find = client.get(f"/api/staff?search={test_emp_id}", headers=admin_headers)
    target_obj = res_find.json()["items"][0]
    target_id = target_obj["id"]
    assert target_obj["account_status"] == "locked", f"Expected account_status='locked', got {target_obj['account_status']}"

    res_unlock = client.post(f"/api/staff/{target_id}/unlock", json={
        "reason": "Staff identity verified in-person at hospital IT Helpdesk"
    }, headers=admin_headers)
    assert res_unlock.status_code == 200, f"Unlock failed: {res_unlock.text}"
    unlocked_staff = res_unlock.json()
    assert unlocked_staff["account_status"] == "active"
    assert unlocked_staff["failed_login_attempts"] == 0
    print(f"   [OK] Account successfully unlocked by Super Admin. Status: {unlocked_staff['account_status']}, Failures: {unlocked_staff['failed_login_attempts']}")

    # Verify that valid credentials now authenticate successfully
    res_login_after = client.post("/api/auth/login", json={"email": login_target, "password": valid_pw})
    assert res_login_after.status_code == 200, f"Login failed after unlock: {res_login_after.text}"
    print("   [OK] Target staff logged in successfully after administrative unlock!")

    # 8. Password Reset Flow
    print("\n[STEP 8] Testing Administrative Password Reset (POST /api/staff/{id}/reset-password)...")
    res_reset = client.post(f"/api/staff/{target_id}/reset-password", json={
        "temporary_password": "NewHospitalPass88!",
        "require_change": True
    }, headers=admin_headers)
    assert res_reset.status_code == 200, f"Reset failed: {res_reset.text}"
    new_temp_pw = res_reset.json()["temporary_password"]
    print(f"   [OK] Password reset completed. Temporary credentials generated.")

    # Authenticate with new temporary password
    res_login_new_pw = client.post("/api/auth/login", json={"email": login_target, "password": new_temp_pw})
    assert res_login_new_pw.status_code == 200, "Login failed with reset password"
    print("   [OK] Target staff authenticated with reset password.")

    # 9. Account Deactivation & Last Admin Protection
    print("\n[STEP 9] Testing Deactivation & Super Admin Safeguards...")
    # Attempt to deactivate the Super Admin (should be blocked)
    res_deact_admin = client.post(f"/api/staff/{admin_user['id']}/deactivate", json={
        "reason": "Accidental demotion attempt"
    }, headers=admin_headers)
    assert res_deact_admin.status_code == 400, "Expected deactivating last Super Admin to fail"
    print(f"   [OK] Safeguard verified: Protected last Super Admin from deactivation. Message: {res_deact_admin.json()['detail']}")

    # Deactivate the test staff
    res_deact_test = client.post(f"/api/staff/{target_id}/deactivate", json={
        "reason": "Staff member on planned medical leave"
    }, headers=admin_headers)
    assert res_deact_test.status_code == 200
    assert res_deact_test.json()["account_status"] == "inactive"
    print("   [OK] Test staff account deactivated.")

    # Verify deactivated staff cannot log in
    res_login_deact = client.post("/api/auth/login", json={"email": login_target, "password": new_temp_pw})
    assert res_login_deact.status_code == 403, f"Expected 403 for inactive account, got {res_login_deact.status_code}"
    print(f"   [OK] Deactivated login blocked with HTTP 403: {res_login_deact.json()['detail']}")

    # Re-activate
    res_reactivate = client.post(f"/api/staff/{target_id}/activate", headers=admin_headers)
    assert res_reactivate.status_code == 200
    assert res_reactivate.json()["account_status"] == "active"
    print("   [OK] Test staff account restored to Active.")

    # 10. Audit Trail Verification
    print("\n[STEP 10] Testing Security Audit Ledger (GET /api/staff/meta/security-events)...")
    res_audit = client.get("/api/staff/meta/security-events", headers=admin_headers)
    assert res_audit.status_code == 200
    audit_events = res_audit.json()
    actions_found = {ev["action"] for ev in audit_events}
    print(f"   [OK] Security audit events recorded ({len(audit_events)} events):")
    for action in sorted(list(actions_found)):
        print(f"     - {action}")

    assert "ACCOUNT_LOCKED_AUTO" in actions_found, "Missing ACCOUNT_LOCKED_AUTO audit log"
    assert "ACCOUNT_UNLOCKED_ADMIN" in actions_found, "Missing ACCOUNT_UNLOCKED_ADMIN audit log"
    assert "ACCOUNT_DEACTIVATED_ADMIN" in actions_found, "Missing ACCOUNT_DEACTIVATED_ADMIN audit log"
    assert "ACCOUNT_ACTIVATED_ADMIN" in actions_found, "Missing ACCOUNT_ACTIVATED_ADMIN audit log"
    assert "PASSWORD_RESET_ADMIN" in actions_found, "Missing PASSWORD_RESET_ADMIN audit log"
    assert "STAFF_CREATED_ADMIN" in actions_found, "Missing STAFF_CREATED_ADMIN audit log"

    print("\n" + "=" * 70)
    print("ALL 10 ENTERPRISE IAM & RBAC ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_acceptance_tests()
