"""Recordings REST API endpoints (/api/v1/recordings)."""

import os
import uuid
from typing import Any, Dict
from flask import Blueprint, request, current_app
from werkzeug.utils import secure_filename
from app.extensions import db
from app.models.recording import Recording, TranscriptionJob
from app.models.collection import Collection
from app.models.transcript import TranscriptSegment, TranscriptChunk
from app.models.insight import Summary, ActionItem
from app.services.workspace_service import WorkspaceService
from app.services.audio_service import AudioService, AudioValidationError
from app.services.ollama_service import OllamaService, OllamaServiceError
from app.services.usage_service import UsageService
from app.jobs.tasks import (
    transcribe_recording_task,
    analyze_recording_task,
    index_recording_chunks_task,
)
from app.utils.response import api_success, api_error

recordings_bp = Blueprint("recordings", __name__, url_prefix="/recordings")


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed for audio processing."""
    allowed = current_app.config.get(
        "ALLOWED_AUDIO_EXTENSIONS", {"mp3", "wav", "m4a", "webm", "ogg", "flac"}
    )
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


@recordings_bp.route("", methods=["GET"])
def list_recordings():
    """List recordings with tenant isolation, search, status filter, and pagination."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 20))))
    except ValueError:
        return api_error("Invalid pagination parameters", code="BAD_REQUEST", status_code=400)

    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip().lower()
    collection_id_str = request.args.get("collection_id", "").strip()
    sort_by = request.args.get("sort_by", "created_at").strip().lower()
    order = request.args.get("order", "desc").strip().lower()

    query = db.session.query(Recording).filter(Recording.workspace_id == workspace.id)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Recording.title.ilike(search_filter)) | (Recording.filename.ilike(search_filter))
        )

    if status and status != "all":
        query = query.filter(Recording.status == status)

    if collection_id_str and collection_id_str != "all":
        try:
            col_uuid = uuid.UUID(collection_id_str)
            query = query.filter(Recording.collection_id == col_uuid)
        except ValueError:
            pass

    sort_column = getattr(Recording, sort_by, Recording.created_at)
    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page if total > 0 else 1

    return api_success(
        data=[rec.to_dict() for rec in items],
        meta={
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": pages,
        },
        message=f"Retrieved {len(items)} recordings",
    )


@recordings_bp.route("/<uuid:recording_id>", methods=["GET"])
def get_recording(recording_id: uuid.UUID):
    """Retrieve full recording details, transcript segments, summaries, and action items."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    data: Dict[str, Any] = recording.to_dict()
    data["segments"] = [seg.to_dict() for seg in recording.segments]
    data["summaries"] = [s.to_dict() for s in recording.summaries]
    data["action_items"] = [act.to_dict() for act in recording.action_items]

    return api_success(data=data, message="Recording retrieved successfully")


@recordings_bp.route("/<uuid:recording_id>/transcript", methods=["GET"])
def get_recording_transcript(recording_id: uuid.UUID):
    """Retrieve chronological transcript segments for a recording."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    segments = [seg.to_dict() for seg in recording.segments]

    return api_success(
        data={
            "recording_id": str(recording.id),
            "status": recording.status,
            "error_message": recording.error_message,
            "count": len(segments),
            "segments": segments,
        },
        message="Transcript retrieved successfully",
    )


