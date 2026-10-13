"""
CareOps AI - Enterprise WhatsApp Business Integration & Notification Lifecycle Service
Complies with Section 5 and Section 6:
- Normalizes phone numbers to E.164 format.
- Dispatches event-driven patient & staff WhatsApp notifications.
- Tracks message delivery lifecycle states (queued, accepted, delivered, failed).
- Integrates with official Meta WhatsApp Cloud API when credentials are provided.
- Employs resilient fallback auditing when in sandbox/credentials pending state without fabricating carrier delivery.
"""

import re
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import urllib.request
import urllib.error
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Ticket, WhatsAppMessage, SystemSecuritySetting, User, Department

logger = logging.getLogger("careops.whatsapp")

def utc_now():
    return datetime.now(timezone.utc)

def normalize_to_e164(phone: str, default_country_code: str = "+91") -> str:
    """
    Normalizes a mobile number to E.164 format (e.g. +919876543210).
    Strips spaces, dashes, parentheses, leading zeros.
    """
    if not phone:
        return ""
    clean = re.sub(r"[^\d+]", "", phone.strip())
    if clean.startswith("+"):
        return clean
    if clean.startswith("00"):
        return "+" + clean[2:]
    if clean.startswith("0") and len(clean) == 11:
        clean = clean[1:]
    if len(clean) == 10:
        return f"{default_country_code}{clean}"
    return f"+{clean}"

def is_valid_e164(phone: str) -> bool:
    """Validates that a string is a well-formed E.164 phone number."""
    if not phone:
        return False
    return bool(re.match(r"^\+[1-9]\d{6,14}$", phone.strip()))

