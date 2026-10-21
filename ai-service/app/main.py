"""VoxMind Python AI Microservice (FastAPI).

Provides dedicated local machine learning inference for:
- faster-whisper speech transcription
- sentence-transformers embeddings
- Ollama structured insights and summaries
- Transcript-grounded QA and RAG synthesis
"""

import logging
import importlib.util
import shutil
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app import config
from app.schemas import (
    TranscribeRequest,
    TranscribeResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    AskTranscriptRequest,
    AskTranscriptResponse,
    EmbedRequest,
    EmbedResponse,
    ChunkRequest,
    ChunkResponse,
    RAGRequest,
    RAGResponse,
    HealthResponse,
)
from app.services.audio_service import AudioService, AudioValidationError
from app.services.transcription_service import TranscriptionService, TranscriptionServiceError
from app.services.ollama_service import OllamaService, OllamaServiceError, OllamaValidationError
from app.services.embedding_service import EmbeddingService
from app.services.chunking_service import ChunkingService
from app.services.rag_service import RAGService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("voxmind.ai_service")

app = FastAPI(
    title="VoxMind AI Microservice",
    description="Internal Python AI inference service for transcription, embeddings, and Ollama LLM.",
    version="1.0.0",
)

# Internal CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Verify health and configuration of local ML dependencies."""
    whisper_installed = importlib.util.find_spec("faster_whisper") is not None
    av_installed = importlib.util.find_spec("av") is not None
    ffmpeg_installed = shutil.which("ffmpeg") is not None or av_installed
    embedding_installed = importlib.util.find_spec("sentence_transformers") is not None

    ollama_ok, ollama_msg = OllamaService.check_availability()

    services = {
        "whisper": {
            "status": "healthy" if (whisper_installed and ffmpeg_installed) else "degraded",
            "model": config.WHISPER_MODEL,
            "device": config.WHISPER_DEVICE,
            "whisper_installed": whisper_installed,
            "ffmpeg_installed": ffmpeg_installed,
        },
        "ollama": {
            "status": "healthy" if ollama_ok else "degraded",
            "configured_model": config.OLLAMA_MODEL,
            "base_url": config.OLLAMA_BASE_URL,
            "message": ollama_msg,
        },
        "embedding": {
            "status": "healthy" if embedding_installed else "unconfigured",
            "model": config.EMBEDDING_MODEL,
            "dimension": config.EMBEDDING_DIMENSION,
            "device": config.EMBEDDING_DEVICE,
        },
    }

    overall = "healthy" if all(s["status"] == "healthy" for s in services.values()) else "degraded"
    return HealthResponse(status=overall, services=services)


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe_audio(payload: TranscribeRequest):
    """Execute speech-to-text inference on a local audio file."""
    try:
        result = TranscriptionService.transcribe(
            audio_path=payload.audio_path,
            language=payload.language,
        )
        return TranscribeResponse(
            success=True,
            language=result["language"],
            language_probability=result["language_probability"],
            duration=result["duration"],
            segments=result["segments"],
        )
    except TranscriptionServiceError as exc:
        logger.error("Transcription error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected transcription error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Internal transcription failure: {str(exc)}")


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_transcript(payload: AnalyzeRequest):
    """Generate structured summary, takeaways, decisions, and action items via Ollama."""
    try:
        insights = OllamaService.generate_insights(
            transcript_text=payload.transcript_text,
            model_name=payload.model_name,
        )
        return AnalyzeResponse(
            success=True,
            model_name=insights["model_name"],
            summary=insights["summary"],
            key_takeaways=insights["key_takeaways"],
            decisions=insights["decisions"],
            action_items=insights["action_items"],
            topics=insights["topics"],
        )
    except (OllamaServiceError, OllamaValidationError) as exc:
        logger.error("Analysis failure: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected analysis error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Internal analysis failure: {str(exc)}")


@app.post("/ask", response_model=AskTranscriptResponse)
def ask_transcript(payload: AskTranscriptRequest):
    """Answer a question grounded exclusively in a single transcript."""
    try:
        res = OllamaService.answer_question(
            transcript_text=payload.transcript_text,
            question=payload.question,
            model_name=payload.model_name,
        )
        return AskTranscriptResponse(
            success=True,
            question=payload.question,
            answer=res["answer"],
            supported_by_transcript=res["supported_by_transcript"],
            timestamps=res["timestamps"],
            model_name=res["model_name"],
        )
    except OllamaServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal QA failure: {str(exc)}")


@app.post("/embed", response_model=EmbedResponse)
def embed_passages(payload: EmbedRequest):
    """Generate normalized embedding vectors using sentence-transformers."""
    try:
        embeddings = EmbeddingService.embed_texts(payload.texts)
        return EmbedResponse(
            success=True,
            model_name=config.EMBEDDING_MODEL,
            dimension=config.EMBEDDING_DIMENSION,
            embeddings=embeddings,
        )
    except Exception as exc:
        logger.exception("Embedding error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Vector embedding failure: {str(exc)}")


@app.post("/chunk", response_model=ChunkResponse)
def chunk_segments(payload: ChunkRequest):
    """Deterministically partition dialogue segments into overlap-windowed passages."""
    try:
        chunks = ChunkingService.chunk_segments(
            segments=payload.segments,
            target_words=payload.target_words or config.CHUNK_TARGET_WORDS,
            overlap_words=payload.overlap_words or config.CHUNK_OVERLAP_WORDS,
        )
        return ChunkResponse(success=True, chunks=chunks)
    except Exception as exc:
        logger.exception("Chunking error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Chunking failure: {str(exc)}")


@app.post("/rag", response_model=RAGResponse)
def rag_synthesis(payload: RAGRequest):
    """Evidence-grounded cross-recording question answering with citations."""
    try:
        result = RAGService.synthesize_answer(
            question=payload.question,
            passages=payload.passages,
            model_name=payload.model_name,
        )
        return RAGResponse(
            success=True,
            answer=result["answer"],
            citations=result["citations"],
            sufficient_evidence=result["sufficient_evidence"],
            model_name=result["model_name"],
        )
    except Exception as exc:
        logger.exception("RAG error: %s", exc)
        raise HTTPException(status_code=500, detail=f"RAG failure: {str(exc)}")