@recordings_bp.route("", methods=["POST"])
def upload_recording():
    """Upload and register audio recording, validating headers and dispatching Celery task."""
    user, workspace = WorkspaceService.get_or_create_default_context()

    # 1. Validate file presence
    if "file" not in request.files:
        return api_error(
            "No audio file part in request ('file')", code="MISSING_FILE", status_code=400
        )

    file = request.files["file"]
    if not file or not file.filename:
        return api_error("No selected audio file", code="NO_FILE_SELECTED", status_code=400)

    # 2. Validate file extension
    if not allowed_file(file.filename):
        return api_error(
            "Unsupported audio file format. Allowed formats: mp3, wav, m4a, webm, ogg, flac",
            code="UNSUPPORTED_MEDIA_TYPE",
            status_code=400,
        )

    # 3. Validate authentic audio magic bytes
    try:
        detected_fmt = AudioService.validate_magic_bytes(file.stream)
    except AudioValidationError as val_err:
        return api_error(
            f"Invalid audio file content: {str(val_err)}",
            code="INVALID_AUDIO_FORMAT",
            status_code=400,
        )

    # 4. Read metadata from request
    fallback_name = f"recording_{uuid.uuid4().hex[:8]}.{detected_fmt}"
    original_filename = secure_filename(file.filename) or fallback_name
    title = request.form.get("title", "").strip() or original_filename.rsplit(".", 1)[0].replace(
        "-", " "
    ).replace("_", " ")

    collection_id_val = None
    collection_id_param = request.form.get("collection_id")
    if collection_id_param:
        try:
            parsed_id = uuid.UUID(collection_id_param)
            col = (
                db.session.query(Collection)
                .filter_by(id=parsed_id, workspace_id=workspace.id)
                .first()
            )
            if col:
                collection_id_val = col.id
        except ValueError:
            pass

    # 5. Prepare local storage directory
    rec_uuid = uuid.uuid4()
    ext = original_filename.rsplit(".", 1)[1].lower() if "." in original_filename else detected_fmt
    stored_filename = f"{rec_uuid.hex}.{ext}"

    workspace_dir = os.path.join(current_app.config["UPLOAD_DIR"], str(workspace.id))
    os.makedirs(workspace_dir, exist_ok=True)
    destination_path = os.path.join(workspace_dir, stored_filename)

    saved_to_disk = False
    try:
        # Save file to disk
        file.save(destination_path)
        saved_to_disk = True
        file_size = os.path.getsize(destination_path)

        if file_size == 0:
            os.remove(destination_path)
            return api_error(
                "Uploaded audio file is empty (0 bytes).",
                code="EMPTY_FILE",
                status_code=400,
            )

        # 6. Deep inspection of container decodability
        try:
            duration, sample_rate, channels = AudioService.inspect_audio_container(destination_path)
        except AudioValidationError as container_err:
            if os.path.exists(destination_path):
                os.remove(destination_path)
            return api_error(
                f"Audio container inspection failed: {str(container_err)}",
                code="CORRUPTED_AUDIO_FILE",
                status_code=400,
            )

        # 7. Create database records in a safe transaction
        recording = Recording(
            id=rec_uuid,
            workspace_id=workspace.id,
            user_id=user.id,
            collection_id=collection_id_val,
            title=title,
            filename=original_filename,
            storage_path=destination_path,
            file_size_bytes=file_size,
            duration_seconds=round(duration, 2),
            mime_type=file.content_type or f"audio/{ext}",
            status="queued",
        )
        db.session.add(recording)

        job = TranscriptionJob(
            recording_id=recording.id,
            status="pending",
            engine="faster-whisper",
            model_name=current_app.config.get("WHISPER_MODEL", "base"),
            device=current_app.config.get("WHISPER_DEVICE", "cpu"),
        )
        db.session.add(job)
        db.session.commit()

        # 8. Dispatch asynchronous background task via Celery
        try:
            task = transcribe_recording_task.delay(str(recording.id), str(job.id))
            job.celery_task_id = getattr(task, "id", None)
            db.session.commit()
        except Exception as queue_err:
            current_app.logger.warning(
                "Celery task dispatch postponed or failed: %s (recording remains queued)", queue_err
            )

        response_data = recording.to_dict()
        response_data["job_id"] = str(job.id)
        response_data["job"] = {
            "id": str(job.id),
            "status": job.status,
            "engine": job.engine,
            "model_name": job.model_name,
        }

        return api_success(
            data=response_data,
            message="Audio recording uploaded and queued for processing",
            status_code=201,
        )

    except Exception as exc:
        db.session.rollback()
        if saved_to_disk and os.path.exists(destination_path):
            try:
                os.remove(destination_path)
            except OSError:
                pass
        current_app.logger.exception("Failed to save audio recording: %s", exc)
        return api_error(
            f"Failed to process and register audio recording: {str(exc)}",
            code="UPLOAD_ERROR",
            status_code=500,
        )


