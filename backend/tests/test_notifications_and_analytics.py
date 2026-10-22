import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from app.main import app
from app.database import get_db, SessionLocal
from app.models import User, Department, Room, Ticket, Notification, DepartmentSupervisor
from app.services.ticket_service import TicketService
from app.services.in_app_notification_service import InAppNotificationService

client = TestClient(app)

def get_token(email: str = "superadmin@careops.hospital", password: str = "password123") -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]

def test_role_based_notification_creation_and_isolation():
    db = SessionLocal()
    try:
        # Maintenance supervisor Mohan
        mohan = db.query(User).filter(User.email == "mohan.supervisor@careops.hospital").first()
        # Maintenance staff Ashif
        ashif = db.query(User).filter(User.email == "ashif.staff@careops.hospital").first()
        # Dietitian supervisor Sarah
        sarah = db.query(User).filter(User.email == "dietitian.lead@careops.hospital").first()
        # Admin
        admin = db.query(User).filter(User.role == "admin").first()
        assert mohan and ashif and admin, "Seed users missing"

        room = db.query(Room).first()
        maint_dept = db.query(Department).filter(Department.id == "maintenance").first()
        assert room and maint_dept

        # Clean previous notifications for test users
        db.query(Notification).filter(Notification.recipient_id.in_([mohan.id, ashif.id, admin.id] + ([sarah.id] if sarah else []))).delete()
        db.commit()

        # 1. Patient creates a ticket for Maintenance
        ticket = TicketService.create_patient_ticket(
            db=db,
            room=room,
            department=maint_dept,
            category="Electrical & Lighting",
            description="Reading lamp bulb is flickering in room 101",
            patient_contact="+91 98765 43210",
            patient_email="patient.test@example.com"
        )
        assert ticket is not None

        # Verify Mohan (maintenance supervisor) received the notification
        mohan_notifs = db.query(Notification).filter(
            Notification.recipient_id == mohan.id,
            Notification.ticket_id == ticket.id
        ).all()
        assert len(mohan_notifs) >= 1
        assert "New Service Request" in mohan_notifs[0].title
        assert mohan_notifs[0].department_id == "maintenance"

        # Verify Admin received alert
        admin_notifs = db.query(Notification).filter(
            Notification.recipient_id == admin.id,
            Notification.ticket_id == ticket.id
        ).all()
        assert len(admin_notifs) >= 1

        # Verify Sarah (dietitian supervisor) did NOT receive the maintenance notification
        if sarah:
            sarah_notifs = db.query(Notification).filter(
                Notification.recipient_id == sarah.id,
                Notification.ticket_id == ticket.id
            ).all()
            assert len(sarah_notifs) == 0

        # Verify Ashif (technician) did NOT receive anything yet before assignment
        ashif_notifs_before = db.query(Notification).filter(
            Notification.recipient_id == ashif.id,
            Notification.ticket_id == ticket.id
        ).all()
        assert len(ashif_notifs_before) == 0

        # 2. Supervisor assigns ticket to Ashif
        TicketService.assign_ticket(
            db=db,
            ticket=ticket,
            supervisor=mohan,
            staff_id=ashif.id,
            note="Please replace bulb"
        )

        # Now Ashif MUST receive assignment notification
        ashif_notifs = db.query(Notification).filter(
            Notification.recipient_id == ashif.id,
            Notification.ticket_id == ticket.id,
            Notification.event_type == "TICKET_ASSIGNED"
        ).all()
        assert len(ashif_notifs) == 1
        assert "New Task Assigned" in ashif_notifs[0].title

        # 3. Technician Ashif starts work
        TicketService.start_work(
            db=db,
            ticket=ticket,
            user=ashif,
            note="Started replacing reading lamp bulb"
        )

        # Supervisor Mohan must receive work started notification
        mohan_work_started = db.query(Notification).filter(
            Notification.recipient_id == mohan.id,
            Notification.ticket_id == ticket.id,
            Notification.event_type == "WORK_STARTED"
        ).all()
        assert len(mohan_work_started) == 1

        # 4. Technician submits resolution
        TicketService.submit_resolution(
            db=db,
            ticket=ticket,
            user=ashif,
            summary="Replaced bulb with 9W LED, tested switch.",
            parts="9W LED bulb"
        )

        # Supervisor Mohan must receive resolution submitted notification (awaiting verification)
        mohan_res_notif = db.query(Notification).filter(
            Notification.recipient_id == mohan.id,
            Notification.ticket_id == ticket.id,
            Notification.event_type == "RESOLUTION_SUBMITTED"
        ).all()
        assert len(mohan_res_notif) == 1
        assert "Awaiting Verification" in mohan_res_notif[0].title

        # 5. Supervisor closes ticket
        TicketService.close_ticket(
            db=db,
            ticket=ticket,
            user=mohan,
            approval_note="Inspected. Work verified complete."
        )

        # Technician Ashif receives closed/approval notification
        ashif_closed_notif = db.query(Notification).filter(
            Notification.recipient_id == ashif.id,
            Notification.ticket_id == ticket.id,
            Notification.event_type == "TICKET_CLOSED"
        ).all()
        assert len(ashif_closed_notif) == 1
        assert "Task Approved & Closed" in ashif_closed_notif[0].title

    finally:
        db.close()

