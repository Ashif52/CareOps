# Hospital Management System — Complete Admin, Staff and Patient User Guide
**Comprehensive Operational Manual & Technical Administration Reference**  
*CareOps AI Healthcare Management Platform*  
*Target Environment: Hospital Local Area Network (LAN IP: 192.168.31.219)*

---

## Table of Contents
1. [Chapter 1 — Understanding the Application Architecture](#chapter-1--understanding-the-application-architecture)
2. [Chapter 2 — Starting and Initializing the Application](#chapter-2--starting-and-initializing-the-application)
3. [Chapter 3 — First Administrator Login & Setup](#chapter-3--first-administrator-login--setup)
4. [Chapter 4 — Adding and Managing Hospital Departments](#chapter-4--adding-and-managing-hospital-departments)
5. [Chapter 5 — Staff Account Provisioning & Access Control](#chapter-5--staff-account-provisioning--access-control)
6. [Chapter 6 — Staff Email Assignment & Notification Routing](#chapter-6--staff-email-assignment--notification-routing)
7. [Chapter 7 — Patient Portal: Registration, Submissions & Tracking](#chapter-7--patient-portal-registration-submissions--tracking)
8. [Chapter 8 — Staff Portal: Task Queue, Status Workflow & Notes](#chapter-8--staff-portal-task-queue-status-workflow--notes)
9. [Chapter 9 — Email Configuration & SMTP Troubleshooting](#chapter-9--email-configuration--smtp-troubleshooting)
10. [Chapter 10 — Hospital Local Area Network (LAN) Deployment](#chapter-10--hospital-local-area-network-lan-deployment)
11. [Chapter 11 — Security Best Practices & Daily Administration](#chapter-11--security-best-practices--daily-administration)
12. [Chapter 12 — Diagnostic Matrix & Troubleshooting Table](#chapter-12--diagnostic-matrix--troubleshooting-table)
13. [Chapter 13 — Daily, Weekly, and Monthly Operational Checklists](#chapter-13--daily-weekly-and-monthly-operational-checklists)

---

# Chapter 1 — Understanding the Application Architecture

### 1.1 The Exactly Three Portals Rule
CareOps AI is architected with strictly **three distinct entry portals**:

| Portal Name | Target Audience | Primary Functionality |
| :--- | :--- | :--- |
| **Admin Portal** | System Administrators, Medical Directors, Facility Ops Leads | System configuration, department lifecycle, staff provisioning, SMTP delivery monitoring, security audit logs, SLA policies. |
| **Staff Portal** | All hospital personnel (Nurses, Physicians, Technicians, Housekeeping, Billing, Pharmacy, IT) | Single unified workspace where staff view tickets assigned to their department or them personally, update resolution progress, and add internal notes. |
| **Patient Portal** | Inpatients, Outpatients, Family Members | Simple mobile-friendly portal accessed via bedside QR code or patient login to lodge service requests, track care team ETA, and review resolution. |

> **Architectural Boundary:** There are no separate portals for individual departments. Doctors, nurses, engineers, and billing staff all log in through the **same Staff Portal**. Access is governed dynamically on the server by the user's assigned department and role permissions.

### 1.2 Key Identity Definitions
To avoid administrative confusion, understand how identity fields work together:

- **Login Identifier:** The unique string used to sign in. In CareOps AI, users may authenticate using either their official **Work Email** (e.g. `technician.rajesh@careops.hospital`), their **Hospital Employee ID** (e.g. `EMP-MNT-1001`), or their **Patient ID** (`PAT-82910`).
- **Assigned Email Address:** The mailbox centrally stored in the database where notification dispatches, ticket assignment alerts, password resets, and audit notices are delivered.
- **Department:** The clinical or facility unit (e.g., `Maintenance`, `Medical`, `Housekeeping`, `Diagnostic Pathology Lab`) that defines ticket routing queues.
- **Role:** The authorization level (`superadmin`, `admin`, `supervisor`, `staff`, `patient`) enforced on the backend by Role-Based Access Control (RBAC).

### 1.3 Application Account vs. Email Mailbox
> **Critical Concept:** Creating an account or entering an email address in CareOps AI **does not create an inbox on your mail server**.
- **Mode 1 (Assign Existing Mailbox):** The administrator enters an email address that the hospital employee already owns (e.g., on Microsoft 365, Google Workspace, or hospital exchange). CareOps AI validates and routes emails to it.
- **Mode 2 (Provision Organizational Mailbox):** If the hospital assigns a brand new address (e.g., `nurse.priya@cityhospital.org`), the hospital IT administrator must first create that account inside the Google Workspace or Microsoft 365 Admin Console. CareOps AI delivers messages to it through the configured SMTP gateway.

### 1.4 How Components Communicate
```
+-----------------------------------------------------------------------------------+
|                            HOSPITAL LOCAL AREA NETWORK                            |
|                                                                                   |
|  [ Client PC 1 (Admin) ]   [ Client PC 2 (Staff) ]   [ Mobile / Bedside Tablet ]  |
|          |                           |                             |              |
|          +---------------------------+-----------------------------+              |
|                                      |                                            |
|                                      v  HTTP (Port 3000)                          |
|                       +-------------------------------+                           |
|                       |  Next.js Frontend Web Server  |                           |
|                       |  Reverse Proxy (/api -> 8000) |                           |
|                       +-------------------------------+                           |
|                                      |                                            |
|                                      v  Internal Loopback / API                   |
|                       +-------------------------------+                           |
|                       |    FastAPI Backend Server     |                           |
|                       |   (Port 8000 / Auth Engine)   |                           |
|                       +-------------------------------+                           |
|                                |             |                                    |
|               SQL Queries & ORM|             | SMTP Transport (STARTTLS)          |
|                                v             v                                    |
|                     +-----------------+   +---------------------+                 |
|                     | SQLite / Postgres|  | Hospital SMTP Server|                 |
|                     | Database Engine |   | (Gmail / O365 / LAN)|                 |
|                     +-----------------+   +---------------------+                 |
+-----------------------------------------------------------------------------------+
```

---

# Chapter 2 — Starting and Initializing the Application

### 2.1 Software Prerequisites
Verify the host computer has the following software installed:
1. **Python 3.11+** (Python 3.12 or 3.14 recommended)
2. **Node.js 18+** or **Node.js 20 LTS**
3. **Git** for version control

### 2.2 Project Directory
Open PowerShell or Terminal and navigate to the project directory:
```powershell
cd C:\Users\Administrator\.gemini\antigravity-ide\scratch\careops-ai
```

### 2.3 Environment Configuration (`.env`)
The backend reads its configuration from `backend/.env`. A template is provided at `backend/.env.example`.
Create or inspect `backend/.env`:
```ini
# Application Environment
ENVIRONMENT=production
SECRET_KEY=careops-enterprise-super-secure-jwt-key-2026-production-grade
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Database Connection
DATABASE_URL=sqlite:///./careops.db

# Host IP and Port Binding
HOST=0.0.0.0
PORT=8000

# Hospital SMTP Delivery Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=hospital.notifications@gmail.com
SMTP_PASSWORD=your-secure-app-password
SMTP_FROM_EMAIL=hospital.notifications@gmail.com
SMTP_FROM_NAME=CareOps Hospital Notifications
SMTP_TLS=True

# Hospital Local Area Network Origins
FRONTEND_URL=http://192.168.31.219:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.31.219:3000
```

### 2.4 Database Migrations & Initial Seeding
Before launching the server for the first time, initialize the database tables and apply schema migrations:
```powershell
cd backend
python -c "from app.database import Base, engine; from app.seed import seed_database; Base.metadata.create_all(bind=engine); seed_database()"
```
This command automatically:
- Creates all relational tables (`users`, `departments`, `tickets`, `evidence`, `rooms`, `audit_logs`, `email_logs`).
- Verifies that zero profile pictures/avatar URLs are stored.
- Seeds the 10 core clinical and service departments (`Maintenance`, `Housekeeping`, `Linen`, `Medical`, `IT`, `Diagnostic Pathology Lab`, `Doctors`, `Nursing`, `Billing`, `Pharmacy`).

### 2.5 Starting the Backend Server
Launch the FastAPI backend bound to `0.0.0.0` (all network interfaces) so it is accessible from the LAN:
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
**Expected terminal output:**
```
INFO:     Started server process [2492]
INFO:     Waiting for application startup.
INFO:careops.migrations:Executing enterprise IAM database schema migrations...
INFO:careops.main:Database migrations executed successfully.
INFO:careops.main:CareOps Persistent SLA Engine initialized.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 2.6 Starting the Frontend Server
Open a second PowerShell window and launch the Next.js frontend dev server, also bound to `0.0.0.0`:
```powershell
cd frontend
npm run dev -- -H 0.0.0.0 -p 3000
```
**Expected terminal output:**
```
▲ Next.js 16.4.0 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://0.0.0.0:3000
✓ Ready in 661ms
```

### 2.7 Verifying System Health
Open your browser or run this command to verify both servers are healthy:
```powershell
curl http://127.0.0.1:8000/api/health
```
**Expected JSON response:**
```json
{
  "status": "healthy",
  "service": "CareOps AI Backend",
  "version": "1.0.0"
}
```

---

# Chapter 3 — First Administrator Login & Setup

### 3.1 Accessing the Admin Portal
1. Open your browser on the host computer or any authorized computer on the hospital network.
2. Navigate to: `http://localhost:3000` or `http://192.168.31.219:3000`.
3. In the top navigation bar or portal switch, click **Admin Login**.

### 3.2 Default Bootstrapped Credentials
The system comes provisioned with initial administrative accounts for first-time setup:

| Account Type | Login Identifier (Email or ID) | Default Initial Password |
| :--- | :--- | :--- |
| **System Superadmin** | `superadmin@careops.hospital` | `password123` |
| **Hospital Administrator** | `admin@careops.hospital` | `password123` |

### 3.3 Changing Your Initial Password
1. Once logged in, open the **Settings & System** or click on your initials badge in the bottom-left sidebar.
2. Under **Account Security**, click **Change Password**.
3. Enter `password123` as the current password, followed by your new, strong password (minimum 8 characters, containing uppercase, lowercase, numbers, and symbols).
4. Click **Update Password**. Your previous password is immediately invalidated.

### 3.4 Understanding the Administrator Dashboard
Upon login, the Admin Overview displays live operational telemetry:
- **Total Hospital Staff:** Total configured personnel eligible to authenticate.
- **Active Service Departments:** Total functional clinical and facility units.
- **Active Tickets & Escalations:** Real-time counter of open, acknowledged, and overdue tickets.
- **Email & SMTP Delivery Health:** Operational badge indicating whether notification emails are accepted by the outbound mail provider.

---

# Chapter 4 — Adding and Managing Hospital Departments

Only users with the `admin` or `superadmin` role have permission to manage departments.

### 4.1 Viewing Department Roster
1. In the Admin sidebar, click **Departments & Staff** (or navigate to tab `departments`).
2. Click the tab titled **Hospital Service Departments (10)**.
3. The grid displays all configured departments with their active tickets count and assigned staff count.

### 4.2 Adding a New Department
1. In the top right of the Departments screen, click the teal button: **+ Add Department**.
2. Complete the Department Registration modal:
   - **Department Name:** e.g. `Cardiology Care Unit`
   - **Department Code:** e.g. `CARD` (short 2-6 character code)
   - **System Identifier ID:** e.g. `cardiology` (lowercase unique routing slug)
   - **Description & Scope:** Explaining the department's responsibilities.
   - **Department Icon:** Select an appropriate icon (`HeartPulse`, `Stethoscope`, `Wrench`, `Sparkles`, `Pill`, `Receipt`, `Building2`, `Shield`).
3. Click **Create Department**.
4. The new department is immediately active and available for ticket routing and staff assignment.

### 4.3 Editing a Department
1. Locate the department card on the grid.
2. Click the **Edit** button (pencil icon) in the bottom action bar.
3. Update the Department Name, Code, Description, or Icon.
4. Click **Save Department Changes**.

### 4.4 Activating or Deactivating a Department
If a department is temporarily not accepting tickets (e.g., renovations):
1. Locate the department card.
2. Click the **Deactivate** button.
3. The department's badge changes to `INACTIVE`. Deactivated departments do not appear in the patient complaint submission dropdown.
4. To view and reactivate inactive departments, check the box **Show Inactive Departments**, locate the card, and click **Activate**.

### 4.5 Safe Department Removal (Dependency Guard)
CareOps AI enforces strict **safe deletion rules**:
- **Rule 1:** Deleting a department will **never** delete historical patient complaints, audit records, or past resolution evidence.
- **Rule 2:** If a department still contains active staff members or unresolved tickets, deletion is **strictly blocked** until dependencies are reassigned.

**Step-by-Step Safe Deletion Procedure:**
1. Locate the department card and click the red **Remove** button (trash icon).
2. The **Safe Department Removal Modal** opens and automatically inspects system dependencies.
3. **If Dependencies Exist:**
   - The modal alerts: *"Department Has Active Operational Dependencies"* and lists the exact count of active staff and open tickets.
   - Select a destination department from the dropdown: **Reassign Staff & Tickets To:** (e.g. `Medical` or `Maintenance`).
   - Click **Reassign Dependencies & Remove**. The system automatically transitions all staff members and active tickets to the new department and then safely removes the source department.
4. **If No Active Dependencies Exist:**
   - The modal shows: *"Safe to Remove"*.
   - If historical resolved tickets exist, it confirms: *"Historical Integrity: X resolved tickets & audit logs are safely preserved in the database archive."*
   - Click **Confirm Safe Removal**.

---

# Chapter 5 — Staff Account Provisioning & Access Control

Administrators create and manage staff accounts directly through the UI without manual database edits.

### 5.1 Adding a New Staff Member
1. Open **Departments & Staff** and select the **Staff Directory & Access Roster** tab.
2. Click **+ Create Staff** in the top action bar.
3. Enter the employee's details:
   - **Full Name:** e.g. `Dr. Vikramaditya Sen`
   - **Employee ID:** e.g. `EMP-DOC-1050` (or click *Auto-Suggest ID*)
   - **Official Work Email:** e.g. `vikram.sen@careops.hospital`
   - **Contact Phone:** Mobile phone number (mandatory for supervisors).
   - **Department:** Select from active hospital departments (e.g., `Doctors` or `Medical`).
   - **Designation / Role Title:** e.g. `Senior Attending Cardiologist`
   - **Primary Access Role:** Select from `staff`, `supervisor`, `admin`, `superadmin`.
   - **Initial Provisioning Password:** e.g. `TempPass2026!`
   - **Force Password Change on First Login:** Checked by default.
   - **Dispatch Account Invitation Email:** Checked by default (sends welcome email with credentials to their work email).
4. Click **Create Hospital Account**.

### 5.2 Editing Staff Personal & Department Info
1. Click on the staff member's row in the directory table to open the **Staff Detail Drawer**.
2. Under the **Overview** tab, click **Edit Details**.
3. You can update their Full Name, Official Work Email, Contact Phone, Assigned Department, and Designation.
4. Click **Save Details**. If the email was changed, security notifications are automatically dispatched to both the old and new email addresses.

### 5.3 Resetting a Staff Password
1. Open the staff member's drawer and click the **Security & Auth** tab.
2. Click **Reset Password**.
3. Choose to either auto-generate a secure random temporary password or enter a specific one.
4. Choose whether to dispatch reset instructions to their registered email.
5. Click **Confirm Reset**. The user's active session is terminated, requiring authentication with the new credential.

### 5.4 Inactivating or Unlocking an Account
- **Inactivating an Employee (on leave or departed):** Click **Inactivate** on their table row or detail drawer. Enter a reason (e.g. *"Medical leave"*). The account is blocked from authenticating immediately.
- **Reactivating an Employee:** Click **Activate**. The account is restored to good standing.
- **Unlocking a Locked Account:** If an employee enters the wrong password 3 consecutive times, CareOps AI locks the account to prevent brute-force attacks. Click **Unlock** on their row to reset failed attempts and re-enable access.

---

# Chapter 6 — Staff Email Assignment & Notification Routing

### 6.1 Purpose of Staff Email Assignment
Every staff account requires a registered work email stored centrally in the database. This email is used for:
- Automatic ticket dispatch when new complaints are submitted for their department.
- Escalation warnings when a high-priority ticket approaches SLA breach.
- Account invitation and password recovery instructions.

### 6.2 Operating Modes for Email Assignment
Administrators must understand the difference between the two operating modes:

```
+-----------------------------------------------------------------------------------+
| MODE 1: ASSIGN AN EXISTING MAILBOX                                               |
| • Used when the staff member already has an active, working email address.        |
| • Admin simply enters the address into CareOps AI.                                |
| • System verifies format, binds it to the account, and routes notifications to it.|
+-----------------------------------------------------------------------------------+
| MODE 2: PROVISION A NEW ORGANIZATIONAL MAILBOX                                   |
| • Used when assigning a new address under the hospital domain (@hospital.org).   |
| • STEP 1: IT Admin creates the mailbox in Google Workspace or Microsoft 365 Admin.|
| • STEP 2: IT Admin assigns the address inside CareOps AI.                         |
| • NOTE: Entering an address in CareOps AI does NOT create the mailbox on Google/O365|
+-----------------------------------------------------------------------------------+
```

### 6.3 Sending a Test Email
To verify your hospital's SMTP email delivery is operational:
1. In the Admin sidebar, click **Email & SMTP Delivery**.
2. In the top action bar, click **Test SMTPS Connection**.
3. Enter a recipient email address (e.g. your personal work email).
4. Click **Send Test Email**.
5. Check the delivery log table below. The status will display `sent` (with provider response code `250 OK`) or `failed` with diagnostic error details.

---

# Chapter 7 — Patient Portal: Registration, Submissions & Tracking

The Patient Portal is designed for mobile phones and bedside touchscreens. It requires zero technical training.

### 7.1 Accessing the Patient Portal
Patients access their portal in two ways:
1. **Bedside QR Code:** By scanning the QR code mounted on their hospital room wall or bed rail. The QR code contains a secure location token (e.g. `http://192.168.31.219:3000/patient/qr/CARE-RM204-7X9Q`) that automatically identifies their Room, Bed, Floor, and Wing.
2. **Direct Web Access:** Opening `http://192.168.31.219:3000/track` or clicking **Patient Login** on the home page.

### 7.2 Patient Submission Workflow
When submitting a complaint or service request:
1. **Select Request Category:** The patient taps an intuitive category card (e.g. *Plumbing & Restroom*, *Air Conditioning & Temperature*, *Room Sanitation*, *Linen Replacement*, *Medical Assistance*).
2. **Enter Details:**
   - **Issue Summary:** e.g. *"AC making loud rattling noise and room is too warm"*.
   - **Specific Location:** Automatically populated from Room QR or entered manually.
   - **Optional Voice Note:** Patient can record a voice message explaining the problem hands-free.
   - **Optional Photo Attachment:** Patient can upload a photo of the issue (e.g., water leak).
   - **Mobile Phone Number & Email:** For receiving live WhatsApp/SMS and email status updates.
3. **Click "Submit Complaint Now":**
   - The submission is validated on both client and server.
   - A unique tracking number is generated (e.g., `TKT-MNT-0008`).
   - The patient sees an immediate confirmation screen with their tracking reference.
   - An email confirmation is dispatched to the patient with a direct tracking link.

### 7.3 Live Status Tracking
Patients can track their request live without refreshing the page:
- **Status Stages:**
  1. *Request Received & Logged*
  2. *Assigned to Care Specialist*
  3. *Care Team En Route*
  4. *Work in Progress*
  5. *Resolution Completed & Verified*
- **Patient Privacy Assurance:** Public tracking views never disclose internal staff personal details, private notes, or medical history.

---

# Chapter 8 — Staff Portal: Task Queue, Status Workflow & Notes

All hospital employees sign in through the single **Staff Login** page using their Employee ID or Email.

### 8.1 Staff Login & Workspace
1. Navigate to: `http://192.168.31.219:3000`.
2. Click **Staff Login**.
3. Enter your **Employee ID** (e.g. `EMP-MNT-1001`) or **Work Email** and password.
4. Click **Sign In to Staff Workspace**.

### 8.2 Ticket Queue & Department Filtering
- The staff workspace displays tickets assigned specifically to your department.
- **Queue Filters:**
  - *All Tickets*
  - *My Assigned Work*
  - *Status:* `Pending Assignment`, `Assigned`, `Acknowledged`, `In Progress`, `Resolution Submitted`, `Closed`.
  - *Priority:* `Critical (Code Red)`, `Urgent`, `Normal`, `Low`.

### 8.3 Ticket Progression Workflow
Staff members progress tickets through approved stages:
1. **Acknowledge Ticket:** Click **Acknowledge Ticket** to notify the supervisor and patient that you are handling the issue and en route.
2. **Start Work:** Click **Begin Work** when arriving at the room. The status transitions to `in_progress`.
3. **Add Internal Notes:** Staff can add notes (e.g. *"Replaced air filter on unit 3B; compressor running normally"*). Check the box **Internal Staff Note** to ensure the note is hidden from the patient.
4. **Submit Resolution with Evidence:**
   - Upload an "After" resolution photo if required by department rules (e.g., fixed pipe or cleaned floor).
   - Enter a brief resolution summary.
   - Click **Submit Resolution**.
   - If AI Verification is enabled, the AI Vision engine automatically inspects the resolution evidence before final closure.

---

# Chapter 9 — Email Configuration & SMTP Troubleshooting

CareOps AI includes an asynchronous, retrying email delivery engine supporting TLS and STARTTLS.

### 9.1 Supported SMTP Providers
CareOps AI works with any standard SMTP provider:
- **Google Workspace / Gmail:** `smtp.gmail.com` on Port `587` with TLS.
- **Microsoft 365 / Exchange:** `smtp.office365.com` on Port `587` with STARTTLS.
- **Amazon SES:** `email-smtp.us-east-1.amazonaws.com` on Port `587`.
- **Hospital Internal Mail Relay:** Direct connection to your on-premise Exchange or Postfix server.

### 9.2 Gmail / Google Workspace App Password Setup
If using Gmail or Google Workspace:
1. Enable 2-Step Verification on the hospital notification account.
2. Go to **Google Account Security** > **App Passwords**.
3. Generate a new App Password named `CareOps AI`.
4. Copy the 16-character password into `backend/.env` as `SMTP_PASSWORD`.

### 9.3 Diagnosing Email Delivery Failures
In the Admin Portal, open **Email & SMTP Delivery**:
- **Delivery States:**
  - `sent`: Successfully accepted by the SMTP provider (Provider Response 250).
  - `queued`: Awaiting asynchronous worker transmission.
  - `retrying`: Transient failure; exponential backoff retry in progress.
  - `failed`: All retry attempts exhausted.
- **Common Error Codes & Resolutions:**
  - `535 5.7.8 Username and Password not accepted`: Check `SMTP_USER` and `SMTP_PASSWORD` in `.env`. Ensure App Password is used instead of your regular Google password.
  - `ConnectionRefusedError [Errno 111]`: Check `SMTP_HOST` and ensure port `587` is not blocked by your firewall.
  - `SMTPAuthenticationError`: Ensure 2-factor authentication and App Passwords are enabled on the sending account.

---

# Chapter 10 — Hospital Local Area Network (LAN) Deployment

### 10.1 Host Server Network Topology
In a hospital environment, one reliable PC or server is designated as the **CareOps Host Server**.
- **Host Server IP:** `192.168.31.219` (assign a static IP via your hospital router or DHCP reservation).
- **Backend Port:** `8000` (FastAPI)
- **Frontend Port:** `3000` (Next.js)

### 10.2 Why Localhost Does Not Work on Other PCs
- `localhost` and `127.0.0.1` refer exclusively to the *local computer you are currently typing on*.
- If a nurse at Room Station 3 types `http://localhost:3000`, their computer looks inside *itself* rather than the CareOps server.
- All client PCs must use the server's actual LAN IP: **`http://192.168.31.219:3000`**.

### 10.3 Windows Firewall Configuration
To allow client computers and mobile phones on the hospital Wi-Fi to access the application, ensure Windows Firewall permits inbound connections on ports 3000 and 8000.
Run these commands in PowerShell as Administrator:
```powershell
New-NetFirewallRule -DisplayName "CareOps Frontend (3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "CareOps Backend API (8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### 10.4 Starting Automatically After Server Reboot
To ensure CareOps AI starts automatically if the hospital server restarts:
1. Create a startup script `start_careops.bat`:
```batch
@echo off
cd /d C:\Users\Administrator\.gemini\antigravity-ide\scratch\careops-ai\backend
start /b python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
timeout /t 3
cd /d C:\Users\Administrator\.gemini\antigravity-ide\scratch\careops-ai\frontend
start /b npm run dev -- -H 0.0.0.0 -p 3000
```
2. Place a shortcut to `start_careops.bat` into the Windows Startup folder:
   `shell:startup`

---

# Chapter 11 — Security Best Practices & Daily Administration

### 11.1 Access Control & Privilege Hygiene
- Never share administrative accounts. Create individual staff accounts for each supervisor with the `supervisor` role.
- Conduct a weekly review of active accounts. Immediately deactivate accounts of personnel on extended leave or who have departed.

### 11.2 Monitoring Failed Logins & Lockouts
- CareOps AI automatically locks an account after 3 consecutive invalid password attempts.
- In the Admin Portal under **Audit Logs**, filter by action `LOGIN_REJECTED_LOCKED_ACCOUNT` to detect potential unauthorized access attempts.

### 11.3 Database Backup & Recovery Procedure
CareOps AI stores its relational data in `backend/careops.db` (or PostgreSQL if configured).
To create a safe backup while the system is running:
```powershell
cd backend
python -c "import sqlite3, shutil, datetime; ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S'); shutil.copy2('careops.db', f'careops_backup_{ts}.db'); print(f'Backup created: careops_backup_{ts}.db')"
```
Store daily backups on a secure external USB drive or hospital network backup share.

---

# Chapter 12 — Diagnostic Matrix & Troubleshooting Table

| Problem | Root Cause | Diagnostic Check | Resolution |
| :--- | :--- | :--- | :--- |
| **Admin cannot log in** | Password changed or account locked. | Run Python check on user account status. | Reset admin password using `python -c "from app.database import SessionLocal; from app.models import User; from app.services.auth_service import get_password_hash; db = SessionLocal(); u = db.query(User).filter(User.role == 'admin').first(); u.hashed_password = get_password_hash('password123'); u.failed_login_attempts = 0; u.account_status = 'active'; db.commit(); db.close()"` |
| **Frontend opens on server, but fails on client PCs** | Client using `localhost` or Windows Firewall blocking port 3000. | Check URL on client machine; ping `192.168.31.219`. | Ensure client navigates to `http://192.168.31.219:3000` and open firewall ports 3000 and 8000. |
| **Department cannot be deleted** | Department has active personnel or unresolved tickets assigned. | Click *Remove* to inspect dependencies in modal. | Use the modal's *Reassign Dependencies & Remove* feature to move staff and tickets to another department first. |
| **Email notifications fail to send** | Missing or incorrect SMTP credentials in `.env`. | Check *Email & SMTP Delivery* logs in Admin Portal. | Update `SMTP_USER` and `SMTP_PASSWORD` in `backend/.env`. Use an App Password for Gmail. |
| **Staff cannot see tickets for other departments** | Strict RBAC isolation. | Normal expected security behavior. | Employees only see tickets for their assigned department. Assign user to the target department if cross-coverage is required. |
| **Patient tracking says "Ticket Not Found"** | Typo in reference number or accessing wrong room URL. | Verify ticket number in Admin ticket roster. | Check ticket reference format (e.g. `TKT-MNT-0008`). |
| **Database locked error** | SQLite file locked by external process. | Check running Python tasks. | Ensure only one backend uvicorn process is accessing `careops.db`. |

---

# Chapter 13 — Daily, Weekly, and Monthly Operational Checklists

### Daily Morning Checklist (5 Minutes)
- [ ] Check System Health at `http://192.168.31.219:8000/api/health`.
- [ ] Review the **Escalation & SLA** dashboard for any Code Red or overdue complaints.
- [ ] Inspect **Email & SMTP Delivery** to confirm notification queues are clearing with status `sent`.
- [ ] Check **Audit Logs** for any locked accounts or failed authentication alerts.

### Weekly Maintenance Checklist (15 Minutes)
- [ ] Review staff roster in **Departments & Staff**: inactivate departed personnel.
- [ ] Create a timestamped database backup (`careops_backup_YYYYMMDD.db`).
- [ ] Verify Bedside QR codes in key patient suites resolve to the correct room.
- [ ] Send a test email from the **Email Delivery Manager**.

### Monthly Governance Checklist (30 Minutes)
- [ ] Run automated test suite: `python -m pytest tests/` in `backend`.
- [ ] Review resolved complaint feedback scores in **NPS & Patient Voice**.
- [ ] Check disk space on host server.
- [ ] Verify offsite backup integrity by testing a test restore on a staging machine.

---
*Manual Version: 2.4.0 (Enterprise Production Edition)*  
*CareOps AI — Dedicated Hospital Dignity & Operational Assurance Platform*
