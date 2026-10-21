"""Recording and Transcription Job Models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.workspace import Workspace
    from app.models.user import User
    from app.models.collection import Collection
    from app.models.transcript import TranscriptSegment
    from app.models.insight import Summary, ActionItem


class Recording(BaseModel):
    """Audio recording asset and its processing lifecycle."""

    __tablename__ = "recordings"

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
    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("collections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    filename: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(sa.String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(sa.Float, default=0.0, nullable=False)
    mime_type: Mapped[str] = mapped_column(sa.String(64), nullable=False)

    # Status tracking: 'queued', 'transcribing', 'summarizing', 'ready', 'failed'
    status: Mapped[str] = mapped_column(sa.String(32), default="queued", index=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="recordings")
    user: Mapped["User"] = relationship("User", back_populates="recordings")
    collection: Mapped[Optional["Collection"]] = relationship(
        "Collection", back_populates="recordings"
    )

    jobs: Mapped[List["TranscriptionJob"]] = relationship(
        "TranscriptionJob", back_populates="recording", cascade="all, delete-orphan"
    )
    segments: Mapped[List["TranscriptSegment"]] = relationship(
        "TranscriptSegment",
        back_populates="recording",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.start_time",
    )
    summaries: Mapped[List["Summary"]] = relationship(
        "Summary", back_populates="recording", cascade="all, delete-orphan"
    )
    action_items: Mapped[List["ActionItem"]] = relationship(
        "ActionItem", back_populates="recording", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        """Serialize recording with collection details."""
        data = super().to_dict()
        data["collection_name"] = self.collection.name if self.collection else None
        return data


class TranscriptionJob(BaseModel):
    """Tracks asynchronous Celery background task processing for a recording."""

    __tablename__ = "transcription_jobs"

    recording_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("recordings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    celery_task_id: Mapped[Optional[str]] = mapped_column(sa.String(128), index=True, nullable=True)
    status: Mapped[str] = mapped_column(
        sa.String(32), default="pending", index=True, nullable=False
    )  # 'pending', 'processing', 'completed', 'failed'
    engine: Mapped[str] = mapped_column(sa.String(64), default="faster-whisper", nullable=False)
    model_name: Mapped[str] = mapped_column(sa.String(64), default="base", nullable=False)
    device: Mapped[str] = mapped_column(sa.String(32), default="cpu", nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    # Relationships
    recording: Mapped["Recording"] = relationship("Recording", back_populates="jobs")
