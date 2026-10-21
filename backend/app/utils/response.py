"""Standardized API Response Envelopes.

Ensures every endpoint returns a consistent JSON contract:
{
    "success": true | false,
    "message": "Human readable status",
    "data": { ... } | null,
    "errors": { ... } | null,
    "meta": { ... } | null
}
"""

from typing import Any, Dict, Optional
from flask import jsonify, Response


def api_success(
    data: Any = None,
    message: str = "Success",
    meta: Optional[Dict[str, Any]] = None,
    status_code: int = 200,
) -> tuple[Response, int]:
    """Return a standardized JSON success response."""
    payload: Dict[str, Any] = {
        "success": True,
        "message": message,
        "data": data,
    }
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status_code


def api_error(
    message: str = "An error occurred",
    errors: Optional[Dict[str, Any]] = None,
    code: str = "ERROR",
    status_code: int = 400,
) -> tuple[Response, int]:
    """Return a standardized JSON error response."""
    payload: Dict[str, Any] = {
        "success": False,
        "message": message,
        "code": code,
        "errors": errors or {},
        "data": None,
    }
    return jsonify(payload), status_code
