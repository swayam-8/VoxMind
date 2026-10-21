"""AI Token and Resource Usage REST API endpoints (/api/v1/usage)."""

from flask import Blueprint, g
from app.services.usage_service import UsageService
from app.utils.auth import require_auth
from app.utils.response import api_success

usage_bp = Blueprint("usage", __name__, url_prefix="/usage")


@usage_bp.route("", methods=["GET"])
@require_auth
def get_usage_metrics():
    """Retrieve comprehensive AI token and operational resource usage for current workspace."""
    workspace = g.workspace
    summary = UsageService.get_workspace_usage_summary(workspace.id)

    return api_success(
        data=summary,
        message="Workspace usage metrics retrieved successfully",
    )
