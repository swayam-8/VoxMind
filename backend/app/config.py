"""VoxMind Application Configuration Modules.

Handles environment-driven settings across Development, Testing, and Production environments.
"""

import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file if present
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class BaseConfig:
    """Base configuration with shared defaults."""

    # Secret keys
    SECRET_KEY = os.getenv("SECRET_KEY", "voxmind-dev-secret-key-change-in-production-min32chars")
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY", "voxmind-jwt-secret-key-change-in-production-min32chars"
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "60"))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30"))
    )

    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://voxmind_user:voxmind_password@localhost:5432/voxmind_db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # Queue & Cache
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
    CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() in (
        "true",
        "1",
        "yes",
    )
    CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "1800"))
    CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "1500"))
    CELERY_WORKER_CONCURRENCY = int(os.getenv("CELERY_WORKER_CONCURRENCY", "2"))
    CELERY_WORKER_PREFETCH_MULTIPLIER = int(os.getenv("CELERY_WORKER_PREFETCH_MULTIPLIER", "1"))

    # Local AI Services
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
    OLLAMA_TIMEOUT_SECONDS = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
    OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
    AI_MAX_TRANSCRIPT_CHARS = int(os.getenv("AI_MAX_TRANSCRIPT_CHARS", "32000"))
    AI_MAX_OUTPUT_TOKENS = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "2048"))
    AI_PROMPT_VERSION = os.getenv("AI_PROMPT_VERSION", "v1")
    WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
    WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    # Storage Paths & Upload limits
    STORAGE_PATH = Path(os.getenv("STORAGE_PATH", str(BASE_DIR / "storage")))
    UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "storage" / "uploads")))
    MAX_CONTENT_LENGTH = int(
        os.getenv("MAX_CONTENT_LENGTH", str(100 * 1024 * 1024))
    )  # 100 MB default
    ALLOWED_AUDIO_EXTENSIONS = {"mp3", "wav", "m4a", "webm", "ogg", "flac"}

    # CORS
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]


class DevelopmentConfig(BaseConfig):
    """Development configuration."""

    DEBUG = True
    TESTING = False


class TestingConfig(BaseConfig):
    """Testing configuration with SQLite in-memory and synchronous execution."""

    DEBUG = False
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    CELERY_TASK_ALWAYS_EAGER = True
    WTF_CSRF_ENABLED = False


class ProductionConfig(BaseConfig):
    """Production configuration with strict checks."""

    DEBUG = False
    TESTING = False

    @classmethod
    def validate(cls):
        """Validate production configuration to prevent insecure deployments."""
        if "voxmind-dev-secret-key" in cls.SECRET_KEY:
            raise ValueError("SECRET_KEY must be overridden with a secure key in production.")
        if "voxmind-jwt-secret-key" in cls.JWT_SECRET_KEY:
            raise ValueError("JWT_SECRET_KEY must be overridden with a secure key in production.")


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}


def get_config(config_name=None):
    """Resolve configuration by environment name."""
    if not config_name:
        config_name = os.getenv("FLASK_ENV", "development").lower()
    return config_by_name.get(config_name, DevelopmentConfig)
