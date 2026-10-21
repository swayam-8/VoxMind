"""Tests for Phase 7: Workspace Collections, Developer API Keys, Usage, and Diagnostics."""

import uuid
from flask.testing import FlaskClient
from app.extensions import db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
from app.models.recording import Recording
from app.models.collection import Collection
from app.services.usage_service import UsageService
from app.utils.auth import generate_jwt_token


def test_collections_crud(client: FlaskClient):
    """Test full CRUD lifecycle of collections."""
    # 1. Create collection
    res = client.post(
        "/api/v1/collections",
        json={
            "name": "Executive Strategy",
            "description": "High level strategy syncs",
            "color": "#10B981",
        },
    )
    assert res.status_code == 201
    col_data = res.get_json()["data"]
    assert col_data["name"] == "Executive Strategy"
    assert col_data["color"] == "#10B981"
    col_id = col_data["id"]

    # 2. List collections
    list_res = client.get("/api/v1/collections")
    assert list_res.status_code == 200
    items = list_res.get_json()["data"]
    assert any(c["id"] == col_id for c in items)

    # 3. Get single collection
    get_res = client.get(f"/api/v1/collections/{col_id}")
    assert get_res.status_code == 200
    assert get_res.get_json()["data"]["name"] == "Executive Strategy"

    # 4. Patch collection
    patch_res = client.patch(
        f"/api/v1/collections/{col_id}",
        json={"name": "Updated Strategy", "color": "#3B82F6"},
    )
    assert patch_res.status_code == 200
    assert patch_res.get_json()["data"]["name"] == "Updated Strategy"
    assert patch_res.get_json()["data"]["color"] == "#3B82F6"

    # 5. Delete collection
    del_res = client.delete(f"/api/v1/collections/{col_id}")
    assert del_res.status_code == 200

    # 6. Verify 404 after delete
    get_deleted = client.get(f"/api/v1/collections/{col_id}")
    assert get_deleted.status_code == 404


def test_collections_recording_assignment(client: FlaskClient):
    """Test assigning and unassigning recordings to a collection."""
    # Create collection
    col_res = client.post("/api/v1/collections", json={"name": "Sprint Retros"})
    assert col_res.status_code == 201
    col_id = col_res.get_json()["data"]["id"]

    # Create dummy recording
    col = db.session.query(Collection).filter_by(id=uuid.UUID(col_id)).first()
    rec = Recording(
        id=uuid.uuid4(),
        workspace_id=col.workspace_id,
        user_id=col.workspace.created_by_user_id,
        title="Retro Q1",
        filename="retro_q1.mp3",
        storage_path="/tmp/retro.mp3",
        file_size_bytes=1024,
        duration_seconds=120.0,
        mime_type="audio/mp3",
        status="ready",
    )
    db.session.add(rec)
    db.session.commit()

    # Assign recording to collection
    assign_res = client.post(
        f"/api/v1/collections/{col_id}/recordings",
        json={"recording_ids": [str(rec.id)]},
    )
    assert assign_res.status_code == 200
    assert assign_res.get_json()["data"]["assigned_count"] == 1

    # Verify collection detail lists this recording
    get_col = client.get(f"/api/v1/collections/{col_id}")
    assert get_col.status_code == 200
    recs = get_col.get_json()["data"]["recordings"]
    assert len(recs) == 1
    assert recs[0]["id"] == str(rec.id)

    # Test PATCH /recordings/:id directly to update collection or title
    patch_rec = client.patch(
        f"/api/v1/recordings/{rec.id}",
        json={"title": "Retro Q1 Renamed", "collection_id": None},
    )
    assert patch_rec.status_code == 200
    assert patch_rec.get_json()["data"]["title"] == "Retro Q1 Renamed"
    assert patch_rec.get_json()["data"]["collection_id"] is None


