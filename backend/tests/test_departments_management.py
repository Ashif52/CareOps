import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Department, User, Ticket
from app.seed import seed_database

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    seed_database()

def get_admin_token():
    resp = client.post("/api/auth/login", json={
        "email": "admin@careops.hospital",
        "password": "password123"
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]

def get_staff_token():
    resp = client.post("/api/auth/login", json={
        "login_identifier": "EMP-MNT-1001",
        "password": "password123"
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]

def test_department_management_rbac():
    """Verify staff cannot create or delete departments, only admin can."""
    staff_token = get_staff_token()
    admin_token = get_admin_token()

    # Staff attempt to create department -> 403 Forbidden
    resp = client.post(
        "/api/departments",
        json={"id": "test_radiology", "name": "Radiology", "code": "RAD", "description": "X-Ray and MRI"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp.status_code == 403, "Staff must be forbidden from creating departments"

    # Admin creates department -> 200 OK
    resp_admin = client.post(
        "/api/departments",
        json={"id": "test_radiology", "name": "Radiology & Imaging", "code": "RAD", "description": "X-Ray, CT, and MRI"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_admin.status_code == 200
    data = resp_admin.json()
    assert data["id"] == "test_radiology"
    assert data["code"] == "RAD"

    # Admin updates department -> 200 OK
    resp_update = client.put(
        "/api/departments/test_radiology",
        json={"name": "Advanced Radiology & Diagnostic Imaging", "description": "Upgraded imaging center"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["name"] == "Advanced Radiology & Diagnostic Imaging"

    # Admin toggles status -> 200 OK
    resp_toggle = client.patch(
        "/api/departments/test_radiology/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_toggle.status_code == 200
    assert resp_toggle.json()["is_active"] is False

    # Check dependency endpoint
    resp_dep = client.get(
        "/api/departments/test_radiology/dependencies",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_dep.status_code == 200
    dep_data = resp_dep.json()
    assert dep_data["can_delete"] is True

    # Safe delete clean department -> 200 OK
    resp_del = client.delete(
        "/api/departments/test_radiology",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_del.status_code == 200
    assert resp_del.json()["success"] is True

def test_safe_delete_enforcement_with_active_dependencies():
    """Verify safe delete prevents deleting a department with active staff or unresolved tickets."""
    admin_token = get_admin_token()

    # Maintenance has active staff and unresolved tickets
    resp_dep = client.get(
        "/api/departments/maintenance/dependencies",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_dep.status_code == 200
    dep_data = resp_dep.json()
    assert dep_data["can_delete"] is False
    assert dep_data["active_staff_count"] > 0 or dep_data["unresolved_tickets_count"] > 0
    assert dep_data["blocking_reason"] is not None

    # Attempt to delete maintenance directly -> must be rejected with 400 Bad Request
    resp_del = client.delete(
        "/api/departments/maintenance",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp_del.status_code == 400
    assert "Cannot delete department" in resp_del.json()["detail"]
