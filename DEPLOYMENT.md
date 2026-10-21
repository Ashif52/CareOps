# CareOps AI — Hospital LAN & Production Deployment Manual

## System Architecture & Exact Three Portals

CareOps AI is engineered strictly around **three authoritative portals**:
1. **Admin Portal**: Executive Command Center — Staff and Patient account lifecycle, department provisioning, SLA policies, real SMTP delivery tracking, and immutable audit logs.
2. **Staff Portal**: Unified workspace for all hospital departments (Maintenance, Doctors, Nursing, Housekeeping, Billing, Pharmacy) with department-scoped ticket queues and live status workflows.
3. **Patient Portal**: Mobile-responsive bedside experience with verified tracking, service requests, public status notes (zero internal note leakage), and contact updates.

---

## 1. Hospital Local Area Network (LAN) Deployment

In a hospital LAN deployment, the frontend and backend run on a designated server computer (or dedicated VM), accessible to all client PCs (nursing stations, doctor workstations, admin terminals, and patient mobile devices connected to hospital Wi-Fi).

### Network Topology Example
- **Server Internal IP**: `192.168.1.50` (Assigned static IP or DHCP reservation)
- **Frontend URL (LAN Clients)**: `http://192.168.1.50:3000`
- **Backend API URL**: `http://192.168.1.50:8000/api`
- **Health Check**: `http://192.168.1.50:8000/health`

---

### Step 1: Detect Server Local IP Address

#### On Windows Server:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object IPAddress, InterfaceAlias
```

#### On Linux (Ubuntu / Debian):
```bash
ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1'
```
*Note down the active hospital subnet IP (e.g. `192.168.1.50`).*

---

### Step 2: Configure Server Network Interfaces (0.0.0.0 Binding)

#### Backend (FastAPI + Uvicorn)
Do NOT bind to `127.0.0.1` or `localhost`. Bind to `0.0.0.0` so all LAN adapters accept connections:
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### Frontend (Next.js)
Bind to `0.0.0.0` to listen on all interfaces:
```bash
cd frontend
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

---

### Step 3: Configure Operating System Firewall

#### Windows Server (PowerShell as Administrator):
```powershell
# Allow inbound CareOps Frontend (Port 3000) from Hospital Subnet
New-NetFirewallRule -DisplayName "CareOps Hospital Frontend (Port 3000)" `
    -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow `
    -RemoteAddress 192.168.1.0/24

# Allow inbound CareOps Backend API (Port 8000) from Hospital Subnet
New-NetFirewallRule -DisplayName "CareOps Hospital Backend (Port 8000)" `
    -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow `
    -RemoteAddress 192.168.1.0/24
```

#### Linux Server (UFW):
```bash
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp comment "CareOps Frontend"
sudo ufw allow from 192.168.1.0/24 to any port 8000 proto tcp comment "CareOps Backend"
sudo ufw reload
```

---

### Step 4: Environment Variables Setup

#### Backend Environment (`backend/.env`):
```ini
ENVIRONMENT=production
DEBUG_MODE=false

# Centralized PostgreSQL Database
DATABASE_URL=postgresql://careops_user:STRONG_SECURE_PASSWORD@localhost:5432/careops_db

# Centralized JWT Identity Security (Generate with: python -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY=9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b
ACCESS_TOKEN_EXPIRE_MINUTES=60

# LAN CORS Configuration — Include server IP and hospital domains
ALLOWED_ORIGINS=http://192.168.1.50:3000,http://localhost:3000
FRONTEND_URL=http://192.168.1.50:3000

# Hospital SMTP Mail Gateway
SMTP_HOST=mail.hospital.org
SMTP_PORT=465
SMTP_USER=alerts@careops.hospital
SMTP_PASSWORD=REPLACE_WITH_REAL_CREDENTIALS
SMTP_FROM=CareOps Dispatch <alerts@careops.hospital>
SMTP_USE_SSL=true

# Private uploads
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE_BYTES=52428800
```

#### Frontend Environment (`frontend/.env.local`):
```ini
NEXT_PUBLIC_API_URL=http://192.168.1.50:8000/api
NEXT_PUBLIC_BACKEND_URL=http://192.168.1.50:8000
```

---

## 2. Secure First-Admin Bootstrap Procedure

When initializing a new hospital deployment, a dedicated administrator account must be provisioned without exposing plaintext credentials in source control.

1. Ensure `backend/.env` is configured.
2. Run the secure database migration and initialization command:
```bash
cd backend
python -c "
from app.database import SessionLocal, Base, engine
from app.models import User
from app.services.auth_service import get_password_hash
import os

Base.metadata.create_all(bind=engine)
db = SessionLocal()

admin_email = os.getenv('INITIAL_ADMIN_EMAIL', 'admin@careops.hospital')
admin_pass = os.getenv('INITIAL_ADMIN_PASSWORD', 'SecureInitialAdminPass2026!')

existing = db.query(User).filter(User.email == admin_email).first()
if not existing:
    admin = User(
        name='Hospital Super Administrator',
        email=admin_email,
        employee_id='ADM-001',
        hashed_password=get_password_hash(admin_pass),
        role='admin',
        designation='Chief Information Officer',
        account_status='active',
        is_active=True,
        must_change_password=True,
        failed_login_attempts=0
    )
    db.add(admin)
    db.commit()
    print(f'Administrator created: {admin_email}')
else:
    print(f'Administrator {admin_email} already exists.')
db.close()
"
```
3. On first login, the admin is required to change their password via the Portal dropdown or `ChangePasswordModal`.

