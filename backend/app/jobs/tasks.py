"""Celery Background Tasks for Audio Processing and Transcription."""

import logging
import uuid
from datetime import datetime, timezone
from celery import shared_task
from app.extensions import db
from app.models.recording import Recording, TranscriptionJob
from app.models.transcript import TranscriptSegment
from app.services.audio_service import AudioService, AudioValidationError
from app.services.transcription_service import TranscriptionService, TranscriptionServiceError

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="transcription.transcribe_recording",
    max_retries=2,
    acks_late=True,
)
def transcribe_recording_task(self, recording_id: str, job_id: str) -> dict:
    """Execute asynchronous speech-to-text pipeline for an uploaded recording.

    Accepts scalar string UUIDs to ensure lightweight, JSON-safe Celery broker payloads.
    Persists transcript segments idempotently and manages lifecycle state transitions.
    """
    logger.info(
        "Celery worker received transcription task [recording_id=%s, job_id=%s, task_id=%s]",
        recording_id,
        job_id,
        self.request.id,
    )

    # 1. Parse UUIDs and retrieve database records
    try:
        rec_uuid = uuid.UUID(recording_id)
        job_uuid = uuid.UUID(job_id)
    except (ValueError, TypeError) as exc:
        logger.error("Invalid UUID passed to transcription task: %s", exc)
        return {"success": False, "error": "Invalid identifier"}

    recording = db.session.query(Recording).filter_by(id=rec_uuid).first()
    job = db.session.query(TranscriptionJob).filter_by(id=job_uuid).first()

    if not recording or not job:
        logger.error(
            "Recording (%s) or Job (%s) not found in database", recording_id, job_id
        )
        return {"success": False, "error": "Record not found"}

    # 2. Mark job as running and recording as processing
    try:
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.celery_task_id = self.request.id or str(job.id)
        recording.status = "processing"
        recording.error_message = None
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.exception("Failed to mark recording %s as processing: %s", recording_id, exc)
        return {"success": False, "error": str(exc)}

    # 3. Audio file inspection & Speech-to-Text inference
    try:
        storage_path = recording.storage_path
        if not storage_path:
            raise AudioValidationError("Recording has no storage path defined.")

        # Container decodability and duration extraction
        container_duration, sample_rate, channels = (
            AudioService.inspect_audio_container(storage_path)
        )
        logger.info(
            "Container verified for %s: duration=%.2fs, rate=%dHz, channels=%d",
            recording_id,
            container_duration,
            sample_rate,
            channels,
        )

        # Run local faster-whisper inference
        transcription_result = TranscriptionService.transcribe(storage_path)
        detected_duration = transcription_result.get("duration", 0.0)
        final_duration = max(container_duration, float(detected_duration))
        raw_segments = transcription_result.get("segments", [])

        # 4. Idempotently clear any previous segments (e.g. from retry or re-run)
        db.session.query(TranscriptSegment).filter_by(recording_id=recording.id).delete()

        # 5. Insert new timestamped segments
        for idx, seg in enumerate(raw_segments):
            segment_obj = TranscriptSegment(
                id=uuid.uuid4(),
                recording_id=recording.id,
                segment_index=idx,
                start_time=float(seg["start"]),
                end_time=float(seg["end"]),
                text=seg["text"],
                speaker=seg.get("speaker", "Speaker 1"),
                confidence=float(seg.get("confidence", 1.0)),
            )
            db.session.add(segment_obj)

        # 6. Update Recording and Job state to completed
        recording.duration_seconds = round(final_duration, 2)
        recording.status = "completed"
        recording.error_message = None

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None

        db.session.commit()
        logger.info(
            "Successfully completed transcription for recording %s (%d segments, duration=%.2fs)",
            recording_id,
            len(raw_segments),
            final_duration,
        )

        return {
            "success": True,
            "recording_id": recording_id,
            "segments_count": len(raw_segments),
            "duration": round(final_duration, 2),
        }

    except (AudioValidationError, TranscriptionServiceError) as validation_err:
        # Non-recoverable validation/decoding error: do NOT retry
        db.session.rollback()
        err_msg = str(validation_err)
        logger.error(
            "Non-retryable audio processing failure for recording %s: %s",
            recording_id,
            err_msg,
        )
        _mark_failure(recording.id, job.id, err_msg)
        return {"success": False, "error": err_msg}

    except Exception as exc:
        db.session.rollback()
        err_msg = f"Unexpected processing error: {str(exc)}"
        logger.exception(
            "Unexpected error during transcription task for recording %s: %s",
            recording_id,
            exc,
        )

        # Retry transient failures if attempts remain (in non-eager worker mode)
        is_eager = getattr(self.app.conf, "task_always_eager", False)
        if not is_eager and self.request.retries < self.max_retries:
            countdown = 10 * (2 ** self.request.retries)
            logger.warning(
                "Retrying task for recording %s (attempt %d/%d) in %ds...",
                recording_id,
                self.request.retries + 1,
                self.max_retries,
                countdown,
            )
            raise self.retry(exc=exc, countdown=countdown)

        # Retries exhausted: mark as failed
        _mark_failure(recording.id, job.id, err_msg)
        return {"success": False, "error": err_msg}


def _mark_failure(recording_id: uuid.UUID, job_id: uuid.UUID, error_message: str):
    """Safely record failure status and error details in database."""
    try:
        rec = db.session.query(Recording).filter_by(id=recording_id).first()
        j = db.session.query(TranscriptionJob).filter_by(id=job_id).first()

        if rec:
            rec.status = "failed"
            rec.error_message = error_message
        if j:
            j.status = "failed"
            j.error_message = error_message
            j.completed_at = datetime.now(timezone.utc)

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.exception("Failed to mark failure state for recording %s: %s", recording_id, exc)
