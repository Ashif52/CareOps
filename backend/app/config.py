import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "CareOps AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "careops_ai_enterprise_super_secret_key_2026_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database: SQLite by default for zero-setup local execution, PostgreSQL supported via env
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{BASE_DIR}/careops.db"
    )
    
    # Private media storage directory
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50MB
    
    # Background SLA loop check frequency (seconds)
    SLA_CHECK_INTERVAL_SECONDS: int = 15
    
    # AI Engine simulation / verification parameters
    AI_MODEL_VERSION: str = "careops-vision-v2.4"
    AI_AUTO_CONFIRM_THRESHOLD: float = 0.85
    AI_INCONCLUSIVE_THRESHOLD: float = 0.55
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "*"
    ]

    # Google Business Profile & Reviews Module
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/settings/integrations/google/callback")
    GOOGLE_PUBSUB_TOPIC: str = os.getenv("GOOGLE_PUBSUB_TOPIC", "")
    GOOGLE_PUBSUB_VERIFICATION_TOKEN: str = os.getenv("GOOGLE_PUBSUB_VERIFICATION_TOKEN", "careops_pubsub_verify_2026")
    REVIEW_RETENTION_DAYS: int = 90  # Official Google API data retention compliance limit
    REVIEW_ALERT_STAR_THRESHOLD: int = 3  # Strictly below 3 stars (< 3): 1 star (critical), 2 star (high)
    REVIEW_SYNC_INTERVAL_MINUTES: int = 15
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # SMTPS & Maintenance Department Escalation Dispatch
    WORK_EMAIL: str = os.getenv("WORK_EMAIL", "")  # Work email configured for operational escalations
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))  # 465 for SMTPS SSL, 587 for STARTTLS
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "alerts@careops.hospital")
    SMTP_USE_SSL: bool = os.getenv("SMTP_USE_SSL", "true").lower() in ("true", "1", "yes")
    MAINTENANCE_DEPARTMENT_EMAIL: str = os.getenv("MAINTENANCE_DEPARTMENT_EMAIL", "maintenance@careops.hospital")
    MAINTENANCE_DEPARTMENT_MOBILE: str = os.getenv("MAINTENANCE_DEPARTMENT_MOBILE", "+91 98765 00003")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
