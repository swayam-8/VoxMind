"""User Model."""

from typing import TYPE_CHECKING, List
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import generate_password_hash, check_password_hash
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.workspace import WorkspaceMembership, Workspace
    from app.models.recording import Recording
    from app.models.api_key import ApiKey


class User(BaseModel):
    """User account entity with authentication credentials."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(sa.String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(sa.Boolean, default=False, nullable=False)

    # Relationships
    workspace_memberships: Mapped[List["WorkspaceMembership"]] = relationship(
        "WorkspaceMembership", back_populates="user", cascade="all, delete-orphan"
    )
    created_workspaces: Mapped[List["Workspace"]] = relationship(
        "Workspace", back_populates="created_by", foreign_keys="Workspace.created_by_user_id"
    )
    recordings: Mapped[List["Recording"]] = relationship(
        "Recording", back_populates="user", cascade="all, delete-orphan"
    )
    api_keys: Mapped[List["ApiKey"]] = relationship(
        "ApiKey", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password: str) -> None:
        """Hash and persist password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Verify plain password against hashed password."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Serialize user object without sensitive hash."""
        data = super().to_dict()
        if not include_sensitive:
            data.pop("password_hash", None)
        return data
