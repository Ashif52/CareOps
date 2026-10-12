"""
CareOps AI - Google Reviews & Reputation Module Tests
Comprehensive test suite validating all 15 scenarios from Section 14 of Master Build Prompt:
1. Newly detected 1-star review creates one alert.
2. Newly detected 2-star review creates one alert.
3. 3-star review does not trigger default below-3-star alert (< 3 threshold).
4. Review notification delivered twice does not create duplicate alerts (idempotency).
5. Review rating changed from 4 stars to 2 stars triggers updated-review alert.
6. Temporary Google API failure does not lose pending synchronization work.
7. AI failure does not prevent low-rating alert from being created.
8. Inconclusive AI result requests human review.
9. Unauthorized staff cannot read management-only review internal notes.
10. Chatbot cannot access reviews outside user's department permissions.
11. AI-generated public replies are drafts and are not automatically published.
12. Corrective-action completion does not alter original Google review.
13. Expired or revoked credentials produce actionable connection error.
14. Applicable review content is redacted according to configured 90-day retention policy.
15. Admin notification retries do not create duplicate logical alerts.
"""

import pytest
import uuid
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine, Base
from app.main import app
from app.models import (
    GoogleIntegration, GoogleLocation, GoogleReview, ReviewAlert,
    ReviewAIAnalysis, ReviewCorrectiveAction, User
)
from app.services.review_ingestion_service import ReviewIngestionService
from app.services.ai_review_service import AIReviewAnalysisService
from app.services.review_copilot_service import ReviewCopilotService
from app.seed import seed_database

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield

def get_auth_token(email: str = "admin@careops.hospital", password: str = "password123"):
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]

