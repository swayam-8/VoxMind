"""Automated Tests for Celery Audio Processing and Speech-to-Text Pipeline."""

import io
import uuid
from tests.conftest import generate_wav_bytes
from app.extensions import db
from app.models.recording import Recording, TranscriptionJob
from app.models.transcript import TranscriptSegment
from app.jobs.tasks import transcribe_recording_task
from app.services.audio_service import AudioService, AudioValidationError


def test_audio_service_magic_bytes_detection():
    """Verify magic bytes validation identifies authentic audio formats and rejects non-audio."""
    wav_bytes = generate_wav_bytes(0.5)
    fmt = AudioService.validate_magic_bytes(io.BytesIO(wav_bytes))
    assert fmt == "wav"

    # MP3 ID3 header
    mp3_header = b"ID3\x03\x00\x00\x00\x00\x00#TSSE" + b"\x00" * 32
    assert AudioService.validate_magic_bytes(io.BytesIO(mp3_header)) == "mp3"

    # Rejection of text / arbitrary binary
    try:
        dummy_html = b"<!DOCTYPE html><html><body>fake</body></html>"
        AudioService.validate_magic_bytes(io.BytesIO(dummy_html))
        assert False, "Should have raised AudioValidationError"
    except AudioValidationError as exc:
        assert "does not match any supported audio signature" in str(exc)


def test_transcription_task_success(app, test_wav_bytes, client):
    """Test full pipeline execution: upload -> task -> segments created -> status completed."""
    with app.app_context():
        # 1. Upload audio
        payload_data = {
            "file": (io.BytesIO(test_wav_bytes), "pipeline_test.wav"),
            "title": "Pipeline Test",
        }
        res = client.post(
            "/api/v1/recordings",
            data=payload_data,
            content_type="multipart/form-data",
        )
        assert res.status_code == 201
        data = res.get_json()["data"]
        rec_id = data["id"]
        job_id = data["job_id"]

        # In testing config, CELERY_TASK_ALWAYS_EAGER=True runs task synchronously
        rec = db.session.query(Recording).filter_by(id=uuid.UUID(rec_id)).first()
        job = db.session.query(TranscriptionJob).filter_by(id=uuid.UUID(job_id)).first()

        assert rec is not None
        assert rec.status == "completed"
        assert rec.duration_seconds > 0.0

        assert job is not None
        assert job.status == "completed"
        assert job.started_at is not None
        assert job.completed_at is not None

        # Verify segments were generated and stored
        segments = (
            db.session.query(TranscriptSegment)
            .filter_by(recording_id=rec.id)
            .order_by(TranscriptSegment.segment_index)
            .all()
        )
        assert len(segments) == 2
        assert segments[0].text == "Welcome to VoxMind voice intelligence platform."
        assert segments[0].start_time == 0.0
        assert segments[1].end_time == 2.5


def test_transcription_task_idempotency(app, test_wav_bytes, client):
    """Re-executing the transcription task does not create duplicate segments."""
    with app.app_context():
        sync_data = {
            "file": (io.BytesIO(test_wav_bytes), "idempotency_test.wav"),
            "title": "Idempotent Sync",
        }
        res = client.post(
            "/api/v1/recordings",
            data=sync_data,
            content_type="multipart/form-data",
        )
        data = res.get_json()["data"]
        rec_id = data["id"]
        job_id = data["job_id"]

        # Run task second time explicitly
        task_res = transcribe_recording_task(rec_id, job_id)
        assert task_res["success"] is True

        # Segment count should still be 2, not 4
        segments = (
            db.session.query(TranscriptSegment)
            .filter_by(recording_id=uuid.UUID(rec_id))
            .all()
        )
        assert len(segments) == 2


def test_transcription_task_failure_handling(app):
    """Verify task marks recording and job as failed when audio file is corrupted or missing."""
    with app.app_context():
        # Create dummy recording with non-existent storage path
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            title="Corrupted File",
            filename="missing.wav",
            storage_path="/nonexistent/path/missing.wav",
            file_size_bytes=100,
            mime_type="audio/wav",
            status="queued",
        )
        job = TranscriptionJob(
            id=uuid.uuid4(),
            recording_id=rec.id,
            status="pending",
        )
        db.session.add(rec)
        db.session.add(job)
        db.session.commit()

        # Run task
        task_res = transcribe_recording_task(str(rec.id), str(job.id))
        assert task_res["success"] is False

        # Refresh state
        db.session.refresh(rec)
        db.session.refresh(job)

        assert rec.status == "failed"
        assert rec.error_message is not None
        assert "not found" in rec.error_message.lower() or "missing" in rec.error_message.lower()
        assert job.status == "failed"
        assert job.error_message is not None


