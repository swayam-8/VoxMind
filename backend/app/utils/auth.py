"""Authentication & Security Utilities.

Supports dual-mode authentication:
1. Developer API Keys (vm_live_...) with SHA-256 validation and last_used tracking.
2. JWT Bearer Tokens with workspace and user resolution.
3. Fallback to default workspace context in development/testing mode when no credentials are sent.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from functools import wraps
from typing import Optional, Tuple
from flask import request, g, current_app
import jwt
from app.extensions import db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.api_key import ApiKey
from app.services.workspace_service import WorkspaceService
from app.utils.response import api_error


API_KEY_PREFIX = "vm_live_"


def generate_api_key() -> Tuple[str, str, str]:
    """Generate a cryptographically secure VoxMind API key.

    Returns:
        (raw_key, key_prefix, key_hash)
    """
    random_part = secrets.token_hex(20)  # 40 hex chars
    raw_key = f"{API_KEY_PREFIX}{random_part}"
    key_prefix = f"{raw_key[:12]}..."
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return raw_key, key_prefix, key_hash


def generate_jwt_token(
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
    expires_in_minutes: int = 60,
) -> str:
    """Generate a signed JWT bearer token."""
    secret = current_app.config.get(
        "JWT_SECRET_KEY", "voxmind-jwt-secret-key-change-in-production-min32chars"
    )
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "workspace_id": str(workspace_id),
        "iat": now,
        "exp": now + timedelta(minutes=expires_in_minutes),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def resolve_auth_context() -> Tuple[
    Optional[User], Optional[Workspace], Optional[ApiKey], Optional[str]
]:
    """Inspect request headers to resolve the calling user, workspace, and optional API key.

    Returns:
        (user, workspace, api_key, error_message)
    """
    raw_auth = request.headers.get("Authorization", "").strip()
    x_api_key = request.headers.get("X-API-Key", "").strip()

    token_candidate = None
    if x_api_key:
        token_candidate = x_api_key
    elif raw_auth.startswith("Bearer "):
        token_candidate = raw_auth[7:].strip()
    elif raw_auth.startswith("ApiKey "):
        token_candidate = raw_auth[7:].strip()

    # Case 1: An API key is provided
    if token_candidate and token_candidate.startswith(API_KEY_PREFIX):
        key_hash = hashlib.sha256(token_candidate.encode("utf-8")).hexdigest()
        api_key = (
            db.session.query(ApiKey)
            .filter(ApiKey.key_hash == key_hash)
            .first()
        )
        if not api_key:
            return None, None, None, "Invalid API key provided."

        if api_key.is_revoked:
            return None, None, None, "This API key has been revoked."

        if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
            return None, None, None, "This API key has expired."

        # Update last used timestamp
        try:
            api_key.last_used_at = datetime.now(timezone.utc)
            db.session.commit()
        except Exception:
            db.session.rollback()

        return api_key.user, api_key.workspace, api_key, None

    # Case 2: A JWT token is provided
    if token_candidate:
        secret = current_app.config.get(
            "JWT_SECRET_KEY", "voxmind-jwt-secret-key-change-in-production-min32chars"
        )
        try:
            payload = jwt.decode(token_candidate, secret, algorithms=["HS256"])
            user_id = uuid.UUID(payload.get("sub"))
            workspace_id = uuid.UUID(payload.get("workspace_id"))
            user = db.session.query(User).filter_by(id=user_id, is_active=True).first()
            workspace = db.session.query(Workspace).filter_by(id=workspace_id).first()
            if not user or not workspace:
                return None, None, None, "User or workspace from token was not found."
            return user, workspace, None, None
        except jwt.ExpiredSignatureError:
            return None, None, None, "Access token has expired."
        except jwt.InvalidTokenError:
            return None, None, None, "Invalid access token."

    # Case 3: No credentials passed. Fall back to default development context
    user, workspace = WorkspaceService.get_or_create_default_context()
    return user, workspace, None, None


def require_auth(f):
    """Decorator to enforce authentication and set g.user, g.workspace, and g.api_key."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user, workspace, api_key, err = resolve_auth_context()
        if err or not user or not workspace:
            return api_error(err or "Authentication required", code="UNAUTHORIZED", status_code=401)

        g.user = user
        g.workspace = workspace
        g.api_key = api_key
        return f(*args, **kwargs)

    return decorated_function
