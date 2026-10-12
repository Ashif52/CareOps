# CareOps AI — Enterprise Hospital Service Management & AI Verification Platform

> **"Every hospital issue. Accountable ownership. Verified resolution."**

CareOps AI is a production-grade, AI-powered hospital service request, maintenance verification, patient QR feedback, SLA monitoring, and supervisor escalation platform. Built with a Linear/Stripe/Vercel enterprise aesthetic, it replaces chaotic WhatsApp groups, physical registers, and unverified maintenance claims with structured workflows, verifiable computer vision evidence, and persistent SLA governance.

---

## 1. System Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    CareOps AI Web App                                   |
|                                                                                         |
|  +-----------------------+    +-------------------------+    +-----------------------+  |
|  |   Patient QR Portal   |    |     Staff Workspace     |    |   Admin & Management  |  |
|  | - Mobile-First Wards  |    | - Action-Driven Triage  |    | - Command Center KPIs |  |
|  | - Web Audio Voice Rec |    | - Live SLA Countdown    |    | - AI Verification Ctr |  |
|  | - Anonymous Dispatches|    | - Sequential Workflow   |    | - SLA Policy Engine   |  |
|  | - Reassuring Tracking |    | - Before/After Evidence |    | - QR Room Manager     |  |
|  | - Zero App Install    |    | - Resolution Submission |    | - Audit Ledger        |  |
|  +-----------------------+    +-------------------------+    +-----------------------+  |
+-----------------------------------------------------------------------------------------+
                                             |
                                  (REST API / JWT Auth)
                                             v
