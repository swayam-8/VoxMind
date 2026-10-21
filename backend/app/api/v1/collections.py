"""Workspace Collections REST API endpoints (/api/v1/collections)."""

import uuid
from typing import List
from flask import Blueprint, request
from app.extensions import db
from app.models.collection import Collection
from app.models.recording import Recording
from app.utils.auth import require_auth
from app.utils.response import api_success, api_error
from flask import g

collections_bp = Blueprint("collections", __name__, url_prefix="/collections")


@collections_bp.route("", methods=["GET"])
@require_auth
def list_collections():
    """List all collections scoped strictly to the authenticated workspace."""
    workspace = g.workspace

    collections = (
        db.session.query(Collection)
        .filter(Collection.workspace_id == workspace.id)
        .order_by(Collection.name.asc())
        .all()
    )

    return api_success(
        data=[col.to_dict() for col in collections],
        message=f"Retrieved {len(collections)} collections",
    )


@collections_bp.route("", methods=["POST"])
@require_auth
def create_collection():
    """Create a new collection within the authenticated workspace."""
    workspace = g.workspace

    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()

    if not name:
        return api_error("Collection name is required", code="VALIDATION_ERROR", status_code=400)

    if len(name) > 120:
        return api_error(
            "Collection name exceeds 120 characters", code="VALIDATION_ERROR", status_code=400
        )

    description = payload.get("description", "").strip() or None
    color = payload.get("color", "#8B5CF6").strip()

    # Verify name uniqueness within workspace
    existing = (
        db.session.query(Collection)
        .filter(Collection.workspace_id == workspace.id, Collection.name == name)
        .first()
    )
    if existing:
        return api_error(
            f"Collection named '{name}' already exists in this workspace",
            code="CONFLICT",
            status_code=409,
        )

    collection = Collection(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        name=name,
        description=description,
        color=color,
    )
    db.session.add(collection)
    db.session.commit()

    return api_success(
        data=collection.to_dict(),
        message="Collection created successfully",
        status_code=201,
    )


@collections_bp.route("/<uuid:collection_id>", methods=["GET"])
@require_auth
def get_collection(collection_id: uuid.UUID):
    """Retrieve collection details along with its member recordings."""
    workspace = g.workspace

    collection = (
        db.session.query(Collection)
        .filter(Collection.id == collection_id, Collection.workspace_id == workspace.id)
        .first()
    )
    if not collection:
        return api_error("Collection not found", code="NOT_FOUND", status_code=404)

    recordings = (
        db.session.query(Recording)
        .filter(Recording.collection_id == collection.id, Recording.workspace_id == workspace.id)
        .order_by(Recording.created_at.desc())
        .all()
    )

    data = collection.to_dict()
    data["recordings"] = [rec.to_dict() for rec in recordings]

    return api_success(data=data, message="Collection retrieved successfully")


@collections_bp.route("/<uuid:collection_id>", methods=["PATCH"])
@require_auth
def update_collection(collection_id: uuid.UUID):
    """Update collection metadata (name, description, color)."""
    workspace = g.workspace

    collection = (
        db.session.query(Collection)
        .filter(Collection.id == collection_id, Collection.workspace_id == workspace.id)
        .first()
    )
    if not collection:
        return api_error("Collection not found", code="NOT_FOUND", status_code=404)

    payload = request.get_json(silent=True) or {}

    if "name" in payload:
        name = str(payload["name"]).strip()
        if not name:
            return api_error(
                "Collection name cannot be empty", code="VALIDATION_ERROR", status_code=400
            )
        # Check duplicate name
        existing = (
            db.session.query(Collection)
            .filter(
                Collection.workspace_id == workspace.id,
                Collection.name == name,
                Collection.id != collection.id,
            )
            .first()
        )
        if existing:
            return api_error(
                "Another collection with this name already exists", code="CONFLICT", status_code=409
            )
        collection.name = name

    if "description" in payload:
        collection.description = str(payload["description"]).strip() or None

    if "color" in payload:
        collection.color = str(payload["color"]).strip() or "#8B5CF6"

    db.session.commit()
    return api_success(data=collection.to_dict(), message="Collection updated successfully")


@collections_bp.route("/<uuid:collection_id>", methods=["DELETE"])
@require_auth
def delete_collection(collection_id: uuid.UUID):
    """Delete a collection. Associated recordings are unassigned, not deleted."""
    workspace = g.workspace

    collection = (
        db.session.query(Collection)
        .filter(Collection.id == collection_id, Collection.workspace_id == workspace.id)
        .first()
    )
    if not collection:
        return api_error("Collection not found", code="NOT_FOUND", status_code=404)

    # Unlink any recordings in this workspace
    db.session.query(Recording).filter(
        Recording.collection_id == collection.id, Recording.workspace_id == workspace.id
    ).update({"collection_id": None})

    db.session.delete(collection)
    db.session.commit()

    return api_success(data={"id": str(collection_id)}, message="Collection deleted successfully")


@collections_bp.route("/<uuid:collection_id>/recordings", methods=["POST"])
@require_auth
def add_recordings_to_collection(collection_id: uuid.UUID):
    """Assign one or more recordings to this collection."""
    workspace = g.workspace

    collection = (
        db.session.query(Collection)
        .filter(Collection.id == collection_id, Collection.workspace_id == workspace.id)
        .first()
    )
    if not collection:
        return api_error("Collection not found", code="NOT_FOUND", status_code=404)

    payload = request.get_json(silent=True) or {}
    recording_ids_raw: List[str] = payload.get("recording_ids", [])
    if not recording_ids_raw:
        return api_error("recording_ids list is required", code="VALIDATION_ERROR", status_code=400)

    parsed_uuids = []
    for r_id in recording_ids_raw:
        try:
            parsed_uuids.append(uuid.UUID(str(r_id)))
        except ValueError:
            pass

    updated_count = (
        db.session.query(Recording)
        .filter(
            Recording.id.in_(parsed_uuids),
            Recording.workspace_id == workspace.id,
        )
        .update({"collection_id": collection.id}, synchronize_session="fetch")
    )
    db.session.commit()

    return api_success(
        data={"collection_id": str(collection.id), "assigned_count": updated_count},
        message=f"Assigned {updated_count} recording(s) to '{collection.name}'",
    )


@collections_bp.route("/<uuid:collection_id>/recordings/<uuid:recording_id>", methods=["DELETE"])
@require_auth
def remove_recording_from_collection(collection_id: uuid.UUID, recording_id: uuid.UUID):
    """Remove a single recording from this collection."""
    workspace = g.workspace

    recording = (
        db.session.query(Recording)
        .filter(
            Recording.id == recording_id,
            Recording.collection_id == collection_id,
            Recording.workspace_id == workspace.id,
        )
        .first()
    )
    if not recording:
        return api_error(
            "Recording not found in this collection", code="NOT_FOUND", status_code=404
        )

    recording.collection_id = None
    db.session.commit()

    return api_success(
        data={"recording_id": str(recording_id), "collection_id": str(collection_id)},
        message="Recording removed from collection",
    )
