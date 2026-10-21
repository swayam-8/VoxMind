"""Automated tests for Local Ollama AI Intelligence Pipeline and Endpoints."""

import uuid
from app.extensions import db
from app.models.recording import Recording
from app.models.transcript import TranscriptSegment
from app.models.insight import Summary, ActionItem
from app.services.ollama_service import (
    OllamaService,
    OllamaValidationError,
)
from app.jobs.tasks import analyze_recording_task
from app.services.workspace_service import WorkspaceService


def test_ollama_clean_json_markdown():
    """Verify code block stripping from LLM responses."""
    raw = "```json\n{\"summary\": \"Test summary\"}\n```"
    cleaned = OllamaService._clean_json_markdown(raw)
    assert cleaned == "{\"summary\": \"Test summary\"}"


def test_ollama_validate_and_normalize_insights():
    """Verify validation handles missing fields and unknown values appropriately."""
    raw = {
        "summary": "Valid summary",
        "key_takeaways": ["Takeaway 1"],
        "decisions": [{"decision": "Deploy Friday", "source_timestamp": "12.5"}],
        "action_items": [{"task": "Fix bug", "assignee": "unassigned", "due_date": "null"}],
        "topics": ["Infra"],
    }
    normalized = OllamaService._validate_and_normalize_insights(raw, "llama3.2")
    assert normalized["summary"] == "Valid summary"
    assert normalized["decisions"][0]["source_timestamp"] == 12.5
    assert normalized["action_items"][0]["assignee"] is None
    assert normalized["action_items"][0]["due_date"] is None

    # Invalid non-dict
    try:
        OllamaService._validate_and_normalize_insights(["invalid"], "llama3.2")
        assert False, "Should have raised OllamaValidationError"
    except OllamaValidationError:
        pass


def test_analyze_recording_task_success(app):
    """Test background AI analysis task populates Summary and ActionItems."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()

        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Architecture Review",
            filename="arch_sync.wav",
            storage_path="/tmp/test.wav",
            file_size_bytes=1024,
            duration_seconds=120.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)

        seg1 = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=0,
            start_time=0.0,
            end_time=30.0,
            speaker="Alex",
            text="Let's approve the Friday staging deployment target.",
            confidence=0.98,
        )
        seg2 = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=1,
            start_time=30.0,
            end_time=60.0,
            speaker="Sarah",
            text="Agreed, I will configure the monitoring alerts before then.",
            confidence=0.95,
        )
        db.session.add(seg1)
        db.session.add(seg2)
        db.session.commit()

        # Run task
        task_res = analyze_recording_task(str(rec.id))
        assert task_res["success"] is True

        summary = db.session.query(Summary).filter_by(recording_id=rec.id).first()
        assert summary is not None
        assert summary.status == "completed"
        assert len(summary.key_takeaways) == 3
        assert len(summary.decisions) == 1
        assert "Friday" in summary.summary_markdown

        actions = db.session.query(ActionItem).filter_by(recording_id=rec.id).all()
        assert len(actions) == 2
        assert actions[0].task == "Review and merge pull request #42"


def test_analyze_recording_task_idempotency(app):
    """Re-running AI analysis does not duplicate action items or summaries."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Idempotency Sync",
            filename="idemp.wav",
            storage_path="/tmp/idemp.wav",
            file_size_bytes=100,
            duration_seconds=60.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        seg = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=0,
            start_time=0.0,
            end_time=10.0,
            speaker="Speaker 1",
            text="Discussion topic.",
            confidence=0.99,
        )
        db.session.add(seg)
        db.session.commit()

        # Execute twice
        analyze_recording_task(str(rec.id))
        analyze_recording_task(str(rec.id))

        summaries = db.session.query(Summary).filter_by(recording_id=rec.id).all()
        assert len(summaries) == 1

        actions = db.session.query(ActionItem).filter_by(recording_id=rec.id).all()
        assert len(actions) == 2


def test_analyze_recording_task_empty_transcript(app):
    """Empty recording completes analysis cleanly without errors."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Empty Dialogue",
            filename="empty.wav",
            storage_path="/tmp/empty.wav",
            file_size_bytes=50,
            duration_seconds=5.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        db.session.commit()

        res = analyze_recording_task(str(rec.id))
        assert res["success"] is True
        assert res.get("empty") is True

        summary = db.session.query(Summary).filter_by(recording_id=rec.id).first()
        assert summary.status == "completed"
        assert "No dialogue detected" in summary.summary_markdown


def test_get_analysis_endpoint(app, client):
    """Test GET /api/v1/recordings/<id>/analysis returns full structured intelligence."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Endpoint Test",
            filename="ep.wav",
            storage_path="/tmp/ep.wav",
            file_size_bytes=100,
            duration_seconds=30.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        seg = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=0,
            start_time=0.0,
            end_time=5.0,
            speaker="Alex",
            text="Deploy Friday target.",
            confidence=0.99,
        )
        db.session.add(seg)
        db.session.commit()
        rec_id = str(rec.id)

    # Trigger analysis task
    analyze_recording_task(rec_id)

    res = client.get(f"/api/v1/recordings/{rec_id}/analysis")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["status"] == "completed"
    assert len(data["key_takeaways"]) > 0
    assert len(data["action_items"]) == 2
    assert len(data["decisions"]) == 1