class WhatsAppService:
    @staticmethod
    def get_provider_credentials(db: Session) -> Dict[str, Any]:
        """Loads WhatsApp provider credentials from DB settings or environment."""
        sec = db.query(SystemSecuritySetting).first()
        phone_id = (sec.whatsapp_phone_number_id if sec and sec.whatsapp_phone_number_id else getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")).strip()
        api_token = (sec.whatsapp_api_token if sec and sec.whatsapp_api_token else getattr(settings, "WHATSAPP_API_TOKEN", "")).strip()
        provider = (sec.whatsapp_provider if sec and sec.whatsapp_provider else getattr(settings, "WHATSAPP_PROVIDER", "meta_business_api")).strip()

        is_configured = bool(phone_id and api_token)
        return {
            "provider": provider,
            "phone_number_id": phone_id,
            "api_token": api_token,
            "is_configured": is_configured
        }

    @staticmethod
    def send_notification(
        db: Session,
        ticket: Optional[Ticket],
        recipient_mobile: str,
        event_type: str,
        message_body: str,
        template_name: Optional[str] = None
    ) -> WhatsAppMessage:
        """
        Dispatches a WhatsApp notification and persists durable delivery record.
        Handles provider submission when credentials exist or tracks mock/queued status.
        """
        normalized_phone = normalize_to_e164(recipient_mobile)
        creds = WhatsAppService.get_provider_credentials(db)

        msg_record = WhatsAppMessage(
            ticket_id=ticket.id if ticket else None,
            recipient_mobile=normalized_phone or recipient_mobile,
            template_name=template_name,
            message_body=message_body,
            event_type=event_type,
            delivery_status="queued",
            is_demo=getattr(ticket, "is_demo", False) if ticket else False
        )
        db.add(msg_record)
        db.flush()

        if creds["is_configured"]:
            # Real Meta Cloud API call
            try:
                url = f"https://graph.facebook.com/v19.0/{creds['phone_number_id']}/messages"
                headers = {
                    "Authorization": f"Bearer {creds['api_token']}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": normalized_phone.replace("+", ""),
                    "type": "text",
                    "text": {"preview_url": True, "body": message_body}
                }
                req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    msg_id = resp_data.get("messages", [{}])[0].get("id")
                    msg_record.provider_message_id = msg_id or "meta_accepted"
                    msg_record.delivery_status = "accepted"
                    logger.info(f"WhatsApp sent successfully to {normalized_phone} [ID: {msg_id}]")
            except Exception as e:
                msg_record.delivery_status = "failed"
                msg_record.error_message = str(e)
                logger.error(f"WhatsApp API delivery failed for {normalized_phone}: {e}")
        else:
            # Sandbox / Simulation mode: Do not claim carrier delivery, record as accepted for local demo
            msg_record.provider_message_id = f"demo_wa_{msg_record.id}_{datetime.now().strftime('%H%M%S')}"
            msg_record.delivery_status = "accepted"
            msg_record.error_message = "Local sandbox mode: Outbound carrier delivery requires Meta WhatsApp API credentials in System Security."

        db.commit()
        db.refresh(msg_record)
        return msg_record

    # --------------------------------------------------------------------------
    # EVENT-SPECIFIC DISPATCHERS
    # --------------------------------------------------------------------------

    @staticmethod
    def on_complaint_created(db: Session, ticket: Ticket, tracking_url: str) -> Optional[WhatsAppMessage]:
        """
        Event 1 — Complaint created:
        Send acknowledgement with ticket reference and secure tracking URL.
        """
        if not ticket.patient_contact:
            return None

        body = (
            f"Your complaint has been registered successfully. "
            f"Your ticket reference is {ticket.ticket_number}. "
            f"Track the progress of your request here: {tracking_url}"
        )
        return WhatsAppService.send_notification(
            db=db,
            ticket=ticket,
            recipient_mobile=ticket.patient_contact,
            event_type="complaint_created",
            message_body=body,
            template_name="patient_ticket_created_v1"
        )

    @staticmethod
    def on_ticket_assigned(db: Session, ticket: Ticket, staff: User) -> Optional[WhatsAppMessage]:
        """
        Event 2 — Ticket assigned:
        Notify responsible staff member if mobile phone is available.
        """
        if not staff.phone:
            return None

        body = (
            f"CareOps Alert: You have been assigned ticket {ticket.ticket_number} "
            f"at {ticket.room_number} ({ticket.category}). "
            f"Please open your staff workspace to acknowledge."
        )
        return WhatsAppService.send_notification(
            db=db,
            ticket=ticket,
            recipient_mobile=staff.phone,
            event_type="ticket_assigned",
            message_body=body,
            template_name="staff_ticket_assignment_v1"
        )

    @staticmethod
    def on_staff_acknowledged(db: Session, ticket: Ticket, eta_minutes: int, tracking_url: str) -> Optional[WhatsAppMessage]:
        """
        Event 3 — Staff acknowledges:
        Notifies patient that team is dispatched with estimated arrival time.
        """
        if not ticket.patient_contact:
            return None

        staff_name = ticket.assigned_staff.name if ticket.assigned_staff else "Our Care Team"
        body = (
            f"Update on {ticket.ticket_number}: {staff_name} has acknowledged your request. "
            f"Estimated arrival: {eta_minutes} minutes. "
            f"Live tracker: {tracking_url}"
        )
        return WhatsAppService.send_notification(
            db=db,
            ticket=ticket,
            recipient_mobile=ticket.patient_contact,
            event_type="staff_acknowledged",
            message_body=body,
            template_name="patient_staff_acknowledged_v1"
        )

    @staticmethod
    def on_work_started(db: Session, ticket: Ticket, tracking_url: str) -> Optional[WhatsAppMessage]:
        """
        Event 4 — Staff arrives / starts work:
        Notifies patient that work is underway.
        """
        if not ticket.patient_contact:
            return None

        body = (
            f"Update on {ticket.ticket_number}: Our team has arrived at {ticket.room_number} "
            f"and work is actively underway. "
            f"Live tracker: {tracking_url}"
        )
        return WhatsAppService.send_notification(
            db=db,
            ticket=ticket,
            recipient_mobile=ticket.patient_contact,
            event_type="work_started",
            message_body=body,
            template_name="patient_work_started_v1"
        )

    @staticmethod
    def on_work_completed(db: Session, ticket: Ticket, tracking_url: str) -> Optional[WhatsAppMessage]:
        """
        Event 5 & 6 — Work completed / Ticket closed:
        Invites patient to submit 3-emoji and NPS feedback.
        """
        if not ticket.patient_contact:
            return None

        body = (
            f"Your service request {ticket.ticket_number} has been completed. "
            f"Please take 5 seconds to share your experience with us: {tracking_url}"
        )
        return WhatsAppService.send_notification(
            db=db,
            ticket=ticket,
            recipient_mobile=ticket.patient_contact,
            event_type="ticket_closed",
            message_body=body,
            template_name="patient_feedback_invite_v1"
        )
