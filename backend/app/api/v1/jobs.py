"""Transcription Jobs REST API endpoints (/api/v1/jobs)."""

import uuid
from flask import Blueprint
from app.extensions import db
from app.models.recording import TranscriptionJob, Recording
from app.services.workspace_service import WorkspaceService
from app.utils.response import api_success, api_error

jobs_bp = Blueprint("jobs", __name__, url_prefix="/jobs")


@jobs_bp.route("/<uuid:job_id>", methods=["GET"])
def get_job(job_id: uuid.UUID):
    """Retrieve transcription job status and execution metadata."""
    _, workspace = WorkspaceService.get_or_create_default_context()

    job = (
        db.session.query(TranscriptionJob)
        .join(Recording, TranscriptionJob.recording_id == Recording.id)
        .filter(TranscriptionJob.id == job_id, Recording.workspace_id == workspace.id)
        .first()
    )

    if not job:
        return api_error("Transcription job not found", code="NOT_FOUND", status_code=404)

    return api_success(
        data={
            "id": str(job.id),
            "recording_id": str(job.recording_id),
            "celery_task_id": job.celery_task_id,
            "status": job.status,
            "engine": job.engine,
            "model_name": job.model_name,
            "device": job.device,
            "error_message": job.error_message,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        },
        message="Job details retrieved successfully",
    )