def test_get_analysis_status_endpoint(app, client):
    """Test GET /api/v1/recordings/<id>/analysis/status returns lightweight status."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Status Check",
            filename="st.wav",
            storage_path="/tmp/st.wav",
            file_size_bytes=100,
            duration_seconds=30.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        db.session.commit()
        rec_id = str(rec.id)

    res = client.get(f"/api/v1/recordings/{rec_id}/analysis/status")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "status" in data
    assert "recording_id" in data


def test_regenerate_analysis_endpoint(app, client):
    """Test POST /api/v1/recordings/<id>/analysis/regenerate resets and enqueues task."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Regen Test",
            filename="regen.wav",
            storage_path="/tmp/regen.wav",
            file_size_bytes=100,
            duration_seconds=30.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        db.session.commit()
        rec_id = str(rec.id)

    res = client.post(f"/api/v1/recordings/{rec_id}/analysis/regenerate")
    assert res.status_code == 202
    assert res.get_json()["success"] is True


def test_ask_recording_question_success(app, client):
    """Test POST /api/v1/recordings/<id>/ask returns grounded answer with timestamps."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="QA Test",
            filename="qa.wav",
            storage_path="/tmp/qa.wav",
            file_size_bytes=100,
            duration_seconds=60.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        seg = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=0,
            start_time=60.0,
            end_time=75.0,
            speaker="Sarah",
            text="The staging deployment is scheduled for Friday at 3 PM.",
            confidence=0.99,
        )
        db.session.add(seg)
        db.session.commit()
        rec_id = str(rec.id)

    # 1. Ask answerable question
    res = client.post(
        f"/api/v1/recordings/{rec_id}/ask",
        json={"question": "When is the staging deployment scheduled?"},
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["supported_by_transcript"] is True
    assert "Friday" in data["answer"]
    assert 60.0 in data["timestamps"]

    # 2. Ask unanswerable question
    res2 = client.post(
        f"/api/v1/recordings/{rec_id}/ask",
        json={"question": "What is the capital of France?"},
    )
    assert res2.status_code == 200
    data2 = res2.get_json()["data"]
    assert data2["supported_by_transcript"] is False
    assert "does not contain" in data2["answer"].lower()


def test_ask_recording_question_validation(app, client):
    """Test input validation for QA endpoint."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Validation QA",
            filename="vqa.wav",
            storage_path="/tmp/vqa.wav",
            file_size_bytes=100,
            duration_seconds=30.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        db.session.commit()
        rec_id = str(rec.id)

    # Empty question
    res = client.post(f"/api/v1/recordings/{rec_id}/ask", json={"question": ""})
    assert res.status_code == 400
    assert res.get_json()["code"] == "EMPTY_QUESTION"

    # Oversized question
    res_large = client.post(
        f"/api/v1/recordings/{rec_id}/ask",
        json={"question": "A" * 1001},
    )
    assert res_large.status_code == 400
    assert res_large.get_json()["code"] == "QUESTION_TOO_LONG"


def test_toggle_action_item_endpoint(app, client):
    """Test PATCH /api/v1/recordings/<id>/action-items/<id> toggles completed state."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()
        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Action Item Test",
            filename="act.wav",
            storage_path="/tmp/act.wav",
            file_size_bytes=100,
            duration_seconds=30.0,
            mime_type="audio/wav",
            status="completed",
        )
        db.session.add(rec)
        item = ActionItem(
            id=uuid.uuid4(),
            recording_id=rec.id,
            task="Write unit tests",
            completed=False,
        )
        db.session.add(item)
        db.session.commit()
        rec_id = str(rec.id)
        item_id = str(item.id)

    # Toggle to true
    res = client.patch(
        f"/api/v1/recordings/{rec_id}/action-items/{item_id}",
        json={"completed": True},
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["completed"] is True

    # Toggle automatically without body
    res2 = client.patch(f"/api/v1/recordings/{rec_id}/action-items/{item_id}")
    assert res2.status_code == 200
    assert res2.get_json()["data"]["completed"] is False