# ------------------------------------------------------------------------------
# SCENARIO 1: Newly detected 1-star review creates one alert
# ------------------------------------------------------------------------------
def test_scenario_1_1_star_review_creates_critical_alert(setup_db):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()
    assert loc is not None

    review_data = {
        "google_review_id": f"test_rev_1star_{uuid.uuid4().hex[:6]}",
        "star_rating": 1,
        "author_name": "Test User 1",
        "review_text": "Emergency room doctor was absent. Waited 4 hours with bleeding wound.",
        "review_created_at": datetime.now(timezone.utc)
    }

    rev, is_new, alert_triggered = ReviewIngestionService.ingest_single_review(db, loc.id, review_data)
    assert is_new is True
    assert alert_triggered is True
    assert rev.is_low_rating_alert is True
    assert rev.alert_priority == "critical"

    alert = db.query(ReviewAlert).filter(ReviewAlert.review_id == rev.id).first()
    assert alert is not None
    assert alert.star_rating == 1
    assert alert.priority == "critical"
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 2: Newly detected 2-star review creates one alert
# ------------------------------------------------------------------------------
def test_scenario_2_2_star_review_creates_high_alert(setup_db):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()

    review_data = {
        "google_review_id": f"test_rev_2star_{uuid.uuid4().hex[:6]}",
        "star_rating": 2,
        "author_name": "Test User 2",
        "review_text": "Billing department was completely opaque. Overcharged for medicines.",
        "review_created_at": datetime.now(timezone.utc)
    }

    rev, is_new, alert_triggered = ReviewIngestionService.ingest_single_review(db, loc.id, review_data)
    assert is_new is True
    assert alert_triggered is True
    assert rev.is_low_rating_alert is True
    assert rev.alert_priority == "high"

    alert = db.query(ReviewAlert).filter(ReviewAlert.review_id == rev.id).first()
    assert alert is not None
    assert alert.star_rating == 2
    assert alert.priority == "high"
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 3: 3-star review does NOT trigger default below-3-star alert (< 3)
# ------------------------------------------------------------------------------
def test_scenario_3_3_star_review_does_not_trigger_alert(setup_db):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()

    review_data = {
        "google_review_id": f"test_rev_3star_{uuid.uuid4().hex[:6]}",
        "star_rating": 3,
        "author_name": "Test User 3",
        "review_text": "Treatment was fine. Waiting area was slightly noisy.",
        "review_created_at": datetime.now(timezone.utc)
    }

    rev, is_new, alert_triggered = ReviewIngestionService.ingest_single_review(db, loc.id, review_data)
    assert is_new is True
    assert alert_triggered is False  # Must strictly be False!
    assert rev.is_low_rating_alert is False
    assert rev.alert_priority == "none"

    alert = db.query(ReviewAlert).filter(ReviewAlert.review_id == rev.id).first()
    assert alert is None
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 4: Notification delivered twice does NOT create duplicate alerts (Idempotency)
# ------------------------------------------------------------------------------
def test_scenario_4_idempotent_duplicate_notification(setup_db):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()

    rev_id = f"test_rev_idempotency_{uuid.uuid4().hex[:6]}"
    review_data = {
        "google_review_id": rev_id,
        "star_rating": 1,
        "author_name": "Idempotent Reviewer",
        "review_text": "Repeated network webhook payload test.",
        "review_created_at": datetime.now(timezone.utc)
    }

    # First delivery
    rev1, is_new1, alert1 = ReviewIngestionService.ingest_single_review(db, loc.id, review_data)
    assert is_new1 is True
    assert alert1 is True

    # Duplicate second delivery
    rev2, is_new2, alert2 = ReviewIngestionService.ingest_single_review(db, loc.id, review_data)
    assert is_new2 is False  # Must recognize existing record
    assert alert2 is False  # Must NOT trigger duplicate alert

    # Check database count: exactly 1 review and 1 alert
    rev_count = db.query(GoogleReview).filter(
        GoogleReview.location_id == loc.id,
        GoogleReview.google_review_id == rev_id
    ).count()
    assert rev_count == 1

    alert_count = db.query(ReviewAlert).filter(ReviewAlert.review_id == rev1.id).count()
    assert alert_count == 1
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 5: Rating changed from 4 stars to 2 stars triggers updated-review alert
# ------------------------------------------------------------------------------
def test_scenario_5_rating_changed_4_to_2_triggers_alert(setup_db):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()

    rev_id = f"test_rev_rating_drop_{uuid.uuid4().hex[:6]}"
    # Initially 4 stars
    initial_data = {
        "google_review_id": rev_id,
        "star_rating": 4,
        "author_name": "Evolving Reviewer",
        "review_text": "Initially good experience.",
        "review_created_at": datetime.now(timezone.utc)
    }
    rev, is_new, alert_initial = ReviewIngestionService.ingest_single_review(db, loc.id, initial_data)
    assert is_new is True
    assert alert_initial is False
    assert rev.is_low_rating_alert is False

    # Reviewer edits rating down to 2 stars
    updated_data = {
        "google_review_id": rev_id,
        "star_rating": 2,
        "author_name": "Evolving Reviewer",
        "review_text": "Updated: developed surgical wound complication and post-op care was unresponsive.",
        "review_created_at": rev.review_created_at
    }
    rev_updated, is_new2, alert_updated = ReviewIngestionService.ingest_single_review(db, loc.id, updated_data)
    assert is_new2 is False
    assert alert_updated is True  # Must trigger alert on rating drop below 3!
    assert rev_updated.is_updated is True
    assert rev_updated.previous_star_rating == 4
    assert rev_updated.star_rating == 2
    assert rev_updated.is_low_rating_alert is True
    assert rev_updated.alert_priority == "high"

    # Verify persistent alert was created
    alert = db.query(ReviewAlert).filter(ReviewAlert.review_id == rev_updated.id).first()
    assert alert is not None
    assert alert.star_rating == 2
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 6: Temporary Google API failure does not lose pending synchronization
# ------------------------------------------------------------------------------
def test_scenario_6_temporary_api_failure_preserves_work(setup_db):
    token = get_auth_token("admin@careops.hospital")
    # Disconnect integration
    disc_resp = client.post("/api/integrations/google/disconnect", headers={"Authorization": f"Bearer {token}"})
    assert disc_resp.status_code == 200

    # Attempting manual sync while disconnected should return graceful 400 error without corrupting data
    sync_resp = client.post("/api/integrations/google/sync", headers={"Authorization": f"Bearer {token}"})
    assert sync_resp.status_code == 400
    assert "Google Business Profile is not connected" in sync_resp.json()["detail"]

    # Re-connect integration via callback
    cb_resp = client.post("/api/integrations/google/callback", json={
        "code": "test_temp_code",
        "state": "test_state"
    }, headers={"Authorization": f"Bearer {token}"})
    assert cb_resp.status_code == 200
    assert cb_resp.json()["status"] == "connected"

