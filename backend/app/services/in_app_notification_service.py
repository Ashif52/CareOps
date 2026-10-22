from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import logging
from sqlalchemy.orm import Session
from app.models import Notification, User, Ticket, Department, DepartmentSupervisor

logger = logging.getLogger("careops.in_app_notifications")

def utc_now():
    return datetime.now(timezone.utc)

class InAppNotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        recipient_id: int,
        event_type: str,
        title: str,
        message: str,
        ticket_id: Optional[int] = None,
        ticket_number: Optional[str] = None,
        department_id: Optional[str] = None,
        destination_link: Optional[str] = None,
        dedup_key: Optional[str] = None
    ) -> Optional[Notification]:
        """
        Creates an in-app notification for a user with event deduplication.
        Ensures idempotency - if dedup_key exists, skips creation.
        """
        try:
            if dedup_key:
                existing = db.query(Notification).filter(Notification.dedup_key == dedup_key).first()
                if existing:
                    logger.debug(f"Notification with dedup_key {dedup_key} already exists. Skipping.")
                    return existing

            notif = Notification(
                recipient_id=recipient_id,
                department_id=department_id,
                event_type=event_type,
                title=title,
                message=message,
                ticket_id=ticket_id,
                ticket_number=ticket_number,
                destination_link=destination_link,
                is_read=False,
                dedup_key=dedup_key,
                created_at=utc_now()
            )
            db.add(notif)
            db.commit()
            db.refresh(notif)
            return notif
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create notification for user {recipient_id}: {e}")
            return None

    @staticmethod
    def notify_department_supervisors(
        db: Session,
        department_id: str,
        event_type: str,
        title: str,
        message: str,
        ticket: Optional[Ticket] = None,
        destination_link: Optional[str] = None,
        dedup_prefix: Optional[str] = None
    ) -> List[Notification]:
        """
        Finds all active supervisors for the specified department and creates
        a notification for each one without duplicates.
        """
        supervisor_user_ids = set()

        # 1. Direct supervisor_id on Department
        dept = db.query(Department).filter(Department.id == department_id).first()
        if dept and dept.supervisor_id:
            supervisor_user_ids.add(dept.supervisor_id)

        # 2. Secondary junction table
        secondary_sups = db.query(DepartmentSupervisor.user_id).filter(
            DepartmentSupervisor.department_id == department_id
        ).all()
        for s in secondary_sups:
            supervisor_user_ids.add(s[0])

        # 3. Users with role='supervisor' and department_id
        users = db.query(User).filter(
            User.role == "supervisor",
            User.department_id == department_id,
            User.is_active == True
        ).all()
        for u in users:
            supervisor_user_ids.add(u.id)

        created_notifs = []
        for uid in supervisor_user_ids:
            dedup_key = f"{dedup_prefix}:{uid}" if dedup_prefix else None
            notif = InAppNotificationService.create_notification(
                db=db,
                recipient_id=uid,
                event_type=event_type,
                title=title,
                message=message,
                ticket_id=ticket.id if ticket else None,
                ticket_number=ticket.ticket_number if ticket else None,
                department_id=department_id,
                destination_link=destination_link or (f"/tickets?id={ticket.id}" if ticket else "/my-department"),
                dedup_key=dedup_key
            )
            if notif:
                created_notifs.append(notif)

        return created_notifs

    @staticmethod
    def notify_administrators(
        db: Session,
        event_type: str,
        title: str,
        message: str,
        department_id: Optional[str] = None,
        ticket: Optional[Ticket] = None,
        destination_link: Optional[str] = None,
        dedup_prefix: Optional[str] = None,
        include_superadmin: bool = True
    ) -> List[Notification]:
        """
        Notifies administrators and superadmins within authorized administrative scope.
        """
        roles = ["admin", "superadmin"] if include_superadmin else ["admin"]
        admins = db.query(User).filter(User.role.in_(roles), User.is_active == True).all()

        created_notifs = []
        for admin in admins:
            dedup_key = f"{dedup_prefix}:{admin.id}" if dedup_prefix else None
            notif = InAppNotificationService.create_notification(
                db=db,
                recipient_id=admin.id,
                event_type=event_type,
                title=title,
                message=message,
                ticket_id=ticket.id if ticket else None,
                ticket_number=ticket.ticket_number if ticket else None,
                department_id=department_id,
                destination_link=destination_link or (f"/tickets?id={ticket.id}" if ticket else "/overview"),
                dedup_key=dedup_key
            )
            if notif:
                created_notifs.append(notif)

        return created_notifs

    @staticmethod
    def notify_assigned_staff(
        db: Session,
        ticket: Ticket,
        event_type: str,
        title: str,
        message: str,
        destination_link: Optional[str] = None,
        dedup_key: Optional[str] = None
    ) -> Optional[Notification]:
        """
        Sends an in-app notification to the assigned staff member.
        Staff only receives notifications for tickets assigned to them!
        """
        if not ticket.assigned_staff_id:
            return None

        return InAppNotificationService.create_notification(
            db=db,
            recipient_id=ticket.assigned_staff_id,
            event_type=event_type,
            title=title,
            message=message,
            ticket_id=ticket.id,
            ticket_number=ticket.ticket_number,
            department_id=ticket.department_id,
            destination_link=destination_link or f"/my-department?ticket={ticket.id}",
            dedup_key=dedup_key
        )