@recordings_bp.route("/<uuid:recording_id>/retry", methods=["POST"])
def retry_recording(recording_id: uuid.UUID):
    """Re-enqueue transcription pipeline for a failed or stalled recording."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    if recording.status in ("processing", "transcribing"):
        return api_error(
            "Recording is currently being processed", code="IN_PROGRESS", status_code=409
        )

    if recording.status in ("completed", "ready"):
        return api_error(
            "Recording has already completed transcription successfully",
            code="ALREADY_COMPLETED",
            status_code=400,
        )

    try:
        # Reset recording state
        recording.status = "queued"
        recording.error_message = None

        job = TranscriptionJob(
            recording_id=recording.id,
            status="pending",
            engine="faster-whisper",
            model_name=current_app.config.get("WHISPER_MODEL", "base"),
            device=current_app.config.get("WHISPER_DEVICE", "cpu"),
        )
        db.session.add(job)
        db.session.commit()

        # Re-dispatch Celery task
        try:
            task = transcribe_recording_task.delay(str(recording.id), str(job.id))
            job.celery_task_id = getattr(task, "id", None)
            db.session.commit()
        except Exception as queue_err:
            current_app.logger.warning("Celery retry task dispatch postponed: %s", queue_err)

        return api_success(
            data={
                "recording": recording.to_dict(),
                "job": {
                    "id": str(job.id),
                    "status": job.status,
                    "celery_task_id": job.celery_task_id,
                },
            },
            message="Transcription re-enqueued successfully",
            status_code=200,
        )

    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Failed to retry recording %s: %s", recording_id, exc)
        return api_error(
            f"Failed to retry transcription: {str(exc)}", code="RETRY_ERROR", status_code=500
        )


@recordings_bp.route("/<uuid:recording_id>", methods=["DELETE"])
def delete_recording(recording_id: uuid.UUID):
    """Delete a recording, remove its physical audio file from disk, and cascade remove data."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    storage_path = recording.storage_path

    try:
        db.session.delete(recording)
        db.session.commit()

        if storage_path and os.path.exists(storage_path):
            try:
                os.remove(storage_path)
            except OSError:
                pass

        return api_success(
            data={"id": str(recording_id)},
            message="Recording deleted successfully",
        )
    except Exception as exc:
        db.session.rollback()
        return api_error(
            f"Failed to delete recording: {str(exc)}", code="DELETE_ERROR", status_code=500
        )


@recordings_bp.route("/<uuid:recording_id>", methods=["PATCH"])
def update_recording(recording_id: uuid.UUID):
    """Update recording metadata such as title and collection assignment."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )
    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    payload = request.get_json(silent=True) or {}

    if "title" in payload:
        new_title = str(payload["title"]).strip()
        if not new_title:
            return api_error("Title cannot be empty", code="VALIDATION_ERROR", status_code=400)
        recording.title = new_title[:255]

    if "collection_id" in payload:
        raw_col = payload["collection_id"]
        if raw_col is None or raw_col == "" or raw_col == "null":
            recording.collection_id = None
        else:
            try:
                col_uuid = uuid.UUID(str(raw_col))
                # Validate collection belongs to same workspace
                col = (
                    db.session.query(Collection)
                    .filter(Collection.id == col_uuid, Collection.workspace_id == workspace.id)
                    .first()
                )
                if not col:
                    return api_error(
                        "Target collection not found in workspace",
                        code="NOT_FOUND",
                        status_code=404,
                    )
                recording.collection_id = col_uuid
            except ValueError:
                return api_error(
                    "Invalid collection UUID", code="VALIDATION_ERROR", status_code=400
                )

    db.session.commit()
    return api_success(data=recording.to_dict(), message="Recording updated successfully")


@recordings_bp.route("/<uuid:recording_id>/analysis", methods=["GET"])
def get_recording_analysis(recording_id: uuid.UUID):
    """Retrieve AI intelligence analysis (summary, takeaways, decisions, actions, topics)."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    summary = (
        db.session.query(Summary)
        .filter_by(recording_id=recording.id)
        .order_by(Summary.created_at.desc())
        .first()
    )
    action_items = (
        db.session.query(ActionItem)
        .filter_by(recording_id=recording.id)
        .all()
    )

    if not summary:
        default_status = (
            "pending" if recording.status in ("queued", "processing", "completed") else "failed"
        )
        return api_success(
            data={
                "recording_id": str(recording.id),
                "status": default_status,
                "summary_markdown": "",
                "key_takeaways": [],
                "decisions": [],
                "action_items": [],
                "topics": [],
                "model_name": current_app.config.get("OLLAMA_MODEL", "llama3.2"),
                "completed_at": None,
                "error_message": None,
            },
            message="Analysis has not been generated yet",
        )

    data = summary.to_dict()
    data["action_items"] = [act.to_dict() for act in action_items]
    return api_success(data=data, message="AI analysis retrieved successfully")


