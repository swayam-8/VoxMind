"""Collection Model for grouping audio recordings."""

import uuid
from typing import TYPE_CHECKING, List, Optional
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.workspace import Workspace
    from app.models.recording import Recording


class Collection(BaseModel):
    """User-defined group for organizing recordings within a workspace."""

    __tablename__ = "collections"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    color: Mapped[str] = mapped_column(sa.String(16), default="#8B5CF6", nullable=False)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="collections")
    recordings: Mapped[List["Recording"]] = relationship("Recording", back_populates="collection")

    def to_dict(self) -> dict:
        """Convert collection to dictionary, including computed recording count."""
        data = super().to_dict()
        data["recording_count"] = len(self.recordings) if self.recordings else 0
        return data
