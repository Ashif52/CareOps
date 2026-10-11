import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta

from app.database import Base, engine, get_db
from app.main import app
from app.models import User, Department, Room, Ticket, Evidence, AIVerificationJob, TicketNote, SLAPolicy
from app.seed import seed_database
from app.services.ai_vision_service import AIVisionService
from app.services.sla_engine import SLAEngine

# Ensure tables and seed exist
Base.metadata.create_all(bind=engine)
seed_database()

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_departments_and_rooms_seeded():
    # Verify departments
    resp = client.get("/api/departments")
    assert resp.status_code == 200
    depts = resp.json()
    assert len(depts) >= 6
    dept_ids = [d["id"] for d in depts]
    for required in ["maintenance", "doctors", "nursing", "housekeeping", "billing", "pharmacy"]:
        assert required in dept_ids

    # Verify rooms
    resp_rooms = client.get("/api/rooms")
    assert resp_rooms.status_code == 200
    rooms = resp_rooms.json()
    assert len(rooms) >= 4

def test_auth_and_roles():
    # Valid login
    login_resp = client.post("/api/auth/login", json={
        "email": "admin@careops.hospital",
        "password": "password123"
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # Authenticated /me endpoint
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == "admin"

    # Bad password
    bad_resp = client.post("/api/auth/login", json={
        "email": "admin@careops.hospital",
        "password": "wrong_password"
    })
    assert bad_resp.status_code == 401

def test_patient_qr_portal_and_privacy_boundary():
    # 1. Resolve room context via QR token
    token = "CARE-RM204-7X9Q"
    room_resp = client.get(f"/api/patient/room/{token}")
    assert room_resp.status_code == 200
    room_data = room_resp.json()
    assert room_data["room_number"] == "Room 204"
    assert len(room_data["departments"]) >= 6

    # 2. Patient submits issue
    submit_resp = client.post("/api/patient/submit", json={
        "qr_token": token,
        "department_id": "maintenance",
        "category": "Lighting",
        "description": "Bedside reading lamp switch sparking when toggled.",
        "patient_contact": "+91 99999 88888"
    })
    assert submit_resp.status_code == 200
    created = submit_resp.json()
    ticket_num = created["ticket_number"]
    assert ticket_num.startswith("TKT-MNT-")

    # 3. Patient checks status - STRICT PRIVACY VERIFICATION
    track_resp = client.get(f"/api/patient/ticket/{ticket_num}")
    assert track_resp.status_code == 200
    track_data = track_resp.json()
    assert track_data["room_number"] == "Room 204"
    assert "updates" in track_data
    # Assert internal notes and staff identity details are NOT exposed
    assert "assigned_staff_name" not in track_data
    assert "internal_notes" not in track_data
    for update in track_data["updates"]:
        assert "Internal" not in update["message"]

def test_staff_ticket_workflow():
    # Login as maintenance technician Rajesh
    login_resp = client.post("/api/auth/login", json={
        "email": "technician.rajesh@careops.hospital",
        "password": "password123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch tickets list
    t_list_resp = client.get("/api/tickets", headers=headers)
    assert t_list_resp.status_code == 200
    tickets = t_list_resp.json()
    assert len(tickets) > 0

    tkt = tickets[0]
    tkt_id = tkt["id"]

    # Add internal note (permitted for staff)
    note_resp = client.post(f"/api/tickets/{tkt_id}/notes", json={
        "content": "Internal inspection note: checked breaker 4B.",
        "is_internal": True
    }, headers=headers)
    assert note_resp.status_code == 200

def test_ai_verification_rules():
    """Validates the AI Vision analysis engine against real clinical maintenance rules"""
    db = next(get_db())
    
    fan_ticket = db.query(Ticket).filter(Ticket.category == "Ceiling Fan").first()
    assert fan_ticket is not None
    
    # 1. Test Static Photo for Fan: AI must recognize still photo cannot prove rotation!
    static_after = Evidence(
        ticket_id=fan_ticket.id,
        stage="after",
        media_type="image",  # STILL PHOTO
        file_url="/uploads/fake_still_fan.jpg",
        equipment_type="Ceiling Fan"
    )
    before_ev = db.query(Evidence).filter(Evidence.ticket_id == fan_ticket.id, Evidence.stage == "before").first()
    
    result = AIVisionService.analyze_ticket_evidence(fan_ticket, before_ev, static_after)
    assert result["after_repair_functional_evidence"] == "static_unverified"
    assert result["ai_recommendation"] == "inconclusive"
    assert "A still photograph cannot demonstrate rotation" in str(result["inconsistencies"])
    assert result["review_requirement"] == "mandatory_human_review"

    # 2. Test Video After: AI detects dynamic movement
    video_after = Evidence(
        ticket_id=fan_ticket.id,
        stage="after",
        media_type="video",  # VIDEO
        file_url="/uploads/fan_rotating.mp4",
        equipment_type="Ceiling Fan"
    )
    result_video = AIVisionService.analyze_ticket_evidence(fan_ticket, before_ev, video_after)
    assert result_video["after_repair_functional_evidence"] == "movement_observed"
    assert result_video["ai_recommendation"] == "likely_resolved"

def test_sla_escalation_engine():
    """Validates background SLA breach check cycle"""
    stats = SLAEngine.run_sla_check_cycle()
    assert "scanned" in stats
    assert stats["scanned"] >= 1
