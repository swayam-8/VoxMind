"""Celery Background Tasks for Audio Processing, Transcription, and AI Intelligence."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from celery import shared_task
from flask import current_app
from app.extensions import db
from app.models.recording import Recording, TranscriptionJob
from app.models.transcript import TranscriptSegment
from app.models.insight import Summary, ActionItem
from app.services.audio_service import AudioService, AudioValidationError
from app.services.transcription_service import TranscriptionService, TranscriptionServiceError
from app.services.ollama_service import OllamaService, OllamaServiceError, OllamaValidationError

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
    Upon successful transcription, dispatches AI intelligence analysis.
    """
    logger.info(
        "Celery worker received transcription task [recording_id=%s, job_id=%s, task_id=%s]",
        recording_id,
        job_id,
        self.request.id,
    )

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

    # 1. Mark job as running and recording as processing
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

    # 2. Audio file inspection & Speech-to-Text inference
    try:
        storage_path = recording.storage_path
        if not storage_path:
            raise AudioValidationError("Recording has no storage path defined.")

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

        transcription_result = TranscriptionService.transcribe(storage_path)
        detected_duration = transcription_result.get("duration", 0.0)
        final_duration = max(container_duration, float(detected_duration))
        raw_segments = transcription_result.get("segments", [])

        # 3. Idempotently clear any previous segments
        db.session.query(TranscriptSegment).filter_by(recording_id=recording.id).delete()

        # 4. Insert new timestamped segments
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

        # 5. Update Recording and Job state to completed
        recording.duration_seconds = round(final_duration, 2)
        recording.status = "completed"
        recording.error_message = None

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None

        # 6. Initialize summary record for Phase 5 AI Intelligence
        model_name = (
            current_app.config.get("OLLAMA_MODEL", "llama3.2")
            if current_app
            else "llama3.2"
        )
        prompt_ver = (
            current_app.config.get("AI_PROMPT_VERSION", "v1")
            if current_app
            else "v1"
        )
        summary = db.session.query(Summary).filter_by(recording_id=recording.id).first()
        if not summary:
            summary = Summary(
                id=uuid.uuid4(),
                recording_id=recording.id,
                status="pending",
                model_name=model_name,
                prompt_version=prompt_ver,
                summary_markdown="",
                key_takeaways=[],
                decisions=[],
                topics=[],
            )
            db.session.add(summary)
        else:
            summary.status = "pending"
            summary.error_message = None

        db.session.commit()
        logger.info(
            "Transcription completed for recording %s (%d segments). Enqueueing AI analysis.",
            recording_id,
            len(raw_segments),
        )

        # 7. Dispatch AI analysis task
        try:
            analyze_recording_task.delay(str(recording.id), str(summary.id))
        except Exception as ai_dispatch_err:
            logger.warning(
                "Celery AI analysis dispatch postponed or failed: %s (summary remains pending)",
                ai_dispatch_err,
            )

        return {
            "success": True,
            "recording_id": recording_id,
            "segments_count": len(raw_segments),
            "duration": round(final_duration, 2),
        }

    except (AudioValidationError, TranscriptionServiceError) as validation_err:
        db.session.rollback()
        err_msg = str(validation_err)
        logger.error(
            "Non-retryable audio processing failure for recording %s: %s",
            recording_id,
            err_msg,
        )
        _mark_transcription_failure(recording.id, job.id, err_msg)
        return {"success": False, "error": err_msg}

    except Exception as exc:
        db.session.rollback()
        err_msg = f"Unexpected processing error: {str(exc)}"
        logger.exception(
            "Unexpected error during transcription task for recording %s: %s",
            recording_id,
            exc,
        )

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

        _mark_transcription_failure(recording.id, job.id, err_msg)
        return {"success": False, "error": err_msg}