+-----------------------------------------------------------------------------------------+
|                           FastAPI Enterprise Backend (Port 8000)                        |
|                                                                                         |
|  * Persistent SLA Engine: Asyncio background loop scanning deadlines every 15s          |
|  * AI Vision Diagnostics: Frame & motion analysis, equipment consistency checks         |
|  * Strict Privacy Boundary: Internal clinical notes isolated from patient access        |
|  * Immutable Audit Ledger: Records every status transition, override, and review       |
+-----------------------------------------------------------------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     v                                               v
+------------------------------------------+    +-----------------------------------------+
|           Database Layer                 |    |          Private Media Store            |
| - SQLite (Zero-config local out-of-box)  |    | - Pre-repair baseline photo/video       |
| - PostgreSQL (Production ready via env)  |    | - Post-repair verification evidence     |
| - 10 Indexed Relational Tables           |    | - Web Audio voice recordings (.webm)    |
+------------------------------------------+    +-----------------------------------------+
```

---

## 2. Core Functional Pillars

### A. Patient QR Feedback Portal
- **Zero-Friction Access**: Patients scan room-specific QR codes (`/qr/[token]` or in-app preview). No app download or account creation required.
- **6 Hospital Departments**: Maintenance, Doctors, Nursing, Housekeeping, Billing, and Pharmacy (all dynamically managed from admin panel).
- **Web Audio Voice Recording**: Patients can speak their complaint; includes live recording indicator, playback, retry, and speech-to-text transcription.
- **Strict Privacy Barrier**: Patients track sanitized progress without seeing staff private notes or management escalation logs.

### B. Staff Operational Workspace
- **Action-Driven Triage**: Organized by My Assigned, Unacknowledged, Due Soon (<60m), In Progress, Overdue, and Awaiting Verification.
- **Live SLA Countdown**: Dynamic timers and urgency badges (Normal, Due Soon, Overdue).
- **Enforced Workflow Machine**: Staff cannot jump steps: `Acknowledge` -> `Start Work` -> `Capture Before/After Evidence` -> `Submit Resolution`.

### C. AI Verification Center
- **Two-Column Evidence Workspace**: Direct side-by-side comparison of pre-repair baseline vs post-repair functional state.
- **Ceiling Fan & Appliance Motion Intelligence**: Detects that a static photograph cannot verify fan rotation or fluid flow. Flags static images as inconclusive and requires video or functional checks.
- **Structured AI Report**:
  - `evidence_relevance` (High, Medium, Low, Mismatch)
  - `equipment_match` (Confirmed Match, Likely Match, Mismatch, Inconclusive)
  - `visible_fault_assessment` (Fault Detected, Ambiguous, Fault Cleared)
  - `after_repair_functional_evidence` (Movement Observed, Static Unverified, Normal)
  - `ai_recommendation` (`likely_resolved`, `likely_unresolved`, `inconclusive`)
- **Supervisor Override Governance**: If a supervisor overrules an AI recommendation, the platform mandates a documented justification and logs it in the immutable audit trail.

### D. Persistent SLA & Escalation Engine
- Background asyncio worker ticks independently of browser sessions.
- Automatically marks breaches, logs escalation levels, and sends supervisor alerts.
- On-demand manual scan trigger available in the dashboard.

---

## 3. The Three Portals Access Gateway

When visiting **[http://localhost:3000](http://localhost:3000)**, CareOps AI presents an enterprise **Three Portals Access Gateway**:

```
+------------------------------------------------------------------------------------------+
|                                    Select Your Portal                                    |
|                                                                                          |
|  +------------------------+  +-------------------------+  +---------------------------+  |
|  |       PORTAL A         |  |        PORTAL B         |  |         PORTAL C          |  |
|  |   Patient QR Portal    |  | Department Staff Portal |  |  Administrator & Ops Boss |  |
|  |                        |  |                         |  |                           |  |
|  | - No login required    |  | - Quick 1-click login   |  | - Quick 1-click login     |  |
|  | - Room 204 QR context  |  | - Rajesh (Maintenance)  |  | - Dr. Vance (Admin)       |  |
|  | - 6 Department cards   |  | - Nurse Priya (Nursing) |  | - Vikramaditya (Supervisor)| |
|  | - Web Audio recording  |  | - Action Triage Queues  |  | - 6 Command Center KPIs   |  |
|  | - Reassuring tracking  |  | - Live SLA Countdown    |  | - AI Verification Center  |  |
|  |                        |  | - Enforced Workflow     |  | - SLA Engine & Room QRs   |  |
|  | [Launch Patient View]  |  | [Login as Technician]   |  | [Login as Administrator]  |  |
|  +------------------------+  +-------------------------+  +---------------------------+  |
+------------------------------------------------------------------------------------------+
```

You can also click **"Direct Credentials"** at the top right to log in with custom email and password.  
At any time while logged in, click **"Log Out / Switch Portal"** in the sidebar footer or top navigation menu to return to the gateway.

```
careops-ai/
├── backend/
│   ├── app/
│   │   ├── config.py             # Settings, JWT, and upload limits
│   │   ├── database.py           # SQLAlchemy engine & session factory
│   │   ├── models/               # SQLAlchemy 2.0 relational models
│   │   ├── schemas/              # Pydantic v2 schemas
│   │   ├── services/
│   │   │   ├── auth_service.py   # JWT token generation & role checks
│   │   │   ├── ticket_service.py # State machine & assignment engine
│   │   │   ├── sla_engine.py     # Background SLA monitor & escalations
│   │   │   ├── ai_vision_service.py # Multimodal frame & motion analyzer
│   │   │   └── storage_service.py# Private media storage & hashing
│   │   ├── routers/              # REST API endpoints
│   │   ├── seed.py               # Enterprise hospital seed data
│   │   └── main.py               # FastAPI entry point & lifespan
│   ├── tests/
│   │   └── test_backend.py       # Pytest automated test suite
│   ├── verify_end_to_end.py      # Full 18-step integration verification
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── globals.css       # Enterprise design tokens & styling
    │   │   ├── layout.tsx        # Root HTML layout
    │   │   └── page.tsx          # CareOps AI primary operational view
    │   ├── components/
    │   │   ├── Sidebar.tsx       # Enterprise navigation shell
    │   │   ├── Header.tsx        # Breadcrumbs, role switcher & alerts
    │   │   ├── OverviewDashboard.tsx # 6 KPI cards & workload charts
    │   │   ├── TicketTable.tsx   # Sortable ticket register & filters
    │   │   ├── TicketDetailView.tsx # Ticket drawer with evidence & notes
    │   │   ├── AIVerificationCenter.tsx # Side-by-side evidence inspection
    │   │   ├── PatientPortal.tsx # Mobile-first QR feedback interface
    │   │   ├── StaffWorkspace.tsx# Staff action queue & SLA timers
    │   │   ├── SLAPoliciesView.tsx # SLA policy matrix & breach log
    │   │   ├── QRRoomManager.tsx # Ward QR code management
    │   │   ├── AuditLogsView.tsx # Immutable compliance ledger
    │   │   └── CreateTicketModal.tsx # Manual ticket creation dialog
    │   └── lib/
    │       └── api.ts            # Type-safe API client interface
    └── package.json
```

---

## 4. Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
# Run the FastAPI server (Port 8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*The database automatically creates `careops.db` and seeds all hospital departments, rooms, SLA policies, and tickets on first launch.*

### Frontend Setup
```bash
cd frontend
npm install
npm run build
npm run start -p 3000
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 4. Production Cloud Deployments

