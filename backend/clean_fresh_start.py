"""
CareOps AI - Complete Database Clean & Fresh Start Utility
Safely clears all transactional test records, tickets, logs, feedbacks, and AI jobs
while strictly preserving core foundational assets (Departments, Rooms, Users, Credentials, SLA, and System Settings).
"""

import os
import sys
import shutil
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import text
from app.database import engine, SessionLocal, Base
from app.models import (
    Ticket, Evidence, AIVerificationJob, TicketNote, EscalationLog,
    EmailLog, WhatsAppMessage, NPSResponse, MaintenanceAuditLog, AuditLog,
    GoogleReview, ReviewAlert, ReviewAIAnalysis, ReviewCorrectiveAction, ReviewChatMessage,
    Department, Room, User, SLAPolicy, EscalationSetting, SystemSecuritySetting
)

def clean_database():
    print("=" * 60)
    print("CareOps AI: Initializing Clean Slate / Fresh Start Database Reset")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # 1. Inspect existing counts
        print("\n[1/4] Current Transactional Records:")
        counts_before = {
            "tickets": db.query(Ticket).count(),
            "evidences": db.query(Evidence).count(),
            "ai_verifications": db.query(AIVerificationJob).count(),
            "ticket_notes": db.query(TicketNote).count(),
            "escalation_logs": db.query(EscalationLog).count(),
            "email_logs": db.query(EmailLog).count(),
            "whatsapp_messages": db.query(WhatsAppMessage).count(),
            "nps_responses": db.query(NPSResponse).count(),
            "google_reviews": db.query(GoogleReview).count(),
            "review_alerts": db.query(ReviewAlert).count(),
            "review_ai_analyses": db.query(ReviewAIAnalysis).count(),
            "review_corrective_actions": db.query(ReviewCorrectiveAction).count(),
            "review_chat_messages": db.query(ReviewChatMessage).count(),
            "maintenance_audit_logs": db.query(MaintenanceAuditLog).count(),
            "audit_logs": db.query(AuditLog).count(),
        }
        for k, v in counts_before.items():
            print(f"  - {k}: {v}")

        print("\n[2/4] Preserving Core System Configuration:")
        print(f"  - Departments: {db.query(Department).count()} (Preserved)")
        print(f"  - Hospital Rooms: {db.query(Room).count()} (Preserved)")
        print(f"  - System Users: {db.query(User).count()} (Preserved)")
        print(f"  - SLA Policies: {db.query(SLAPolicy).count()} (Preserved)")
        print(f"  - Escalation Settings: {db.query(EscalationSetting).count()} (Preserved)")
        print(f"  - Security Settings: {db.query(SystemSecuritySetting).count()} (Preserved)")

        # 2. Delete transactional rows in dependency order
        print("\n[3/4] Purging transactional tables...")
        
        # Google Reviews cascade
        db.query(ReviewChatMessage).delete(synchronize_session=False)
        db.query(ReviewCorrectiveAction).delete(synchronize_session=False)
        db.query(ReviewAIAnalysis).delete(synchronize_session=False)
        db.query(ReviewAlert).delete(synchronize_session=False)
        db.query(GoogleReview).delete(synchronize_session=False)
        
        # NPS & Communications
        db.query(NPSResponse).delete(synchronize_session=False)
        db.query(WhatsAppMessage).delete(synchronize_session=False)
        db.query(EmailLog).delete(synchronize_session=False)
        db.query(EscalationLog).delete(synchronize_session=False)
        
        # AI Verifications & Tickets
        db.query(AIVerificationJob).delete(synchronize_session=False)
        db.query(TicketNote).delete(synchronize_session=False)
        db.query(Evidence).delete(synchronize_session=False)
        
        # Audit logs referencing tickets
        db.query(MaintenanceAuditLog).delete(synchronize_session=False)
        db.query(AuditLog).delete(synchronize_session=False)
        
        # Tickets
        db.query(Ticket).delete(synchronize_session=False)

        # Clear room demo flags if any
        db.query(Room).update({"is_demo": False})

        db.commit()
        print("  [OK] All transactional records successfully purged from database.")

        # 3. Clean uploaded files in uploads directory
        uploads_dir = BASE_DIR / "uploads"
        if uploads_dir.exists():
            deleted_files = 0
            for item in uploads_dir.iterdir():
                if item.is_file() and item.name != ".gitkeep":
                    try:
                        item.unlink()
                        deleted_files += 1
                    except Exception as e:
                        print(f"    Notice: Could not delete {item.name}: {e}")
            print(f"  [OK] Cleaned {deleted_files} physical media files from uploads folder.")

        # 4. Insert clean system fresh-start audit log
        admin_user = db.query(User).filter(User.role.in_(["superadmin", "admin"])).first()
        if admin_user:
            clean_audit = AuditLog(
                action="SYSTEM_FRESH_START_RESET",
                actor_id=admin_user.id,
                actor_name=admin_user.name,
                actor_role=admin_user.role,
                details='{"status": "pristine_fresh_slate", "preserved": ["users", "rooms", "departments", "sla_policies", "credentials", "security_settings"]}'
            )
            db.add(clean_audit)
            db.commit()

        print("\n[4/4] Verification of Fresh State:")
        counts_after = {
            "tickets": db.query(Ticket).count(),
            "evidences": db.query(Evidence).count(),
            "ai_verifications": db.query(AIVerificationJob).count(),
            "email_logs": db.query(EmailLog).count(),
            "whatsapp_messages": db.query(WhatsAppMessage).count(),
            "nps_responses": db.query(NPSResponse).count(),
            "google_reviews": db.query(GoogleReview).count(),
        }
        for k, v in counts_after.items():
            print(f"  - {k}: {v}")

        print("\n" + "=" * 60)
        print("SUCCESS: Database is now completely fresh and ready for clean testing!")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\nERROR: Failed to clean database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clean_database()
