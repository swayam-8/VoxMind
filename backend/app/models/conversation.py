"""Conversation and Message Models for Ask VoxMind."""

import uuid
from typing import TYPE_CHECKING, List, Optional
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.workspace import Workspace
    from app.models.user import User


class Conversation(BaseModel):
    """Interactive RAG inquiry session across recordings or the entire library."""

    __tablename__ = "conversations"

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
    title: Mapped[str] = mapped_column(sa.String(255), default="New Inquiry", nullable=False)
    scope_type: Mapped[str] = mapped_column(
        sa.String(32), default="library", nullable=False
    )  # 'library', 'recording'
    scope_recording_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        sa.Uuid(as_uuid=True), sa.ForeignKey("recordings.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="conversations")
    user: Mapped["User"] = relationship("User")
    messages: Mapped[List["ConversationMessage"]] = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )


class ConversationMessage(BaseModel):
    """Individual user query or AI response with verified source citations."""

    __tablename__ = "conversation_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender: Mapped[str] = mapped_column(sa.String(16), nullable=False)  # 'user', 'assistant'
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    citations: Mapped[list] = mapped_column(sa.JSON, default=list, nullable=False)

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
