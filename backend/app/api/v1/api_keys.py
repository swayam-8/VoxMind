"""Developer API Keys Management REST API endpoints (/api/v1/api-keys)."""

import uuid
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, g
from app.extensions import db
from app.models.api_key import ApiKey
from app.utils.auth import require_auth, generate_api_key
from app.utils.response import api_success, api_error

api_keys_bp = Blueprint("api_keys", __name__, url_prefix="/api-keys")


@api_keys_bp.route("", methods=["GET"])
@require_auth
def list_api_keys():
    """List developer API keys for the current workspace."""
    workspace = g.workspace

    keys = (
        db.session.query(ApiKey)
        .filter(ApiKey.workspace_id == workspace.id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )

    return api_success(
        data=[k.to_dict() for k in keys],
        message=f"Retrieved {len(keys)} API keys",
    )


@api_keys_bp.route("", methods=["POST"])
@require_auth
def create_api_key():
    """Generate a new developer API key with SHA-256 hash storage."""
    workspace = g.workspace
    user = g.user

    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()

    if not name:
        return api_error("API key name is required", code="VALIDATION_ERROR", status_code=400)

    if len(name) > 120:
        return api_error(
            "API key name exceeds 120 characters", code="VALIDATION_ERROR", status_code=400
        )

    expires_days = payload.get("expires_days")
    expires_at = None
    if expires_days and isinstance(expires_days, (int, float)) and expires_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=int(expires_days))

    raw_key, key_prefix, key_hash = generate_api_key()

    api_key = ApiKey(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        user_id=user.id,
        name=name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.session.add(api_key)
    db.session.commit()

    resp_data = api_key.to_dict()
    # The unhashed raw key is only returned ONCE upon generation
    resp_data["raw_key"] = raw_key

    return api_success(
        data=resp_data,
        message="API key generated successfully. Save this secret key now.",
        status_code=201,
    )


@api_keys_bp.route("/<uuid:key_id>", methods=["DELETE"])
@require_auth
def revoke_api_key(key_id: uuid.UUID):
    """Revoke an API key immediately."""
    workspace = g.workspace

    key = (
        db.session.query(ApiKey)
        .filter(ApiKey.id == key_id, ApiKey.workspace_id == workspace.id)
        .first()
    )
    if not key:
        return api_error("API key not found", code="NOT_FOUND", status_code=404)

    key.is_revoked = True
    db.session.commit()

    return api_success(
        data={"id": str(key.id), "is_revoked": True},
        message=f"API key '{key.name}' was revoked successfully",
    )