def test_notification_endpoints_and_authorization():
    # 1. Login as Ashif
    ashif_token = get_token("ashif.staff@careops.hospital")
    headers_ashif = {"Authorization": f"Bearer {ashif_token}"}

    # Fetch notifications
    resp = client.get("/api/notifications", headers=headers_ashif)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "unread_count" in data

    # Unread count endpoint
    count_resp = client.get("/api/notifications/unread-count", headers=headers_ashif)
    assert count_resp.status_code == 200
    assert "unread_count" in count_resp.json()

    if data["items"]:
        first_notif = data["items"][0]
        notif_id = first_notif["id"]

        # 2. Login as Sarah (dietitian supervisor) and attempt to mark Ashif's notification
        sarah_token = get_token("dietitian.lead@careops.hospital")
        headers_sarah = {"Authorization": f"Bearer {sarah_token}"}
        forbidden_resp = client.post(f"/api/notifications/{notif_id}/mark-read", headers=headers_sarah)
        assert forbidden_resp.status_code == 404, "Cross-user notification modification must be rejected"

        # 3. Ashif marks his own notification as read
        mark_resp = client.post(f"/api/notifications/{notif_id}/mark-read", headers=headers_ashif)
        assert mark_resp.status_code == 200
        assert mark_resp.json()["is_read"] is True

        # 4. Mark all as read
        mark_all_resp = client.post("/api/notifications/mark-all-read", headers=headers_ashif)
        assert mark_all_resp.status_code == 200
        assert mark_all_resp.json()["success"] is True

        # Verify unread count is now 0
        verify_count = client.get("/api/notifications/unread-count", headers=headers_ashif)
        assert verify_count.json()["unread_count"] == 0

def test_notification_event_deduplication():
    db = SessionLocal()
    try:
        mohan = db.query(User).filter(User.email == "mohan.supervisor@careops.hospital").first()
        assert mohan

        # Dispatch with same dedup_key multiple times
        dedup_key = f"TEST_DEDUP_KEY_{int(datetime.now().timestamp())}"

        n1 = InAppNotificationService.create_notification(
            db=db,
            recipient_id=mohan.id,
            event_type="TEST_EVENT",
            title="Deduplication Test Alert",
            message="Initial event",
            dedup_key=dedup_key
        )
        assert n1 is not None

        # Repeat trigger with exact same dedup_key
        n2 = InAppNotificationService.create_notification(
            db=db,
            recipient_id=mohan.id,
            event_type="TEST_EVENT",
            title="Deduplication Test Alert Duplicate",
            message="Second event attempt",
            dedup_key=dedup_key
        )
        assert n2 is not None
        assert n1.id == n2.id, "Duplicate alert with identical dedup_key must return existing record without creating duplicate"

        # Count total in DB with this dedup_key
        count = db.query(Notification).filter(Notification.dedup_key == dedup_key).count()
        assert count == 1
    finally:
        db.close()

def test_role_based_analytics_and_department_scoping():
    # 1. Admin gets organization-wide analytics
    admin = SessionLocal().query(User).filter(User.role == "admin").first()
    admin_token = get_token(admin.email)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_analytics = client.get("/api/analytics/dashboard?timeframe=7d", headers=admin_headers)
    assert admin_analytics.status_code == 200
    a_data = admin_analytics.json()

    # Verify 8 KPIs present
    kpis = a_data["kpis"]
    assert "total_open_tickets" in kpis
    assert "unacknowledged_tickets" in kpis
    assert "in_progress_tickets" in kpis
    assert "overdue_tickets" in kpis
    assert "awaiting_verification" in kpis
    assert "completed_tickets" in kpis
    assert "avg_resolution_time_minutes" in kpis
    assert "sla_compliance_rate" in kpis
    assert "comparisons" in kpis

    # Verify 7 Charts present
    charts = a_data["charts"]
    assert "volume_over_time" in charts
    assert "tickets_by_department" in charts
    assert "status_distribution" in charts
    assert "sla_performance" in charts
    assert "avg_resolution_time_by_department" in charts
    assert "workload_distribution" in charts
    assert "ticket_trends" in charts

    # 2. Supervisor Mohan gets scoped analytics
    mohan_token = get_token("mohan.supervisor@careops.hospital")
    mohan_headers = {"Authorization": f"Bearer {mohan_token}"}

    mohan_analytics = client.get("/api/analytics/dashboard?timeframe=7d", headers=mohan_headers)
    assert mohan_analytics.status_code == 200
    m_data = mohan_analytics.json()
    assert m_data["scoped_department"] == "maintenance"

    # Supervisor attempts to access unrelated department analytics -> Must return 403 Forbidden
    forbidden_resp = client.get("/api/analytics/dashboard?department_id=dietitian", headers=mohan_headers)
    assert forbidden_resp.status_code == 403

    # 3. Timeframe tests: 24h, 30d, 90d
    for tf in ["24h", "30d", "90d"]:
        tf_resp = client.get(f"/api/analytics/dashboard?timeframe={tf}", headers=admin_headers)
        assert tf_resp.status_code == 200
        assert tf_resp.json()["timeframe"] == tf