@shared_task(
    bind=True,
    name="analysis.analyze_recording",
    max_retries=2,
    acks_late=True,
)
def analyze_recording_task(
    self, recording_id: str, summary_id: Optional[str] = None
) -> dict:
    """Execute asynchronous Ollama AI analysis on a completed transcript.

    Extracts executive summary, key takeaways, grounded decisions, action items,
    and topics. AI failures are isolated so that completed transcripts are preserved.
    """
    logger.info(
        "Celery worker received AI analysis task [recording_id=%s, summary_id=%s, task_id=%s]",
        recording_id,
        summary_id,
        self.request.id,
    )

    try:
        rec_uuid = uuid.UUID(recording_id)
        sum_uuid = uuid.UUID(summary_id) if summary_id else None
    except (ValueError, TypeError) as exc:
        logger.error("Invalid UUID passed to analysis task: %s", exc)
        return {"success": False, "error": "Invalid identifier"}

    recording = db.session.query(Recording).filter_by(id=rec_uuid).first()
    if not recording:
        logger.error("Recording %s not found for AI analysis", recording_id)
        return {"success": False, "error": "Recording not found"}

    # Find or initialize summary record
    summary = None
    if sum_uuid:
        summary = db.session.query(Summary).filter_by(id=sum_uuid).first()
    if not summary:
        summary = db.session.query(Summary).filter_by(recording_id=recording.id).first()

    if not summary:
        model_name = (
            current_app.config.get("OLLAMA_MODEL", "llama3.2")
            if current_app
            else "llama3.2"
        )
        prompt_version = (
            current_app.config.get("AI_PROMPT_VERSION", "v1")
            if current_app
            else "v1"
        )
        summary = Summary(
            id=uuid.uuid4(),
            recording_id=recording.id,
            status="processing",
            model_name=model_name,
            prompt_version=prompt_version,
            summary_markdown="",
            key_takeaways=[],
            decisions=[],
            topics=[],
        )
        db.session.add(summary)
    else:
        summary.status = "processing"
        summary.error_message = None

    db.session.commit()

    # Retrieve ordered transcript segments
    segments = (
        db.session.query(TranscriptSegment)
        .filter_by(recording_id=recording.id)
        .order_by(TranscriptSegment.start_time.asc())
        .all()
    )

    # Empty transcript handling
    if not segments:
        logger.info(
            "Recording %s has no dialogue segments. Completing empty summary.",
            recording_id,
        )
        summary.status = "completed"
        summary.summary_markdown = "No dialogue detected in this recording."
        summary.key_takeaways = []
        summary.decisions = []
        summary.topics = []
        summary.completed_at = datetime.now(timezone.utc)
        summary.error_message = None
        db.session.commit()
        return {"success": True, "summary_id": str(summary.id), "empty": True}

    # Format transcript with timestamps
    lines = []
    for s in segments:
        m = int(s.start_time // 60)
        sec = int(s.start_time % 60)
        lines.append(f"[{m:02d}:{sec:02d}] {s.speaker}: {s.text}")
    transcript_text = "\n".join(lines)

    try:
        # Generate structured insights via local Ollama
        result = OllamaService.generate_insights(transcript_text)

        # Idempotently replace action items for this recording
        db.session.query(ActionItem).filter_by(recording_id=recording.id).delete()
        for act in result.get("action_items", []):
            item = ActionItem(
                id=uuid.uuid4(),
                recording_id=recording.id,
                task=act["task"],
                assignee=act.get("assignee"),
                due_date=act.get("due_date"),
                completed=act.get("completed", False),
                source_timestamp=act.get("source_timestamp"),
            )
            db.session.add(item)

        # Update summary record
        summary.status = "completed"
        summary.summary_markdown = result["summary"]
        summary.key_takeaways = result.get("key_takeaways", [])
        summary.decisions = result.get("decisions", [])
        summary.topics = result.get("topics", [])
        summary.model_name = result.get("model_name", summary.model_name)
        summary.completed_at = datetime.now(timezone.utc)
        summary.error_message = None

        db.session.commit()
        logger.info(
            "AI analysis completed for recording %s: %d takeaways, %d decisions, %d action items",
            recording_id,
            len(summary.key_takeaways),
            len(summary.decisions),
            len(result.get("action_items", [])),
        )

        return {
            "success": True,
            "recording_id": recording_id,
            "summary_id": str(summary.id),
            "takeaways_count": len(summary.key_takeaways),
            "decisions_count": len(summary.decisions),
        }

    except (OllamaValidationError, OllamaServiceError) as ai_err:
        db.session.rollback()
        err_msg = str(ai_err)
        logger.error("Ollama AI analysis failure for recording %s: %s", recording_id, err_msg)
        _mark_analysis_failure(summary.id, err_msg)
        return {"success": False, "error": err_msg}

    except Exception as exc:
        db.session.rollback()
        err_msg = f"Unexpected analysis error: {str(exc)}"
        logger.exception(
            "Unexpected error in analysis task for recording %s: %s", recording_id, exc
        )

        is_eager = getattr(self.app.conf, "task_always_eager", False)
        if not is_eager and self.request.retries < self.max_retries:
            countdown = 10 * (2 ** self.request.retries)
            logger.warning(
                "Retrying analysis for recording %s in %ds...",
                recording_id,
                countdown,
            )
            raise self.retry(exc=exc, countdown=countdown)

        _mark_analysis_failure(summary.id, err_msg)
        return {"success": False, "error": err_msg}


def _mark_transcription_failure(recording_id: uuid.UUID, job_id: uuid.UUID, error_message: str):
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


def _mark_analysis_failure(summary_id: uuid.UUID, error_message: str):
    """Record failure status for AI analysis without failing the transcription."""
    try:
        s = db.session.query(Summary).filter_by(id=summary_id).first()
        if s:
            s.status = "failed"
            s.error_message = error_message
            s.completed_at = datetime.now(timezone.utc)
            db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.exception("Failed to mark summary failure for %s: %s", summary_id, exc)
