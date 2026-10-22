# DEVELOPER INTERNAL BUDGET & PRODUCTION EXECUTION GUIDE
## Confidential Internal Operating Manual — KVT Multispeciality Hospital Deployment
**Author:** Lead Full-Stack Software Architect  
**Classification:** STRICTLY CONFIDENTIAL — FOR DEVELOPER / INTERNAL AGENCY USE ONLY  
**Associated Client Document:** `CLIENT_PROPOSAL_KVT_HOSPITAL.md` (Contract Value: ₹1,00,000)  

---

## 1. Financial Overview & Profit Margin Audit

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          COMMERCIAL PROFIT & LOSS                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Total Invoiced to KVT Hospital:                        ₹1,00,000 (100.0%)    ║
║ Less: Total Direct Hard Costs (Year 1):              - ₹ 14,350 ( 14.3%)    ║
║ Less: Physical Bedside QR Acrylic Stands (50 units): - ₹  4,000 (  4.0%)    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ NET CASH PROFIT POCKETED:                              ₹ 81,650 ( 81.65%)   ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Granular Hard Expense Audit (What You Actually Spend)

### 2.1 Complete Expense Breakdown Table

| Component | Provider / Tool | Actual Hard Cost (₹) | Billing Cycle | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Meta WhatsApp Cloud API** | Meta Graph API v19.0 | **₹1,800 – ₹3,000** | Annual Usage | 1,000 service convos/mo FREE. Utility messages in India cost ~₹0.12 – ₹0.35 each. |
| **Dedicated WhatsApp SIM** | Jio / Airtel Prepaid | **₹499** | Annual Plan | 1-Year validity basic SIM for hospital official WhatsApp number. |
| **Server Hosting (Cloud)** | Hetzner / DigitalOcean / AWS Lightsail | **₹7,200 – ₹9,600** *(Cloud)*<br>**₹0** *(Local Hospital Server)* | Annual (~₹700/mo) | 4GB RAM, 2 vCPU. Can be **₹0** if hosted on existing hospital PC. |
| **Domain Registration** | Namecheap / GoDaddy | **₹899** | Annual | `care.kvthospital.in` or `kvtcare.com`. |
| **Wildcard SSL Certificate** | Let's Encrypt | **₹0** (Free) | Perpetual | Automated Certbot renewal via cron. |
| **Outbound Email (SMTP)** | Gmail SMTP / Brevo / AWS SES | **₹0** (Free) | Monthly Free Tier | Brevo: 300 free emails/day. Gmail SMTP: 500 emails/day free. |
| **AI Computer Vision API** | Google Gemini 1.5 Flash / GPT-4o-mini | **₹250** | Annual Usage | ~$0.0004 per image inspection (~₹20/month for 500 inspections). |
| **Bedside Acrylic Stands** | Local Acrylic Printer | **₹3,500 – ₹4,500** | One-time fabrication | 50 Units of 3mm acrylic L-stands @ ₹70–₹90 per room. |
| **TOTAL OUT-OF-POCKET** | — | **₹14,448 – ₹18,748 (Cloud)**<br>**₹7,248 – ₹9,148 (Local)** | **First Full Year** | **All expenses covered by client 40% advance.** |

---

## 3. Meta WhatsApp Business Cloud API — Deep Dive & Exact Math

### 3.1 Understanding Meta's Pricing Model in India
Meta charges per **24-hour conversation window**, divided into 4 categories:
1. **Service Conversations (User-Initiated)**:
   * When a patient or staff member sends a message to the hospital WhatsApp first, a 24-hour session opens.
   * **Every Meta Business Account receives 1,000 FREE Service Conversations each month.**
   * For a 100-bed hospital generating 300–600 user inquiries/month, **this is 100% FREE.**
