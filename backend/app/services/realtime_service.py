import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any
from datetime import datetime, timezone

logger = logging.getLogger("careops.realtime")

class RealtimeHub:
    """
    Production-grade in-memory Server-Sent Events (SSE) & WebSocket broadcaster.
    Supports role-based and department-based event distribution, plus specific ticket-level channels.
    """
    def __init__(self):
        # Queues subscribed to staff/admin operational events
        # Mapping: queue -> subscriber metadata dict
        self._staff_subscribers: Dict[asyncio.Queue, Dict[str, Any]] = {}
        
        # Queues subscribed to specific ticket tracking (e.g., patient tracker)
        # Mapping: ticket_number -> Set of asyncio.Queue
        self._patient_subscribers: Dict[str, Set[asyncio.Queue]] = {}
        
        self._lock = asyncio.Lock()

    async def subscribe_staff(
        self,
        user_id: int,
        role: str,
        department_id: Optional[str] = None
    ) -> asyncio.Queue:
        """Register a staff or administrator connection for real-time ticket alerts"""
        queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._staff_subscribers[queue] = {
                "user_id": user_id,
                "role": role,
                "department_id": department_id,
                "connected_at": datetime.now(timezone.utc).isoformat()
            }
        logger.info(f"Staff SSE subscriber connected: user_id={user_id}, role={role}, dept={department_id}. Active: {len(self._staff_subscribers)}")
        return queue

    async def unsubscribe_staff(self, queue: asyncio.Queue):
        """Remove a staff subscriber queue cleanly on disconnect"""
        async with self._lock:
            if queue in self._staff_subscribers:
                meta = self._staff_subscribers.pop(queue)
                logger.info(f"Staff SSE subscriber disconnected: user_id={meta.get('user_id')}. Active: {len(self._staff_subscribers)}")

    async def subscribe_patient(self, ticket_number: str) -> asyncio.Queue:
        """Register a patient connection listening for status updates on a specific ticket"""
        key = ticket_number.strip().upper()
        queue = asyncio.Queue(maxsize=50)
        async with self._lock:
            if key not in self._patient_subscribers:
                self._patient_subscribers[key] = set()
            self._patient_subscribers[key].add(queue)
        logger.info(f"Patient SSE subscriber connected for ticket {key}")
        return queue

    async def unsubscribe_patient(self, ticket_number: str, queue: asyncio.Queue):
        """Remove a patient subscriber queue cleanly on disconnect"""
        key = ticket_number.strip().upper()
        async with self._lock:
            if key in self._patient_subscribers:
                self._patient_subscribers[key].discard(queue)
                if not self._patient_subscribers[key]:
                    del self._patient_subscribers[key]
        logger.info(f"Patient SSE subscriber disconnected for ticket {key}")

    async def publish_ticket_created(self, ticket_data: dict):
        """
        Broadcast incoming patient or staff complaint to all authorized staff workspaces.
        Ensures the very first ticket appears automatically without page refresh!
        """
        dept_id = ticket_data.get("department_id")
        event_payload = {
            "event": "ticket_created",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": ticket_data
        }
        raw_message = f"event: ticket_created\ndata: {json.dumps(event_payload)}\n\n"

        async with self._lock:
            target_queues = list(self._staff_subscribers.items())

        sent_count = 0
        for queue, meta in target_queues:
            # Admins, directors, supervisors see all tickets
            # Staff see tickets for their department, or if unscoped
            staff_dept = meta.get("department_id")
            staff_role = meta.get("role")

            is_authorized = (
                staff_role in ["admin", "supervisor", "director"]
                or not staff_dept
                or staff_dept == dept_id
            )

            if is_authorized:
                try:
                    queue.put_nowait(raw_message)
                    sent_count += 1
                except asyncio.QueueFull:
                    logger.warning("Staff subscriber queue full; dropping event to prevent blocking")
                except Exception as e:
                    logger.warning(f"Error publishing ticket_created to staff: {e}")

        logger.info(f"Published ticket_created ({ticket_data.get('ticket_number')}) to {sent_count}/{len(target_queues)} staff connections")

    async def publish_ticket_updated(self, ticket_data: dict):
        """
        Broadcast ticket status changes (acknowledged, work started, resolved, closed)
        to both authorized staff workspaces AND patient tracking views!
        """
        dept_id = ticket_data.get("department_id")
        ticket_number = ticket_data.get("ticket_number", "").strip().upper()

        event_payload = {
            "event": "ticket_updated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": ticket_data
        }
        raw_message = f"event: ticket_updated\ndata: {json.dumps(event_payload)}\n\n"

        # 1. Distribute to staff subscribers
        async with self._lock:
            staff_queues = list(self._staff_subscribers.items())
            patient_queues = list(self._patient_subscribers.get(ticket_number, set()))

        sent_staff = 0
        for queue, meta in staff_queues:
            staff_dept = meta.get("department_id")
            staff_role = meta.get("role")
            is_authorized = (
                staff_role in ["admin", "supervisor", "director"]
                or not staff_dept
                or staff_dept == dept_id
            )
            if is_authorized:
                try:
                    queue.put_nowait(raw_message)
                    sent_staff += 1
                except asyncio.QueueFull:
                    pass
                except Exception:
                    pass

        # 2. Distribute to patient tracking subscribers
        sent_patients = 0
        for queue in patient_queues:
            try:
                queue.put_nowait(raw_message)
                sent_patients += 1
            except asyncio.QueueFull:
                pass
            except Exception:
                pass

        logger.info(
            f"Published ticket_updated ({ticket_number}, status={ticket_data.get('status')}) "
            f"to {sent_staff} staff and {sent_patients} patient subscribers"
        )

# Global singleton
realtime_hub = RealtimeHub()