---

## 3. Real SMTP Email System Configuration

CareOps AI features true asynchronous background SMTP delivery with retry tracking and audit logging.

### Supported Mail Protocols
- **SMTPS (Port 465, SSL/TLS)**: Recommended for enterprise mail servers and Google Workspace / Microsoft 365.
- **STARTTLS (Port 587)**: Supported by setting `SMTP_PORT=587` and `SMTP_USE_SSL=false`.

### Testing SMTP Connectivity
1. Log into the **Admin Portal** as Administrator.
2. Navigate to the **Email & SMTP Delivery** tab in the sidebar.
3. In the **Test SMTP Delivery** widget, enter an authorized recipient email address.
4. Click **Send Test Message**.
5. The system performs an end-to-end SMTP handshake, sends a test payload, and creates a verified `EmailLog` record displaying the delivery timestamp or detailed provider handshake error.

---

## 4. PostgreSQL Database Backup & Restoration

### Daily Backup Script (Automated Cron / Windows Task):
```bash
# Set password variable for non-interactive backup
export PGPASSWORD="STRONG_SECURE_PASSWORD"

# Timestamped dump
BACKUP_DIR="/var/backups/careops"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

pg_dump -h localhost -U careops_user -F c -b -v -f "$BACKUP_DIR/careops_$TIMESTAMP.dump" careops_db

# Retention: Delete backups older than 30 days
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +30 -exec rm {} +
```

### Restoration Procedure:
```bash
# Stop application services first
sudo systemctl stop careops-backend

# Restore database from backup archive
export PGPASSWORD="STRONG_SECURE_PASSWORD"
pg_restore -h localhost -U careops_user -d careops_db -v -c "/var/backups/careops/careops_20261020_000000.dump"

# Restart application services
sudo systemctl start careops-backend
```

---

## 5. Server Reboot Resilience (systemd Service)

To ensure CareOps restarts automatically when the hospital server boots or recovers from power maintenance:

### `/etc/systemd/system/careops-backend.service`:
```ini
[Unit]
Description=CareOps AI Hospital Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=careops
WorkingDirectory=/opt/careops-ai/backend
EnvironmentFile=/opt/careops-ai/backend/.env
ExecStart=/opt/careops-ai/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable careops-backend
sudo systemctl start careops-backend
```

---

## 6. How Staff & Patients Access the System

### A. Staff Workstation Access:
1. Open any modern web browser (Edge, Chrome, Safari, Firefox).
2. Enter the hospital server URL: `http://192.168.1.50:3000` (or intranet DNS `http://careops.hospital.lan`).
3. Select **Portal B: Staff Login**.
4. Enter assigned Staff ID (`EMP-XXXXX`) or registered hospital email and password.
5. The workspace opens filtered to the staff member's assigned clinical or operational department.

### B. Patient Bedside Access:
1. Patient or nurse scans the Bedside QR Placard using any smartphone camera.
2. The browser automatically navigates to `http://192.168.1.50:3000/patient/qr/{token}`.
3. Or the patient navigates to `http://192.168.1.50:3000` and selects **Portal C: Patient Login / Registration**.
4. Patient submits service requests and tracks live status updates without seeing internal notes.

---

## 7. Production Troubleshooting Guide

### 1. Login Failures ("Invalid Credentials" or "Account is Locked")
- **Root Cause**: Account exceeded 3 consecutive bad passwords (HTTP 423 Locked) or inactive account status.
- **Resolution**:
  1. Have an Administrator log into the Admin Portal.
  2. Open **Staff Access** or **Patient Accounts**.
  3. Click **Reset Lockout / Password** on the user record.
  4. The lockout counter and `locked_at` timestamp are cleared immediately.

### 2. Email Delivery Failures ("No SMTP_HOST configured" or "Connection Refused")
- **Root Cause**: SMTP credentials missing from `.env` or port 465 blocked by hospital network egress firewall.
- **Resolution**:
  1. Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` in `backend/.env`.
  2. Verify network egress: `nc -zv mail.hospital.org 465` (or `Test-NetConnection -ComputerName mail.hospital.org -Port 465`).
  3. Open Admin Portal → **Email & SMTP Delivery** → click **Retry Failed Emails** to re-queue unsent messages.

### 3. Database Connection Errors ("could not connect to server: Connection refused")
- **Root Cause**: PostgreSQL service stopped or invalid credentials in `DATABASE_URL`.
- **Resolution**:
  1. Check PostgreSQL service status: `sudo systemctl status postgresql`.
  2. Verify credentials using `psql`: `psql -h localhost -U careops_user -d careops_db`.
  3. In development/fallback mode, CareOps uses embedded SQLite (`sqlite:///./careops.db`) which requires zero service dependencies.

### 4. LAN Connectivity ("ERR_CONNECTION_REFUSED" on client PC)
- **Root Cause**: Backend or Frontend bound to `127.0.0.1` instead of `0.0.0.0`, or server firewall blocking inbound ports.
- **Resolution**:
  1. Confirm server listening address: `netstat -ano | findstr 8000` (must show `0.0.0.0:8000`, NOT `127.0.0.1:8000`).
  2. Check Windows Defender Firewall / UFW rule for inbound ports 3000 and 8000.
  3. Ping server from client: `ping 192.168.1.50`.
