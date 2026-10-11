# CareOps AI — Enterprise Cloud Production Deployment Guide

This guide details how to deploy **CareOps AI** using the production-ready PaaS architecture:
- **Frontend**: [Vercel](https://vercel.com) (Next.js 16 + React 19)
- **Backend**: [Railway](https://railway.app) or [Render](https://render.com) (FastAPI + Persistent SLA Engine)
- **Database**: [PostgreSQL](https://railway.app) (Railway Postgres, [Neon](https://neon.tech), or [Supabase](https://supabase.com))

---

## Architecture Overview

```
[ Patients / QR Scanners / Hospital Staff / Admins ]
                         │
                         ▼ (HTTPS)
           +───────────────────────────+
           │       Vercel (Edge)       │
           │   CareOps Next.js 16 App  │
           +───────────────────────────+
                         │
                         ▼ REST API / JWT / WebSocket
           +───────────────────────────+
           │  Railway / Render Service │
           │   FastAPI Backend (Py3.11)│
           │   * Persistent SLA Loop   │
           │   * AI Vision Diagnostics │
           +───────────────────────────+
                 │               │
                 ▼               ▼
      +────────────────────+  +────────────────────+
      │   PostgreSQL DB    │  │  Persistent Disk   │
      │ (Railway/Neon/Supa)│  │ (/app/uploads)     │
      +────────────────────+  +────────────────────+
```

---

## Phase 1: Provision the PostgreSQL Database (2 minutes)

Choose one of the following free/starter options:

### Option A: Railway PostgreSQL (Easiest — Backend & DB together)
1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Provision PostgreSQL**.
3. Once created, click on the **Postgres** card → **Variables** tab.
4. Copy the `DATABASE_URL` (e.g., `postgresql://postgres:password@junction.proxy.rlwy.net:54321/railway`).

### Option B: Neon Serverless Postgres (Generous free tier)
1. Sign up at [neon.tech](https://neon.tech) and create a project `careops-ai`.
2. Copy the Connection String URI (`postgresql://neondb_owner:***@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`).

---

## Phase 2: Deploy Backend to Railway or Render (3 minutes)

### Option A: Deploy Backend to Railway
1. Push your repository to GitHub (or use the Railway CLI).
2. In your Railway project, click **+ New** → **GitHub Repo** → select your `careops-ai` repository.
3. In the service settings:
   - **Root Directory**: `backend`
   - **Build Command**: Uses included `backend/Dockerfile` or automatic Python detection.
4. Go to **Variables** tab and add:
   - `DATABASE_URL`: *(paste the Postgres connection URL from Phase 1)*
   - `SECRET_KEY`: *(generate any strong random string, e.g. `careops_prod_sec_key_2026_99x`)*
   - `PORT`: `8000`
5. Go to **Settings** → **Networking** → Click **Generate Domain**.
   - Your backend URL will be: `https://careops-backend-production-xxxx.up.railway.app`
6. Verify deployment by visiting `https://your-backend-url.up.railway.app/api/health`. You will receive:
   ```json
   {"status":"healthy","service":"CareOps AI Backend","version":"1.0.0"}
   ```
   *(Note: The database tables and initial hospital seed data are automatically provisioned on the very first start!)*

### Option B: Deploy Backend to Render
1. Go to [render.com](https://render.com) → **New** → **Blueprint**.
2. Connect your repository. Render will automatically detect [`render.yaml`](./render.yaml) at the repository root and provision both the PostgreSQL database and FastAPI web service automatically.
3. Or manually create a **Web Service**:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**: Add `DATABASE_URL` and `SECRET_KEY`.

---

## Phase 3: Deploy Frontend to Vercel (2 minutes)

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New...** → **Project** and import your `careops-ai` repository.
3. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click `Edit` and select `frontend`
4. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-url.up.railway.app/api`
   - `NEXT_PUBLIC_BACKEND_URL`: `https://your-backend-url.up.railway.app`
5. Click **Deploy**.
6. In ~60 seconds, Vercel will assign your production domain: `https://careops-ai.vercel.app`.

---

## Phase 4: Production Verification

Open your Vercel URL in your browser:
1. **Three Portals Access Gateway**:
   - Test **Portal A (Patient QR Portal)**: Enter `/patient/qr/QR-ROOM-204` or click Launch Patient View.
   - Test **Portal B (Staff Workspace)**: Log in as Rajesh Sharma (Technician) or Nurse Priya.
   - Test **Portal C (Executive Command Center)**: Log in as Dr. Alistair Vance (Admin) or Vikramaditya Rao (Supervisor).
2. **Default Seed Credentials**:
   - **Administrator**: `admin@careops.hospital` / `password123`
   - **Maintenance Supervisor**: `supervisor.mnt@careops.hospital` / `password123`
   - **Lead Technician**: `technician.rajesh@careops.hospital` / `password123`
   - **Staff Nurse**: `nurse.priya@careops.hospital` / `password123`
3. **Verify Background SLA Worker**:
   - The FastAPI server runs the continuous background asyncio loop (`sla_background_worker`) every 15s to check resolution deadlines and escalate breached tickets.

---

## Alternative: Self-Hosted Single Server (Docker Compose)

To host both services and PostgreSQL on a single VPS (DigitalOcean, AWS EC2, Hetzner, Linode):

```bash
# Clone the repository on your server
git clone <your-repo-url>
cd careops-ai

# Start PostgreSQL, FastAPI Backend, and Next.js Frontend
docker compose up -d --build
```
Everything will be online with:
- **Frontend**: `http://your-server-ip:3000`
- **Backend API**: `http://your-server-ip:8000/api`
- **PostgreSQL**: `localhost:5432`
