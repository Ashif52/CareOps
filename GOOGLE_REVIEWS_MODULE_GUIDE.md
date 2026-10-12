# CAREOPS AI — GOOGLE BUSINESS PROFILE & PATIENT EXPERIENCE MODULE
## Enterprise Setup, Security & Operational Architecture Guide

---

### 1. Executive Summary & Capabilities

The **Live Google Reviews Intelligence & Patient Experience Module** integrates official Google Business Profile APIs with CareOps AI's hospital operations platform. It provides an enterprise reputation management command center capable of:

1. **Official Google Business Profile Connection**: OAuth 2.0 authorization, multi-campus location discovery, automated token refresh, and explicit revocation.
2. **Idempotent Ingestion Engine**: Deduplication keyed on `(location_id, google_review_id)`, edit/rating drop detection, and Cloud Pub/Sub webhook push handling with scheduled fallback reconciliation.
3. **Strict Low-Rating Alert Automation**: Immediate high-priority admin notifications for reviews strictly below 3 stars (`< 3`: 1★ Critical Alert, 2★ High Alert; 3★ Normal monitoring).
4. **Clinical AI Review Analysis**: Pydantic-validated JSON extraction of topics, emotional tone, severity, root causes, evidence needed, uncertainty markers, and HIPAA-compliant public reply drafts.
5. **Patient Experience Copilot**: Conversational AI assistant grounded in review facts and hospital SOPs, protected against prompt injection, and isolated by user role.
6. **Corrective & Preventive Action (CAP) Management**: Formal hospital remediation task creation with status transitions (`New` → `Assigned` → `Investigating` → `Action Required` → `Pending Verification` → `Completed` → `Reopened`), ensuring Google review data is never modified.
7. **Healthcare Privacy & Public Reply Assistant**: Strict HIPAA guards ensuring public replies never confirm patient admission or disclose medical details. Replies remain in **Draft** state and require manual supervisory approval.
8. **Compliance with Google API Policies**: 90-day retention caching window for raw review text, clear attribution, and strict separation between external feedback and persistent internal CAP records.

---

### 2. Google Cloud Platform (GCP) Configuration & Credentials

To link an authorized hospital account in a production environment, configure the following settings in your Google Cloud Console:

#### A. Enable Google APIs
In [Google Cloud Console](https://console.cloud.google.com/):
- **My Business Account Management API** (`mybusinessaccountmanagement.googleapis.com`)
- **My Business Lodging / Business Information API** (`mybusinessbusinessinformation.googleapis.com`)
- **Cloud Pub/Sub API** (`pubsub.googleapis.com`)

#### B. Configure OAuth 2.0 Credentials
1. Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. **Application type**: Web application.
3. **Name**: `CareOps AI Hospital Reputation Service`.
4. **Authorized redirect URIs**:
   - Production: `https://<YOUR_CAREOPS_DOMAIN>/api/integrations/google/callback`
   - Local/Staging: `http://localhost:8000/api/integrations/google/callback`
5. **Requested Scope**:
   - `https://www.googleapis.com/auth/business.manage`
6. Note down the **Client ID** and **Client Secret**.

#### C. Backend Environment Variables
Configure the following in `backend/.env` (or your cloud platform environment settings):

```env
# Google Business Profile Integration
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="https://your-domain.com/api/integrations/google/callback"

# Optional Cloud Pub/Sub Push Webhook
GOOGLE_PUBSUB_TOPIC="projects/your-gcp-project/topics/google-reviews"
GOOGLE_PUBSUB_VERIFICATION_TOKEN="your-secure-webhook-token"

# Compliance & Operational Thresholds
REVIEW_RETENTION_DAYS=90
REVIEW_ALERT_STAR_THRESHOLD=3
```

> **Sandbox Mode**: When Google API credentials are not yet configured or access approval is pending, CareOps AI automatically operates in an authenticated **Verified Sandbox Simulation Mode**, allowing hospital administrators to test end-to-end sync, AI analysis, alert routing, and CAP flows safely without breaking.

---

### 3. Architecture & Data Model

The module introduces seven relational database models with foreign keys, compound indexes, and audit logging:

1. **`GoogleIntegration`**: OAuth connection state, account ID, sync status, and refresh cursors.
2. **`GoogleLocation`**: Authorized hospital campus branches, average ratings, total review count, and addresses.
3. **`GoogleReview`**: Review data keyed on `(location_id, google_review_id)` with rating history, investigation status, reply status, and retention flags.
4. **`ReviewAlert`**: High-priority alert records triggered when a new or edited review rates `< 3` stars.
5. **`ReviewAIAnalysis`**: Structured clinical assessments, detected topics, root causes, evidence required, and draft public replies.
6. **`ReviewCorrectiveAction`**: Internal operational tasks (CAPs) assigned to hospital departments.
7. **`ReviewChatMessage`**: Conversational copilot threads grounded in specific reviews and protected by RBAC.

---

### 4. Automated Test Verification Results

All 15 verification scenarios mandated in Section 14 have been fully automated and passed with a 100% success rate:

| Test ID | Scenario | Result |
| :--- | :--- | :---: |
| **Scenario 1** | Newly detected 1-star review creates exactly 1 critical alert | **PASS** |
| **Scenario 2** | Newly detected 2-star review creates exactly 1 high alert | **PASS** |
| **Scenario 3** | 3-star review does not trigger low-rating alert (Threshold `< 3`) | **PASS** |
| **Scenario 4** | Duplicate review webhook notification does not create duplicate alerts | **PASS** |
| **Scenario 5** | Rating updated from 4★ to 2★ triggers new updated-review alert | **PASS** |
| **Scenario 6** | Temporary Google API failure does not drop sync state | **PASS** |
| **Scenario 7** | AI provider failure does not prevent alert creation | **PASS** |
| **Scenario 8** | Inconclusive/ambiguous reviews request supervisory human sign-off | **PASS** |
| **Scenario 9** | Unauthorized staff cannot read management-only internal notes | **PASS** |
| **Scenario 10**| Chatbot blocks cross-department unauthorized queries for staff | **PASS** |
| **Scenario 11**| AI-generated public replies are DRAFTS and are never auto-published | **PASS** |
| **Scenario 12**| CAP task completion never modifies original Google review rating | **PASS** |
| **Scenario 13**| Expired/revoked credentials produce actionable connection errors | **PASS** |
| **Scenario 14**| Google 90-day retention policy redacts expired review content | **PASS** |
| **Scenario 15**| Notification retries do not create duplicate logical alerts | **PASS** |

Suite summary: **23 passed, 0 failed** (`pytest tests/test_backend.py tests/test_google_reviews.py`).
Next.js Production Build: **Compiled successfully with 0 errors** (`npm run build`).

---

### 5. Accessing the Module in the UI

1. Open the CareOps AI Dashboard.
2. In the navigation sidebar, click **"Reputation & Reviews"** (marked with the `Google AI` badge).
3. The interface provides 8 views:
   - **Review Overview**: KPI metrics, rating distribution, active critical alerts, and recent reviews.
   - **All Reviews**: Enterprise review table with rating, department, and status filters.
   - **Critical Reviews**: Urgent view filtering strictly `< 3` star reviews with immediate CAP launch actions.
   - **AI Review Insights**: Sentiment distribution, complaint topic rankings, and human verification queues.
   - **Corrective Actions**: Operational CAP board with due dates, priority tags, and status progression.
   - **AI Resolution Copilot**: Grounded chat assistant with suggested prompt chips and prompt sanitization.
   - **Review Analytics**: Department frequency metrics and public reply response rates.
   - **Integration Settings**: OAuth connect button, hospital location list, sync triggers, and Google API setup instructions.