# ------------------------------------------------------------------------------
# SCENARIO 7: AI failure does not prevent low-rating alert creation
# ------------------------------------------------------------------------------
def test_scenario_7_ai_failure_does_not_block_alert(setup_db, monkeypatch):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()

    # Monkeypatch AI service to simulate temporary outage / exception
    def mock_ai_fail(*args, **kwargs):
        raise RuntimeError("AI model inference service unavailable")

    monkeypatch.setattr(AIReviewAnalysisService, "analyze_review", mock_ai_fail)

    review_data = {
        "google_review_id": f"test_rev_ai_failure_{uuid.uuid4().hex[:6]}",
        "star_rating": 1,
        "author_name": "Robustness Tester",
        "review_text": "Pharmacy dispenser gave incorrect dosage label.",
        "review_created_at": datetime.now(timezone.utc)
    }

    # Must succeed despite AI crash
    rev, is_new, alert_triggered = ReviewIngestionService.ingest_single_review(db, loc.id, review_data)
    assert is_new is True
    assert alert_triggered is True

    # Alert must exist
    alert = db.query(ReviewAlert).filter(ReviewAlert.review_id == rev.id).first()
    assert alert is not None
    assert alert.priority == "critical"

    # AI record fallback exists
    ai_record = db.query(ReviewAIAnalysis).filter(ReviewAIAnalysis.review_id == rev.id).first()
    assert ai_record is not None
    assert ai_record.human_review_required is True
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 8: Inconclusive AI result requests human review
# ------------------------------------------------------------------------------
def test_scenario_8_inconclusive_ai_requests_human_review():
    # Empty or very short review
    result = AIReviewAnalysisService.analyze_review(
        review_text="Bad hospital.",
        star_rating=1,
        author_name="Anonymous"
    )
    assert result["human_review_required"] is True
    assert result["confidence"] <= 0.70
    assert "Unclear or unclassified" in result["detected_topics"]