2. **Utility Conversations (Business-Initiated / Template)**:
   * Triggered when the server sends an automated confirmation notice or dispatch order.
   * Current rate in India: **~₹0.12 to ₹0.35 per conversation**.
   * If KVT Hospital generates **500 complaints per month**:
     * 500 tickets $\times$ 2 utility notices (Ticket Created + Staff Assigned) = 1,000 messages.
     * $1,000 \times ₹0.25 = \mathbf{₹250/\text{month}}$ ($\mathbf{₹3,000/\text{year}}$).

### 3.2 Step-by-Step Meta Setup Guide (Never Pay Middleware Like Wati/Twilio)
Third-party providers (Wati, Interakt, Twilio) charge ₹1,500 – ₹3,000/month *plus* message markups. By connecting directly to the official Meta Cloud API, you cut out all middlemen.

#### Step 1: Create Meta Business Suite Account
1. Visit `https://business.facebook.com` and log in with the hospital administrator's Facebook account.
2. Complete Business Verification: Upload hospital registration certificate and electricity/phone bill showing hospital name and address. (Takes 24–48 hours for Meta approval).

#### Step 2: Create WhatsApp Cloud API App in Meta Developers
1. Visit `https://developers.facebook.com`.
2. Click **Create App** $\rightarrow$ Select **Other** $\rightarrow$ Select **Business**.
3. Add the **WhatsApp** product to your app.

#### Step 3: Generate a Permanent System User Token
*By default, Meta gives a temporary 24-hour token. You MUST generate a permanent token so the hospital server never disconnects:*
1. Go to **Meta Business Settings** $\rightarrow$ **Users** $\rightarrow$ **System Users**.
2. Click **Add System User** $\rightarrow$ Role: **Admin**.
3. Click **Add Assets** $\rightarrow$ Select your WhatsApp App $\rightarrow$ Grant **Full Control**.
4. Click **Generate Token** $\rightarrow$ Select your App $\rightarrow$ Check permissions:
   * `whatsapp_business_messaging`
   * `whatsapp_business_management`
5. Set Token Expiry: **Never**. Copy this permanent token.
6. Paste it into your `backend/.env` file:
   ```env
   WHATSAPP_API_TOKEN=EAAxxxxxxx...
   WHATSAPP_PHONE_NUMBER_ID=1092837465xxxxx
   WHATSAPP_BUSINESS_ACCOUNT_ID=192837465xxxxx
   ```

#### Step 4: Add & Verify the Dedicated Hospital SIM Number
1. Under WhatsApp $\rightarrow$ **API Setup**, click **Add Phone Number**.
2. Enter the dedicated phone number (e.g. `+91 98XXX XXXXX`).
3. Meta sends an SMS / Voice OTP. Enter the OTP to verify ownership.
4. Set a 6-digit Two-Factor PIN.

#### Step 5: Pre-Approve Interactive Message Templates
Submit these standard templates in **WhatsApp Manager** $\rightarrow$ **Message Templates**:
* Template Name: `patient_ticket_created_v1` (Category: Utility)
  ```text
  *Official Happy Care Hospital Confirmation Notice*

  Your complaint has been registered successfully.
  • Ticket Reference: {{1}}
  • Service Location: {{2}}
  • Department: {{3}}
  • Issue Category: {{4}}

  Track real-time resolution progress here:
  {{5}}
  ```
  *(Buttons: Quick Reply or URL Button linking to `{{5}}`).*

---

## 4. Zero-Bug Production Engineering Blueprint
*(How to guarantee 100% bug-free 24/7 uptime without emergency client calls)*

### 4.1 Database Migration (SQLite to PostgreSQL 16)
SQLite is fine for single-user dev, but will lock (`sqlite3.OperationalError: database is locked`) if multiple patients scan QR codes simultaneously.
1. Install PostgreSQL on server:
   ```bash
   sudo apt update && sudo apt install postgresql postgresql-contrib -y
   sudo -u postgres psql -c "CREATE DATABASE kvt_careops;"
   sudo -u postgres psql -c "CREATE USER careops_admin WITH PASSWORD 'StrongSecurePass2026!';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kvt_careops TO careops_admin;"
   ```
