"""The internal service must reject unauthenticated inference and unsafe paths."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import config
from app.services.transcription_service import TranscriptionService


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "AI_INTERNAL_SECRET", "security-test-internal-key")
    monkeypatch.setattr(config, "AUDIO_STORAGE_ROOT", str(tmp_path))
    return TestClient(app)


@pytest.mark.parametrize("endpoint", ["transcribe", "analyze", "ask", "embed", "chunk", "rag"])
def test_inference_requires_internal_authentication(client, endpoint):
    assert client.post(f"/{endpoint}", json={}).status_code == 401
    assert client.post(f"/{endpoint}", json={}, headers={"X-AI-Internal-Key": "wrong-key"}).status_code == 401


def test_no_default_secret_or_browser_cors_access(client, monkeypatch):
    monkeypatch.setattr(config, "AI_INTERNAL_SECRET", "")
    response = client.post("/embed", json={"texts": ["private"]}, headers={"Origin": "https://attacker.example"})
    assert response.status_code == 401
    assert "access-control-allow-origin" not in response.headers


def test_missing_or_external_file_is_rejected_before_inference(client, monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(TranscriptionService, "transcribe", lambda **kwargs: calls.append(kwargs))
    outside = tmp_path.parent / "outside-secret.wav"
    outside.write_bytes(b"RIFF....WAVEfmt ")
    symlink = tmp_path / "linked.wav"
    symlink.symlink_to(outside)
    try:
        for candidate in [str(outside), str(symlink), "/etc/passwd", "https://example.test/audio.wav"]:
            response = client.post("/transcribe", json={"audio_path": candidate}, headers={"X-AI-Internal-Key": "security-test-internal-key"})
            assert response.status_code == 400
            assert "/etc/passwd" not in response.text
        assert calls == []
    finally:
        outside.unlink()


def test_large_chunked_body_is_bounded_before_parsing(client, monkeypatch):
    monkeypatch.setattr(config, "AI_MAX_REQUEST_BYTES", 100)
    response = client.post("/embed", content=iter([b'x' * 60, b'x' * 60]), headers={"X-AI-Internal-Key": "security-test-internal-key", "Content-Type": "application/json"})
    assert response.status_code == 413


def test_invalid_chunk_limits_are_rejected(client):
    response = client.post("/chunk", json={"segments": [], "target_words": -1}, headers={"X-AI-Internal-Key": "security-test-internal-key"})
    assert response.status_code == 422


def test_internal_failure_does_not_expose_server_exception(client, monkeypatch):
    def fail(**kwargs):
        raise RuntimeError("SECRET-internal-password")
    from app.services.ollama_service import OllamaService
    monkeypatch.setattr(OllamaService, "answer_question", fail)
    response = client.post("/ask", json={"transcript_text": "Meeting transcript", "question": "What happened?"}, headers={"X-AI-Internal-Key": "security-test-internal-key"})
    assert response.status_code == 500
    assert "SECRET" not in response.text


def test_real_audio_decoding_accepts_wav_and_rejects_playlists(tmp_path):
    import wave
    from app.services.audio_service import AudioService, AudioValidationError
    recording = tmp_path / "real.wav"
    with wave.open(str(recording), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(16000)
        output.writeframes(b"\x00\x00" * 1600)
    duration, rate, channels = AudioService.inspect_audio_container(str(recording))
    assert duration > 0 and rate == 16000 and channels == 1
    playlist = tmp_path / "disguised.wav"
    playlist.write_text("ffconcat version 1.0\nfile '/etc/passwd'\n")
    with pytest.raises(AudioValidationError):
        AudioService.inspect_audio_container(str(playlist))
