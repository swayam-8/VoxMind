"""AI Token & Resource Usage Accounting Service."""

import uuid
from typing import Optional, Dict, Any
from sqlalchemy import func, desc
from app.extensions import db
from app.models.api_key import ApiUsageRecord


class UsageService:
    """Tracks and aggregates API calls, speech transcription duration, and LLM token usage."""

    @staticmethod
    def record_usage(
        workspace_id: uuid.UUID,
        endpoint: str,
        method: str = "POST",
        status_code: int = 200,
        response_time_ms: float = 0.0,
        resource_type: str = "api_request",
        model_name: Optional[str] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        duration_seconds: float = 0.0,
        api_key_id: Optional[uuid.UUID] = None,
    ) -> ApiUsageRecord:
        """Create and commit a persistent usage ledger record."""
        computed_tokens = (
            total_tokens if total_tokens > 0 else (prompt_tokens + completion_tokens)
        )
        record = ApiUsageRecord(
            workspace_id=workspace_id,
            api_key_id=api_key_id,
            endpoint=endpoint,
            method=method.upper(),
            status_code=status_code,
            response_time_ms=round(response_time_ms, 2),
            resource_type=resource_type,
            model_name=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=computed_tokens,
            duration_seconds=round(duration_seconds, 2),
        )
        db.session.add(record)
        db.session.commit()
        return record

    @staticmethod
    def get_workspace_usage_summary(workspace_id: uuid.UUID) -> Dict[str, Any]:
        """Aggregate all resource accounting metrics scoped strictly to a workspace."""
        query = db.session.query(ApiUsageRecord).filter(ApiUsageRecord.workspace_id == workspace_id)

        total_requests = query.count()
        total_audio_seconds = (
            db.session.query(func.coalesce(func.sum(ApiUsageRecord.duration_seconds), 0.0))
            .filter(
                ApiUsageRecord.workspace_id == workspace_id,
                ApiUsageRecord.resource_type == "transcription",
            )
            .scalar()
        ) or 0.0

        token_aggregates = (
            db.session.query(
                func.coalesce(func.sum(ApiUsageRecord.prompt_tokens), 0),
                func.coalesce(func.sum(ApiUsageRecord.completion_tokens), 0),
                func.coalesce(func.sum(ApiUsageRecord.total_tokens), 0),
            )
            .filter(ApiUsageRecord.workspace_id == workspace_id)
            .first()
        )

        prompt_tokens = int(token_aggregates[0]) if token_aggregates else 0
        completion_tokens = int(token_aggregates[1]) if token_aggregates else 0
        total_tokens = int(token_aggregates[2]) if token_aggregates else 0

        # Breakdown by resource type
        type_rows = (
            db.session.query(
                ApiUsageRecord.resource_type,
                func.count(ApiUsageRecord.id),
                func.coalesce(func.sum(ApiUsageRecord.total_tokens), 0),
                func.coalesce(func.sum(ApiUsageRecord.duration_seconds), 0.0),
            )
            .filter(ApiUsageRecord.workspace_id == workspace_id)
            .group_by(ApiUsageRecord.resource_type)
            .all()
        )
        by_resource_type = {
            r[0]: {
                "count": r[1],
                "tokens": int(r[2]),
                "duration_seconds": round(float(r[3]), 2),
            }
            for r in type_rows
        }

        # Breakdown by model
        model_rows = (
            db.session.query(
                ApiUsageRecord.model_name,
                func.count(ApiUsageRecord.id),
                func.coalesce(func.sum(ApiUsageRecord.total_tokens), 0),
            )
            .filter(
                ApiUsageRecord.workspace_id == workspace_id,
                ApiUsageRecord.model_name.isnot(None),
            )
            .group_by(ApiUsageRecord.model_name)
            .all()
        )
        by_model = {
            r[0]: {
                "count": r[1],
                "tokens": int(r[2]),
            }
            for r in model_rows
        }

        # Recent 25 activity items
        recent_records = (
            query.order_by(desc(ApiUsageRecord.created_at))
            .limit(25)
            .all()
        )

        return {
            "total_requests": total_requests,
            "total_audio_seconds": round(total_audio_seconds, 2),
            "total_audio_hours": round(total_audio_seconds / 3600, 2),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "quota": {
                "requests_limit": 100000,
                "audio_hours_limit": 50.0,
                "tokens_limit": 5000000,
            },
            "by_resource_type": by_resource_type,
            "by_model": by_model,
            "recent_records": [rec.to_dict() for rec in recent_records],
        }
