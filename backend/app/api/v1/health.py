"""System Health Endpoints for VoxMind (/api/v1/health)."""

from flask import Blueprint
from app.utils.response import api_success
from app.services.health_service import HealthService

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_ping():
    """Liveness probe for load balancers and container orchestrators."""
    return api_success(
        data={
            "status": "healthy",
            "service": "VoxMind Voice Intelligence API",
            "version": "1.0.0",
        },
        message="VoxMind API is operational",
    )


@health_bp.route("/health/detailed", methods=["GET"])
def health_detailed():
    """Deep readiness and dependency diagnostics check."""
    diagnostics = HealthService.get_full_diagnostics()
    status_code = 200 if diagnostics["status"] in ("healthy", "degraded") else 503
    return api_success(
        data=diagnostics,
        message=f"System health evaluation: {diagnostics['status']}",
        status_code=status_code,
    )
