import json

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.ollama_service import OllamaService, OllamaValidationError


def normalize(**changes):
    value = {"summary": "The team discussed the release.", "decisions": [], "action_items": []}
    value.update(changes)
    return OllamaService._validate_and_normalize_insights(json.dumps(value))


def test_plain_text_actions_do_not_crash_analysis():
    result = normalize(action_items=["Send the checklist", "Send the checklist"])
    assert result["action_items"] == [{"task": "Send the checklist", "assignee": None, "due_date": None, "completed": False, "source_timestamp": None}]


def test_empty_results_remain_empty_without_invented_decisions_or_tasks():
    result = normalize()
    assert result["decisions"] == []
    assert result["action_items"] == []


def test_timestamp_zero_aliases_and_nullable_fields_are_preserved():
    result = normalize(
        decisions=[{"text": "Ship Friday", "source_timestamp": 0, "context": None}],
        action_items=[{"text": "Send checklist", "sourceTimestamp": "01:05", "assignee": None, "due_date": "null", "completed": "false"}],
    )
    assert result["decisions"][0]["source_timestamp"] == 0
    assert result["decisions"][0]["context"] is None
    assert result["action_items"][0] == {"task": "Send checklist", "source_timestamp": 65, "assignee": None, "due_date": None, "completed": False}


@pytest.mark.parametrize("timestamp", ["NaN", "Infinity", -1, "01:99", True])
def test_invalid_evidence_timestamps_are_discarded(timestamp):
    assert normalize(decisions=[{"decision": "Ship", "source_timestamp": timestamp}])["decisions"][0]["source_timestamp"] is None


@pytest.mark.parametrize("summary", ["", None, "null"])
def test_invalid_summaries_raise_a_recoverable_analysis_error(summary):
    with pytest.raises(OllamaValidationError):
        normalize(summary=summary)


def test_analyze_endpoint_parses_real_model_response_shape(monkeypatch):
    def infer(**kwargs):
        assert "Do not invent decisions" in kwargs["system_prompt"]
        return json.dumps({"summary": "The release was approved.", "decisions": ["Release Friday"], "action_items": ["Alex will send the checklist"], "key_takeaways": [], "topics": ["Release"]})
    monkeypatch.setattr(OllamaService, "_call_ollama", infer)
    monkeypatch.setattr(__import__("app.config", fromlist=["config"]), "AI_INTERNAL_SECRET", "normalization-test-key")
    response = TestClient(app, headers={"X-AI-Internal-Key": "normalization-test-key"}).post("/analyze", json={"transcript_text": "[0.00s] Alex: We agreed to release Friday. I will send the checklist."})
    assert response.status_code == 200
    assert response.json()["decisions"][0]["decision"] == "Release Friday"
    assert response.json()["action_items"][0]["completed"] is False


@pytest.mark.parametrize("timestamps,expected", [(None, []), ("unknown", []), ([0, "2.5", -1, True, "NaN", 0], [0, 2.5])])
def test_qa_handles_missing_or_invalid_evidence_without_losing_the_answer(monkeypatch, timestamps, expected):
    monkeypatch.setattr(OllamaService, "_call_ollama", lambda **kwargs: json.dumps({"answer": "No budget was agreed.", "supported_by_transcript": False, "timestamps": timestamps}))
    result = OllamaService.answer_question("We will meet Friday.", "What budget was agreed?")
    assert result["answer"] == "No budget was agreed."
    assert result["supported_by_transcript"] is False
    assert result["timestamps"] == expected
