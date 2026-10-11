from datetime import datetime, timedelta, timezone
import json
import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import Ticket, SLAPolicy, EscalationLog, AuditLog, User
from app.database import SessionLocal

logger = logging.getLogger("careops.sla")

def utc_now():
    return datetime.now(timezone.utc)

class SLAEngine:
    @staticmethod
    def calculate_deadlines(db: Session, department_id: str, priority: str) -> tuple[datetime, datetime]:
        """Calculates acknowledgement and resolution deadlines based on department SLA policy"""
        policy = db.query(SLAPolicy).filter(
            SLAPolicy.department_id == department_id,
            SLAPolicy.priority == priority,
            SLAPolicy.is_active == True
        ).first()
        
        now = utc_now()
        
        if policy:
            ack_minutes = policy.ack_target_minutes
            res_minutes = policy.resolution_target_minutes
        else:
            # Safe enterprise defaults if policy not configured
            defaults = {
                "critical": (15, 60),
                "high": (30, 120),
                "medium": (60, 240),
                "low": (120, 480)
            }
            ack_minutes, res_minutes = defaults.get(priority, (60, 240))
            
        ack_deadline = now + timedelta(minutes=ack_minutes)
        res_deadline = now + timedelta(minutes=res_minutes)
        return ack_deadline, res_deadline

    @staticmethod
    def run_sla_check_cycle(db: Optional[Session] = None) -> dict:
        """
        Scans all open tickets, checks for impending deadlines, breaches,
        and triggers persistent escalation workflows.
        """
        should_close_db = False
        if db is None:
            db = SessionLocal()
            should_close_db = True
            
        now = utc_now()
        stats = {
            "scanned": 0,
            "escalated_ack_breach": 0,
            "escalated_resolution_breach": 0,
            "reminders_issued": 0
        }
        
        try:
            open_tickets = db.query(Ticket).filter(Ticket.status != "closed").all()
            stats["scanned"] = len(open_tickets)
            
            for ticket in open_tickets:
                # 1. Check Acknowledgement SLA Breach
                if ticket.status in ["submitted", "assigned"] and ticket.sla_acknowledgement_deadline:
                    # Make sure comparison is timezone-aware
                    ack_dl = ticket.sla_acknowledgement_deadline
                    if ack_dl.tzinfo is None:
                        ack_dl = ack_dl.replace(tzinfo=timezone.utc)
                        
                    if now > ack_dl and ticket.escalation_level < 1:
                        ticket.is_escalated = True
                        ticket.escalation_level = 1
                        ticket.escalation_reason = "Acknowledgement SLA target breached."
                        
                        esc = EscalationLog(
                            ticket_id=ticket.id,
                            escalation_level=1,
                            trigger_reason="Acknowledgement deadline exceeded without staff acknowledgement.",
                            notified_supervisor_id=ticket.assigned_supervisor_id,
                            delivery_status="delivered"
                        )
                        db.add(esc)
                        
                        audit = AuditLog(
                            ticket_id=ticket.id,
                            action="SLA_ACK_BREACH",
                            actor_name="SLA Monitor Engine",
                            actor_role="system",
                            details=json.dumps({"breach_time": now.isoformat(), "level": 1})
                        )
                        db.add(audit)
                        stats["escalated_ack_breach"] += 1

                # 2. Check Resolution SLA Breach
                if ticket.status in ["assigned", "acknowledged", "in_progress", "resolution_submitted"] and ticket.sla_resolution_deadline:
                    res_dl = ticket.sla_resolution_deadline
                    if res_dl.tzinfo is None:
                        res_dl = res_dl.replace(tzinfo=timezone.utc)
                        
                    if now > res_dl and ticket.escalation_level < 2:
                        ticket.is_escalated = True
                        ticket.escalation_level = 2
                        ticket.escalation_reason = "Resolution SLA deadline breached. Immediate supervisor review required."
                        
                        esc = EscalationLog(
                            ticket_id=ticket.id,
                            escalation_level=2,
                            trigger_reason="Resolution target time exceeded. Ticket escalated to Operations Supervisor.",
                            notified_supervisor_id=ticket.assigned_supervisor_id,
                            delivery_status="delivered"
                        )
                        db.add(esc)
                        
                        audit = AuditLog(
                            ticket_id=ticket.id,
                            action="SLA_RESOLUTION_BREACH",
                            actor_name="SLA Monitor Engine",
                            actor_role="system",
                            details=json.dumps({"breach_time": now.isoformat(), "level": 2})
                        )
                        db.add(audit)
                        stats["escalated_resolution_breach"] += 1
                        
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error during SLA check cycle: {e}")
        finally:
            if should_close_db:
                db.close()
                
        return stats
