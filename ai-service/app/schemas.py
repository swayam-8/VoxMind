"""Pydantic schemas for AI Microservice requests and responses."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, model_validator


class TranscribeRequest(BaseModel):
    audio_path: str = Field(default="", max_length=4096, description="Absolute server path to audio file")
    file_path: Optional[str] = Field(None, max_length=4096, description="Alias for audio_path")
    language: Optional[str] = Field(None, pattern=r"^[a-z]{2,3}$", description="Optional ISO language code")

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("audio_path") and data.get("file_path"):
                data["audio_path"] = data["file_path"]
        return data


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
    transcript_text: str = Field(..., min_length=1, max_length=1000000, description="Ordered dialogue transcript with speaker tags")
    model_name: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = None


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
    prompt_tokens: int = 0
    completion_tokens: int = 0


class AskTranscriptRequest(BaseModel):
    transcript_text: str = Field(min_length=1, max_length=1000000)
    question: str = Field(min_length=1, max_length=4000)
    model_name: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = None


class AskTranscriptResponse(BaseModel):
    success: bool = True
    question: str = Field(min_length=1, max_length=4000)
    answer: str
    supported_by_transcript: bool
    timestamps: List[float]
    model_name: str
    prompt_tokens: int = 0
    completion_tokens: int = 0


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=2048, description="Passages to vectorize")


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
    source_segment_ids: List[str] = Field(default_factory=list)
    content_hash: str = ""
    token_count: int = 0


class ChunkRequest(BaseModel):
    segments: List[Dict[str, Any]] = Field(max_length=10000)
    target_words: Optional[int] = Field(180, ge=1, le=2000)
    overlap_words: Optional[int] = Field(35, ge=0, le=1000)
    max_tokens: Optional[int] = None
    overlap_tokens: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("target_words") is None and data.get("max_tokens") is not None:
                # Approximate 1 token ~ 0.75 words, or use direct integer
                data["target_words"] = int(data["max_tokens"] * 0.75) if data["max_tokens"] > 50 else data["max_tokens"]
            if data.get("overlap_words") is None and data.get("overlap_tokens") is not None:
                data["overlap_words"] = int(data["overlap_tokens"] * 0.75) if data["overlap_tokens"] > 10 else data["overlap_tokens"]
        return data


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
    question: str = Field(default="", max_length=4000, description="Question to answer")
    query: Optional[str] = Field(None, description="Alias for question")
    passages: List[Dict[str, Any]] = Field(default_factory=list, max_length=100, description="Retrieved candidate passages")
    chunks: Optional[List[Dict[str, Any]]] = Field(None, max_length=100, description="Alias for passages")
    model_name: Optional[str] = Field(None, max_length=100)
    top_k: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("question") and data.get("query"):
                data["question"] = data["query"]
            if not data.get("passages") and data.get("chunks"):
                data["passages"] = data["chunks"]
            # Ensure each passage has a score key
            if "passages" in data and isinstance(data["passages"], list):
                for p in data["passages"]:
                    if isinstance(p, dict):
                        if "score" not in p and "similarity" in p:
                            p["score"] = p["similarity"]
                        elif "score" not in p:
                            p["score"] = 0.5
        return data


class RAGResponse(BaseModel):
    success: bool = True
    answer: str
    citations: List[CitationItem]
    sources: Optional[List[Dict[str, Any]]] = None
    sufficient_evidence: bool
    model_name: str
    confidence: float = 0.95
    prompt_tokens: int = 0
    completion_tokens: int = 0


class HealthResponse(BaseModel):
    status: str
    service: str = "MeetingBrief AI Microservice"
    services: Dict[str, Any]
