"""
CareOps AI - Google Review Ingestion & Low-Rating Alert Engine
Processes incoming review batches, handles Cloud Pub/Sub real-time hooks,
enforces idempotent storage keyed by (location_id, google_review_id),
detects rating updates, triggers strict below-3-star alerts, and runs AI analysis.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.config import settings
from app.models import (
    GoogleLocation, GoogleReview, ReviewAlert, ReviewAIAnalysis,
    AuditLog, User
)
from app.services.ai_review_service import AIReviewAnalysisService

logger = logging.getLogger("careops.review_ingestion")

def utc_now():
    return datetime.now(timezone.utc)

class ReviewIngestionService:
    @staticmethod
    def ingest_single_review(
        db: Session,
        location_id: int,
        review_data: Dict[str, Any]
    ) -> Tuple[GoogleReview, bool, bool]:
        """
        Idempotently ingests or updates a Google review.
        Returns: (GoogleReview, is_new: bool, alert_triggered: bool)
        """
        google_review_id = str(review_data["google_review_id"])
        star_rating = int(review_data["star_rating"])
        review_text = review_data.get("review_text")
        author_name = review_data.get("author_name", "Google Reviewer")
        author_photo_url = review_data.get("author_photo_url")
        original_review_url = review_data.get("original_review_url")
        review_created_at = review_data.get("review_created_at") or utc_now()

        # Check existing review
        existing = db.query(GoogleReview).filter(
            GoogleReview.location_id == location_id,
            GoogleReview.google_review_id == google_review_id
        ).first()

        alert_triggered = False

        if existing:
            # Check if updated (rating or text change)
            old_rating = existing.star_rating
            old_text = existing.review_text
            rating_changed = (old_rating != star_rating)
            text_changed = (old_text != review_text)

            if rating_changed or text_changed:
                existing.previous_star_rating = old_rating
                existing.star_rating = star_rating
                existing.review_text = review_text
                existing.is_updated = True
                existing.review_updated_at = utc_now()
                existing.author_name = author_name
                if author_photo_url:
                    existing.author_photo_url = author_photo_url

                # Log immutable audit event for review update
                audit = AuditLog(
                    ticket_id=None,
                    action="GOOGLE_REVIEW_UPDATED",
                    actor_name="Google Review Ingestion Sync",
                    actor_role="system",
                    details=json.dumps({
                        "google_review_id": google_review_id,
                        "location_id": location_id,
                        "old_rating": old_rating,
                        "new_rating": star_rating,
                        "text_changed": text_changed
                    })
                )
                db.add(audit)

                # Low-Rating Alert Rule for Updates:
                # Trigger an alert if rating drops from >= 3 stars to strictly below 3 stars (< 3)
                if old_rating >= 3 and star_rating < 3:
                    existing.is_low_rating_alert = True
                    existing.alert_priority = "critical" if star_rating == 1 else "high"
                    
                    # Ensure alert record exists without duplicating
                    alert_record = db.query(ReviewAlert).filter(ReviewAlert.review_id == existing.id).first()
                    if not alert_record:
                        alert_record = ReviewAlert(
                            review_id=existing.id,
                            star_rating=star_rating,
                            priority=existing.alert_priority,
                            alert_status="new",
                            notification_status="delivered",
                            notification_sent_at=utc_now()
                        )
                        db.add(alert_record)
                        alert_triggered = True
                    else:
                        alert_record.star_rating = star_rating
                        alert_record.priority = existing.alert_priority
                        alert_record.alert_status = "new"
                        alert_triggered = True

                # Re-run AI analysis if text or rating changed
                analysis_data = AIReviewAnalysisService.analyze_review(
                    review_text=review_text,
                    star_rating=star_rating,
                    author_name=author_name
                )
                existing_ai = db.query(ReviewAIAnalysis).filter(ReviewAIAnalysis.review_id == existing.id).first()
                if existing_ai:
                    existing_ai.review_summary = analysis_data["review_summary"]
                    existing_ai.detected_topics = json.dumps(analysis_data["detected_topics"])
                    existing_ai.sentiment = analysis_data["sentiment"]
                    existing_ai.severity = analysis_data["severity"]
                    existing_ai.suggested_department = analysis_data["suggested_department"]
                    existing_ai.possible_root_causes = json.dumps(analysis_data["possible_root_causes"])
                    existing_ai.recommended_actions = json.dumps(analysis_data["recommended_actions"])
                    existing_ai.evidence_needed = json.dumps(analysis_data["evidence_needed"])
                    existing_ai.suggested_public_reply = analysis_data["suggested_public_reply"]
                    existing_ai.confidence = analysis_data["confidence"]
                    existing_ai.human_review_required = analysis_data["human_review_required"]
                else:
                    new_ai = ReviewAIAnalysis(
                        review_id=existing.id,
                        review_summary=analysis_data["review_summary"],
                        detected_topics=json.dumps(analysis_data["detected_topics"]),
                        sentiment=analysis_data["sentiment"],
                        severity=analysis_data["severity"],
                        suggested_department=analysis_data["suggested_department"],
                        possible_root_causes=json.dumps(analysis_data["possible_root_causes"]),
                        recommended_actions=json.dumps(analysis_data["recommended_actions"]),
                        evidence_needed=json.dumps(analysis_data["evidence_needed"]),
                        suggested_public_reply=analysis_data["suggested_public_reply"],
                        confidence=analysis_data["confidence"],
                        human_review_required=analysis_data["human_review_required"]
                    )
                    db.add(new_ai)

                db.commit()
                return existing, False, alert_triggered

            return existing, False, False

        # --- Brand New Review ---
        # Alert Rule: strictly star_rating < 3 (1-star = critical, 2-star = high, 3-star = no alert)
        is_low_rating = (star_rating < settings.REVIEW_ALERT_STAR_THRESHOLD)
        alert_priority = "critical" if star_rating == 1 else "high" if star_rating == 2 else "none"

        new_review = GoogleReview(
            location_id=location_id,
            google_review_id=google_review_id,
            author_name=author_name,
            author_photo_url=author_photo_url,
            star_rating=star_rating,
            previous_star_rating=None,
            review_text=review_text,
            original_review_url=original_review_url,
            review_created_at=review_created_at,
            is_updated=False,
            is_low_rating_alert=is_low_rating,
            alert_priority=alert_priority,
            investigation_status="uninvestigated" if is_low_rating else "resolved",
            public_reply_status="not_replied"
        )
        db.add(new_review)
        db.flush()  # Obtain ID

        # 1. Create persistent Alert Record before notification delivery
        if is_low_rating:
            alert_record = ReviewAlert(
                review_id=new_review.id,
                star_rating=star_rating,
                priority=alert_priority,
                alert_status="new",
                notification_status="delivered",  # In-app alert immediately posted
                notification_sent_at=utc_now()
            )
            db.add(alert_record)
            alert_triggered = True

            # Audit record
            audit = AuditLog(
                ticket_id=None,
                action="GOOGLE_REVIEW_LOW_RATING_ALERT",
                actor_name="Review Ingestion Engine",
                actor_role="system",
                details=json.dumps({
                    "review_id": new_review.id,
                    "google_review_id": google_review_id,
                    "star_rating": star_rating,
                    "priority": alert_priority
                })
            )
            db.add(audit)

        # 2. Run AI Review Analysis
        try:
            analysis_data = AIReviewAnalysisService.analyze_review(
                review_text=review_text,
                star_rating=star_rating,
                author_name=author_name
            )
            new_review.assigned_department_id = analysis_data.get("suggested_department") if analysis_data.get("suggested_department") != "general" else None
            new_review.public_reply_draft = analysis_data.get("suggested_public_reply")

            ai_record = ReviewAIAnalysis(
                review_id=new_review.id,
                review_summary=analysis_data["review_summary"],
                detected_topics=json.dumps(analysis_data["detected_topics"]),
                sentiment=analysis_data["sentiment"],
                severity=analysis_data["severity"],
                suggested_department=analysis_data["suggested_department"],
                possible_root_causes=json.dumps(analysis_data["possible_root_causes"]),
                recommended_actions=json.dumps(analysis_data["recommended_actions"]),
                evidence_needed=json.dumps(analysis_data["evidence_needed"]),
                suggested_public_reply=analysis_data["suggested_public_reply"],
                confidence=analysis_data["confidence"],
                human_review_required=analysis_data["human_review_required"],
                model_version=analysis_data.get("model_version", "careops-reputation-ai-v1.0")
            )
            db.add(ai_record)
        except Exception as ai_err:
            logger.error(f"AI analysis failed for review {new_review.id}: {ai_err}")
            # AI failure MUST NOT block review ingestion or alert creation!
            fallback_ai = ReviewAIAnalysis(
                review_id=new_review.id,
                review_summary=f"{star_rating}-star rating recorded (AI analysis pending manual review).",
                detected_topics=json.dumps(["General service"]),
                sentiment="negative" if star_rating <= 2 else "neutral" if star_rating == 3 else "positive",
                severity="critical" if star_rating == 1 else "high" if star_rating == 2 else "low",
                suggested_department="general",
                possible_root_causes=json.dumps(["Automated AI service temporarily unavailable"]),
                recommended_actions=json.dumps(["Conduct manual clinical supervisor review"]),
                evidence_needed=json.dumps([]),
                suggested_public_reply=None,
                confidence=0.40,
                human_review_required=True,
                model_version="fallback-heuristic"
            )
            db.add(fallback_ai)

        db.commit()
        return new_review, True, alert_triggered

    @staticmethod
    def cleanup_expired_reviews(db: Session) -> int:
        """
        Enforces Google Business Profile API data retention policy:
        Removes cached review text beyond settings.REVIEW_RETENTION_DAYS (90 days)
        while preserving internal corrective action tasks and audit records.
        """
        cutoff_date = utc_now() - timedelta(days=settings.REVIEW_RETENTION_DAYS)
        expired_reviews = db.query(GoogleReview).filter(
            GoogleReview.review_created_at < cutoff_date
        ).all()

        count = len(expired_reviews)
        for r in expired_reviews:
            # We clear cached third-party text to comply with retention terms
            r.review_text = "[Review content expired per Google Business Profile 90-day retention policy]"
            r.author_name = "Anonymous Reviewer"
            r.author_photo_url = None

        db.commit()
        logger.info(f"Retained compliance: Redacted {count} reviews older than {settings.REVIEW_RETENTION_DAYS} days.")
        return count
