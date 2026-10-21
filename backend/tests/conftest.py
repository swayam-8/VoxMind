"""Pytest fixtures for VoxMind backend test suite."""

import io
import wave
import pytest
from app import create_app
from app.extensions import db
from app.services.transcription_service import TranscriptionService
from app.services.ollama_service import OllamaService


def generate_wav_bytes(duration_seconds: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Generate authentic, uncompressed PCM WAV bytes for testing."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = int(sample_rate * duration_seconds)
        wav_file.writeframes(b"\x00\x00" * frames)
    return buf.getvalue()


@pytest.fixture(scope="session")
def app():
    """Create test application configured for testing with SQLite and eager execution."""
    test_app = create_app("testing")

    with test_app.app_context():
        db.create_all()
        yield test_app
        db.drop_all()


@pytest.fixture
def client(app):
    """Test client for issuing requests."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Test CLI runner."""
    return app.test_cli_runner()


@pytest.fixture
def test_wav_bytes():
    """Returns valid 1.0 second WAV file bytes."""
    return generate_wav_bytes(1.0)


@pytest.fixture(autouse=True)
def mock_transcription():
    """Mock Whisper inference during tests to avoid heavy weight downloads."""
    def _mock_transcribe(audio_path, language=None):
        return {
            "language": "en",
            "language_probability": 0.98,
            "duration": 2.5,
            "segments": [
                {
                    "start": 0.0,
                    "end": 1.25,
                    "text": "Welcome to VoxMind voice intelligence platform.",
                    "confidence": 0.96,
                    "speaker": "Speaker 1",
                },
                {
                    "start": 1.25,
                    "end": 2.5,
                    "text": "This audio recording has been transcribed successfully.",
                    "confidence": 0.94,
                    "speaker": "Speaker 1",
                },
            ],
        }

    TranscriptionService.set_mock_transcriber(_mock_transcribe)
    yield _mock_transcribe
    TranscriptionService.clear_mock_transcriber()


@pytest.fixture(autouse=True)
def mock_ollama_global():
    """Mock Ollama local LLM during all automated test runs."""
    def _mock_generate(transcript_text):
        return {
            "model_name": "llama3.2",
            "summary": (
                "The team aligned on the Q4 release roadmap, "
                "finalizing the Friday staging deployment timeline."
            ),
            "key_takeaways": [
                "Database migration completed ahead of schedule.",
                "Staging deployment target confirmed for Friday at 3 PM.",
                "Security review scheduled for next Tuesday.",
            ],
            "decisions": [
                {
                    "decision": "Approved deployment to staging on Friday.",
                    "context": "All integration tests passed with zero regressions.",
                    "source_timestamp": 45.0,
                }
            ],
            "action_items": [
                {
                    "task": "Review and merge pull request #42",
                    "assignee": "Alex Chen",
                    "due_date": "Friday",
                    "completed": False,
                    "source_timestamp": 60.5,
                },
                {
                    "task": "Configure production monitoring alerts",
                    "assignee": None,
                    "due_date": None,
                    "completed": False,
                    "source_timestamp": 90.0,
                },
            ],
            "topics": ["Q4 Roadmap", "Staging Deployment", "Security Review"],
        }

    def _mock_qa(transcript_text, question):
        q_lower = question.lower()
        if "deployment" in q_lower or "staging" in q_lower or "friday" in q_lower:
            return {
                "answer": "The staging deployment is scheduled for Friday at [01:00].",
                "supported_by_transcript": True,
                "timestamps": [60.0],
                "model_name": "llama3.2",
            }
        return {
            "answer": (
                "The provided transcript does not contain information to answer this question."
            ),
            "supported_by_transcript": False,
            "timestamps": [],
            "model_name": "llama3.2",
        }

    OllamaService.set_mock_generator(_mock_generate)
    OllamaService.set_mock_qa(_mock_qa)
    yield
    OllamaService.clear_mock_generator()
    OllamaService.clear_mock_qa()
