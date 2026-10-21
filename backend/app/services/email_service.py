"""
CareOps AI - Enterprise Hospital Email Delivery & Alert Dispatch Service
Supports secure SMTP (SSL/TLS on port 465 or STARTTLS on port 587).
Provides asynchronous background email delivery, persistent delivery audit logging,
reusable HTML & plain-text healthcare templates, retry handling, and SMTP connectivity testing.
"""

import smtplib
import ssl
import json
import logging
import asyncio
import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
import email.utils
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import EmailLog, Ticket, User, Department, EscalationSetting, AuditLog

logger = logging.getLogger("careops.email")
_executor = ThreadPoolExecutor(max_workers=4)

def utc_now():
    return datetime.now(timezone.utc)

def is_routable_email(email_str: Optional[str]) -> bool:
    """Checks whether an email address belongs to a real, routable internet domain (not mock/internal test)."""
    if not email_str or "@" not in email_str:
        return False
    domain = email_str.split("@")[-1].lower().strip()
    if domain.endswith(".hospital") or domain.endswith(".local") or domain in ("example.com", "test.com", "hospital.com", "careops.hospital"):
        return False
    return True


class EmailService:
    @staticmethod
    def get_smtp_config(db: Session) -> Dict[str, Any]:
        """Resolves active SMTP settings from database escalation settings first, fallback to environment."""
        db_conf = db.query(EscalationSetting).filter(EscalationSetting.id == 1).first()
        smtp_host = (db_conf.smtp_host if db_conf and db_conf.smtp_host else settings.SMTP_HOST or "").strip()
        smtp_port = db_conf.smtp_port if db_conf and db_conf.smtp_port else settings.SMTP_PORT
        smtp_user = (db_conf.smtp_user if db_conf and db_conf.smtp_user else settings.SMTP_USER or "").strip()
        smtp_password = db_conf.smtp_password if db_conf and db_conf.smtp_password else settings.SMTP_PASSWORD
        smtp_from = (db_conf.smtp_from if db_conf and db_conf.smtp_from else settings.SMTP_FROM or "alerts@careops.hospital").strip()
        smtp_use_ssl = db_conf.smtp_use_ssl if db_conf and db_conf.smtp_use_ssl is not None else settings.SMTP_USE_SSL
        work_email = (db_conf.work_email if db_conf and db_conf.work_email else settings.WORK_EMAIL or "").strip()
        maint_email = (db_conf.maintenance_email if db_conf and db_conf.maintenance_email else settings.MAINTENANCE_DEPARTMENT_EMAIL or "maintenance@careops.hospital").strip()
        resend_key = (db_conf.resend_api_key if db_conf and hasattr(db_conf, "resend_api_key") and db_conf.resend_api_key else settings.RESEND_API_KEY or "").strip()

        return {
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "smtp_user": smtp_user,
            "smtp_password": smtp_password,
            "smtp_from": smtp_from,
            "smtp_use_ssl": smtp_use_ssl,
            "work_email": work_email,
            "maintenance_email": maint_email,
            "resend_api_key": resend_key,
        }

    @staticmethod
    def _render_email_base(title: str, preheader: str, content_html: str) -> str:
        """Reusable responsive HTML email shell with healthcare SaaS styling."""
        return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  body {{ margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }}
  .wrapper {{ max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }}
  .header {{ background-color: #0f172a; padding: 24px; text-align: left; }}
  .header h1 {{ margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }}
  .header p {{ margin: 4px 0 0 0; color: #94a3b8; font-size: 13px; }}
  .content {{ padding: 28px 24px; line-height: 1.6; font-size: 15px; }}
  .badge {{ display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 9999px; background: #e0f2fe; color: #0369a1; margin-bottom: 12px; }}
  .info-box {{ background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin: 18px 0; border-left: 4px solid #2563eb; }}
  .info-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }}
  .info-label {{ font-weight: 600; color: #475569; }}
  .info-val {{ color: #0f172a; }}
  .btn {{ display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; }}
  .footer {{ padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }}
</style>
</head>
<body>
<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  {preheader}
</div>
<div class="wrapper">
  <div class="header">
    <h1>Happy Care &bull; Hospital Operations</h1>
    <p>Patient Care & Facilities Management System</p>
  </div>
  <div class="content">
    {content_html}
  </div>
  <div class="footer">
    <p>This is an automated operational notification from Metropolitan General Hospital Happy Care platform.</p>
    <p>Confidential Personal Health Information is strictly protected. Please do not reply directly to this automated email.</p>
  </div>
</div>
</body>
</html>"""

    @staticmethod
    def enqueue_email(
        db: Session,
        recipient_email: str,
        recipient_name: Optional[str],
        subject: str,
        body_html: str,
        body_text: str,
        email_type: str,
        ticket_id: Optional[int] = None
    ) -> EmailLog:
        """Saves email record to persistent database log and triggers non-blocking asynchronous dispatch."""
        clean_email = recipient_email.strip().lower()
        log = EmailLog(
            recipient_email=clean_email,
            recipient_name=recipient_name or clean_email,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            email_type=email_type,
            ticket_id=ticket_id,
            status="queued",
            attempts=0,
            max_attempts=3,
            created_at=utc_now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        # Trigger async delivery in background thread pool without blocking FastAPI request
        try:
            _executor.submit(EmailService._send_email_worker, log.id)
        except Exception as e:
            logger.error(f"Failed to submit email task to background executor: {e}")

        return log

    @staticmethod
    def _send_via_resend(
        api_key: str,
        from_email: str,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transports outbound healthcare email via Resend REST API over HTTPS (Port 443).
        Guaranteed to bypass cloud firewall restrictions (e.g. Render Free Tier blocking raw SMTP ports 25, 465, 587).
        """
        import urllib.request
        import json

        clean_sender = from_email.lower().strip() if from_email else ""
        if (
            not clean_sender
            or "@" not in clean_sender
            or clean_sender.endswith(".hospital")
            or clean_sender.endswith(".local")
            or "@gmail." in clean_sender
            or "@yahoo." in clean_sender
            or "@outlook." in clean_sender
            or "@hotmail." in clean_sender
            or "@icloud." in clean_sender
        ):
            sender = "CareOps Hospital <onboarding@resend.dev>"
        elif "<" not in from_email:
            sender = f"Happy Care Operations <{from_email}>"
        else:
            sender = from_email

        payload = {
            "from": sender,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": text_content or "Please view this message in an HTML-compatible email client."
        }
        if from_email and "@" in from_email and not from_email.endswith(".hospital"):
            payload["reply_to"] = from_email
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json",
                "User-Agent": "CareOps-Healthcare/1.0"
            },
            method="POST"
        )
        import urllib.error
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as http_err:
            try:
                err_body = json.loads(http_err.read().decode("utf-8"))
                detail = err_body.get("message", str(err_body))
            except Exception:
                detail = f"HTTP {http_err.code}: {http_err.reason}"
            raise RuntimeError(f"Resend API Error ({http_err.code}): {detail}")

    @staticmethod
    def _send_email_worker(email_log_id: int):
        """Worker executing in background thread to establish SMTP or HTTPS transport and record delivery state."""
        db = SessionLocal()
        try:
            log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
            if not log:
                return

            cfg = EmailService.get_smtp_config(db)
            smtp_host = cfg["smtp_host"]
            smtp_port = cfg["smtp_port"]
            smtp_user = cfg["smtp_user"]
            smtp_password = cfg["smtp_password"]
            smtp_from = cfg["smtp_from"]
            smtp_use_ssl = cfg["smtp_use_ssl"]
            resend_key = cfg.get("resend_api_key")

            log.attempts += 1
            log.last_attempt_at = utc_now()
            # Immediate resolution for mock / internal demo domains to keep real client queue fast & unblocked
            if not is_routable_email(log.recipient_email):
                log.status = "sent"
                log.sent_at = utc_now()
                log.error_message = None
                db.commit()
                logger.info(f"Email #{email_log_id} recorded (simulated delivery for test address: {log.recipient_email})")
                return

            # Method 1: If Resend API Key is available, dispatch via HTTPS over port 443 (never blocked on cloud platforms)
            if resend_key:
                try:
                    res = EmailService._send_via_resend(
                        api_key=resend_key,
                        from_email=smtp_from,
                        to_email=log.recipient_email,
                        subject=log.subject,
                        html_content=log.body_html,
                        text_content=log.body_text
                    )
                    log.status = "sent"
                    log.sent_at = utc_now()
                    log.error_message = None
                    log.smtp_host_used = f"Resend API (HTTPS Port 443, id={res.get('id', 'ok')})"
                    db.commit()
                    logger.info(f"Email #{email_log_id} delivered successfully via Resend HTTPS API to {log.recipient_email}")
                    return
                except Exception as api_err:
                    logger.warning(f"Resend HTTPS delivery failed for email #{email_log_id}: {api_err}. Trying standard SMTP fallback.")

            # Method 2: Check if SMTP is configured
            if not smtp_host:
                log.status = "failed"
                log.error_message = "No email transport configured. In Admin Settings, provide either: (1) Standard SMTP host & credentials, or (2) A free Resend API key (RESEND_API_KEY) for cloud HTTPS delivery."
                db.commit()
                logger.warning(f"Email #{email_log_id} failed: No SMTP_HOST or RESEND_API_KEY configured.")
                return

            # Construct MIME message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = Header(log.subject, "utf-8")
            msg["From"] = f"Happy Care Operations <{smtp_from}>"
            msg["To"] = log.recipient_email
            msg["Date"] = email.utils.formatdate(localtime=True) if hasattr(email, "utils") else None

            # Attach plain text and HTML versions
            part_text = MIMEText(log.body_text or "Please view this message in an HTML-compatible email client.", "plain", "utf-8")
            part_html = MIMEText(log.body_html, "html", "utf-8")
            msg.attach(part_text)
            msg.attach(part_html)

            # Send via SMTP with appropriate security protocol
            if smtp_use_ssl or smtp_port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=20) as server:
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.sendmail(smtp_from, [log.recipient_email], msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                    server.ehlo()
                    # Use STARTTLS if supported/required
                    if smtp_port in (587, 25):
                        try:
                            context = ssl.create_default_context()
                            server.starttls(context=context)
                            server.ehlo()
                        except Exception as tls_err:
                            logger.info(f"STARTTLS negotiation note: {tls_err}")
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.sendmail(smtp_from, [log.recipient_email], msg.as_string())

            # Successful delivery confirmed by SMTP server
            log.status = "sent"
            log.sent_at = utc_now()
            log.error_message = None
            log.smtp_host_used = f"{smtp_host}:{smtp_port}"
            db.commit()
            logger.info(f"Email #{email_log_id} delivered successfully to {log.recipient_email}")

        except Exception as e:
            err_str = str(e)
            if "101" in err_str or "Network is unreachable" in err_str:
                err_msg = (
                    "Network unreachable on SMTP ports 465/587. Cloud providers (like Render Free Tier) firewall raw SMTP traffic. "
                    "Solution: (1) Add a free Resend API key (RESEND_API_KEY) in Settings to deliver over HTTPS Port 443, or (2) Upgrade Render instance to Starter ($7/mo) to unblock SMTP ports."
                )
            else:
                err_msg = f"{type(e).__name__}: {err_str}"
            logger.error(f"Failed to deliver email #{email_log_id} to {getattr(log, 'recipient_email', 'unknown')}: {err_msg}")
            try:
                log.status = "failed"
                log.error_message = err_msg
                db.commit()
            except Exception:
                pass
        finally:
            db.close()

    @staticmethod
    def test_smtp_connection(db: Session, to_email: str) -> Dict[str, Any]:
        """
        Interactive live diagnostic test called from the Admin Portal.
        Attempts real SMTP handshake, authentication, and test message delivery.
        """
        cfg = EmailService.get_smtp_config(db)
        clean_to = to_email.strip().lower()

        # Option A: If Resend API Key is configured, test HTTPS delivery over Port 443
        if cfg.get("resend_api_key"):
            subject = "CareOps AI — Resend HTTPS API Diagnostic Test Message"
            html_content = EmailService._render_email_base(
                title="Email Delivery Diagnostic",
                preheader="CareOps AI HTTPS Transport is Online",
                content_html=f"""
                <div class="badge">HTTPS Transport Verified</div>
                <h2 style="margin-top: 0; color: #0f172a;">Resend API Delivery Confirmed</h2>
                <p>This test email confirms that CareOps AI outbound mail delivery over HTTPS Port 443 is operational.</p>
                <div class="info-box">
                  <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b;">Transport Diagnostics:</div>
                  <div class="info-row"><span class="info-label">Transport:</span> <span class="info-val">Resend REST API (HTTPS Port 443)</span></div>
                  <div class="info-row"><span class="info-label">Sender Address:</span> <span class="info-val">{cfg["smtp_from"]}</span></div>
                  <div class="info-row"><span class="info-label">Recipient:</span> <span class="info-val">{clean_to}</span></div>
                  <div class="info-row"><span class="info-label">Timestamp:</span> <span class="info-val">{utc_now().strftime('%Y-%m-%d %H:%M:%S UTC')}</span></div>
                </div>
                <p style="color: #475569; font-size: 13px;">Patients and staff will now reliably receive automated Work Started, Work Finished, and tracking receipts.</p>
                """
            )
            text_content = f"Happy Care Email Diagnostic Test\nTransport: Resend HTTPS API (Port 443)\nRecipient: {clean_to}\nTimestamp: {utc_now().isoformat()}\nYour email configuration is working correctly."

            log = EmailLog(
                recipient_email=clean_to,
                recipient_name="Hospital Administrator",
                subject=subject,
                body_html=html_content,
                body_text=text_content,
                email_type="smtp_test",
                status="queued",
                attempts=1,
                max_attempts=1,
                last_attempt_at=utc_now(),
                smtp_host_used="Resend API (HTTPS Port 443)",
                created_at=utc_now()
            )
            db.add(log)
            db.commit()
            db.refresh(log)

            try:
                res = EmailService._send_via_resend(
                    api_key=cfg["resend_api_key"],
                    from_email=cfg["smtp_from"],
                    to_email=clean_to,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content
                )
                log.status = "sent"
                log.sent_at = utc_now()
                log.error_message = None
                log.smtp_host_used = f"Resend API (HTTPS Port 443, id={res.get('id', 'ok')})"
                db.commit()
                return {
                    "success": True,
                    "message": f"Test email sent successfully via Resend HTTPS API to {clean_to}",
                    "log_id": log.id,
                    "transport": "resend_https",
                    "config": {
                        "transport": "Resend API (HTTPS Port 443)",
                        "from": cfg["smtp_from"],
                        "recipient": clean_to
                    }
                }
            except Exception as resend_err:
                log.status = "failed"
                log.error_message = f"Resend API error: {str(resend_err)}"
                db.commit()
                if not cfg.get("smtp_host"):
                    return {
                        "success": False,
                        "error": f"Resend API error: {str(resend_err)}",
                        "log_id": log.id,
                        "transport": "resend_https"
                    }

        # Option B: Standard SMTP Handshake & Delivery Test
        if not cfg["smtp_host"]:
            log = EmailLog(
                recipient_email=clean_to,
                recipient_name="Hospital Administrator",
                subject="CareOps AI — SMTP Diagnostic Test Message",
                body_html="<p>SMTP Test Attempted - No SMTP Host configured</p>",
                body_text="SMTP Test Attempted - No SMTP Host configured",
                email_type="smtp_test",
                status="failed",
                attempts=1,
                max_attempts=1,
                error_message="SMTP Host is not configured. Please set SMTP_HOST or RESEND_API_KEY in Admin Settings.",
                last_attempt_at=utc_now(),
                smtp_host_used="(none)",
                created_at=utc_now()
            )
            db.add(log)
            db.commit()
            return {
                "success": False,
                "error": "No email transport configured. Please set SMTP_HOST or RESEND_API_KEY in Admin Settings.",
                "message": "Delivery failed: no SMTP host or Resend API key configured.",
                "config": {
                    "host": cfg["smtp_host"] or "(empty)",
                    "port": cfg["smtp_port"],
                    "from": cfg["smtp_from"],
                    "use_ssl": cfg["smtp_use_ssl"]
                }
            }

        subject = "CareOps AI — SMTP Diagnostic Test Message"
        html_content = EmailService._render_email_base(
            title="SMTP Diagnostic Verification",
            preheader="CareOps AI Email Delivery System is Online",
            content_html=f"""
            <div class="badge">System Diagnostic</div>
            <h2 style="margin-top: 0; color: #0f172a;">SMTP Delivery Confirmed</h2>
            <p>This test email confirms that your hospital CareOps AI SMTP outbound mail relay is correctly configured and operational.</p>
            <div class="info-box">
              <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b;">Transport Diagnostics:</div>
              <div class="info-row"><span class="info-label">SMTP Host:</span> <span class="info-val">{cfg["smtp_host"]}:{cfg["smtp_port"]}</span></div>
              <div class="info-row"><span class="info-label">Protocol:</span> <span class="info-val">{'SMTPS (SSL/TLS)' if cfg["smtp_use_ssl"] else 'SMTP (STARTTLS)'}</span></div>
              <div class="info-row"><span class="info-label">Sender Address:</span> <span class="info-val">{cfg["smtp_from"]}</span></div>
              <div class="info-row"><span class="info-label">Recipient:</span> <span class="info-val">{clean_to}</span></div>
              <div class="info-row"><span class="info-label">Timestamp:</span> <span class="info-val">{utc_now().strftime('%Y-%m-%d %H:%M:%S UTC')}</span></div>
            </div>
            <p style="color: #475569; font-size: 13px;">Patients and staff will now receive automated service request confirmations and operational alerts reliably.</p>
            """
        )
        text_content = f"Happy Care SMTP Test Message\n\nSMTP Host: {cfg['smtp_host']}:{cfg['smtp_port']}\nRecipient: {clean_to}\nTimestamp: {utc_now().isoformat()}\nYour email configuration is working correctly."

        # Synchronous test execution so the admin gets immediate diagnostic feedback
        log = EmailLog(
            recipient_email=clean_to,
            recipient_name="Hospital Administrator",
            subject=subject,
            body_html=html_content,
            body_text=text_content,
            email_type="smtp_test",
            status="queued",
            attempts=1,
            max_attempts=1,
            last_attempt_at=utc_now(),
            smtp_host_used=f"{cfg['smtp_host']}:{cfg['smtp_port']}",
            created_at=utc_now()
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = cfg["smtp_from"]
            msg["To"] = clean_to

            msg.attach(MIMEText(text_content, "plain", "utf-8"))
            msg.attach(MIMEText(html_content, "html", "utf-8"))

            if cfg["smtp_use_ssl"] or cfg["smtp_port"] == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(cfg["smtp_host"], cfg["smtp_port"], context=context, timeout=15) as server:
                    if cfg["smtp_user"] and cfg["smtp_password"]:
                        server.login(cfg["smtp_user"], cfg["smtp_password"])
                    server.sendmail(cfg["smtp_from"], [clean_to], msg.as_string())
            else:
                with smtplib.SMTP(cfg["smtp_host"], cfg["smtp_port"], timeout=15) as server:
                    server.ehlo()
                    if cfg["smtp_port"] in (587, 25):
                        try:
                            context = ssl.create_default_context()
                            server.starttls(context=context)
                            server.ehlo()
                        except Exception:
                            pass
                    if cfg["smtp_user"] and cfg["smtp_password"]:
                        server.login(cfg["smtp_user"], cfg["smtp_password"])
                    server.sendmail(cfg["smtp_from"], [clean_to], msg.as_string())

            log.status = "sent"
            log.sent_at = utc_now()
            log.error_message = None
            db.commit()

            return {
                "success": True,
                "message": f"Test email sent successfully to {clean_to}",
                "log_id": log.id,
                "config": {
                    "host": cfg["smtp_host"],
                    "port": cfg["smtp_port"],
                    "from": cfg["smtp_from"],
                    "use_ssl": cfg["smtp_use_ssl"]
                }
            }
        except Exception as e:
            err_str = str(e)
            if "101" in err_str or "Network is unreachable" in err_str:
                err_msg = (
                    "Render Cloud Firewall: Outbound SMTP ports 465/587 are blocked on Render Free Tier (OSError: [Errno 101] Network is unreachable). "
                    "Solution: Provide a free Resend API key (RESEND_API_KEY) in Settings to deliver over HTTPS Port 443 without firewall restrictions, or upgrade Render to Starter."
                )
            else:
                err_msg = f"{type(e).__name__}: {err_str}"
            log.status = "failed"
            log.error_message = err_msg
            db.commit()
            return {
                "success": False,
                "error": err_msg,
                "log_id": log.id,
                "config": {
                    "host": cfg["smtp_host"],
                    "port": cfg["smtp_port"],
                    "from": cfg["smtp_from"],
                    "use_ssl": cfg["smtp_use_ssl"]
                }
            }

    @staticmethod
    def retry_failed_emails(db: Session, max_retries: int = 3) -> Dict[str, Any]:
        """Scans for queued or failed emails with attempts < max_attempts and re-enqueues them."""
        pending = db.query(EmailLog).filter(
            EmailLog.status.in_(["failed", "queued"]),
            EmailLog.attempts < max_retries
        ).all()

        retried_count = 0
        for log in pending:
            try:
                _executor.submit(EmailService._send_email_worker, log.id)
                retried_count += 1
            except Exception:
                pass

        return {
            "retried_count": retried_count,
            "total_pending": len(pending)
        }

    # =========================================================================
    # CORE HOSPITAL WORKFLOW NOTIFICATION DISPATCHERS
    # =========================================================================

    @staticmethod
    def build_patient_maintenance_email_content(
        ticket: Ticket,
        dept_name: str,
        custom_headline: Optional[str] = None,
        status_note: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Builds the high-fidelity Happy Care hospital maintenance confirmation email:
        - Exact WhatsApp Official Confirmation Notice quote box
        - Real-Time Resolution Live Tracking CTA button
        - 5-Step Maintenance Milestones Timeline (Request Registered -> Assigned -> Acknowledged -> Work In Progress -> Resolved)
        - Service Location & Technician Assignment Details
        - Direct WhatsApp Web/App Link
        """
        base_url = (getattr(settings, "FRONTEND_URL", "") or "http://192.168.31.219:3000").rstrip("/")
        token_param = f"?token={ticket.patient_tracking_token}" if ticket.patient_tracking_token else ""
        tracking_url = f"{base_url}/track/{ticket.ticket_number}{token_param}"

        # Clean contact phone and WhatsApp URL
        clean_phone = re.sub(r"[^\d+]", "", ticket.patient_contact or "").lstrip("+")
        wa_notice_text = (
            f"*Official Happy Care Hospital Confirmation Notice*\n\n"
            f"Your complaint has been registered successfully.\n"
            f"• Ticket Reference: *{ticket.ticket_number}*\n"
            f"• Service Location: *{ticket.room_number}*\n"
            f"• Department: *{dept_name}*\n"
            f"• Issue Category: *{ticket.category}*\n\n"
            f"Track real-time resolution progress here:\n"
            f"{tracking_url}"
        )
        wa_url = (
            f"https://api.whatsapp.com/send?phone={clean_phone}&text={urllib.parse.quote(wa_notice_text)}"
            if clean_phone
            else f"https://api.whatsapp.com/send?text={urllib.parse.quote(wa_notice_text)}"
        )

        assigned_staff_name = ticket.assigned_staff.name if ticket.assigned_staff else "On-Duty Dispatch Specialist"
        assigned_staff_role = (
            ticket.assigned_staff.designation
            if (ticket.assigned_staff and hasattr(ticket.assigned_staff, "designation") and ticket.assigned_staff.designation)
            else f"{dept_name} Team Specialist"
        )

        # Format timestamps
        created_str = ticket.created_at.strftime("%I:%M %p, %d %b %Y") if ticket.created_at else "Just now"
        assigned_str = ticket.assigned_at.strftime("%I:%M %p") if ticket.assigned_at else (ticket.created_at.strftime("%I:%M %p") if ticket.created_at else "Assigned")
        ack_str = ticket.acknowledged_at.strftime("%I:%M %p") if ticket.acknowledged_at else None
        progress_str = (ticket.in_progress_at or ticket.work_started_at).strftime("%I:%M %p") if (ticket.in_progress_at or ticket.work_started_at) else None
        closed_str = (ticket.closed_at or ticket.work_completed_at).strftime("%I:%M %p") if (ticket.closed_at or ticket.work_completed_at) else None

        # Determine milestone states
        status = ticket.status.lower() if ticket.status else "submitted"
        s1_done = True
        s2_done = status != "submitted" or bool(ticket.assigned_staff_id)
        s3_done = status in ["acknowledged", "in_progress", "work_started", "work_completed", "resolution_submitted", "closed"]
        s4_done = status in ["in_progress", "work_started", "work_completed", "resolution_submitted", "closed"]
        s5_done = status in ["work_completed", "resolution_submitted", "closed"]

        def render_step_row(step_num: int, title: str, subtitle: str, is_done: bool, is_last: bool, time_text: Optional[str]):
            circle_bg = "#16805D" if is_done else "#FFFFFF"
            circle_border = "#16805D" if is_done else "#CBD5E1"
            circle_color = "#FFFFFF" if is_done else "#94A3B8"
            circle_symbol = "&#10003;" if is_done else str(step_num)
            badge_bg = "#EDF7F2" if is_done else "#F1F5F9"
            badge_color = "#16805D" if is_done else "#64748B"
            badge_text = "Completed" if is_done else "Pending"
            line_html = f'<div style="width: 2px; height: 32px; background-color: {circle_border}; margin: 4px auto 0 auto;"></div>' if not is_last else ''
            time_display = f'<span style="font-family: monospace; font-size: 11px; color: #16805D; font-weight: 700; margin-left: 6px;">({time_text})</span>' if time_text else ''

            return f"""
            <tr>
              <td valign="top" style="width: 32px; text-align: center; padding-right: 12px;">
                <div style="width: 26px; height: 26px; border-radius: 50%; background-color: {circle_bg}; border: 2px solid {circle_border}; color: {circle_color}; font-size: 13px; font-weight: bold; line-height: 26px; text-align: center; margin: 0 auto;">
                  {circle_symbol}
                </div>
                {line_html}
              </td>
              <td valign="top" style="padding-bottom: 16px;">
                <div style="font-size: 13px; font-weight: 700; color: #0F172A;">
                  {title}
                  <span style="display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background-color: {badge_bg}; color: {badge_color}; margin-left: 6px;">
                    {badge_text}
                  </span>
                  {time_display}
                </div>
                <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
                  {subtitle}
                </div>
              </td>
            </tr>
            """

        timeline_table = f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
          {render_step_row(1, "1. Request Registered", "Saved in Happy Care hospital database", s1_done, False, created_str)}
          {render_step_row(2, "2. Assigned to On-Duty Team", f"Assigned to {assigned_staff_name} ({assigned_staff_role})", s2_done, False, assigned_str)}
          {render_step_row(3, "3. Staff Acknowledged & En Route", "Staff member accepted the task and dispatched to room", s3_done, False, ack_str)}
          {render_step_row(4, "4. Work in Progress", "Physical repairs and safety inspection underway at bedside", s4_done, False, progress_str)}
          {render_step_row(5, "5. Resolved & Closed", "Verified by hospital supervisor & ready for review", s5_done, True, closed_str)}
        </table>
        """

        whatsapp_btn_row = ""
        if ticket.patient_contact:
            whatsapp_btn_row = f"""
            <tr>
              <td style="padding-top: 8px;">
                <a href="{wa_url}" target="_blank" style="display: block; background-color: #25D366; color: #FFFFFF; font-weight: 800; font-size: 13px; text-decoration: none; padding: 11px 18px; border-radius: 8px; text-align: center;">
                  &#128172; Open / Receive Official Notice in WhatsApp
                </a>
              </td>
            </tr>
            """

        status_note_row = ""
        if status_note:
            status_note_row = f"""
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Operational Note:</td>
              <td style="color: #0F172A; font-weight: 700; padding: 4px 0;">{status_note}</td>
            </tr>
            """

        resolution_summary_row = ""
        if ticket.resolution_summary:
            resolution_summary_row = f"""
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Resolution Summary:</td>
              <td style="color: #16805D; font-weight: 700; padding: 4px 0;">{ticket.resolution_summary}</td>
            </tr>
            """

        headline_text = custom_headline or "Service Request Registered Successfully"
        status_display = ticket.status.replace("_", " ").title()

        content_html = f"""
        <div style="background-color: #E8F3F1; border: 2px solid #A7D7D1; border-radius: 12px; padding: 18px; margin-bottom: 22px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 12px; font-weight: 800; color: #176B63; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 8px;">
                &#10003; Official Hospital Confirmation Notice
              </td>
              <td align="right" style="font-size: 11px; font-weight: 700; color: #16805D;">
                WhatsApp Notice Sync
              </td>
            </tr>
          </table>

          <div style="background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 8px; padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #0F172A;">
            <p style="margin: 0 0 6px 0; font-weight: 800; color: #0F172A;">
              *Official Happy Care Hospital Confirmation Notice*
            </p>
            <p style="margin: 0 0 10px 0; color: #334155;">
              Your complaint has been registered successfully in the hospital dispatch network.
            </p>
            <div style="margin-bottom: 10px; font-size: 13px; color: #1E293B;">
              <div>&bull; Ticket Reference: <strong style="font-family: monospace; color: #176B63; font-size: 14px;">{ticket.ticket_number}</strong></div>
              <div>&bull; Service Location: <strong>{ticket.room_number}</strong></div>
              <div>&bull; Department: <strong>{dept_name}</strong></div>
              <div>&bull; Issue Category: <strong>{ticket.category}</strong></div>
              <div>&bull; Current Status: <strong style="color: #16805D;">{status_display}</strong></div>
            </div>
            <div style="border-top: 1px dashed #CBD5E1; padding-top: 10px; font-size: 12px; color: #475569;">
              Track real-time resolution progress here:<br>
              <a href="{tracking_url}" target="_blank" style="color: #176B63; font-weight: 800; text-decoration: underline; word-break: break-all;">
                {tracking_url}
              </a>
            </div>
          </div>

          <!-- ACTION BUTTONS -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 14px;">
            <tr>
              <td>
                <a href="{tracking_url}" target="_blank" style="display: block; background-color: #176B63; color: #FFFFFF; font-weight: 800; font-size: 14px; text-decoration: none; padding: 13px 20px; border-radius: 8px; text-align: center; letter-spacing: 0.02em;">
                  &#10140; Track Real-Time Live Resolution
                </a>
              </td>
            </tr>
            {whatsapp_btn_row}
          </table>
        </div>

        <!-- 5-STEP RESOLUTION MILESTONES -->
        <div style="background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 12px; padding: 20px; margin-bottom: 22px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
            <tr>
              <td>
                <div style="font-size: 13px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.05em;">
                  Live Resolution Milestones
                </div>
                <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
                  Continuous telemetry synchronized with bedside QR status
                </div>
              </td>
              <td align="right" valign="top">
                <span style="background-color: #EDF7F2; color: #16805D; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 10px; border: 1px solid #A6E1CE;">
                  &bull; Live Sync Active
                </span>
              </td>
            </tr>
          </table>

          {timeline_table}
        </div>

        <!-- HOSPITAL SERVICE REFERENCE DETAILS -->
        <div style="background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 12px; padding: 18px; margin-bottom: 18px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748B; letter-spacing: 0.05em; margin-bottom: 12px;">
            Hospital Service Reference Details
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; line-height: 1.8;">
            <tr>
              <td style="color: #64748B; width: 140px; padding: 4px 0;">Ticket Reference:</td>
              <td style="color: #176B63; font-weight: 800; font-family: monospace; font-size: 14px; padding: 4px 0;">{ticket.ticket_number}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Service Location:</td>
              <td style="color: #0F172A; font-weight: 700; padding: 4px 0;">{ticket.room_number}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Department:</td>
              <td style="color: #0F172A; font-weight: 700; padding: 4px 0;">{dept_name}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Category / Issue:</td>
              <td style="color: #0F172A; font-weight: 600; padding: 4px 0;">{ticket.category}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Assigned Specialist:</td>
              <td style="color: #0F172A; font-weight: 700; padding: 4px 0;">{assigned_staff_name} <span style="font-weight: normal; color: #64748B; font-size: 12px;">({assigned_staff_role})</span></td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Current Status:</td>
              <td style="padding: 4px 0;">
                <span style="display: inline-block; background-color: #EDF7F2; color: #16805D; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; border: 1px solid #A6E1CE;">
                  {status_display}
                </span>
              </td>
            </tr>
            {status_note_row}
            {resolution_summary_row}
          </table>
        </div>
        """

        full_html = EmailService._render_email_base(
            title=f"Happy Care Service Notice: {ticket.ticket_number}",
            preheader=f"Official Notice & Real-time Timeline for {ticket.ticket_number} ({ticket.room_number})",
            content_html=content_html
        )

        plain_text = (
            f"*Official Happy Care Hospital Confirmation Notice*\n\n"
            f"Your complaint has been registered successfully.\n"
            f"- Ticket Reference: {ticket.ticket_number}\n"
            f"- Service Location: {ticket.room_number}\n"
            f"- Department: {dept_name}\n"
            f"- Category: {ticket.category}\n"
            f"- Current Status: {status_display}\n\n"
            f"Track real-time resolution progress here:\n"
            f"{tracking_url}\n\n"
            f"Live Resolution Milestones:\n"
            f"1. Request Registered: Completed ({created_str})\n"
            f"2. Assigned to On-Duty Team: {'Completed' if s2_done else 'Pending'} ({assigned_staff_name})\n"
            f"3. Staff Acknowledged & En Route: {'Completed' if s3_done else 'Pending'}\n"
            f"4. Work in Progress: {'Completed' if s4_done else 'Pending'}\n"
            f"5. Resolved & Closed: {'Completed' if s5_done else 'Pending'}\n\n"
            f"Happy Care Hospital Operations - Patient Care & Facilities Management"
        )

        subject = f"Happy Care - Service Confirmation: {ticket.ticket_number} ({dept_name})"

        return {
            "subject": subject,
            "html": full_html,
            "text": plain_text,
            "tracking_url": tracking_url,
            "wa_notice_text": wa_notice_text
        }

    @staticmethod
    def on_ticket_created(db: Session, ticket: Ticket):
        """
        Triggered when a patient or staff member registers a new complaint:
        1. Patient confirmation email (with full WhatsApp quote & 5-step timeline)
        2. Staff notification email (to assigned staff or department personnel)
        3. Administrator notification email
        """
        dept = db.query(Department).filter(Department.id == ticket.department_id).first()
        dept_name = dept.name if dept else ticket.department_id.capitalize()
        cfg = EmailService.get_smtp_config(db)

        # Generate rich maintenance content
        rendered = EmailService.build_patient_maintenance_email_content(
            ticket=ticket,
            dept_name=dept_name
        )

        # 1. Patient Confirmation Email
        patient_email = ticket.patient_email or (ticket.patient_user.email if ticket.patient_user else None)
        if not patient_email and ticket.patient_contact and "@" in ticket.patient_contact:
            patient_email = ticket.patient_contact.strip()

        if patient_email:
            EmailService.enqueue_email(
                db=db,
                recipient_email=patient_email,
                recipient_name=ticket.patient_user.name if ticket.patient_user else "Hospital Patient",
                subject=rendered["subject"],
                body_html=rendered["html"],
                body_text=rendered["text"],
                email_type="patient_submission_confirmation",
                ticket_id=ticket.id
            )

        # 2. Staff Notification Email
        staff_recipient = None
        staff_name = None
        if ticket.assigned_staff and ticket.assigned_staff.email:
            staff_recipient = ticket.assigned_staff.email
            staff_name = ticket.assigned_staff.name
        elif dept and dept.supervisor_id:
            sup = db.query(User).filter(User.id == dept.supervisor_id).first()
            if sup and sup.email:
                staff_recipient = sup.email
                staff_name = sup.name
        elif cfg["maintenance_email"] and ticket.department_id == "maintenance":
            staff_recipient = cfg["maintenance_email"]
            staff_name = "Maintenance Department"

        if staff_recipient:
            staff_subj = f"Happy Care - New Ticket Assigned: {ticket.ticket_number} ({ticket.room_number})"
            EmailService.enqueue_email(
                db=db,
                recipient_email=staff_recipient,
                recipient_name=staff_name,
                subject=staff_subj,
                body_html=rendered["html"],
                body_text=rendered["text"],
                email_type="staff_ticket_assigned",
                ticket_id=ticket.id
            )

        # 3. Admin Notification Email
        admin_recipients = []
        if cfg["work_email"]:
            admin_recipients.append(cfg["work_email"])
        admins = db.query(User).filter(User.role.in_(["admin", "superadmin"]), User.is_active == True).all()
        for a in admins:
            if a.email and a.email not in admin_recipients:
                admin_recipients.append(a.email)

        for admin_email in admin_recipients[:3]:
            admin_subj = f"[Happy Care Alert] New Patient Submission: {ticket.ticket_number} ({dept_name})"
            EmailService.enqueue_email(
                db=db,
                recipient_email=admin_email,
                recipient_name="Hospital Administrator",
                subject=admin_subj,
                body_html=rendered["html"],
                body_text=rendered["text"],
                email_type="admin_new_ticket_alert",
                ticket_id=ticket.id
            )

    @staticmethod
    def send_work_started_email(
        db: Session,
        ticket: Ticket,
        actor_name: str = "Hospital Care Specialist",
        update_note: Optional[str] = None,
        recipient_email_override: Optional[str] = None,
        recipient: Optional[str] = None
    ) -> Optional[EmailLog]:
        """
        Follow-up message #1: Work Started notification for client/patient.
        Dispatched when specialist initiates physical repairs/tasks at bedside.
        """
        target_override = recipient_email_override or recipient
        patient_email = target_override or ticket.patient_email or (ticket.patient_user.email if ticket.patient_user else None)
        if not patient_email and ticket.patient_contact and "@" in ticket.patient_contact:
            patient_email = ticket.patient_contact.strip()

        if not patient_email:
            logger.info(f"Ticket #{ticket.id} work started, but no client email address is registered on ticket.")
            return None

        dept = db.query(Department).filter(Department.id == ticket.department_id).first()
        dept_name = dept.name if dept else ticket.department_id.capitalize()
        recipient_name = ticket.patient_user.name if ticket.patient_user else "Hospital Patient"

        base_url = (getattr(settings, "FRONTEND_URL", "") or "http://192.168.31.219:3000").rstrip("/")
        token_param = f"?token={ticket.patient_tracking_token}" if ticket.patient_tracking_token else ""
        tracking_url = f"{base_url}/track/{ticket.ticket_number}{token_param}"

        assigned_staff_name = ticket.assigned_staff.name if ticket.assigned_staff else actor_name
        assigned_staff_role = (
            ticket.assigned_staff.designation
            if (ticket.assigned_staff and hasattr(ticket.assigned_staff, "designation") and ticket.assigned_staff.designation)
            else f"{dept_name} Specialist"
        )
        started_at_str = (ticket.work_started_at or ticket.in_progress_at or utc_now()).strftime("%I:%M %p, %d %b %Y")

        subject = f"🛠️ Work Started: Specialist Attending to Room {ticket.room_number} [{ticket.ticket_number}]"

        content_html = f"""
        <div style="background-color: #EFF6FF; border: 2px solid #BFDBFE; border-radius: 12px; padding: 20px; margin-bottom: 22px;">
          <div style="display: inline-block; background-color: #DBEAFE; color: #1E40AF; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px;">
            &#9881; Milestone Update &bull; Work Actively in Progress
          </div>
          <h2 style="margin: 0 0 8px 0; color: #1E3A8A; font-size: 20px; font-weight: 800;">
            Specialist Commenced Work at Bedside
          </h2>
          <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
            Hello <strong>{recipient_name}</strong>, our hospital specialist <strong>{assigned_staff_name}</strong> ({assigned_staff_role}) has arrived at <strong>{ticket.room_number}</strong> and work has actively begun on your service request.
          </p>

          <div style="background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 8px; padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #0F172A; margin-bottom: 16px;">
            <div>&bull; Ticket Reference: <strong style="font-family: monospace; color: #176B63; font-size: 14px;">{ticket.ticket_number}</strong></div>
            <div>&bull; Service Location: <strong>{ticket.room_number}</strong></div>
            <div>&bull; Department: <strong>{dept_name}</strong></div>
            <div>&bull; Issue Category: <strong>{ticket.category}</strong></div>
            <div>&bull; Work Commenced: <strong>{started_at_str}</strong></div>
            {f'<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #E2E8F0; color: #475569;">&bull; Note from Specialist: <em>{update_note}</em></div>' if update_note else ''}
          </div>

          <a href="{tracking_url}" target="_blank" style="display: block; background-color: #2563EB; color: #FFFFFF; font-weight: 800; font-size: 14px; text-decoration: none; padding: 13px 20px; border-radius: 8px; text-align: center; letter-spacing: 0.02em;">
            &#10140; Track Live Progress on Bedside Display
          </a>
        </div>

        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 16px; font-size: 13px; color: #475569;">
          <strong>What happens next?</strong> Once work and physical testing are finished, you will receive an official completion notification email with the resolution report and a 1-click rating option.
        </div>
        """

        full_html = EmailService._render_email_base(
            title=f"Work Started - {ticket.ticket_number}",
            preheader=f"Specialist {assigned_staff_name} is actively working on your request at {ticket.room_number}",
            content_html=content_html
        )

        plain_text = (
            f"CareOps Hospital Operations - Work Started Notice\n\n"
            f"Hello {recipient_name},\n\n"
            f"Specialist {assigned_staff_name} ({assigned_staff_role}) has commenced work at {ticket.room_number}.\n\n"
            f"Ticket: {ticket.ticket_number}\n"
            f"Location: {ticket.room_number}\n"
            f"Department: {dept_name}\n"
            f"Category: {ticket.category}\n"
            f"Started At: {started_at_str}\n"
            f"{f'Note: {update_note}' if update_note else ''}\n\n"
            f"Track real-time progress here:\n"
            f"{tracking_url}\n"
        )

        return EmailService.enqueue_email(
            db=db,
            recipient_email=patient_email,
            recipient_name=recipient_name,
            subject=subject,
            body_html=full_html,
            body_text=plain_text,
            email_type="patient_work_started",
            ticket_id=ticket.id
        )

    @staticmethod
    def send_work_completed_email(
        db: Session,
        ticket: Ticket,
        actor_name: str = "Hospital Care Specialist",
        summary: Optional[str] = None,
        parts: Optional[str] = None,
        recipient_email_override: Optional[str] = None,
        recipient: Optional[str] = None
    ) -> Optional[EmailLog]:
        """
        Follow-up message #2: Work Finished notification for client/patient.
        Dispatched when technician completes work or supervisor signs off.
        Includes resolution summary, replaced parts, digital report link, and rating CTA.
        """
        target_override = recipient_email_override or recipient
        patient_email = target_override or ticket.patient_email or (ticket.patient_user.email if ticket.patient_user else None)
        if not patient_email and ticket.patient_contact and "@" in ticket.patient_contact:
            patient_email = ticket.patient_contact.strip()

        if not patient_email:
            logger.info(f"Ticket #{ticket.id} work completed, but no client email address is registered on ticket.")
            return None

        dept = db.query(Department).filter(Department.id == ticket.department_id).first()
        dept_name = dept.name if dept else ticket.department_id.capitalize()
        recipient_name = ticket.patient_user.name if ticket.patient_user else "Hospital Patient"

        base_url = (getattr(settings, "FRONTEND_URL", "") or "http://192.168.31.219:3000").rstrip("/")
        token_param = f"?token={ticket.patient_tracking_token}" if ticket.patient_tracking_token else ""
        tracking_url = f"{base_url}/track/{ticket.ticket_number}{token_param}"
        feedback_url = f"{tracking_url}&action=feedback"

        assigned_staff_name = ticket.assigned_staff.name if ticket.assigned_staff else actor_name
        assigned_staff_role = (
            ticket.assigned_staff.designation
            if (ticket.assigned_staff and hasattr(ticket.assigned_staff, "designation") and ticket.assigned_staff.designation)
            else f"{dept_name} Specialist"
        )
        completed_at_str = (ticket.work_completed_at or ticket.closed_at or utc_now()).strftime("%I:%M %p, %d %b %Y")
        res_summary = summary or ticket.resolution_summary or "Service inspected, repaired, and functionally verified."
        parts_used = parts or ticket.parts_replaced or "Standard service inspection (no external parts required)"

        subject = f"✅ Work Finished: Service Request Resolved for Room {ticket.room_number} [{ticket.ticket_number}]"

        content_html = f"""
        <div style="background-color: #EDF7F2; border: 2px solid #A6E1CE; border-radius: 12px; padding: 20px; margin-bottom: 22px;">
          <div style="display: inline-block; background-color: #C6EEDC; color: #16805D; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px;">
            &#10003; Milestone Update &bull; Work Completed & Verified
          </div>
          <h2 style="margin: 0 0 8px 0; color: #14532D; font-size: 20px; font-weight: 800;">
            Work Completed & Service Verified
          </h2>
          <p style="margin: 0 0 16px 0; color: #166534; font-size: 14px; line-height: 1.6;">
            Hello <strong>{recipient_name}</strong>, great news! The maintenance and repair work for your service request at <strong>{ticket.room_number}</strong> has been successfully completed and functionally tested.
          </p>

          <div style="background-color: #FFFFFF; border: 1px solid #A6E1CE; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.7; color: #0F172A; margin-bottom: 16px;">
            <div>&bull; Ticket Reference: <strong style="font-family: monospace; color: #176B63; font-size: 14px;">{ticket.ticket_number}</strong></div>
            <div>&bull; Service Location: <strong>{ticket.room_number}</strong></div>
            <div>&bull; Department: <strong>{dept_name}</strong></div>
            <div>&bull; Completed By: <strong>{assigned_staff_name}</strong> ({assigned_staff_role})</div>
            <div>&bull; Time Completed: <strong>{completed_at_str}</strong></div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #CBD5E1;">
              &bull; <strong>Resolution Summary:</strong><br>
              <span style="color: #16805D; font-weight: 700;">{res_summary}</span>
            </div>
            {f'<div style="margin-top: 6px; color: #64748B;">&bull; <strong>Replaced Parts / Components:</strong> {parts_used}</div>' if parts_used else ''}
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 12px;">
            <tr>
              <td style="padding-bottom: 8px;">
                <a href="{tracking_url}" target="_blank" style="display: block; background-color: #176B63; color: #FFFFFF; font-weight: 800; font-size: 14px; text-decoration: none; padding: 13px 20px; border-radius: 8px; text-align: center; letter-spacing: 0.02em;">
                  &#10140; View Completed Service Report & Digital Log
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="{feedback_url}" target="_blank" style="display: block; background-color: #F8FAFC; color: #16805D; border: 2px solid #16805D; font-weight: 800; font-size: 13px; text-decoration: none; padding: 11px 18px; border-radius: 8px; text-align: center;">
                  &#11088; Rate Your Service Experience (1 &ndash; 5 Stars)
                </a>
              </td>
            </tr>
          </table>
        </div>

        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; font-size: 12px; color: #64748B; text-align: center;">
          Thank you for helping us maintain top clinical and patient care standards at Metropolitan General Hospital.
        </div>
        """

        full_html = EmailService._render_email_base(
            title=f"Work Completed - {ticket.ticket_number}",
            preheader=f"Work has been completed and verified for your request at {ticket.room_number}",
            content_html=content_html
        )

        plain_text = (
            f"CareOps Hospital Operations - Work Finished Notice\n\n"
            f"Hello {recipient_name},\n\n"
            f"The service work for your request at {ticket.room_number} has been completed and verified.\n\n"
            f"Ticket: {ticket.ticket_number}\n"
            f"Location: {ticket.room_number}\n"
            f"Department: {dept_name}\n"
            f"Specialist: {assigned_staff_name} ({assigned_staff_role})\n"
            f"Completed At: {completed_at_str}\n"
            f"Resolution: {res_summary}\n\n"
            f"View completed report:\n{tracking_url}\n\n"
            f"Rate your service experience:\n{feedback_url}\n"
        )

        return EmailService.enqueue_email(
            db=db,
            recipient_email=patient_email,
            recipient_name=recipient_name,
            subject=subject,
            body_html=full_html,
            body_text=plain_text,
            email_type="patient_work_completed",
            ticket_id=ticket.id
        )

    @staticmethod
    def on_ticket_status_updated(db: Session, ticket: Ticket, new_status: str, actor_name: str, update_note: Optional[str] = None):
        """
        Notifies patient and staff when a ticket's status changes:
        - When 'in_progress': dispatches high-priority dedicated Work Started follow-up email.
        - When 'resolution_submitted' or 'closed': dispatches dedicated Work Completed follow-up email.
        - For other status updates: sends milestone timeline status alert.
        """
        norm_status = (new_status or "").lower()

        # Follow-up #1: Dedicated Work Started email for client
        if norm_status in ("in_progress", "work_started"):
            return EmailService.send_work_started_email(
                db=db,
                ticket=ticket,
                actor_name=actor_name,
                update_note=update_note
            )

        # Follow-up #2: Dedicated Work Finished email for client
        if norm_status in ("resolution_submitted", "work_completed", "closed"):
            return EmailService.send_work_completed_email(
                db=db,
                ticket=ticket,
                actor_name=actor_name,
                summary=update_note or ticket.resolution_summary,
                parts=ticket.parts_replaced
            )

        # Default milestone update for other states (acknowledged, delayed, reopened)
        patient_email = ticket.patient_email or (ticket.patient_user.email if ticket.patient_user else None)
        if not patient_email and ticket.patient_contact and "@" in ticket.patient_contact:
            patient_email = ticket.patient_contact.strip()

        if patient_email:
            dept = db.query(Department).filter(Department.id == ticket.department_id).first()
            dept_name = dept.name if dept else ticket.department_id.capitalize()
            status_display = new_status.replace("_", " ").title()

            rendered = EmailService.build_patient_maintenance_email_content(
                ticket=ticket,
                dept_name=dept_name,
                custom_headline=f"Request Status Updated: {status_display}",
                status_note=f"{update_note} (Updated by {actor_name})" if update_note else f"Updated by {actor_name}"
            )

            subject = f"Happy Care - Status Update: {ticket.ticket_number} is {status_display}"
            EmailService.enqueue_email(
                db=db,
                recipient_email=patient_email,
                recipient_name=ticket.patient_user.name if ticket.patient_user else "Patient",
                subject=subject,
                body_html=rendered["html"],
                body_text=rendered["text"],
                email_type="patient_status_update",
                ticket_id=ticket.id
            )

    @staticmethod
    def send_ticket_timeline_email(
        db: Session,
        ticket: Ticket,
        recipient_email: str,
        recipient_name: Optional[str] = None
    ) -> EmailLog:
        """
        Explicitly dispatches the full WhatsApp-style maintenance confirmation
        and 5-step milestone timeline email to any target address.
        """
        dept = db.query(Department).filter(Department.id == ticket.department_id).first()
        dept_name = dept.name if dept else ticket.department_id.capitalize()

        rendered = EmailService.build_patient_maintenance_email_content(
            ticket=ticket,
            dept_name=dept_name
        )

        return EmailService.enqueue_email(
            db=db,
            recipient_email=recipient_email,
            recipient_name=recipient_name or "Hospital Patient",
            subject=rendered["subject"],
            body_html=rendered["html"],
            body_text=rendered["text"],
            email_type="patient_submission_confirmation",
            ticket_id=ticket.id
        )

    @staticmethod
    def send_password_reset_email(db: Session, user: User, reset_url: str):
        """Sends secure password reset link to user."""
        subject = "CareOps AI — Secure Password Reset Request"
        html_content = EmailService._render_email_base(
            title="Password Reset Request",
            preheader="Secure link to reset your CareOps password",
            content_html=f"""
            <div class="badge" style="background: #fee2e2; color: #b91c1c;">Security Notice</div>
            <h2 style="margin-top: 0; color: #0f172a;">Password Reset Instructions</h2>
            <p>Hello <strong>{user.name}</strong>,</p>
            <p>A password reset was requested for your hospital account ({user.email}). Click the secure button below to set a new password:</p>
            
            <p style="text-align: center; margin: 24px 0;">
              <a href="{reset_url}" class="btn">Reset My Password</a>
            </p>
            
            <p style="color: #64748b; font-size: 13px;">This secure link is single-use and will expire in 60 minutes. If you did not initiate this request, please report it immediately to your hospital IT administrator.</p>
            """
        )
        text_content = f"Password reset requested for {user.email}.\nUse this link to reset your password:\n{reset_url}\nExpires in 60 minutes."
        EmailService.enqueue_email(
            db=db,
            recipient_email=user.email,
            recipient_name=user.name,
            subject=subject,
            body_html=html_content,
            body_text=text_content,
            email_type="password_reset"
        )

    @staticmethod
    def send_staff_invitation_email(
        db: Session,
        user: User,
        temporary_password: Optional[str] = None,
        activation_url: Optional[str] = None
    ):
        """
        Sends secure account onboarding and activation instructions to newly provisioned hospital staff.
        Enforces Master Requirement #4: Staff Email Assignment & Notifications.
        """
        dept = db.query(Department).filter(Department.id == user.department_id).first() if user.department_id else None
        dept_name = dept.name if dept else (user.department_id.capitalize() if user.department_id else "Hospital Operations")
        frontend_base = (getattr(settings, "FRONTEND_URL", "") or "http://localhost:3000").rstrip("/")
        login_url = f"{frontend_base}/"

        subject = f"Welcome to CareOps — Your Staff Account Credentials ({dept_name})"
        content_html = f"""
        <div class="badge" style="background: #e0f2fe; color: #0369a1;">Hospital Staff Onboarding</div>
        <h2 style="margin-top: 0; color: #0f172a;">Welcome to CareOps Hospital Platform</h2>
        <p>Dear <strong>{user.name}</strong>,</p>
        <p>Your hospital staff account has been provisioned by hospital administration. You can now access the shared <strong>Staff Portal</strong> to manage complaints, service orders, and departmental tasks.</p>

        <div class="info-box">
          <div style="font-weight: 700; margin-bottom: 8px; color: #0f172a;">Your Authentication Credentials:</div>
          <div class="info-row"><span class="info-label">Staff / Employee ID:</span> <span class="info-val" style="font-weight: 700; font-family: monospace; color: #2563eb;">{user.employee_id}</span></div>
          <div class="info-row"><span class="info-label">Registered Work Email:</span> <span class="info-val">{user.email}</span></div>
          <div class="info-row"><span class="info-label">Assigned Department:</span> <span class="info-val">{dept_name}</span></div>
          <div class="info-row"><span class="info-label">Role:</span> <span class="info-val" style="text-transform: capitalize;">{user.role}</span></div>
          <div class="info-row"><span class="info-label">Designation:</span> <span class="info-val">{user.designation or 'Hospital Personnel'}</span></div>
          {f'<div class="info-row"><span class="info-label">Temporary Password:</span> <span class="info-val" style="font-family: monospace; font-weight: 700; background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">{temporary_password}</span></div>' if temporary_password else ''}
        </div>

        <p>You can sign in to the Staff Portal using either your <strong>Employee ID ({user.employee_id})</strong> or your registered email address.</p>

        <p style="text-align: center; margin: 24px 0;">
          <a href="{activation_url or login_url}" class="btn">Access Hospital Staff Portal</a>
        </p>

        <p style="color: #64748b; font-size: 13px;">Security Notice: You will be prompted to change your temporary password upon initial authentication. Never share your credentials with colleagues.</p>
        """

        text_content = (
            f"Welcome to CareOps AI, {user.name}!\n\n"
            f"Your staff account has been created for department: {dept_name}.\n"
            f"Employee ID: {user.employee_id}\n"
            f"Email: {user.email}\n"
            f"Temporary Password: {temporary_password or 'Contact Administrator'}\n"
            f"Staff Portal Login: {login_url}\n\n"
            f"Please sign in and configure your permanent password immediately."
        )

        return EmailService.enqueue_email(
            db=db,
            recipient_email=user.email,
            recipient_name=user.name,
            subject=subject,
            body_html=content_html,
            body_text=text_content,
            email_type="staff_account_invitation"
        )

    @staticmethod
    def send_staff_email_updated_notice(
        db: Session,
        user: User,
        old_email: str,
        new_email: str
    ):
        """Notifies user at both old and new addresses when their official work email is changed."""
        subject = "Security Notice: Your CareOps Account Email Address Was Updated"
        html_content = EmailService._render_email_base(
            title="Account Security Notice",
            preheader="Notification of work email address update",
            content_html=f"""
            <div class="badge" style="background: #fef3c7; color: #b45309;">Account Update</div>
            <h2 style="margin-top: 0; color: #0f172a;">Official Work Email Changed</h2>
            <p>Dear <strong>{user.name}</strong>,</p>
            <p>Your official work email address for your CareOps hospital staff account (ID: {user.employee_id}) was updated by hospital administration:</p>
            <div class="info-box">
              <div class="info-row"><span class="info-label">Previous Email:</span> <span class="info-val">{old_email}</span></div>
              <div class="info-row"><span class="info-label">New Active Email:</span> <span class="info-val" style="font-weight: 700; color: #2563eb;">{new_email}</span></div>
              <div class="info-row"><span class="info-label">Timestamp:</span> <span class="info-val">{utc_now().strftime('%Y-%m-%d %H:%M:%S UTC')}</span></div>
            </div>
            <p>All future operational notifications, ticket assignments, and password reset instructions will be delivered to <strong>{new_email}</strong>.</p>
            <p style="color: #64748b; font-size: 13px;">If you did not authorize this change, please report this immediately to your hospital IT administrator or security officer.</p>
            """
        )
        text_content = f"Security Notice: Your CareOps email was updated from {old_email} to {new_email} on {utc_now().isoformat()}."

        # Send to new email
        EmailService.enqueue_email(
            db=db,
            recipient_email=new_email,
            recipient_name=user.name,
            subject=subject,
            body_html=html_content,
            body_text=text_content,
            email_type="staff_email_changed"
        )
        # Also notify old email if valid
        if old_email and "@" in old_email:
            try:
                EmailService.enqueue_email(
                    db=db,
                    recipient_email=old_email,
                    recipient_name=user.name,
                    subject=subject,
                    body_html=html_content,
                    body_text=text_content,
                    email_type="staff_email_changed"
                )
            except Exception:
                pass
