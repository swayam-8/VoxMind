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


class ApiUsageRecord(BaseModel):
    """Logs individual programmatic requests for usage metrics and rate limiting."""

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

    # Relationships
    api_key: Mapped[Optional["ApiKey"]] = relationship("ApiKey", back_populates="usage_records")
