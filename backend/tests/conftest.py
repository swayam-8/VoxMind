"""Pytest fixtures for VoxMind backend test suite."""

import io
import wave
import pytest
from app import create_app
from app.extensions import db
from app.services.transcription_service import TranscriptionService


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