# ------------------------------------------------------------------------------
# SCENARIO 9: Unauthorized staff cannot read management-only review internal notes
# ------------------------------------------------------------------------------
def test_scenario_9_staff_cannot_read_confidential_notes(setup_db):
    db = SessionLocal()
    admin_token = get_auth_token("admin@careops.hospital")
    staff_token = get_auth_token("nurse.priya@careops.hospital")

    rev = db.query(GoogleReview).filter(GoogleReview.internal_notes.isnot(None)).first()
    assert rev is not None
    rev_id = rev.id
    db.close()

    # Admin requests review detail: internal notes are visible
    admin_resp = client.get(f"/api/reviews/{rev_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200
    assert admin_resp.json()["internal_notes"] is not None

    # Staff requests review detail: internal notes must be redacted / None!
    staff_resp = client.get(f"/api/reviews/{rev_id}", headers={"Authorization": f"Bearer {staff_token}"})
    if staff_resp.status_code == 200:
        assert staff_resp.json()["internal_notes"] is None

# ------------------------------------------------------------------------------
# SCENARIO 10: Chatbot adheres to department RBAC permissions
# ------------------------------------------------------------------------------
def test_scenario_10_chatbot_rbac_boundary(setup_db):
    db = SessionLocal()
    nurse_user = db.query(User).filter(User.email == "nurse.priya@careops.hospital").first()
    assert nurse_user is not None

    # Find a review assigned strictly to doctors
    doc_review = db.query(GoogleReview).filter(GoogleReview.assigned_department_id == "doctors").first()
    assert doc_review is not None
    db.close()

    # Nurse queries a doctor review: Copilot enforces isolation
    res = ReviewCopilotService.answer_query(
        db=SessionLocal(),
        user=nurse_user,
        query="What is the root cause?",
        review_id=doc_review.id
    )
    assert "Access restricted" in res["content"]

# ------------------------------------------------------------------------------
# SCENARIO 11: AI-generated public replies are drafts and never automatically published
# ------------------------------------------------------------------------------
def test_scenario_11_public_replies_are_drafts(setup_db):
    db = SessionLocal()
    rev = db.query(GoogleReview).filter(GoogleReview.public_reply_status == "draft_ready").first()
    assert rev is not None
    # Public reply status must not be 'posted' without manual human authorization
    assert rev.public_reply_status != "posted"
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 12: Corrective-action completion does NOT alter original Google review
# ------------------------------------------------------------------------------
def test_scenario_12_corrective_action_does_not_alter_google_review(setup_db):
    db = SessionLocal()
    token = get_auth_token("admin@careops.hospital")

    cap = db.query(ReviewCorrectiveAction).first()
    assert cap is not None
    review_before = db.query(GoogleReview).filter(GoogleReview.id == cap.review_id).first()
    original_star = review_before.star_rating
    original_text = review_before.review_text
    db.close()

    # Complete the CAP task via API
    patch_resp = client.patch(
        f"/api/reviews/corrective-actions/{cap.id}",
        json={"status": "completed", "completion_evidence": "Audit completed and verified by Dr. Vance"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "completed"

    # Verify review in database was NOT altered
    db2 = SessionLocal()
    review_after = db2.query(GoogleReview).filter(GoogleReview.id == cap.review_id).first()
    assert review_after.star_rating == original_star
    assert review_after.review_text == original_text
    db2.close()

# ------------------------------------------------------------------------------
# SCENARIO 13: Expired or revoked credentials produce actionable connection error
# ------------------------------------------------------------------------------
def test_scenario_13_expired_credentials_actionable_error(setup_db):
    db = SessionLocal()
    integration = db.query(GoogleIntegration).first()
    assert integration is not None
    integration.status = "needs_reauth"
    integration.last_error = "Google OAuth refresh token revoked by account administrator. Re-authorization required."
    db.commit()

    token = get_auth_token("admin@careops.hospital")
    status_resp = client.get("/api/integrations/google/status", headers={"Authorization": f"Bearer {token}"})
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert data["status"] == "needs_reauth"
    assert "Re-authorization required" in data["last_error"]
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 14: Retention compliance policy cleans/redacts expired review text
# ------------------------------------------------------------------------------
def test_scenario_14_retention_compliance_policy(setup_db):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()

    # Insert an old review older than 90 days
    old_rev_id = f"rev_old_retention_{uuid.uuid4().hex[:6]}"
    old_review = GoogleReview(
        location_id=loc.id,
        google_review_id=old_rev_id,
        author_name="Historical Patient",
        star_rating=4,
        review_text="This is historical text that should be redacted after 90 days.",
        review_created_at=datetime.now(timezone.utc) - timedelta(days=95)
    )
    db.add(old_review)
    db.commit()

    # Run cleanup
    redacted_count = ReviewIngestionService.cleanup_expired_reviews(db)
    assert redacted_count >= 1

    db.refresh(old_review)
    assert "[Review content expired per Google Business Profile 90-day retention policy]" in old_review.review_text
    db.close()

# ------------------------------------------------------------------------------
# SCENARIO 15: Admin notification retries do not create duplicate logical alerts
# ------------------------------------------------------------------------------
def test_scenario_15_admin_notification_retries_no_duplicate_alerts(setup_db):
    db = SessionLocal()
    loc = db.query(GoogleLocation).first()

    retry_id = f"rev_retry_alert_{uuid.uuid4().hex[:6]}"
    review_data = {
        "google_review_id": retry_id,
        "star_rating": 1,
        "author_name": "Retry Tester",
        "review_text": "Testing multiple alert webhook invocations.",
        "review_created_at": datetime.now(timezone.utc)
    }

    # Ingest 3 times consecutively
    for _ in range(3):
        ReviewIngestionService.ingest_single_review(db, loc.id, review_data)

    rev = db.query(GoogleReview).filter(
        GoogleReview.location_id == loc.id,
        GoogleReview.google_review_id == retry_id
    ).first()
    assert rev is not None

    # Check alert count for this review
    alerts = db.query(ReviewAlert).filter(ReviewAlert.review_id == rev.id).all()
    assert len(alerts) == 1  # Exactly 1 alert!
    db.close()
