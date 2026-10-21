"""Integration tests for Python AI Microservice."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.transcription_service import TranscriptionService
from app.services.ollama_service import OllamaService
from app.services.embedding_service import EmbeddingService
from app.services.rag_service import RAGService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_ai_services():
    """Mock out model inference for instant deterministic tests."""
    def _mock_transcribe(audio_path, language=None):
        return {
            "language": "en",
            "language_probability": 0.99,
            "duration": 5.0,
            "segments": [
                {
                    "start": 0.0,
                    "end": 2.5,
                    "speaker": "Speaker 1",
                    "text": "Hello and welcome to VoxMind.",
                    "confidence": 0.98,
                },
                {
                    "start": 2.5,
                    "end": 5.0,
                    "speaker": "Speaker 2",
                    "text": "The local voice intelligence platform.",
                    "confidence": 0.97,
                },
            ],
        }

    def _mock_insights(transcript_text):
        return {
            "model_name": "llama3.2",
            "summary": "Executive sync on local voice intelligence.",
            "key_takeaways": ["Fast local STT verified", "Ollama LLM connected"],
            "decisions": [{"decision": "Approved local-first stack", "context": "No external APIs", "source_timestamp": 2.5}],
            "action_items": [{"task": "Deploy BullMQ worker", "assignee": "Alex", "due_date": "Tomorrow", "completed": False, "source_timestamp": 0.0}],
            "topics": ["Architecture", "Local AI"],
        }

    def _mock_qa(transcript_text, question):
        return {
            "answer": "VoxMind is a local-first voice intelligence platform.",
            "supported_by_transcript": True,
            "timestamps": [0.0, 2.5],
            "model_name": "llama3.2",
        }

    def _mock_embed(texts):
        return [[0.1] * 384 for _ in texts]

    def _mock_rag(question, passages):
        return {
            "answer": "According to [Passage 1], VoxMind runs locally.",
            "citations": [
                {
                    "recording_id": "rec-1",
                    "recording_title": "Architecture Sync",
                    "chunk_id": "chunk-1",
                    "start_time": 0.0,
                    "end_time": 2.5,
                    "speaker": "Speaker 1",
                    "quote": "Hello and welcome to VoxMind.",
                    "score": 0.95,
                }
            ],
            "sufficient_evidence": True,
            "model_name": "llama3.2",
        }

    TranscriptionService.set_mock_transcriber(_mock_transcribe)
    OllamaService.set_mock_generator(_mock_insights)
    OllamaService.set_mock_qa(_mock_qa)
    EmbeddingService.set_mock_embedder(_mock_embed)
    RAGService.set_mock_generator(_mock_rag)

    yield

    TranscriptionService.clear_mock_transcriber()
    OllamaService.clear_mock_generator()
    OllamaService.clear_mock_qa()
    EmbeddingService.set_mock_embedder(None)
    RAGService.set_mock_generator(None)


def test_health_endpoint(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["service"] == "VoxMind AI Microservice"
    assert "whisper" in data["services"]
    assert "embedding" in data["services"]


def test_transcribe_endpoint(client: TestClient, tmp_path):
    dummy_audio = tmp_path / "test.wav"
    dummy_audio.write_bytes(b"RIFF....WAVEfmt ")

    res = client.post("/transcribe", json={"audio_path": str(dummy_audio)})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["language"] == "en"
    assert len(data["segments"]) == 2


def test_analyze_endpoint(client: TestClient):
    res = client.post(
        "/analyze",
        json={"transcript_text": "Speaker 1: Hello.\nSpeaker 2: Let us approve this."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["model_name"] == "llama3.2"
    assert len(data["key_takeaways"]) == 2
    assert len(data["decisions"]) == 1


def test_ask_endpoint(client: TestClient):
    res = client.post(
        "/ask",
        json={"transcript_text": "Speaker 1: Welcome to VoxMind.", "question": "What is VoxMind?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["supported_by_transcript"] is True
    assert len(data["timestamps"]) == 2


def test_embed_endpoint(client: TestClient):
    res = client.post("/embed", json={"texts": ["Hello world", "Audio search"]})
    assert res.status_code == 200
    data = res.json()
    assert len(data["embeddings"]) == 2
    assert len(data["embeddings"][0]) == 384


def test_chunk_endpoint(client: TestClient):
    segments = [
        {"start_time": 0.0, "end_time": 2.0, "speaker": "Alex", "text": "First passage"},
        {"start_time": 2.0, "end_time": 4.0, "speaker": "Elena", "text": "Second passage"},
    ]
    res = client.post("/chunk", json={"segments": segments})
    assert res.status_code == 200
    data = res.json()
    assert len(data["chunks"]) >= 1
    assert data["chunks"][0]["speaker"] == "Alex, Elena"


def test_rag_endpoint(client: TestClient):
    passages = [
        {
            "recording_id": "rec-1",
            "recording_title": "Architecture Sync",
            "chunk_id": "chunk-1",
            "start_time": 0.0,
            "end_time": 2.5,
            "speaker": "Speaker 1",
            "text": "Hello and welcome to VoxMind.",
            "score": 0.95,
        }
    ]
    res = client.post("/rag", json={"question": "Where does VoxMind run?", "passages": passages})
    assert res.status_code == 200
    data = res.json()
    assert data["sufficient_evidence"] is True
    assert len(data["citations"]) == 1
