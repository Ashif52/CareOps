from datetime import datetime, timedelta, timezone
import json
from app.database import engine, Base, SessionLocal
from app.models import (
    Department, User, Room, Ticket, Evidence, AIVerificationJob,
    SLAPolicy, EscalationLog, TicketNote, AuditLog
)
from app.services.auth_service import get_password_hash

def utc_now():
    return datetime.now(timezone.utc)

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Check if already seeded
        if db.query(Department).first():
            print("Database already contains data, skipping seed.")
            return

        print("Seeding CareOps AI enterprise database...")
        now = utc_now()
        pw_hash = get_password_hash("password123")

        # 1. Seed Users (Admin & Supervisors first so foreign keys work)
        admin = User(
            email="admin@careops.hospital",
            name="Dr. Alistair Vance",
            role="admin",
            department_id=None,
            phone="+91 98765 43210",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            hashed_password=pw_hash
        )
        superadmin = User(
            email="superadmin@careops.hospital",
            name="System Superadmin",
            role="superadmin",
            department_id=None,
            phone="+91 98765 00000",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            hashed_password=pw_hash
        )
        db.add_all([admin, superadmin])
        db.flush()

        sup_mnt = User(
            email="supervisor.mnt@careops.hospital",
            name="Vikramaditya Rao",
            role="supervisor",
            department_id=None,
            phone="+91 98765 11111",
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
            hashed_password=pw_hash
        )
        sup_nur = User(
            email="supervisor.nur@careops.hospital",
            name="Sister Mary Thomas",
            role="supervisor",
            department_id=None,
            phone="+91 98765 22222",
            avatar_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
            hashed_password=pw_hash
        )
        db.add_all([sup_mnt, sup_nur])
        db.flush()

        # 2. Seed 6 Departments
        departments_data = [
            Department(
                id="maintenance",
                name="Facilities & Biomedical Engineering",
                code="MNT",
                description="Ceiling fans, lighting, plumbing, medical gas outlets, HVAC, and room equipment.",
                icon="Wrench",
                supervisor_id=sup_mnt.id
            ),
            Department(
                id="doctors",
                name="Physicians & Duty Doctors",
                code="DOC",
                description="Attending physician consultations, urgent rounds, clinical symptom inquiries.",
                icon="Stethoscope",
                supervisor_id=admin.id
            ),
            Department(
                id="nursing",
                name="Clinical Nursing Staff",
                code="NUR",
                description="Nurse call assistance, vitals check, IV drip monitoring, patient mobility.",
                icon="HeartPulse",
                supervisor_id=sup_nur.id
            ),
            Department(
                id="housekeeping",
                name="Housekeeping & Sanitation",
                code="HSK",
                description="Room sanitization, spill cleanup, waste disposal, fresh bed linen replacements.",
                icon="Sparkles",
                supervisor_id=sup_mnt.id
            ),
            Department(
                id="billing",
                name="Patient Accounts & Billing",
                code="BIL",
                description="Insurance pre-authorization, pharmacy bill clarification, interim invoice reviews.",
                icon="Receipt",
                supervisor_id=admin.id
            ),
            Department(
                id="pharmacy",
                name="Inpatient Clinical Pharmacy",
                code="PHM",
                description="Discharge prescription dispatch, STAT medication requests, IV consumables.",
                icon="Pill",
                supervisor_id=admin.id
            )
        ]
        db.add_all(departments_data)
        db.flush()

        # Link supervisors to their departments now that departments exist
        sup_mnt.department_id = "maintenance"
        sup_nur.department_id = "nursing"
        db.flush()

        # 3. Staff Users
        staff_members = [
            User(
                email="technician.rajesh@careops.hospital",
                name="Rajesh Sharma",
                role="staff",
                department_id="maintenance",
                phone="+91 98765 33301",
                avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
                hashed_password=pw_hash
            ),
            User(
                email="technician.kiran@careops.hospital",
                name="Kiran Patel",
                role="staff",
                department_id="maintenance",
                phone="+91 98765 33302",
                avatar_url="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150",
                hashed_password=pw_hash
            ),
            User(
                email="nurse.priya@careops.hospital",
                name="Staff Nurse Priya Nair",
                role="staff",
                department_id="nursing",
                phone="+91 98765 33303",
                avatar_url="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
                hashed_password=pw_hash
            ),
            User(
                email="nurse.arun@careops.hospital",
                name="Staff Nurse Arun Kumar",
                role="staff",
                department_id="nursing",
                phone="+91 98765 33304",
                avatar_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150",
                hashed_password=pw_hash
            ),
            User(
                email="hk.suresh@careops.hospital",
                name="Suresh Yadav",
                role="staff",
                department_id="housekeeping",
                phone="+91 98765 33305",
                avatar_url="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
                hashed_password=pw_hash
            ),
            User(
                email="billing.anita@careops.hospital",
                name="Anita Deshmukh",
                role="staff",
                department_id="billing",
                phone="+91 98765 33306",
                avatar_url="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
                hashed_password=pw_hash
            ),
            User(
                email="pharmacy.rahul@careops.hospital",
                name="Rahul Sen",
                role="staff",
                department_id="pharmacy",
                phone="+91 98765 33307",
                avatar_url="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150",
                hashed_password=pw_hash
            )
        ]
        db.add_all(staff_members)
        db.flush()

        # 4. Seed Hospital Rooms with QR Tokens
        rooms = [
            Room(room_number="Room 204", floor="Floor 2", wing="East Wing (Cardiology)", qr_token="CARE-RM204-7X9Q", bed_count=1),
            Room(room_number="Room 205", floor="Floor 2", wing="East Wing (Cardiology)", qr_token="CARE-RM205-2M4K", bed_count=1),
            Room(room_number="Room 312", floor="Floor 3", wing="West Wing (General Med)", qr_token="CARE-RM312-9A8L", bed_count=2),
            Room(room_number="ICU Bed 04", floor="Floor 1", wing="Critical Care Unit", qr_token="CARE-ICU04-3V7P", bed_count=1),
            Room(room_number="Deluxe Suite 501", floor="Floor 5", wing="VIP Pavilion", qr_token="CARE-DLX501-8T2R", bed_count=1),
            Room(room_number="Post-Op Ward 108", floor="Floor 1", wing="Surgical Recovery", qr_token="CARE-POP108-5N1W", bed_count=4)
        ]
        db.add_all(rooms)
        db.flush()

        # 5. SLA Policies
        sla_policies = [
            # Maintenance
            SLAPolicy(department_id="maintenance", priority="critical", ack_target_minutes=15, resolution_target_minutes=60, reminder_1_minutes_before=20, reminder_2_minutes_before=5),
            SLAPolicy(department_id="maintenance", priority="high", ack_target_minutes=30, resolution_target_minutes=120, reminder_1_minutes_before=30, reminder_2_minutes_before=10),
            SLAPolicy(department_id="maintenance", priority="medium", ack_target_minutes=60, resolution_target_minutes=240, reminder_1_minutes_before=60, reminder_2_minutes_before=15),
            SLAPolicy(department_id="maintenance", priority="low", ack_target_minutes=120, resolution_target_minutes=480, reminder_1_minutes_before=90, reminder_2_minutes_before=30),
            # Nursing
            SLAPolicy(department_id="nursing", priority="critical", ack_target_minutes=5, resolution_target_minutes=20, reminder_1_minutes_before=10, reminder_2_minutes_before=3),
            SLAPolicy(department_id="nursing", priority="high", ack_target_minutes=15, resolution_target_minutes=45, reminder_1_minutes_before=15, reminder_2_minutes_before=5),
            SLAPolicy(department_id="nursing", priority="medium", ack_target_minutes=30, resolution_target_minutes=90, reminder_1_minutes_before=20, reminder_2_minutes_before=5),
            # Housekeeping
            SLAPolicy(department_id="housekeeping", priority="high", ack_target_minutes=15, resolution_target_minutes=45, reminder_1_minutes_before=15, reminder_2_minutes_before=5),
            SLAPolicy(department_id="housekeeping", priority="medium", ack_target_minutes=30, resolution_target_minutes=90, reminder_1_minutes_before=20, reminder_2_minutes_before=10),
            # Doctors
            SLAPolicy(department_id="doctors", priority="critical", ack_target_minutes=10, resolution_target_minutes=30, reminder_1_minutes_before=10, reminder_2_minutes_before=3),
            SLAPolicy(department_id="doctors", priority="high", ack_target_minutes=20, resolution_target_minutes=60, reminder_1_minutes_before=15, reminder_2_minutes_before=5),
            # Billing
            SLAPolicy(department_id="billing", priority="medium", ack_target_minutes=60, resolution_target_minutes=180, reminder_1_minutes_before=30, reminder_2_minutes_before=10),
            # Pharmacy
            SLAPolicy(department_id="pharmacy", priority="critical", ack_target_minutes=10, resolution_target_minutes=30, reminder_1_minutes_before=10, reminder_2_minutes_before=5),
            SLAPolicy(department_id="pharmacy", priority="high", ack_target_minutes=20, resolution_target_minutes=60, reminder_1_minutes_before=15, reminder_2_minutes_before=5)
        ]
        db.add_all(sla_policies)
        db.flush()

        # 6. Realistic Sample Tickets across states
        seed_demo_tickets(db)

        print("Successfully seeded CareOps AI database with 6 departments, staff, rooms, and live tickets!")

    except Exception as e:
        db.rollback()
        print(f"Error during database seed: {e}")
        raise e
    finally:
        db.close()


