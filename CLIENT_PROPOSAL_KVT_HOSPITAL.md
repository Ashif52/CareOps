# COMMERCIAL PROPOSAL & SERVICE AGREEMENT
## Hospital Facilities Operating System, Bedside Patient QR Portal & Automated WhatsApp Integration

**Document Reference:** `PRP-KVT-2026-V1`  
**Date of Issuance:** October 2026  
**Proposal Validity:** 30 Calendar Days  

**Prepared For:**  
**The Board of Directors & Medical Superintendent**  
**KVT Multispeciality Hospital**  

**Prepared By:**  
**Happy Care Solutions Engineering Team**  
*Enterprise Healthcare Systems & Automation Group*  

---

## 1. Executive Summary

Modern multispeciality hospitals face daily operational friction in managing non-clinical patient requests, facility breakdowns, room cleanliness, and equipment repairs. In many hospital wards, patients and attendants are forced to verbally notify nursing stations, write in physical registers, or call front-desk numbers repeatedly. 

This traditional model causes:
* **Nursing Distraction**: Registered nurses spend valuable clinical time fielding complaints about air conditioning, plumbing, televisions, or bed controls instead of focusing on direct patient care.
* **Delayed Turnaround & Lost Accountability**: Lack of automated tracking leads to forgotten work orders and unverified technician claims.
* **Patient Dissatisfaction**: Attendants feel anxious when they cannot track when a technician will arrive or whether their complaint was recorded.

The **Happy Care Hospital Operating System** solves these challenges by deploying touchless, room-specific Bedside QR Codes connected to an automated **Meta WhatsApp Cloud API dispatch platform**, real-time technician workspaces, automated SLA escalation monitors, and NABH-compliant audit logging.

---

## 2. Solution Architecture & Key Modules

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                       KVT MULTISPECIALITY HOSPITAL                          │
 │                          BEDSIDE PATIENT EXPERIENCE                         │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ (Scans Room QR Code)
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                      PATIENT BEDSIDE QR WEB APPLICATION                     │
 │  • Zero App Download Required (Works on any smartphone camera)              │
 │  • Multilingual One-Touch Complaint Selector (Maintenance, Housekeeping,    │
 │    Biomedical, Dietary, Nursing Routine)                                    │
 │  • Integrated Voice Note Recording & Computer Vision Camera Capture         │
 │  • Tokenized Live Resolution Progress Tracker (/track/[TKT-XXXX])           │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                         Automated Dispatch & Tracking Engine
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────────┐
│   OFFICIAL META WHATSAPP BUSINESS    │  │    STAFF & TECHNICIAN DISPATCH     │
│   • Instant WhatsApp Notice to Patient│  │    • Least-Busy Auto-Assignment   │
│   • Interactive [Track Live] Button  │  │    • Mobile Technician Work Orders │
│   • Staff Dispatch & ETA Alerts      │  │    • "Before" & "After" Evidence   │
│   • Post-Resolution NPS 1-5★ Rating  │  │    • Supervisor Inspection Sign-off│
└──────────────────────────────────────┘  └────────────────────────────────────┘
                                        │
                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │             EXECUTIVE COMMAND CENTER & SUPERADMIN PLATFORM                  │
 │  • Real-Time Hospital SLA Countdown Timers & Department Performance         │
 │  • Automated Level-1 and Level-2 Escalations for Overdue Requests           │
 │  • Google Reviews AI Sentiment Analysis & CAPA Audit Trail                  │
 │  • High-Availability Local Network (LAN) & Cloud Synchronized Engine        │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Official Meta WhatsApp Business Integration

To provide the highest standard of patient comfort and trust, the system integrates directly with the **Official Meta WhatsApp Cloud API** (Graph API v19.0+), delivering an enterprise-grade experience:

1. **Official Hospital Profile**: Messages are delivered from a verified WhatsApp Business profile displaying **"KVT Multispeciality Hospital"**, hospital address, emergency contact numbers, and official logo.
2. **Automated 6-Stage Patient & Staff Lifecycle Notifications**:
   * **Stage 1 — Complaint Registration**: Patient instantly receives an official confirmation WhatsApp message with ticket ID and live tracking link.
   * **Stage 2 — Work Order Dispatch**: On-duty technician receives WhatsApp work order with room number, issue details, and SLA resolution target.
   * **Stage 3 — Staff En Route**: Patient receives alert when the technician accepts the order, including technician name, designation, and estimated arrival time.
   * **Stage 4 — Work in Progress**: Live progress telemetry notifies patient when repairs begin at the bedside.
   * **Stage 5 — Supervisory Verification**: Supervisor receives inspection alert with photographic evidence upon work completion.
   * **Stage 6 — Satisfaction Survey**: Patient receives automated post-service survey with 1–5 star interactive buttons and a link to post a Google Review.
3. **Zero Risk of Number Banning**: Unlike unverified third-party bots or web scrapers, official Meta API integration complies 100% with Meta’s Business Policies and healthcare privacy standards.

---

## 4. Commercial Quotation & Scope of Work

The complete turnkey deployment of the Happy Care Hospital Operations platform for **KVT Multispeciality Hospital** is quoted below:

| Deliverable ID | Solution Module / Scope of Delivery | Investment (₹) |
| :---: | :--- | :---: |
| **MOD-01** | **Bedside Patient QR Experience & Guest Session Portal**<br>• Room-specific dynamic QR code system for up to 150 hospital beds/rooms.<br>• Touchless complaint submission with voice note audio recording & transcription.<br>• Patient live resolution tracker (`/track/[ticket_number]`) with zero login friction. | **₹22,000** |
| **MOD-02** | **Technician & Department Dispatch Operating System**<br>• Real-time technician mobile workspace with automatic department workload routing.<br>• Mobile camera evidence upload ("Before" and "After" repair photos).<br>• Technician ETA management, delay reasoning, and work completion tracking. | **₹18,000** |
| **MOD-03** | **Automated SLA Governance & Escalation Engine**<br>• Departmental SLA policies (Low, Medium, High, Critical priority tiers).<br>• Persistent background watchdog with automated Level-1 and Level-2 supervisor escalations.<br>• Computer Vision AI verification of repair completion evidence. | **₹18,000** |
| **MOD-04** | **Official Meta WhatsApp Business Cloud Platform Integration**<br>• Complete Meta Business Cloud API setup and verified phone number onboarding.<br>• Configuration of 6 pre-approved interactive WhatsApp message templates.<br>• Live webhook telemetry for message delivery status (Sent, Delivered, Read). | **₹15,000** |
| **MOD-05** | **Executive Command Center & Google Reviews CAPA Suite**<br>• Real-time hospital operational dashboard with SLA breach telemetry.<br>• Turnaround time analytics, department scorecards, and staff performance metrics.<br>• Google Business Profile review sync with AI Sentiment Analysis and Corrective & Preventive Action (CAPA) tracking. | **₹12,000** |
| **MOD-06** | **Hospital Network Deployment & Security Hardening**<br>• Deployment on hospital local network (LAN) with cross-device Wi-Fi accessibility.<br>• Docker containerization with automated daily database backups.<br>• Wildcard SSL/TLS encryption & HIPAA/NABH security compliance hardening. | **₹8,000** |
| **MOD-07** | **Onboarding, Staff Training & 60-Day Hypercare Warranty**<br>• Structured training workshops for nursing supervisors, maintenance staff, and IT personnel.<br>• Comprehensive Master Administrator User Guide & SOP documentation.<br>• 60 calendar days of priority bug-fix warranty and technical support. | **₹7,000** |
| **TOTAL** | **Comprehensive Turnkey Production Deployment** | **₹1,00,000** |

*(Total Contract Value: Rupees One Lakh Only. Taxes as applicable).*

---

## 5. Milestone-Based Payment Terms

To align project execution with measurable deliverables, payments are structured across two milestones:

| Milestone | Stage / Deliverable | Percentage | Amount (₹) |
| :---: | :--- | :---: | :---: |
| **Milestone 1** | **Project Kick-off & Mobilization Advance**<br>Payable upon signing of agreement. Covers hospital server provisioning, dedicated database setup, domain/SSL linkage, AI diagnostic calibration, and Meta WhatsApp Business Account registration. | **50%** | **₹50,000** |
| **Milestone 2** | **Hospital-Wide Rollout, Training & Final Handover**<br>Payable upon complete inpatient room QR deployment, multi-department staff training workshops, Google Reviews & WhatsApp live sync, and official operational Go-Live sign-off. | **50%** | **₹50,000** |

---

## 6. Implementation Timeline (3 Weeks / 18–21 Days to Go-Live)

```
Week 1: Infrastructure, Architecture & API Gateways
├── Days 01–02: Hospital network configuration, dedicated database setup, and domain/SSL provisioning
├── Days 03–05: Meta WhatsApp Business Cloud API integration, verified sender onboarding & template approvals
└── Days 06–07: Hospital branding integration (KVT logos, 27–40 department codes, staff directory setup)

Week 2: AI Diagnostics, Google Reviews Sync & Pilot Testing
├── Days 08–10: Google Business Profile OAuth 2.0 authorization & Cloud Pub/Sub real-time review sync
├── Days 11–12: AI Computer Vision diagnostic model calibration (facilities, cleanliness & equipment photos)
└── Days 13–14: Pilot ward launch with live WhatsApp dispatch, technician tracking & SLA escalation stress-testing

Week 3: Hospital-Wide Rollout, Training & Go-Live
├── Days 15–17: Deployment of branded acrylic room QR standees across all inpatient rooms & ward stations
├── Days 18–19: Multi-department training workshops for Nursing In-charges, Technicians, Supervisors & IT Staff
└── Days 20–21: Official Hospital-Wide Go-Live, executive dashboard handover & operational sign-off
```

---

## 7. Service Level Agreement (SLA) & Warranty

1. **60-Day Hypercare Warranty**: For 60 days following Go-Live, the engineering team provides priority technical support covering bug fixes, configuration adjustments, and performance tuning at zero additional charge.
2. **System Availability**: The system is engineered for 99.9% uptime with automated self-healing process supervision and daily backups.
3. **Optional Annual Maintenance Contract (Year 2+)**: ₹18,000/year (Includes software updates, security patches, periodic database maintenance, and priority support).

---

## 8. Proposal Acceptance & Authorization

By signing below, **KVT Multispeciality Hospital** accepts the commercial quotation, milestone payment terms, and scope of work outlined in this document.

**Submitted By:**  
Happy Care Solutions Engineering Team  

*Signature:* _____________________________  
*Name:* __________________________________  
*Title:* Principal Solutions Architect  
*Date:* __________________________________  

<br>

**Accepted & Approved By:**  
For **KVT Multispeciality Hospital**  

*Signature:* _____________________________  
*Name:* __________________________________  
*Designation:* Medical Superintendent / Managing Director  
*Date:* __________________________________  
*Hospital Seal:*
