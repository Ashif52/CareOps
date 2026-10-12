import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User

client = TestClient(app)

def test_user_self_registration_and_login():
    db = SessionLocal()
    # Clean up test user if exists
    test_email = "testuser_reg_99@hospital.com"
    existing = db.query(User).filter(User.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    # 1. Register new user
    reg_payload = {
        "name": "Ashif Registration Test",
        "email": test_email,
        "password": "SecurePassword@2026",
        "role": "admin",
        "department_id": "maintenance",
        "designation": "Hospital Operations Director",
        "phone": "+91 98765 12345"
    }

    res = client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == test_email
    assert data["user"]["role"] == "admin"
    assert data["user"]["name"] == "Ashif Registration Test"

    # 2. Verify subsequent login with newly created credentials
    login_res = client.post("/api/auth/login", json={
        "email": test_email,
        "password": "SecurePassword@2026"
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == test_email

    # 3. Duplicate registration should be rejected
    dup_res = client.post("/api/auth/register", json=reg_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()
