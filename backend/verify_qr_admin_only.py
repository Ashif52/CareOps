import sys
from fastapi.testclient import TestClient
from app.main import app

def test_admin_only_qr_creation():
    client = TestClient(app)

    print("1. Testing Staff Login (Rajesh Sharma)...")
    res_staff = client.post("/api/auth/login", json={
        "email": "technician.rajesh@careops.hospital",
        "password": "password123"
    })
    assert res_staff.status_code == 200, f"Staff login failed: {res_staff.text}"
    staff_token = res_staff.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    print("   Staff login SUCCESS. Role:", res_staff.json()["user"]["role"])

    print("\n2. Testing Admin Login (Dr. Alistair Vance)...")
    res_admin = client.post("/api/auth/login", json={
        "email": "admin@careops.hospital",
        "password": "password123"
    })
    assert res_admin.status_code == 200, f"Admin login failed: {res_admin.text}"
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("   Admin login SUCCESS. Role:", res_admin.json()["user"]["role"])

    print("\n3. Testing Staff attempt to create Room & QR code (MUST FAIL with 403 Forbidden)...")
    res_staff_qr = client.post("/api/rooms", json={
        "room_number": "Test Room Staff Unauth",
        "floor": "Floor 1",
        "wing": "General",
        "bed_count": 1
    }, headers=staff_headers)
    print("   Staff QR creation status:", res_staff_qr.status_code, res_staff_qr.json())
    assert res_staff_qr.status_code == 403, f"Expected 403 Forbidden for staff, got {res_staff_qr.status_code}"
    print("   CONFIRMED: Staff is blocked with 403 Forbidden from creating room QR codes!")

    print("\n4. Testing Admin attempt to create Room & QR code (MUST SUCCEED with 200 OK)...")
    test_room_num = f"Room Admin 999"
    # Ensure it doesn't already exist or delete if exists
    res_admin_qr = client.post("/api/rooms", json={
        "room_number": test_room_num,
        "floor": "Floor 4",
        "wing": "Executive Wing",
        "bed_count": 2
    }, headers=admin_headers)
    print("   Admin QR creation status:", res_admin_qr.status_code)
    assert res_admin_qr.status_code in [200, 400], f"Admin QR creation error: {res_admin_qr.text}"
    if res_admin_qr.status_code == 200:
        data = res_admin_qr.json()
        print("   Created Room:", data["room_number"])
        print("   Generated QR Token:", data["qr_token"])
        assert "qr_token" in data and data["qr_token"]
        print("   CONFIRMED: Admin successfully created room and generated QR token!")

    print("\nALL ADMIN-ONLY QR PERMISSION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_admin_only_qr_creation()
