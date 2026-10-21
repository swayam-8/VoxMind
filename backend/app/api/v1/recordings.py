"""Recordings REST API endpoints (/api/v1/recordings)."""

import os
import uuid
from typing import Any, Dict
from flask import Blueprint, request, current_app
from werkzeug.utils import secure_filename
from app.extensions import db
from app.models.recording import Recording, TranscriptionJob
from app.models.collection import Collection
from app.services.workspace_service import WorkspaceService
from app.services.audio_service import AudioService, AudioValidationError
from app.jobs.tasks import transcribe_recording_task
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
