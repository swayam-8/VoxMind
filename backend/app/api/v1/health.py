"""System Health and Readiness Endpoints (/api/v1/health, /api/v1/ready)."""

import os
from flask import Blueprint, current_app
from sqlalchemy import text
from app.extensions import db
from app.utils.response import api_success, api_error
from app.services.health_service import HealthService

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_ping():
    """Liveness probe for orchestrators and container healthchecks."""
    return api_success(
        data={
            "status": "healthy",
            "service": "VoxMind Voice Intelligence API",
            "version": "1.0.0",
        },
        message="VoxMind API is operational",
    )


@health_bp.route("/ready", methods=["GET"])
def readiness_check():
    """Readiness probe verifying database connectivity and storage volume availability."""
    checks = {}
    is_ready = True

    # 1. Check Primary Database
    try:
        db.session.execute(text("SELECT 1"))
        checks["database"] = {"status": "ready", "message": "Database is connected"}
    except Exception as exc:
        checks["database"] = {"status": "unreachable", "message": str(exc)}
        is_ready = False

    # 2. Check Storage Writable
    upload_dir = current_app.config.get("UPLOAD_DIR")
    try:
        if upload_dir and os.path.exists(upload_dir):
            test_file = os.path.join(upload_dir, ".healthcheck")
            with open(test_file, "w") as f:
                f.write("ok")
            os.remove(test_file)
            checks["storage"] = {"status": "ready", "path": str(upload_dir)}
        else:
            checks["storage"] = {"status": "degraded", "message": "Upload directory not found"}
            is_ready = False
    except Exception as exc:
        checks["storage"] = {"status": "unreachable", "message": str(exc)}
        is_ready = False

    if is_ready:
        return api_success(
            data={"status": "ready", "checks": checks},
            message="All critical services are ready to accept traffic",
            status_code=200,
        )
    else:
        return api_error(
            message="System is not ready to process traffic",
            errors=checks,
            code="SERVICE_UNAVAILABLE",
            status_code=503,
        )


@health_bp.route("/health/detailed", methods=["GET"])
@health_bp.route("/diagnostics", methods=["GET"])
def health_detailed():
    """Deep readiness and dependency diagnostics check."""
    diagnostics = HealthService.get_full_diagnostics()
    status_code = 200 if diagnostics["status"] in ("healthy", "degraded") else 503
    return api_success(
        data=diagnostics,
        message=f"System health evaluation: {diagnostics['status']}",
        status_code=status_code,
    )
