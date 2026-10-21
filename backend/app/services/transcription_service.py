"""Local faster-whisper Speech-to-Text Transcription Service.

Manages process-level lazy model loading, hardware device detection,
audio transcription with VAD segmentation, and chronological timestamp extraction.
"""

import os
import math
import logging
from typing import List, Dict, Any, Optional
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


class TranscriptionServiceError(Exception):
    """Raised when speech transcription fails."""
    pass


class TranscriptionService:
    """Singleton-oriented manager for local faster-whisper inference."""

    _model_instance: Optional[WhisperModel] = None
    _cached_config: Optional[tuple] = None
    _mock_transcriber = None

    @classmethod
    def set_mock_transcriber(cls, mock_fn):
        """Set a test mock for unit tests to prevent downloading neural weights."""
        cls._mock_transcriber = mock_fn

    @classmethod
    def clear_mock_transcriber(cls):
        """Clear test mock."""
        cls._mock_transcriber = None

    @classmethod
    def get_model(cls) -> WhisperModel:
        """Lazily initialize and return the cached WhisperModel for this process."""
        if cls._mock_transcriber is not None:
            return None  # type: ignore

        model_size = os.getenv("WHISPER_MODEL_SIZE", os.getenv("WHISPER_MODEL", "base"))
        device = os.getenv("WHISPER_DEVICE", "cpu")
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
        current_config = (model_size, device, compute_type)

        if cls._model_instance is None or cls._cached_config != current_config:
            logger.info(
                "Initializing local faster-whisper model '%s' on %s (compute: %s)",
                model_size,
                device,
                compute_type,
            )
            download_root = os.getenv(
                "WHISPER_DOWNLOAD_ROOT",
                os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "storage", "models"),
            )
            os.makedirs(download_root, exist_ok=True)

            try:
                cls._model_instance = WhisperModel(
                    model_size,
                    device=device,
                    compute_type=compute_type,
                    download_root=download_root,
                )
                cls._cached_config = current_config
                logger.info("faster-whisper model '%s' loaded successfully.", model_size)
            except Exception as exc:
                logger.error("Failed to load faster-whisper model: %s", exc)
                raise TranscriptionServiceError(
                    f"Could not load faster-whisper model '{model_size}' "
                    f"on device '{device}': {str(exc)}"
                )

        return cls._model_instance

    @classmethod
    def transcribe(
        cls,
        audio_path: str,
        language: Optional[str] = None,
        vad_filter: bool = True,
    ) -> Dict[str, Any]:
        """Execute local speech-to-text inference on an audio file.

        Returns:
            Dict containing detected language, duration, and ordered timestamped segments.
        """
        if not os.path.exists(audio_path):
            raise TranscriptionServiceError(f"Audio file does not exist at {audio_path}")

        # Check mock override for unit tests
        if cls._mock_transcriber is not None:
            return cls._mock_transcriber(audio_path, language=language)

        model = cls.get_model()
        configured_language = language or os.getenv("WHISPER_LANGUAGE") or None

        try:
            logger.info("Starting faster-whisper transcription for %s", audio_path)
            segments_gen, info = model.transcribe(
                audio_path,
                beam_size=5,
                language=configured_language,
                vad_filter=vad_filter,
                vad_parameters=dict(min_silence_duration_ms=600),
            )

            result_segments: List[Dict[str, Any]] = []
            for seg in segments_gen:
                text = seg.text.strip()
                if not text:
                    continue

                # Safely convert logprob to confidence score between 0.0 and 1.0
                confidence = 1.0
                if hasattr(seg, "avg_logprob") and seg.avg_logprob is not None:
                    try:
                        confidence = round(max(0.0, min(1.0, math.exp(seg.avg_logprob))), 3)
                    except (OverflowError, ValueError):
                        confidence = 0.95

                result_segments.append(
                    {
                        "start": round(float(seg.start), 2),
                        "end": round(float(seg.end), 2),
                        "text": text,
                        "confidence": confidence,
                    }
                )

            prob = (
                round(float(info.language_probability), 3)
                if hasattr(info, "language_probability")
                else 1.0
            )
            dur = (
                round(float(info.duration), 2)
                if hasattr(info, "duration")
                else 0.0
            )
            return {
                "language": info.language if hasattr(info, "language") else "en",
                "language_probability": prob,
                "duration": dur,
                "segments": result_segments,
            }

        except Exception as exc:
            logger.exception("Error during speech transcription: %s", exc)
            raise TranscriptionServiceError(f"Speech-to-text inference failed: {str(exc)}")
