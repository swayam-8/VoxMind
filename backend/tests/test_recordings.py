"""Integration tests for Recordings REST API endpoints."""

import io
import uuid


def test_list_recordings_initially(client):
    """Test listing recordings returns an array with pagination metadata."""
    response = client.get("/api/v1/recordings")
    assert response.status_code == 200

    data = response.get_json()
    assert data["success"] is True
    assert isinstance(data["data"], list)
    assert "meta" in data
    assert data["meta"]["page"] == 1


def test_upload_recording_success(client):
    """Test successful multipart audio upload."""
    audio_content = (
        b"ID3\x03\x00\x00\x00\x00\x00#TSSE\x00\x00\x00\x0f\x00\x00\x01\xff\xfe"
        b"L\x00a\x00v\x00f\x006\x000\x00"
    )
    data = {
        "file": (io.BytesIO(audio_content), "weekly_sync_sample.mp3"),
        "title": "Weekly Platform Sync",
    }

    response = client.post(
        "/api/v1/recordings",
        data=data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 201

    payload = response.get_json()
    assert payload["success"] is True
    assert payload["data"]["title"] == "Weekly Platform Sync"
    assert payload["data"]["status"] == "queued"
    assert "id" in payload["data"]

    # Verify item is retrieved in details endpoint
    rec_id = payload["data"]["id"]
    detail_res = client.get(f"/api/v1/recordings/{rec_id}")
    assert detail_res.status_code == 200
    assert detail_res.get_json()["data"]["id"] == rec_id


def test_upload_missing_file(client):
    """Test upload fails gracefully when file part is omitted."""
    response = client.post(
        "/api/v1/recordings",
        data={"title": "No File Provided"},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400

    payload = response.get_json()
    assert payload["success"] is False
    assert payload["code"] == "MISSING_FILE"


def test_upload_invalid_format(client):
    """Test upload rejects unsupported extensions like .exe or .pdf."""
    fake_file = (io.BytesIO(b"MALICIOUS_EXE"), "payload.exe")
    response = client.post(
        "/api/v1/recordings",
        data={"file": fake_file},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400

    payload = response.get_json()
    assert payload["success"] is False
    assert payload["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_get_recording_not_found(client):
    """Test 404 response for nonexistent UUID."""
    fake_id = uuid.uuid4()
    response = client.get(f"/api/v1/recordings/{fake_id}")
    assert response.status_code == 404

    payload = response.get_json()
    assert payload["success"] is False
    assert payload["code"] == "NOT_FOUND"


def test_delete_recording_success(client):
    """Test creating and deleting a recording."""
    # First upload an item
    audio_content = b"WAVE_AUDIO_BYTES_TEST"
    upload_res = client.post(
        "/api/v1/recordings",
        data={"file": (io.BytesIO(audio_content), "to_delete.wav"), "title": "Temporary Recording"},
        content_type="multipart/form-data",
    )
    assert upload_res.status_code == 201
    rec_id = upload_res.get_json()["data"]["id"]

    # Now delete it
    del_res = client.delete(f"/api/v1/recordings/{rec_id}")
    assert del_res.status_code == 200
    assert del_res.get_json()["success"] is True

    # Verify it can no longer be retrieved
    get_res = client.get(f"/api/v1/recordings/{rec_id}")
    assert get_res.status_code == 404