def seed_demo_tickets(db: Session):
    """Seeds or re-seeds 5 realistic demonstration tickets across hospital departments"""
    now = utc_now()
    rooms = db.query(Room).order_by(Room.id).all()
    if not rooms or len(rooms) < 5:
        return

    staff_members = db.query(User).filter(User.role == "staff").order_by(User.id).all()
    if not staff_members:
        return

    sup_mnt = db.query(User).filter(User.department_id == "maintenance", User.role == "supervisor").first()
    sup_nur = db.query(User).filter(User.department_id == "nursing", User.role == "supervisor").first()
    if not sup_mnt:
        sup_mnt = staff_members[0]
    if not sup_nur:
        sup_nur = staff_members[0]

    # Ticket 1: The flagship Ceiling Fan repair with AI verification
    t1 = Ticket(
        ticket_number="TKT-MNT-1001",
        title="Ceiling Fan Not Rotating - Room 204",
        description="Patient in Bed 1 reports the ceiling fan fails to start when regulator switch is turned to max. Whirring noise heard from the motor capacitor.",
        voice_recording_url="/uploads/audio/demo_fan_complaint.webm",
        voice_transcription="Hello nurse station, the overhead ceiling fan in room 204 isn't spinning even though the wall switch is on. It's getting quite warm.",
        department_id="maintenance",
        room_id=rooms[0].id,
        room_number=rooms[0].room_number,
        category="Ceiling Fan",
        priority="high",
        status="resolution_submitted",
        is_escalated=False,
        assigned_staff_id=staff_members[0].id,  # Rajesh
        assigned_supervisor_id=sup_mnt.id,
        sla_acknowledgement_deadline=now - timedelta(minutes=90),
        sla_resolution_deadline=now + timedelta(minutes=40),
        acknowledged_at=now - timedelta(minutes=100),
        in_progress_at=now - timedelta(minutes=80),
        resolution_submitted_at=now - timedelta(minutes=15),
        resolution_summary="Replaced faulty 3.15uF capacitor and re-lubricated motor ball bearing assembly. Fan inspected for balanced clearance.",
        parts_replaced="3.15uF Havells Motor Capacitor",
        functional_test_notes="Ran at Step 5 for 10 minutes without rattling or heat buildup. Blade clearance 34cm verified.",
        patient_contact="+91 98451 00293",
        created_at=now - timedelta(minutes=110)
    )
    db.add(t1)
    db.flush()

    # Evidences for T1
    ev_t1_before = Evidence(
        ticket_id=t1.id,
        stage="before",
        media_type="video",
        file_url="https://assets.mixkit.co/videos/preview/mixkit-ceiling-fan-in-a-white-room-42861-large.mp4",
        file_size_bytes=4210000,
        file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        equipment_type="Ceiling Fan",
        uploaded_by_id=staff_members[0].id,
        notes="Before: Switch turned on, motor stationary. Video demonstrates complete absence of blade rotation."
    )
    ev_t1_after = Evidence(
        ticket_id=t1.id,
        stage="after",
        media_type="video",
        file_url="https://assets.mixkit.co/videos/preview/mixkit-ceiling-fan-rotating-in-a-room-42862-large.mp4",
        file_size_bytes=5180000,
        file_hash="ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
        equipment_type="Ceiling Fan",
        uploaded_by_id=staff_members[0].id,
        notes="After: Capacitor replaced, fan running smoothly at high speed. Blade motion clearly visible."
    )
    db.add_all([ev_t1_before, ev_t1_after])
    db.flush()

    ai_t1 = AIVerificationJob(
        ticket_id=t1.id,
        status="completed",
        before_evidence_id=ev_t1_before.id,
        after_evidence_id=ev_t1_after.id,
        evidence_relevance="high",
        equipment_match="confirmed_match",
        visible_fault_assessment="fault_cleared",
        after_repair_functional_evidence="movement_observed",
        media_quality="high",
        missing_evidence="[]",
        inconsistencies="[]",
        ai_recommendation="likely_resolved",
        review_requirement="standard_signoff",
        confidence_score=0.92,
        analysis_notes="Both before and after video streams clearly demonstrate identical Crompton ceiling fan fixture in Room 204. Pre-repair: stationary blades with energized switch circuit. Post-repair: continuous 320 RPM rotational motion detected with zero blade wobble. Operational criteria satisfied.",
        model_version="careops-vision-v2.4",
        analysis_timestamp=now - timedelta(minutes=14)
    )
    db.add(ai_t1)

    t1_note_pub = TicketNote(
        ticket_id=t1.id,
        author_id=staff_members[0].id,
        author_name=staff_members[0].name,
        content="Fan motor inspected. Capacitor replacement completed. Running operational test.",
        is_internal=False,
        created_at=now - timedelta(minutes=20)
    )
    t1_note_priv = TicketNote(
        ticket_id=t1.id,
        author_id=staff_members[0].id,
        author_name=staff_members[0].name,
        content="Internal: The old capacitor was bulged due to past grid surge. Replaced with genuine OEM stock from rack B4.",
        is_internal=True,
        created_at=now - timedelta(minutes=18)
    )
    db.add_all([t1_note_pub, t1_note_priv])

    # Ticket 2: Overdue Escalated Ticket (demonstrates SLA breach & alert)
    t2 = Ticket(
        ticket_number="TKT-MNT-1002",
        title="Bathroom Faucet Heavy Leakage - Room 205",
        description="Continuous high-pressure leak from hot water mixer tap creating slip hazard.",
        department_id="maintenance",
        room_id=rooms[1].id,
        room_number=rooms[1].room_number,
        category="Plumbing",
        priority="high",
        status="acknowledged",
        is_escalated=True,
        escalation_level=2,
        escalation_reason="Resolution SLA deadline breached. Immediate supervisor review required.",
        assigned_staff_id=staff_members[1].id if len(staff_members) > 1 else staff_members[0].id,
        assigned_supervisor_id=sup_mnt.id,
        sla_acknowledgement_deadline=now - timedelta(minutes=150),
        sla_resolution_deadline=now - timedelta(minutes=35),
        acknowledged_at=now - timedelta(minutes=140),
        delay_reason="Waiting for specialized ceramic cartridge shutoff valve from central store",
        revised_eta=now + timedelta(minutes=45),
        created_at=now - timedelta(minutes=180)
    )
    db.add(t2)
    db.flush()

    esc_t2 = EscalationLog(
        ticket_id=t2.id,
        escalation_level=2,
        trigger_reason="Resolution target time exceeded (120 mins). Ticket escalated to Operations Supervisor Vikramaditya Rao.",
        notified_supervisor_id=sup_mnt.id,
        delivery_status="delivered",
        created_at=now - timedelta(minutes=35)
    )
    db.add(esc_t2)

    # Ticket 3: Nursing STAT IV pump alert
    t3 = Ticket(
        ticket_number="TKT-NUR-1003",
        title="IV Infusion Pump Occlusion Alarm - ICU Bed 04",
        description="Infusion pump sounding downstream occlusion alarm. Patient experiencing mild discomfort.",
        department_id="nursing",
        room_id=rooms[3].id,
        room_number=rooms[3].room_number,
        category="Nurse Call",
        priority="critical",
        status="in_progress",
        is_escalated=False,
        assigned_staff_id=staff_members[2].id if len(staff_members) > 2 else staff_members[0].id,
        assigned_supervisor_id=sup_nur.id,
        sla_acknowledgement_deadline=now - timedelta(minutes=15),
        sla_resolution_deadline=now + timedelta(minutes=10),
        acknowledged_at=now - timedelta(minutes=18),
        in_progress_at=now - timedelta(minutes=12),
        created_at=now - timedelta(minutes=20)
    )
    db.add(t3)

    # Ticket 4: Housekeeping sanitization
    t4 = Ticket(
        ticket_number="TKT-HSK-1004",
        title="Post-Discharge Terminal Room Sanitization - Room 312",
        description="Patient discharged at 10:30 AM. Deep UV sanitization and linen reset required for next scheduled admission.",
        department_id="housekeeping",
        room_id=rooms[2].id,
        room_number=rooms[2].room_number,
        category="Housekeeping",
        priority="medium",
        status="assigned",
        is_escalated=False,
        assigned_staff_id=staff_members[4].id if len(staff_members) > 4 else staff_members[0].id,
        assigned_supervisor_id=sup_mnt.id,
        sla_acknowledgement_deadline=now + timedelta(minutes=25),
        sla_resolution_deadline=now + timedelta(minutes=85),
        created_at=now - timedelta(minutes=5)
    )
    db.add(t4)

    # Ticket 5: Closed Ticket with Full AI and Supervisor Verification
    t5 = Ticket(
        ticket_number="TKT-MNT-1000",
        title="Corridor Emergency Light Flickering - Floor 5",
        description="Ballast failure causing high frequency strobe in VIP Pavilion corridor.",
        department_id="maintenance",
        room_id=rooms[4].id,
        room_number=rooms[4].room_number,
        category="Lighting",
        priority="medium",
        status="closed",
        is_escalated=False,
        assigned_staff_id=staff_members[0].id,
        assigned_supervisor_id=sup_mnt.id,
        sla_acknowledgement_deadline=now - timedelta(hours=5),
        sla_resolution_deadline=now - timedelta(hours=2),
        acknowledged_at=now - timedelta(hours=4, minutes=50),
        in_progress_at=now - timedelta(hours=4, minutes=10),
        resolution_submitted_at=now - timedelta(hours=3),
        closed_at=now - timedelta(hours=2, minutes=40),
        resolution_summary="Installed new 18W Philips LED driver unit. Lux meter reading: 320 lux.",
        parts_replaced="18W Philips Constant Current Driver",
        functional_test_notes="Flicker index tested at 0.02 (standard < 0.05). Emergency battery backup verified.",
        created_at=now - timedelta(hours=5, minutes=10)
    )
    db.add(t5)
    db.flush()

    # Initial audit logs
    db.add_all([
        AuditLog(
            ticket_id=t1.id,
            action="TICKET_INITIAL_SUBMISSION",
            actor_name="Patient (Room 204)",
            actor_role="patient",
            details=json.dumps({"room": "Room 204", "category": "Ceiling Fan"}),
            created_at=now - timedelta(minutes=110)
        ),
        AuditLog(
            ticket_id=t1.id,
            action="RESOLUTION_SUBMITTED",
            actor_id=staff_members[0].id,
            actor_name=staff_members[0].name,
            actor_role="staff",
            details=json.dumps({"parts": "3.15uF Havells Motor Capacitor"}),
            created_at=now - timedelta(minutes=15)
        ),
        AuditLog(
            ticket_id=t2.id,
            action="SLA_RESOLUTION_BREACH",
            actor_name="SLA Monitor Engine",
            actor_role="system",
            details=json.dumps({"breach_level": 2, "overdue_minutes": 35}),
            created_at=now - timedelta(minutes=35)
        )
    ])

    db.commit()
    print("Demo tickets successfully seeded!")

if __name__ == "__main__":
    seed_database()
