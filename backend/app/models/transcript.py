"""Transcript Segment and Chunk Models."""

import uuid
from typing import TYPE_CHECKING, List
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.recording import Recording


class TranscriptSegment(BaseModel):
    """Timestamped speech segment extracted from faster-whisper."""

    __tablename__ = "transcript_segments"

    recording_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("recordings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    start_time: Mapped[float] = mapped_column(sa.Float, nullable=False, index=True)
    end_time: Mapped[float] = mapped_column(sa.Float, nullable=False)
    speaker: Mapped[str] = mapped_column(sa.String(64), default="Speaker 1", nullable=False)
    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
    confidence: Mapped[float] = mapped_column(sa.Float, default=1.0, nullable=False)

    # Relationships
    recording: Mapped["Recording"] = relationship("Recording", back_populates="segments")


class TranscriptChunk(BaseModel):
    """Passage chunk generated from adjacent segments for semantic search and RAG."""

    __tablename__ = "transcript_chunks"

    recording_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("recordings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    start_time: Mapped[float] = mapped_column(sa.Float, nullable=False, index=True)
    end_time: Mapped[float] = mapped_column(sa.Float, nullable=False)
    speaker: Mapped[str] = mapped_column(sa.String(64), default="Speaker 1", nullable=False)
    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
    source_segment_ids: Mapped[list] = mapped_column(sa.JSON, default=list, nullable=False)
    content_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    embedding_model: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    embedding: Mapped[List[float]] = mapped_column(Vector(384), nullable=False)

    # Relationships
    recording: Mapped["Recording"] = relationship("Recording", back_populates="chunks")

    def to_dict(self) -> dict:
        data = super().to_dict()
        data.pop("embedding", None)
        return data
