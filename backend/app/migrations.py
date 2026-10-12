"""
Automated Migration & Enterprise Personnel Backfill Utility
Ensures SQLite / PostgreSQL tables have all required IAM & RBAC columns,
backfills existing seed users with valid Employee IDs, and seeds cross-department personnel.
"""

import logging
from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import User
from app.services.auth_service import get_password_hash

logger = logging.getLogger("careops.migrations")

def run_migrations():
    logger.info("Executing enterprise IAM database schema migrations...")
    
    with engine.connect() as conn:
        # Check existing columns in users table (portable across SQLite and PostgreSQL)
        try:
            from sqlalchemy import inspect
            inspector = inspect(conn)
            existing_cols = {col["name"] for col in inspector.get_columns("users")}
        except Exception as e:
            logger.warning(f"Could not inspect table info via inspector: {e}")
            existing_cols = set()

        is_postgres = engine.dialect.name == "postgresql"
        datetime_type = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"
        bool_type = "BOOLEAN DEFAULT FALSE" if is_postgres else "BOOLEAN DEFAULT 0"

        columns_to_ensure = [
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
            ("permissions_override", "TEXT")
        ]

        for col_name, col_def in columns_to_ensure:
            if col_name not in existing_cols:
                try:
                    conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                    logger.info(f"Added column users.{col_name}")
                except Exception as ex:
                    logger.warning(f"Column users.{col_name} might already exist: {ex}")

        conn.commit()

    # Backfill seed users with Employee IDs & Designations
    db = SessionLocal()
    try:
        pw_hash = get_password_hash("password123")
        
        # 1. Backfill existing core users
        backfill_map = {
            "admin@careops.hospital": {
                "emp_id": "EMP-ADM-0001",
                "designation": "Chief Medical Officer & Hospital Administrator",
                "role": "admin"
            },
            "supervisor.mnt@careops.hospital": {
                "emp_id": "EMP-MNT-0100",
                "designation": "Head of Biomedical & Facilities Engineering",
                "role": "supervisor"
            },
            "supervisor.nur@careops.hospital": {
                "emp_id": "EMP-NUR-0100",
                "designation": "Inpatient Nursing Superintendent",
                "role": "supervisor"
            },
            "technician.rajesh@careops.hospital": {
                "emp_id": "EMP-MNT-1001",
                "designation": "Senior Biomedical & Electrical Technician",
                "role": "staff"
            },
            "technician.kiran@careops.hospital": {
                "emp_id": "EMP-MNT-1002",
                "designation": "HVAC & Facility Maintenance Lead",
                "role": "staff"
            },
            "nurse.priya@careops.hospital": {
                "emp_id": "EMP-NUR-1001",
                "designation": "Critical Care & ICU Staff Nurse",
                "role": "nurse"
            },
            "nurse.arun@careops.hospital": {
                "emp_id": "EMP-NUR-1002",
                "designation": "Clinical Ward Care Nurse",
                "role": "nurse"
            },
            "hk.suresh@careops.hospital": {
                "emp_id": "EMP-HSK-1001",
                "designation": "Sanitation & Ward Hygiene Lead",
                "role": "housekeeping"
            }
        }

        for email, data in backfill_map.items():
            u = db.query(User).filter(User.email == email).first()
            if u:
                if not u.employee_id:
                    u.employee_id = data["emp_id"]
                if not u.designation:
                    u.designation = data["designation"]
                u.account_status = u.account_status or "active"
                u.failed_login_attempts = u.failed_login_attempts or 0

        # 2. Add extra roles: IT Admin, Doctor, Billing, Pharmacy, Auditor if missing
        extra_personnel = [
            {
                "email": "itadmin@careops.hospital",
                "name": "Amit Verma",
                "employee_id": "EMP-IT-0050",
                "designation": "IT Security & Identity Administrator",
                "role": "it_admin",
                "department_id": "maintenance",
                "phone": "+91 98765 44401",
                "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
            },
            {
                "email": "doctor.varma@careops.hospital",
                "name": "Dr. Rajesh Varma",
                "employee_id": "EMP-DOC-1020",
                "designation": "Attending Physician / Hospitalist",
                "role": "doctor",
                "department_id": "doctors",
                "phone": "+91 98765 44402",
                "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150"
            },
            {
                "email": "billing.mehra@careops.hospital",
                "name": "Sunita Mehra",
                "employee_id": "EMP-BIL-1005",
                "designation": "Patient Accounts & Billing Lead",
                "role": "billing",
                "department_id": "billing",
                "phone": "+91 98765 44403",
                "avatar_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150"
            },
            {
                "email": "pharmacy.joshi@careops.hospital",
                "name": "Devendra Joshi",
                "employee_id": "EMP-PHM-1010",
                "designation": "Inpatient Clinical Pharmacist",
                "role": "pharmacy",
                "department_id": "pharmacy",
                "phone": "+91 98765 44404",
                "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
            },
            {
                "email": "auditor.deshmukh@careops.hospital",
                "name": "Ananya Deshmukh",
                "employee_id": "EMP-AUD-0099",
                "designation": "Healthcare Quality & Compliance Auditor",
                "role": "auditor",
                "department_id": None,
                "phone": "+91 98765 44405",
                "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"
            },
            {
                "email": "superadmin@careops.hospital",
                "name": "System Superadmin",
                "employee_id": "EMP-ROOT-0001",
                "designation": "Root Platform & Security Super Administrator",
                "role": "superadmin",
                "department_id": None,
                "phone": "+91 98765 00000",
                "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
            }
        ]

        for p in extra_personnel:
            exists = db.query(User).filter(User.email == p["email"]).first()
            if not exists:
                new_u = User(
                    email=p["email"],
                    name=p["name"],
                    employee_id=p["employee_id"],
                    designation=p["designation"],
                    role=p["role"],
                    department_id=p["department_id"],
                    phone=p["phone"],
                    avatar_url=p["avatar_url"],
                    hashed_password=pw_hash,
                    is_active=True,
                    account_status="active",
                    failed_login_attempts=0
                )
                db.add(new_u)
                logger.info(f"Provisioned personnel: {p['name']} ({p['role']})")
            elif exists.role != p["role"] and p["role"] == "superadmin":
                exists.role = "superadmin"
                db.add(exists)

        db.commit()
        logger.info("Enterprise IAM backfill completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error during migration backfill: {e}")
    finally:
        db.close()