@recordings_bp.route("/<uuid:recording_id>/analysis/status", methods=["GET"])
def get_recording_analysis_status(recording_id: uuid.UUID):
    """Retrieve current AI analysis processing status."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    summary = (
        db.session.query(Summary)
        .filter_by(recording_id=recording.id)
        .order_by(Summary.created_at.desc())
        .first()
    )

    if not summary:
        return api_success(
            data={
                "recording_id": str(recording.id),
                "status": "pending",
                "model_name": current_app.config.get("OLLAMA_MODEL", "llama3.2"),
                "completed_at": None,
                "error_message": None,
            },
            message="Analysis status retrieved",
        )

    return api_success(
        data={
            "recording_id": str(recording.id),
            "summary_id": str(summary.id),
            "status": summary.status,
            "model_name": summary.model_name,
            "completed_at": summary.completed_at.isoformat() if summary.completed_at else None,
            "error_message": summary.error_message,
        },
        message="Analysis status retrieved",
    )


@recordings_bp.route("/<uuid:recording_id>/analysis/regenerate", methods=["POST"])
def regenerate_recording_analysis(recording_id: uuid.UUID):
    """Request asynchronous regeneration of AI insights for a completed recording."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    if recording.status in ("queued", "processing"):
        return api_error(
            "Recording is currently still being transcribed",
            code="TRANSCRIPTION_IN_PROGRESS",
            status_code=409,
        )

    summary = db.session.query(Summary).filter_by(recording_id=recording.id).first()
    if summary and summary.status == "processing":
        return api_error(
            "AI analysis is already currently processing",
            code="ANALYSIS_IN_PROGRESS",
            status_code=409,
        )

    if not summary:
        summary = Summary(
            id=uuid.uuid4(),
            recording_id=recording.id,
            status="pending",
            model_name=current_app.config.get("OLLAMA_MODEL", "llama3.2"),
            prompt_version=current_app.config.get("AI_PROMPT_VERSION", "v1"),
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

    try:
        analyze_recording_task.delay(str(recording.id), str(summary.id))
    except Exception as exc:
        current_app.logger.warning("Celery analyze task dispatch failed: %s", exc)

    return api_success(
        data=summary.to_dict(),
        message="AI insights regeneration enqueued successfully",
        status_code=202,
    )


@recordings_bp.route("/<uuid:recording_id>/ask", methods=["POST"])
def ask_recording_question(recording_id: uuid.UUID):
    """Ask a question grounded exclusively in the recording's audio transcript."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    payload = request.get_json(silent=True)
    if not payload or not isinstance(payload, dict):
        return api_error(
            "Request body must be a JSON object with 'question'",
            code="BAD_REQUEST",
            status_code=400,
        )

    question = str(payload.get("question", "")).strip()
    if not question:
        return api_error("Question cannot be empty", code="EMPTY_QUESTION", status_code=400)

    if len(question) > 1000:
        return api_error(
            "Question exceeds maximum length of 1000 characters",
            code="QUESTION_TOO_LONG",
            status_code=400,
        )

    segments = (
        db.session.query(TranscriptSegment)
        .filter_by(recording_id=recording.id)
        .order_by(TranscriptSegment.start_time.asc())
        .all()
    )

    if not segments:
        return api_error(
            "This recording has no transcript dialogue to answer questions from.",
            code="NO_TRANSCRIPT",
            status_code=400,
        )

    lines = []
    for s in segments:
        m = int(s.start_time // 60)
        sec = int(s.start_time % 60)
        lines.append(f"[{m:02d}:{sec:02d}] {s.speaker}: {s.text}")
    transcript_text = "\n".join(lines)

    try:
        answer_result = OllamaService.answer_question(transcript_text, question)

        try:
            p_toks = max(5, len(question.split()) * 2)
            c_toks = max(5, len(answer_result.get("answer", "").split()))
            UsageService.record_usage(
                workspace_id=workspace.id,
                endpoint=f"/api/v1/recordings/{recording.id}/ask",
                method="POST",
                status_code=200,
                resource_type="qa",
                model_name=answer_result.get("model_name"),
                prompt_tokens=p_toks,
                completion_tokens=c_toks,
                total_tokens=p_toks + c_toks,
            )
        except Exception:
            pass

        return api_success(
            data={
                "recording_id": str(recording.id),
                "question": question,
                "answer": answer_result["answer"],
                "supported_by_transcript": answer_result["supported_by_transcript"],
                "timestamps": answer_result["timestamps"],
                "model_name": answer_result["model_name"],
            },
            message="Question answered successfully",
            status_code=200,
        )
    except OllamaServiceError as err:
        return api_error(
            f"AI Question Answering failed: {str(err)}",
            code="AI_SERVICE_UNAVAILABLE",
            status_code=503,
        )
    except Exception as exc:
        current_app.logger.exception("Error answering recording question: %s", exc)
        return api_error(
            f"Internal error answering question: {str(exc)}",
            code="INTERNAL_ERROR",
            status_code=500,
        )


@recordings_bp.route("/<uuid:recording_id>/action-items/<uuid:action_id>", methods=["PATCH"])
def toggle_action_item(recording_id: uuid.UUID, action_id: uuid.UUID):
    """Toggle completion status of an action item."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    item = (
        db.session.query(ActionItem)
        .join(Recording, ActionItem.recording_id == Recording.id)
        .filter(
            ActionItem.id == action_id,
            ActionItem.recording_id == recording_id,
            Recording.workspace_id == workspace.id,
        )
        .first()
    )

    if not item:
        return api_error("Action item not found", code="NOT_FOUND", status_code=404)

    payload = request.get_json(silent=True) or {}
    if "completed" in payload:
        item.completed = bool(payload["completed"])
    else:
        item.completed = not item.completed

    db.session.commit()
    return api_success(data=item.to_dict(), message="Action item updated")