CareOps AI is deployed and live in production:
- **Web Application (Vercel)**: [https://care-ops-dusky.vercel.app](https://care-ops-dusky.vercel.app)
- **FastAPI Core Engine (Render)**: [https://careops-5uaf.onrender.com](https://careops-5uaf.onrender.com)
- **API Health Check**: [https://careops-5uaf.onrender.com/api/health](https://careops-5uaf.onrender.com/api/health)
- **Interactive Swagger Docs**: [https://careops-5uaf.onrender.com/docs](https://careops-5uaf.onrender.com/docs)
- **PostgreSQL Database**: Serverless Neon Postgres with automated connection pooling.

---

## 5. Demo & Governance Accounts

The top header includes a **One-Click Role Switcher** to test all permission tiers immediately:

| Name | Role | Email | Password | Primary Capabilities |
|---|---|---|---|---|
| **System Superadmin** | Superadmin | `superadmin@careops.hospital` | `password123` | Exclusive database wipe, operational purge, demo reseed, system recovery |
| **Dr. Alistair Vance** | Administrator | `admin@careops.hospital` | `password123` | Full dashboard, SLA policies, analytics, room QR management, audit trails |
| **Vikramaditya Rao** | Supervisor | `supervisor.mnt@careops.hospital` | `password123` | AI verification sign-off, override justifications, closure approval, reports |
| **Rajesh Sharma** | Staff (Lead) | `technician.rajesh@careops.hospital` | `password123` | Acknowledge tickets, start work, capture evidence, submit resolution |
| **Nurse Priya Nair** | Staff (Nurse) | `nurse.priya@careops.hospital` | `password123` | Clinical requests, IV pump triage, patient care updates |

---

## 6. Executive Analytics & Reports

The platform includes an enterprise analytics engine:
- **Throughput Velocity**: Weekly volume vs. closure velocity and backlog trend tracking.
- **Departmental SLA Matrix**: Real-time response and resolution compliance rates across all 6 departments.
- **AI Verification Intelligence**: Automated vision pass rate, inconclusive flags, and supervisor override distribution.
- **Overdue Heatmap**: Visual identification of persistent operational bottlenecks.
- **Audit & CSV Export**: One-click download of filtered ticket records and raw forensic audit logs.

---

## 7. Running Automated Tests

### Unit & Security Boundary Tests
```bash
cd backend
python -m pytest tests/test_backend.py -v
```
*Validates health checks, seeded departments, JWT authentication, patient privacy boundaries, staff workflows, ceiling fan motion heuristics, SLA engine, and superadmin database security.*


### End-to-End Operational Verification Script
```bash
cd backend
python verify_end_to_end.py
```
*Executes the complete lifecycle from patient QR dispatch through resolution, AI verification, supervisor override, and final closure.*

---

## 7. Verified Acceptance Criteria

- [x] **1. Patient QR Feedback**: Scans Room 204 QR code and dispatches request without app install.
- [x] **2. Persistence**: Tickets persist in relational database with auto-generated ID (`TKT-MNT-...`).
- [x] **3. Auto-Assignment**: Eligible department staff assigned based on active workload.
- [x] **4. SLA Deadlines**: Backend calculates acknowledgement & resolution deadlines from active policy.
- [x] **5. Sequential Workflow**: Staff acknowledges, starts work, records delay reasons, and submits resolution.
- [x] **6. Autonomous SLA Engine**: Background worker detects breaches and escalates without an open browser.
- [x] **7. Secure Evidence**: Multipart and base64 upload pipeline with SHA-256 file hashing.
- [x] **8. AI Verification Intelligence**: Structured diagnostics with `likely_resolved`, `likely_unresolved`, or `inconclusive`.
- [x] **9. Motion Heuristics**: Detects that static photos cannot verify ceiling fan rotation or flow.
- [x] **10. Closure Governance**: Mandatory human review and supervisor sign-off before closure.
- [x] **11. Patient Privacy**: Strict boundary ensures internal notes and staff IDs are hidden from patients.
- [x] **12. Documented Overrides**: Mandatory written justification required when overruling AI assessments.
- [x] **13. Immutable Audit Trail**: All status changes, evidence uploads, and reviews recorded in audit ledger.
- [x] **14. Multi-Role Authorization**: Server-side role enforcement protects administrative endpoints.
- [x] **15. Responsive Design**: Desktop command center and mobile-first patient QR view.
- [x] **16. Zero-Config Startup**: Operates seamlessly out of the box with realistic seed data.
