"""
Automated Migration & Enterprise Personnel Backfill Utility
Ensures SQLite / PostgreSQL tables have all required IAM & RBAC columns,
ensures canonical departments exist, backfills existing seed users with valid Employee IDs,
and seeds cross-department personnel without foreign key violations.
"""

import logging
from sqlalchemy import text, inspect
from app.database import engine, Base, SessionLocal
from app.models import User, Department, Ticket
from app.services.auth_service import get_password_hash

logger = logging.getLogger("careops.migrations")

def run_migrations():
    logger.info("Executing enterprise IAM database schema migrations...")

    # Step 1: Ensure all base tables exist
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Base.metadata.create_all notice: {e}")

    is_postgres = engine.dialect.name == "postgresql"
    datetime_type = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"
    bool_type = "BOOLEAN DEFAULT FALSE" if is_postgres else "BOOLEAN DEFAULT 0"
    bool_true_type = "BOOLEAN DEFAULT TRUE" if is_postgres else "BOOLEAN DEFAULT 1"

    # Step 2: Ensure all required columns exist across tables
    table_columns = {
        "departments": [
            ("supervisor_id", "INTEGER"),
            ("is_active", bool_true_type),
        ],
        "users": [
            ("employee_id", "VARCHAR(50)"),
            ("designation", "VARCHAR(100)"),
            ("account_status", "VARCHAR(30) DEFAULT 'active'"),
            ("failed_login_attempts", "INTEGER DEFAULT 0"),
            ("locked_at", datetime_type),
            ("locked_reason", "VARCHAR(255)"),
            ("last_login_at", datetime_type),
            ("must_change_password", bool_type),
            ("password_reset_token", "VARCHAR(255)"),
            ("password_reset_expires_at", datetime_type),
            ("permissions_override", "TEXT"),
            ("supervisor_id", "INTEGER"),
            ("mobile_number", "VARCHAR(50)"),
            ("is_demo", bool_type),
        ],
        "tickets": [
            ("patient_tracking_token", "VARCHAR(100)"),
            ("assigned_at", datetime_type),
            ("en_route_at", datetime_type),
            ("work_started_at", datetime_type),
            ("work_completed_at", datetime_type),
            ("estimated_arrival_minutes", "INTEGER"),
            ("estimated_arrival_at", datetime_type),
            ("is_demo", bool_type),
        ],
        "rooms": [
            ("is_demo", bool_type),
        ],
        "evidences": [
            ("is_demo", bool_type),
        ],
        "ai_verifications": [
            ("is_demo", bool_type),
            ("provider_selected", "VARCHAR(50) DEFAULT 'mock'"),
            ("model_name_selected", "VARCHAR(100) DEFAULT 'careops-vision-default'"),
        ],
        "google_reviews": [
            ("is_demo", bool_type),
        ],
        "nps_responses": [
            ("source", "VARCHAR(100) DEFAULT 'Bedside QR Code'"),
            ("investigation_notes", "TEXT"),
            ("corrective_action", "TEXT"),
            ("resolution_status", "VARCHAR(50) DEFAULT 'unresolved'"),
            ("resolved_by", "VARCHAR(100)"),
            ("resolved_at", datetime_type),
        ]
    }

    if is_postgres:
        # In PostgreSQL, execute each ADD COLUMN IF NOT EXISTS in autocommit mode so failed commands do not abort transaction
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            for tbl, cols in table_columns.items():
                for col_name, col_def in cols:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS {col_name} {col_def}")
                    except Exception as ex:
                        logger.warning(f"PostgreSQL column migration notice {tbl}.{col_name}: {ex}")

            # Foreign key handling for audit_logs
            try:
                conn.exec_driver_sql("""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.table_constraints
                            WHERE constraint_name = 'audit_logs_ticket_id_fkey'
                        ) THEN
                            ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_ticket_id_fkey;
                            ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_ticket_id_fkey 
                                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
                        END IF;
                    END $$;
                """)
            except Exception as e:
                logger.warning(f"Could not update audit_logs constraint: {e}")
    else:
        # In SQLite, inspect columns and add missing ones
        with engine.connect() as conn:
            inspector = inspect(conn)
            for tbl, cols in table_columns.items():
                try:
                    existing_cols = {col["name"] for col in inspector.get_columns(tbl)}
                except Exception:
                    existing_cols = set()
                for col_name, col_def in cols:
                    if col_name not in existing_cols:
                        try:
                            conn.exec_driver_sql(f"ALTER TABLE {tbl} ADD COLUMN {col_name} {col_def}")
                        except Exception as ex:
                            logger.warning(f"SQLite column migration notice {tbl}.{col_name}: {ex}")
            conn.commit()

    # Step 3: Seed Canonical Departments FIRST so foreign keys work
    db = SessionLocal()
    try:
        canonical_depts = [
            {
                "id": "maintenance",
                "name": "Maintenance",
                "code": "MNT",
                "icon": "Wrench",
                "description": "Electrical and lighting, AC and climate control, plumbing and restroom, general facilities."
            },
            {
                "id": "housekeeping",
                "name": "Housekeeping",
                "code": "HSK",
                "icon": "Sparkles",
                "description": "Room turnover & cleaning, waste disposal, spill & sanitation, amenities restock."
            },
            {
                "id": "linen",
                "name": "Linen",
                "code": "LIN",
                "icon": "Shirt",
                "description": "Bed sheet exchange, pillow & blanket request, towel restock, patient gown replacement."
            },
            {
                "id": "medical",
                "name": "Medical",
                "code": "MED",
                "icon": "Stethoscope",
                "description": "Attending physician assistance, clinical inquiries, vitals check, and nurse calls."
            },
            {
                "id": "it",
                "name": "IT",
                "code": "IT",
                "icon": "Laptop",
                "description": "Bedside TVs and screens, patient Wi-Fi, room network and telephony equipment."
            }
        ]

        for cd in canonical_depts:
            dept_obj = db.query(Department).filter(Department.id == cd["id"]).first()
            if not dept_obj:
                dept_obj = Department(
                    id=cd["id"],
                    name=cd["name"],
                    code=cd["code"],
                    icon=cd["icon"],
                    description=cd["description"],
                    is_active=True
                )
                db.add(dept_obj)
            else:
                dept_obj.name = cd["name"]
                dept_obj.code = cd["code"]
                dept_obj.icon = cd["icon"]
                dept_obj.description = cd["description"]
                dept_obj.is_active = True
                db.add(dept_obj)

        db.commit()

        # Step 4: Migrate legacy departments on tickets and users to canonical departments
        dept_mappings = {
            "biomedical": "maintenance",
            "doctors": "medical",
            "nursing": "medical",
            "billing": "medical",
            "pharmacy": "medical"
        }

        for old_id, new_id in dept_mappings.items():
            db.query(Ticket).filter(Ticket.department_id == old_id).update({Ticket.department_id: new_id}, synchronize_session=False)
            db.query(User).filter(User.department_id == old_id).update({User.department_id: new_id}, synchronize_session=False)
            old_dept = db.query(Department).filter(Department.id == old_id).first()
            if old_dept:
                old_dept.is_active = False

        db.commit()

        # Step 5: Backfill / Ensure Core Personnel
        pw_hash = get_password_hash("password123")
        core_personnel = [
            {
                "email": "admin@careops.hospital",
                "name": "Dr. Alistair Vance",
                "emp_id": "EMP-ADM-0001",
                "designation": "Chief Medical Officer & Hospital Administrator",
                "role": "admin",
                "department_id": None,
                "phone": "+91 98765 43210"
            },
            {
                "email": "superadmin@careops.hospital",
                "name": "System Superadmin",
                "emp_id": "EMP-ROOT-0001",
                "designation": "Root Platform & Security Super Administrator",
                "role": "superadmin",
                "department_id": None,
                "phone": "+91 98765 00000"
            },
            {
                "email": "supervisor.mnt@careops.hospital",
                "name": "Vikramaditya Rao",
                "emp_id": "EMP-MNT-0100",
                "designation": "Head of Facilities & Maintenance Engineering",
                "role": "supervisor",
                "department_id": "maintenance",
                "phone": "+91 98765 11111"
            },
            {
                "email": "supervisor.nur@careops.hospital",
                "name": "Sister Mary Thomas",
                "emp_id": "EMP-NUR-0100",
                "designation": "Inpatient Nursing Superintendent",
                "role": "supervisor",
                "department_id": "medical",
                "phone": "+91 98765 22222"
            },
            {
                "email": "technician.rajesh@careops.hospital",
                "name": "Rajesh Sharma",
                "emp_id": "EMP-MNT-1001",
                "designation": "Senior Facilities & Electrical Technician",
                "role": "staff",
                "department_id": "maintenance",
                "phone": "+91 98765 33333"
            },
            {
                "email": "technician.kiran@careops.hospital",
                "name": "Kiran Patel",
                "emp_id": "EMP-MNT-1002",
                "designation": "HVAC & Climate Control Specialist",
                "role": "staff",
                "department_id": "maintenance",
                "phone": "+91 98765 33334"
            },
            {
                "email": "nurse.priya@careops.hospital",
                "name": "Priya Nair",
                "emp_id": "EMP-NUR-1001",
                "designation": "Critical Care & Medical Staff Nurse",
                "role": "staff",
                "department_id": "medical",
                "phone": "+91 98765 33335"
            },
            {
                "email": "nurse.arun@careops.hospital",
                "name": "Arun Kumar",
                "emp_id": "EMP-NUR-1002",
                "designation": "Clinical Ward Care Nurse",
                "role": "staff",
                "department_id": "medical",
                "phone": "+91 98765 33336"
            },
            {
                "email": "hk.suresh@careops.hospital",
                "name": "Suresh Yadav",
                "emp_id": "EMP-HSK-1001",
                "designation": "Sanitation & Ward Hygiene Lead",
                "role": "staff",
                "department_id": "housekeeping",
                "phone": "+91 98765 33337"
            },
            {
                "email": "itadmin@careops.hospital",
                "name": "Amit Verma",
                "emp_id": "EMP-IT-0050",
                "designation": "IT Systems & Room Connectivity Lead",
                "role": "staff",
                "department_id": "it",
                "phone": "+91 98765 44401"
            }
        ]

        for p in core_personnel:
            u = db.query(User).filter(User.email == p["email"]).first()
            if not u:
                u = User(
                    email=p["email"],
                    name=p["name"],
                    employee_id=p["emp_id"],
                    designation=p["designation"],
                    role=p["role"],
                    department_id=p["department_id"],
                    phone=p["phone"],
                    hashed_password=pw_hash,
                    is_active=True,
                    account_status="active",
                    failed_login_attempts=0
                )
                db.add(u)
                logger.info(f"Created personnel: {p['name']} ({p['email']})")
            else:
                if not u.employee_id:
                    u.employee_id = p["emp_id"]
                if not u.designation:
                    u.designation = p["designation"]
                if p["department_id"] and not u.department_id:
                    u.department_id = p["department_id"]
                if not u.phone:
                    u.phone = p["phone"]
                u.is_active = True
                u.account_status = "active"
                u.failed_login_attempts = 0
                u.hashed_password = pw_hash

        db.commit()

        # Step 6: Assign department supervisors to staff
        maintenance_sup = db.query(User).filter(User.department_id == "maintenance", User.role == "supervisor").first()
        if maintenance_sup:
            db.query(User).filter(
                User.department_id == "maintenance",
                User.role == "staff",
                User.supervisor_id == None
            ).update({User.supervisor_id: maintenance_sup.id}, synchronize_session=False)

        medical_sup = db.query(User).filter(User.department_id == "medical", User.role == "supervisor").first()
        if medical_sup:
            db.query(User).filter(
                User.department_id == "medical",
                User.role.in_(["staff", "nurse", "doctor"]),
                User.supervisor_id == None
            ).update({User.supervisor_id: medical_sup.id}, synchronize_session=False)

        db.commit()
        logger.info("Enterprise IAM and Department standardization completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error during migration backfill: {e}", exc_info=True)
    finally:
        db.close()