@recordings_bp.route("/<uuid:recording_id>/index-status", methods=["GET"])
def get_recording_index_status(recording_id: uuid.UUID):
    """Retrieve vector indexing readiness, status, and chunk count for a recording."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )
    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    chunk_count = (
        db.session.query(TranscriptChunk)
        .filter(TranscriptChunk.recording_id == recording.id)
        .count()
    )

    return api_success(
        data={
            "recording_id": str(recording.id),
            "index_status": recording.index_status,
            "indexed_at": recording.indexed_at.isoformat() if recording.indexed_at else None,
            "chunk_count": chunk_count,
            "error_message": recording.index_error,
        }
    )


@recordings_bp.route("/<uuid:recording_id>/reindex", methods=["POST"])
def reindex_recording(recording_id: uuid.UUID):
    """Trigger re-chunking and re-embedding of a recording's transcript."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    recording = (
        db.session.query(Recording)
        .filter(Recording.id == recording_id, Recording.workspace_id == workspace.id)
        .first()
    )
    if not recording:
        return api_error("Recording not found", code="NOT_FOUND", status_code=404)

    if not recording.segments and recording.status != "ready":
        return api_error(
            "Cannot index recording without completed transcript",
            code="INVALID_STATE",
            status_code=400,
        )

    recording.index_status = "indexing"
    recording.index_error = None
    db.session.commit()

    try:
        index_recording_chunks_task.delay(str(recording.id))
    except Exception as exc:
        current_app.logger.warning("Failed to enqueue indexing task: %s", exc)

    return api_success(
        data={
            "recording_id": str(recording.id),
            "index_status": "indexing",
        },
        message="Vector reindexing task enqueued successfully",
        status_code=202,
    )
