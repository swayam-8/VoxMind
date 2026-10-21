"""Audio Validation and Preprocessing Service.

Performs deep file inspection, magic byte validation, audio container verification,
and duration extraction using PyAV / native decoders without shell execution risks.
"""

import os
from typing import Tuple
import av


class AudioValidationError(Exception):
    """Raised when an uploaded file fails audio content validation."""
    pass


class AudioService:
    """Service to validate, inspect, and normalize audio assets."""

    AUDIO_MAGIC_SIGNATURES = {
        "wav": [(0, b"RIFF", 8, b"WAVE")],
        "mp3": [
            (0, b"ID3"),
            (0, b"\xff\xfb"),
            (0, b"\xff\xf3"),
            (0, b"\xff\xf2"),
            (0, b"\xff\xfa"),
        ],
        "ogg": [(0, b"OggS")],
        "flac": [(0, b"fLaC")],
        "m4a": [(4, b"ftyp")],
        "webm": [(0, b"\x1a\x45\xdf\xa3")],
    }

    @classmethod
    def validate_magic_bytes(cls, file_stream) -> str:
        """Inspect file header bytes to confirm authentic audio data."""
        pos = file_stream.tell()
        header = file_stream.read(32)
        file_stream.seek(pos)

        if not header or len(header) < 4:
            raise AudioValidationError("Audio file is empty or too short.")

        # Test signatures
        for fmt, sigs in cls.AUDIO_MAGIC_SIGNATURES.items():
            for sig in sigs:
                if len(sig) == 2:
                    offset, pattern = sig
                    if len(header) >= offset + len(pattern):
                        if header[offset : offset + len(pattern)] == pattern:
                            return fmt
                elif len(sig) == 4:
                    off1, pat1, off2, pat2 = sig
                    if len(header) >= off2 + len(pat2):
                        if (
                            header[off1 : off1 + len(pat1)] == pat1
                            and header[off2 : off2 + len(pat2)] == pat2
                        ):
                            return fmt

        raise AudioValidationError(
            "File content does not match any supported audio signature "
            "(MP3, WAV, M4A, OGG, FLAC, WEBM)."
        )

    @classmethod
    def inspect_audio_container(cls, file_path: str) -> Tuple[float, int, int]:
        """Inspect audio stream using PyAV to verify decodability, duration, and channels.

        Returns: (duration_seconds, sample_rate, channels)
        """
        if not os.path.exists(file_path):
            raise AudioValidationError(f"Audio file not found at {file_path}")

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            raise AudioValidationError("Audio file is empty (0 bytes).")

        try:
            with av.open(file_path, mode="r") as container:
                audio_streams = [s for s in container.streams if s.type == "audio"]
                if not audio_streams:
                    raise AudioValidationError("Container does not contain any valid audio stream.")

                stream = audio_streams[0]
                duration_seconds = 0.0

                if stream.duration is not None and stream.time_base is not None:
                    duration_seconds = float(stream.duration * stream.time_base)
                elif container.duration is not None:
                    duration_seconds = float(container.duration / av.time_base)

                sample_rate = stream.sample_rate or 16000
                channels = stream.channels or 1

                return max(0.0, duration_seconds), sample_rate, channels

        except (av.InvalidDataError, av.FFmpegError) as exc:
            raise AudioValidationError(f"Corrupted or invalid audio stream: {str(exc)}")
        except Exception as exc:
            raise AudioValidationError(f"Could not decode audio file: {str(exc)}")