def test_collections_tenant_isolation(client: FlaskClient):
    """Ensure collections in one workspace cannot be accessed by another workspace."""
    # Workspace A collection
    col_a = client.post("/api/v1/collections", json={"name": "Workspace A Secret Project"})
    assert col_a.status_code == 201
    col_a_id = col_a.get_json()["data"]["id"]

    # Create Workspace B and User B
    user_b = User(
        email="tenant_b@voxmind.internal",
        full_name="Tenant B User",
        is_active=True,
    )
    user_b.set_password("SecurePass123!")
    db.session.add(user_b)
    db.session.flush()

    ws_b = Workspace(
        name="Workspace B",
        slug="workspace-b",
        created_by_user_id=user_b.id,
    )
    db.session.add(ws_b)
    db.session.flush()

    membership_b = WorkspaceMembership(
        workspace_id=ws_b.id,
        user_id=user_b.id,
        role="owner",
    )
    db.session.add(membership_b)
    db.session.commit()

    # Generate JWT for User B in Workspace B
    token_b = generate_jwt_token(user_b.id, ws_b.id)

    # User B tries to access Workspace A's collection -> 404 NOT_FOUND
    res_b = client.get(
        f"/api/v1/collections/{col_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 404


def test_api_keys_lifecycle_and_dual_auth(client: FlaskClient):
    """Test generating API key, authenticating with it, and revoking it."""
    # 1. Generate key
    res = client.post("/api/v1/api-keys", json={"name": "CLI Integration Key"})
    assert res.status_code == 201
    data = res.get_json()["data"]
    raw_key = data.get("raw_key")
    key_id = data.get("id")

    assert raw_key.startswith("vm_live_")
    assert "key_hash" not in data  # secret hash must never leak

    # 2. List keys
    list_res = client.get("/api/v1/api-keys")
    assert list_res.status_code == 200
    assert any(k["id"] == key_id for k in list_res.get_json()["data"])

    # 3. Authenticate with this API key via Authorization: Bearer
    authed_res = client.get(
        "/api/v1/collections",
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert authed_res.status_code == 200

    # 4. Authenticate with this API key via X-API-Key header
    authed_x_res = client.get(
        "/api/v1/collections",
        headers={"X-API-Key": raw_key},
    )
    assert authed_x_res.status_code == 200

    # 5. Revoke key
    revoke_res = client.delete(f"/api/v1/api-keys/{key_id}")
    assert revoke_res.status_code == 200
    assert revoke_res.get_json()["data"]["is_revoked"] is True

    # 6. Authenticate with revoked key -> 401 Unauthorized
    failed_res = client.get(
        "/api/v1/collections",
        headers={"X-API-Key": raw_key},
    )
    assert failed_res.status_code == 401


def test_usage_service_and_metrics_endpoint(client: FlaskClient):
    """Test AI token and audio usage recording and aggregated metrics endpoint."""
    ws = db.session.query(Workspace).first()

    # Record some usage events
    UsageService.record_usage(
        workspace_id=ws.id,
        endpoint="/api/v1/jobs/transcribe",
        method="BACKGROUND",
        resource_type="transcription",
        model_name="whisper-base",
        duration_seconds=360.0,
    )
    UsageService.record_usage(
        workspace_id=ws.id,
        endpoint="/api/v1/recordings/analysis",
        method="BACKGROUND",
        resource_type="summary",
        model_name="llama3.2",
        prompt_tokens=450,
        completion_tokens=220,
    )

    # Query metrics endpoint
    res = client.get("/api/v1/usage")
    assert res.status_code == 200
    usage_data = res.get_json()["data"]

    assert usage_data["total_audio_seconds"] >= 360.0
    assert usage_data["prompt_tokens"] >= 450
    assert usage_data["completion_tokens"] >= 220
    assert usage_data["total_tokens"] >= 670
    assert "transcription" in usage_data["by_resource_type"]
    assert "summary" in usage_data["by_resource_type"]
    assert "llama3.2" in usage_data["by_model"]
    assert len(usage_data["recent_records"]) >= 2


def test_diagnostics_endpoint(client: FlaskClient):
    """Test deep system diagnostics endpoint /api/v1/diagnostics."""
    res = client.get("/api/v1/diagnostics")
    assert res.status_code in (200, 503)
    data = res.get_json()["data"]

    assert "services" in data
    services = data["services"]
    assert "database" in services
    assert "redis" in services
    assert "celery" in services
    assert "ollama" in services
    assert "whisper" in services
    assert "embedding" in services
    assert "vector_storage" in services
    assert "storage" in services
    assert services["database"]["status"] == "healthy"
    assert services["embedding"]["model"] is not None
