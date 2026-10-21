"""Workspace and Tenant Membership Models."""

import uuid
from typing import TYPE_CHECKING, List
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.recording import Recording
    from app.models.collection import Collection
    from app.models.api_key import ApiKey
    from app.models.conversation import Conversation


class Workspace(BaseModel):
    """Tenant isolation root for all audio assets and metadata."""

    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    slug: Mapped[str] = mapped_column(sa.String(120), unique=True, index=True, nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    created_by: Mapped["User"] = relationship(
        "User", back_populates="created_workspaces", foreign_keys=[created_by_user_id]
    )
    memberships: Mapped[List["WorkspaceMembership"]] = relationship(
        "WorkspaceMembership", back_populates="workspace", cascade="all, delete-orphan"
    )
    recordings: Mapped[List["Recording"]] = relationship(
        "Recording", back_populates="workspace", cascade="all, delete-orphan"
    )
    collections: Mapped[List["Collection"]] = relationship(
        "Collection", back_populates="workspace", cascade="all, delete-orphan"
    )
    api_keys: Mapped[List["ApiKey"]] = relationship(
        "ApiKey", back_populates="workspace", cascade="all, delete-orphan"
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation", back_populates="workspace", cascade="all, delete-orphan"
    )


class WorkspaceMembership(BaseModel):
    """Associates a user with a workspace and grants specific roles."""

    __tablename__ = "workspace_memberships"
    __table_args__ = (
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership"),
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
    role: Mapped[str] = mapped_column(
        sa.String(32), default="member", nullable=False
    )  # 'owner', 'admin', 'member'

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="memberships")
    user: Mapped["User"] = relationship("User", back_populates="workspace_memberships")
