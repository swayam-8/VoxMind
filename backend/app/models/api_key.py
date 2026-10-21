"""Developer API Key and Usage Models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.workspace import Workspace
    from app.models.user import User


class ApiKey(BaseModel):
    """Scoped developer API keys for programmatic access."""

    __tablename__ = "api_keys"

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
    name: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    key_hash: Mapped[str] = mapped_column(sa.String(128), unique=True, index=True, nullable=False)
    key_prefix: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    is_revoked: Mapped[bool] = mapped_column(sa.Boolean, default=False, nullable=False)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="api_keys")
    user: Mapped["User"] = relationship("User", back_populates="api_keys")
    usage_records: Mapped[List["ApiUsageRecord"]] = relationship(
        "ApiUsageRecord", back_populates="api_key", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        """Safe representation omitting secret hash."""
        data = super().to_dict()
        data.pop("key_hash", None)
        return data


class ApiUsageRecord(BaseModel):
    """Logs individual programmatic requests and AI token usage."""

    __tablename__ = "api_usage_records"

    api_key_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("api_keys.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    endpoint: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    method: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    status_code: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    response_time_ms: Mapped[float] = mapped_column(sa.Float, nullable=False)

    # Phase 7 AI Token and Resource Accounting
    resource_type: Mapped[str] = mapped_column(
        sa.String(32), default="api_request", nullable=False, index=True
    )
    model_name: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(sa.Float, default=0.0, nullable=False)

    # Relationships
    api_key: Mapped[Optional["ApiKey"]] = relationship("ApiKey", back_populates="usage_records")
