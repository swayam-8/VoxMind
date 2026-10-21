"""Pydantic schemas for AI Microservice requests and responses."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TranscribeRequest(BaseModel):
    audio_path: str = Field(..., description="Absolute server path to audio file")
    language: Optional[str] = Field(None, description="Optional ISO language code")


class TranscriptSegmentResult(BaseModel):
    start: float
    end: float
    speaker: str = "Speaker 1"
    text: str
    confidence: float = 0.95


class TranscribeResponse(BaseModel):
    success: bool = True
    language: str
    language_probability: float
    duration: float
    segments: List[TranscriptSegmentResult]


class AnalyzeRequest(BaseModel):
    transcript_text: str = Field(..., description="Ordered dialogue transcript with speaker tags")
    model_name: Optional[str] = None


class ActionItemResult(BaseModel):
    task: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    completed: bool = False
    source_timestamp: Optional[float] = None


class DecisionResult(BaseModel):
    decision: str
    context: Optional[str] = None
    source_timestamp: Optional[float] = None


class AnalyzeResponse(BaseModel):
    success: bool = True
    model_name: str
    summary: str
    key_takeaways: List[str]
    decisions: List[DecisionResult]
    action_items: List[ActionItemResult]
    topics: List[str]


class AskTranscriptRequest(BaseModel):
    transcript_text: str
    question: str
    model_name: Optional[str] = None


class AskTranscriptResponse(BaseModel):
    success: bool = True
    question: str
    answer: str
    supported_by_transcript: bool
    timestamps: List[float]
    model_name: str


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., description="Passages to vectorize")


class EmbedResponse(BaseModel):
    success: bool = True
    model_name: str
    dimension: int
    embeddings: List[List[float]]


class ChunkItem(BaseModel):
    chunk_index: int
    start_time: float
    end_time: float
    speaker: str
    text: str
    source_segment_ids: List[str]
    content_hash: str


class ChunkRequest(BaseModel):
    segments: List[Dict[str, Any]]
    target_words: Optional[int] = 180
    overlap_words: Optional[int] = 35


class ChunkResponse(BaseModel):
    success: bool = True
    chunks: List[ChunkItem]


class CitationItem(BaseModel):
    recording_id: str
    recording_title: str
    chunk_id: str
    start_time: float
    end_time: float
    speaker: str
    quote: str
    score: float


class RAGRequest(BaseModel):
    question: str
    passages: List[Dict[str, Any]]
    model_name: Optional[str] = None


class RAGResponse(BaseModel):
    success: bool = True
    answer: str
    citations: List[CitationItem]
    sufficient_evidence: bool
    model_name: str


class HealthResponse(BaseModel):
    status: str
    service: str = "VoxMind AI Microservice"
    services: Dict[str, Any]
