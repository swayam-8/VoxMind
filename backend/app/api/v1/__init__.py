"""VoxMind API Version 1 Blueprint.

All version 1 endpoints are registered under the `/api/v1` prefix.
"""

from flask import Blueprint
from app.api.v1.health import health_bp
from app.api.v1.docs import docs_bp
from app.api.v1.recordings import recordings_bp
from app.api.v1.jobs import jobs_bp

api_v1 = Blueprint("api_v1", __name__, url_prefix="/api/v1")

# Register sub-blueprints
api_v1.register_blueprint(health_bp)
api_v1.register_blueprint(docs_bp)
api_v1.register_blueprint(recordings_bp)
api_v1.register_blueprint(jobs_bp)
