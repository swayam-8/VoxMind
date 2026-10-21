"""Centralized API Error Handlers for VoxMind.

Ensures that errors return standard JSON responses and never expose raw internal stack traces.
"""

import logging
from flask import Flask
from werkzeug.exceptions import HTTPException
from app.utils.response import api_error

logger = logging.getLogger(__name__)


def register_error_handlers(app: Flask) -> None:
    """Register uniform error handlers for all standard HTTP and unhandled exceptions."""

    @app.errorhandler(400)
    def bad_request(error):
        msg = getattr(error, "description", "Bad Request")
        return api_error(message=msg, code="BAD_REQUEST", status_code=400)

    @app.errorhandler(401)
    def unauthorized(error):
        msg = getattr(error, "description", "Authentication required")
        return api_error(message=msg, code="UNAUTHORIZED", status_code=401)

    @app.errorhandler(403)
    def forbidden(error):
        msg = getattr(error, "description", "Forbidden access")
        return api_error(message=msg, code="FORBIDDEN", status_code=403)

    @app.errorhandler(404)
    def not_found(error):
        msg = getattr(error, "description", "Resource not found")
        return api_error(message=msg, code="NOT_FOUND", status_code=404)

    @app.errorhandler(405)
    def method_not_allowed(error):
        msg = getattr(error, "description", "Method not allowed")
        return api_error(message=msg, code="METHOD_NOT_ALLOWED", status_code=405)

    @app.errorhandler(413)
    def request_entity_too_large(error):
        max_bytes = app.config.get("MAX_CONTENT_LENGTH", 100 * 1024 * 1024)
        max_mb = round(max_bytes / (1024 * 1024))
        msg = f"Audio payload exceeds maximum upload size limit ({max_mb} MB)"
        return api_error(message=msg, code="PAYLOAD_TOO_LARGE", status_code=413)

    @app.errorhandler(422)
    def unprocessable_entity(error):
        msg = getattr(error, "description", "Unprocessable entity")
        return api_error(message=msg, code="VALIDATION_ERROR", status_code=422)

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return api_error(
            message=error.description,
            code=error.name.upper().replace(" ", "_"),
            status_code=error.code or 500,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error):
        logger.exception("Unhandled server exception: %s", error)
        # Never leak stack trace to user
        return api_error(
            message="An internal server error occurred. Please try again later.",
            code="INTERNAL_SERVER_ERROR",
            status_code=500,
        )
