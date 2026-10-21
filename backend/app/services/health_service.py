"""System Health & Diagnostics Service.

Performs authentic, non-simulated connectivity tests across:
- Database (PostgreSQL / SQLite)
- Cache & Queue (Redis / Celery)
- Local LLM Runtime (Ollama)
- Speech Transcription Engine (faster-whisper)
- Local File Storage
"""

import time
import shutil
import urllib.request
import urllib.error
import json
from typing import Dict, Any
from flask import current_app
from sqlalchemy import text
from app.extensions import db


class HealthService:
    """Service to evaluate live infrastructure health without falsified metrics."""

    @staticmethod
    def check_database() -> Dict[str, Any]:
        """Check primary database connectivity and measure query latency."""
        start = time.perf_counter()
        try:
            db.session.execute(text("SELECT 1"))
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "status": "healthy",
                "latency_ms": latency_ms,
                "message": "Database query executed successfully",
            }
        except Exception as exc:
            return {
                "status": "unreachable",
                "message": f"Database connection failed: {str(exc)}",
            }

    @staticmethod
    def check_redis() -> Dict[str, Any]:
        """Check Redis broker / cache connectivity."""
        redis_url = current_app.config.get("REDIS_URL")
        if not redis_url:
            return {"status": "unconfigured", "message": "REDIS_URL is not configured"}

        start = time.perf_counter()
        try:
            import redis

            r = redis.from_url(redis_url, socket_connect_timeout=1.5)
            r.ping()
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "status": "healthy",
                "latency_ms": latency_ms,
                "message": "Redis ping succeeded",
            }
        except Exception as exc:
            return {
                "status": "unreachable",
                "message": f"Redis ping failed: {str(exc)}",
            }

    @staticmethod
    def check_ollama() -> Dict[str, Any]:
        """Check Ollama API endpoint and available downloaded models."""
        base_url = current_app.config.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        tags_url = f"{base_url}/api/tags"
        configured_model = current_app.config.get("OLLAMA_MODEL", "llama3.2")

        start = time.perf_counter()
        try:
            req = urllib.request.Request(tags_url, headers={"User-Agent": "VoxMind-HealthCheck"})
            with urllib.request.urlopen(req, timeout=2.0) as response:
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    models = [m.get("name") for m in data.get("models", [])]
                    model_found = any(configured_model in m for m in models)
                    return {
                        "status": "healthy" if model_found else "degraded",
                        "latency_ms": latency_ms,
                        "base_url": base_url,
                        "configured_model": configured_model,
                        "model_available": model_found,
                        "downloaded_models": models,
                        "message": (
                            f"Ollama running with model '{configured_model}'"
                            if model_found
                            else f"Ollama model '{configured_model}' is not pulled"
                        ),
                    }
        except urllib.error.URLError as exc:
            return {
                "status": "unreachable",
                "base_url": base_url,
                "message": f"Ollama service unreachable at {base_url}: {exc.reason}",
            }
        except Exception as exc:
            return {
                "status": "unreachable",
                "base_url": base_url,
                "message": f"Ollama health check error: {str(exc)}",
            }

    @staticmethod
    def check_whisper() -> Dict[str, Any]:
        """Check faster-whisper library and model runtime configuration."""
        configured_model = current_app.config.get("WHISPER_MODEL", "base")
        device = current_app.config.get("WHISPER_DEVICE", "cpu")
        compute_type = current_app.config.get("WHISPER_COMPUTE_TYPE", "int8")

        try:
            import faster_whisper  # noqa: F401

            whisper_installed = True
        except ImportError:
            whisper_installed = False

        try:
            import av  # noqa: F401
            av_installed = True
        except ImportError:
            av_installed = False

        ffmpeg_installed = shutil.which("ffmpeg") is not None or av_installed

        if whisper_installed and ffmpeg_installed:
            status = "healthy"
            msg = (
                f"faster-whisper and ffmpeg available (model: {configured_model}, device: {device})"
            )
        elif whisper_installed and not ffmpeg_installed:
            status = "degraded"
            msg = "faster-whisper installed, but ffmpeg is missing from PATH"
        else:
            status = "unconfigured"
            msg = "faster-whisper is not installed in the current environment"

        return {
            "status": status,
            "whisper_installed": whisper_installed,
            "ffmpeg_installed": ffmpeg_installed,
            "model": configured_model,
            "device": device,
            "compute_type": compute_type,
            "message": msg,
        }

    @staticmethod
    def check_storage() -> Dict[str, Any]:
        """Check storage path accessibility and available disk space."""
        upload_dir = current_app.config.get("UPLOAD_DIR")
        try:
            total, used, free = shutil.disk_usage(upload_dir)
            return {
                "status": "healthy",
                "path": str(upload_dir),
                "total_gb": round(total / (1024**3), 2),
                "used_gb": round(used / (1024**3), 2),
                "free_gb": round(free / (1024**3), 2),
            }
        except Exception as exc:
            return {
                "status": "degraded",
                "path": str(upload_dir),
                "message": f"Could not inspect storage usage: {str(exc)}",
            }

    @classmethod
    def get_full_diagnostics(cls) -> Dict[str, Any]:
        """Aggregate diagnostics across all system services."""
        db_health = cls.check_database()
        redis_health = cls.check_redis()
        ollama_health = cls.check_ollama()
        whisper_health = cls.check_whisper()
        storage_health = cls.check_storage()

        # Determine overall system status
        statuses = [
            db_health.get("status"),
            redis_health.get("status"),
            ollama_health.get("status"),
            whisper_health.get("status"),
        ]

        if all(s == "healthy" for s in statuses):
            overall = "healthy"
        elif any(s == "healthy" for s in statuses):
            overall = "degraded"
        else:
            overall = "unhealthy"

        return {
            "status": overall,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "environment": current_app.config.get("ENV", "development"),
            "services": {
                "database": db_health,
                "redis": redis_health,
                "ollama": ollama_health,
                "whisper": whisper_health,
                "storage": storage_health,
            },
        }
