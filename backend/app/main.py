import asyncio
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import engine, Base
from app.seed import seed_database
from app.services.sla_engine import SLAEngine

# Routers
from app.routers import (
    auth, patient, tickets, evidence, ai_verify,
    departments, rooms, sla, analytics, audit, staff, system, google_reviews, nps
)
from app.migrations import run_migrations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("careops.main")

async def sla_background_worker():
    """Background persistent worker that scans tickets and triggers SLA escalation & reminders"""
    logger.info("CareOps Persistent SLA Engine initialized.")
    while True:
        try:
            SLAEngine.run_sla_check_cycle()
        except Exception as e:
            logger.error(f"SLA background monitor exception: {e}")
        await asyncio.sleep(settings.SLA_CHECK_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist, apply schema migrations & seed DB if fresh
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Base.metadata.create_all notice: {e}")
    try:
        run_migrations()
        logger.info("Database migrations executed successfully.")
    except Exception as e:
        logger.error(f"Database migrations error: {e}", exc_info=True)
    try:
        seed_database()
        logger.info("Database seeding checked/executed successfully.")
    except Exception as e:
        logger.error(f"Auto-seeding error: {e}", exc_info=True)
        
    # Start persistent SLA ticker
    worker_task = asyncio.create_task(sla_background_worker())
    yield
    # Shutdown
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    logger.info("CareOps backend shutdown cleanly.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise AI-Powered Hospital Service Request, SLA Monitoring & Verification Platform",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount private media uploads directory
uploads_path = Path(settings.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# Include Routers under API_V1_STR
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(patient.router, prefix=settings.API_V1_STR)
app.include_router(tickets.router, prefix=settings.API_V1_STR)
app.include_router(evidence.router, prefix=settings.API_V1_STR)
app.include_router(ai_verify.router, prefix=settings.API_V1_STR)
app.include_router(departments.router, prefix=settings.API_V1_STR)
app.include_router(rooms.router, prefix=settings.API_V1_STR)
app.include_router(sla.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(staff.router, prefix=settings.API_V1_STR)
app.include_router(system.router, prefix=settings.API_V1_STR)
app.include_router(google_reviews.router, prefix=settings.API_V1_STR)
app.include_router(google_reviews.integrations_router, prefix=settings.API_V1_STR)
app.include_router(nps.router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check(heal: bool = False):
    migration_res = "skipped"
    if heal:
        try:
            run_migrations()
            seed_database()
            migration_res = "success"
        except Exception as e:
            migration_res = f"failed: {e}"
    return {
        "status": "healthy",
        "service": "CareOps AI Backend",
        "version": settings.VERSION,
        "migration": migration_res,
        "engine": "FastAPI + SQLAlchemy + Asyncio SLA Engine + Computer Vision Analyzer"
    }
