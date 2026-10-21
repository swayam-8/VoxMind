"""Common Validation Schemas."""

from typing import Optional
from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    """Query parameters for paginated endpoints."""

    page: int = Field(default=1, ge=1, description="Page number, 1-indexed")
    per_page: int = Field(default=20, ge=1, le=100, description="Items per page (max 100)")
    search: Optional[str] = Field(default=None, max_length=100, description="Search term")
    sort_by: Optional[str] = Field(default="created_at", description="Field to sort by")
    order: Optional[str] = Field(default="desc", pattern="^(asc|desc)$", description="Sort order")
