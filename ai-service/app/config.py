"""Configuration settings for Python AI Microservice."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_TIMEOUT_SECONDS = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
AI_MAX_TRANSCRIPT_CHARS = int(os.getenv("AI_MAX_TRANSCRIPT_CHARS", "32000"))
AI_MAX_OUTPUT_TOKENS = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "2048"))
AI_PROMPT_VERSION = os.getenv("AI_PROMPT_VERSION", "v1")

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "384"))
EMBEDDING_DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))
EMBEDDING_MAX_SEQUENCE_LENGTH = int(os.getenv("EMBEDDING_MAX_SEQUENCE_LENGTH", "256"))
EMBEDDING_NORMALIZE = os.getenv("EMBEDDING_NORMALIZE", "true").lower() in ("true", "1", "yes")

CHUNK_TARGET_WORDS = int(os.getenv("CHUNK_TARGET_WORDS", "180"))
CHUNK_OVERLAP_WORDS = int(os.getenv("CHUNK_OVERLAP_WORDS", "35"))
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "10"))
RETRIEVAL_MIN_SCORE = float(os.getenv("RETRIEVAL_MIN_SCORE", "0.35"))

AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
AI_SERVICE_HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "voxmind-internal-ai-service-secret")