def test_get_transcript_endpoint(client, test_wav_bytes):
    """Test GET /api/v1/recordings/<id>/transcript returns ordered segments."""
    upload_data = {
        "file": (io.BytesIO(test_wav_bytes), "transcript_ep_test.wav"),
        "title": "Transcript Test",
    }
    upload_res = client.post(
        "/api/v1/recordings",
        data=upload_data,
        content_type="multipart/form-data",
    )
    rec_id = upload_res.get_json()["data"]["id"]

    # Fetch transcript
    trans_res = client.get(f"/api/v1/recordings/{rec_id}/transcript")
    assert trans_res.status_code == 200

    payload = trans_res.get_json()
    assert payload["success"] is True
    assert payload["data"]["recording_id"] == rec_id
    assert payload["data"]["status"] == "completed"
    assert payload["data"]["count"] == 2
    assert len(payload["data"]["segments"]) == 2
    first_seg_text = payload["data"]["segments"][0]["text"]
    assert first_seg_text == "Welcome to VoxMind voice intelligence platform."


def test_get_transcript_not_found(client):
    """Test GET /api/v1/recordings/<id>/transcript returns 404 for non-existent recording."""
    fake_id = uuid.uuid4()
    res = client.get(f"/api/v1/recordings/{fake_id}/transcript")
    assert res.status_code == 404
    assert res.get_json()["code"] == "NOT_FOUND"


def test_retry_recording_endpoint(app, client):
    """Test re-enqueuing failed recording and rejecting retry for completed recording."""
    with app.app_context():
        from app.services.workspace_service import WorkspaceService
        user, workspace = WorkspaceService.get_or_create_default_context()

        # Create a failed recording in user's workspace
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Failed Recording",
            filename="failed.wav",
            storage_path="/tmp/fake.wav",
            file_size_bytes=500,
            mime_type="audio/wav",
            status="failed",
            error_message="Simulated decoder failure",
        )
        db.session.add(rec)
        db.session.commit()
        rec_id = str(rec.id)

    # 1. Retry failed recording -> should re-enqueue
    retry_res = client.post(f"/api/v1/recordings/{rec_id}/retry")
    assert retry_res.status_code == 200
    assert retry_res.get_json()["success"] is True


def test_retry_completed_recording_rejected(client, test_wav_bytes):
    """Test that retrying an already completed recording is rejected with 400."""
    upload_res = client.post(
        "/api/v1/recordings",
        data={"file": (io.BytesIO(test_wav_bytes), "completed_rec.wav"), "title": "Already Done"},
        content_type="multipart/form-data",
    )
    rec_id = upload_res.get_json()["data"]["id"]

    # Attempt to retry completed recording
    retry_res = client.post(f"/api/v1/recordings/{rec_id}/retry")
    assert retry_res.status_code == 400
    assert retry_res.get_json()["code"] == "ALREADY_COMPLETED"


def test_get_job_endpoint(client, test_wav_bytes):
    """Test GET /api/v1/jobs/<id> returns job lifecycle metadata."""
    upload_res = client.post(
        "/api/v1/recordings",
        data={"file": (io.BytesIO(test_wav_bytes), "job_test.wav"), "title": "Job Test"},
        content_type="multipart/form-data",
    )
    job_id = upload_res.get_json()["data"]["job_id"]

    job_res = client.get(f"/api/v1/jobs/{job_id}")
    assert job_res.status_code == 200

    job_data = job_res.get_json()["data"]
    assert job_data["id"] == job_id
    assert job_data["engine"] == "faster-whisper"
    assert job_data["status"] in ("completed", "pending", "running")


def test_get_job_not_found(client):
    """Test GET /api/v1/jobs/<id> returns 404 for unknown job ID."""
    fake_job_id = uuid.uuid4()
    res = client.get(f"/api/v1/jobs/{fake_job_id}")
    assert res.status_code == 404
    assert res.get_json()["code"] == "NOT_FOUND"
