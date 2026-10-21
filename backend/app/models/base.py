"""Base SQLAlchemy Model with UUID and Timestamp defaults."""

import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column
from app.extensions import db


class BaseModel(db.Model):
    """Abstract base model implementing common identity and audit fields."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self) -> dict:
        """Convert model attributes to a dictionary representation."""
        data = {}
        for column in self.__table__.columns:
            val = getattr(self, column.name)
            if isinstance(val, datetime):
                data[column.name] = val.isoformat()
            elif isinstance(val, uuid.UUID):
                data[column.name] = str(val)
            else:
                data[column.name] = val
        return data