2. Update `backend/.env`:
   ```env
   DATABASE_URL=postgresql+psycopg2://careops_admin:StrongSecurePass2026!@127.0.0.1:5432/kvt_careops
   ```
3. Run Alembic/SQLAlchemy startup: The existing models in `backend/app/models/__init__.py` will auto-generate all tables cleanly.

### 4.2 Local Hospital Wi-Fi Resilience (0.0.0.0 Binding)
Hospital internet frequently fluctuates. If the external ISP goes down, the hospital staff still need to resolve room complaints:
1. Ensure the server has a **Static IP** on the hospital router (e.g., `192.168.1.150`).
2. Both frontend (port 3000) and backend (port 8000) listen on `0.0.0.0`.
3. Bedside QR codes point to `http://192.168.1.150:3000/patient/qr/...` or a local DNS name `http://happycare.kvt`.
4. Result: **Patients and nurses can submit and resolve requests completely offline without active internet connection.**

### 4.3 Fail-Safe WhatsApp & Email Asynchronous Queue
If Meta API or SMTP server takes 5 seconds to reply, the patient's phone must NEVER freeze:
* The backend already uses `ThreadPoolExecutor(max_workers=4)`.
* Every outbound notification is written to `EmailLog` or `WhatsAppMessage` as `queued`.
* Background worker executes the HTTP request. If it fails, `attempts` increments with status `retrying`.
* The patient receives an immediate `< 200ms` HTTP response with their ticket number.

### 4.4 Automated Image Compression (Storage Protection)
Smartphone cameras take 5MB–10MB photos. In 6 months, 2,000 photos will consume 20GB and slow down backups.
* In `backend/app/services/storage_service.py`, enforce PIL compression:
  ```python
  from PIL import Image
  img = Image.open(file_path)
  img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
  img.save(file_path, "JPEG", optimize=True, quality=80)
  ```
* This reduces each image from **8MB to ~220KB** without visible loss.

### 4.5 Process Supervision via PM2 (Automatic Self-Healing)
Never run `python main.py` directly in production. Use PM2 so the server auto-restarts if it crashes or the server reboots:
```bash
npm install -g pm2

# Start Backend
pm2 start "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" --name "careops-backend"

# Start Frontend
cd frontend && npm run build
pm2 start "npm run start -- -p 3000 -H 0.0.0.0" --name "careops-frontend"

# Persist on server reboots
pm2 save
pm2 startup
```

### 4.6 Automated Daily Database Backup
Add a cron job to dump the database every night at 2:00 AM:
```bash
0 2 * * * pg_dump -U careops_admin kvt_careops | gzip > /var/backups/careops_$(date +\%Y\%m\%d).sql.gz
```

---

## 5. Cash-Flow Protection Strategy (Never Spend Your Own Money)

Follow this golden rule for software contracting:
1. **Never spend out-of-pocket before receiving Milestone 1**:
   * Collect **₹40,000 (40% Advance)** upon signing.
   * Buy the SIM (₹499), Domain (₹899), and Cloud VPS (₹800/mo) *from the ₹40,000 advance*.
   * You remain **₹37,800 in positive cash balance from Day 1**.
2. **Collect Milestone 2 (₹40,000) at Floor Pilot Launch**:
   * Deploy on the 1st floor (20 beds). Once management sees live WhatsApp messages working, collect Milestone 2.
   * Total cash collected: **₹80,000**.
3. **Print Acrylic Stands with Milestone 2 Funds**:
   * Spend ₹3,500 to fabricate the 50 acrylic bedside QR stands.
4. **Collect Milestone 3 (₹20,000) at Full Handover**:
   * Deliver documentation and conduct staff training.
   * Final total collected: **₹1,00,000**.
   * Total hard expenses paid: **~₹14,500**.
   * **Net Take-Home Cash Profit: ₹85,500**.
