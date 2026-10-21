"""Unified Semantic Retrieval and Cross-Recording RAG API."""

import logging
import uuid
from typing import List, Optional
from flask import Blueprint, request
from app.utils.response import api_error, api_success
from app.services.workspace_service import WorkspaceService
from app.services.search_service import SearchService
from app.services.rag_service import RAGService

logger = logging.getLogger(__name__)

search_bp = Blueprint("search", __name__)


@search_bp.route("/search", methods=["POST"])
def search_recordings():
    """
    Semantic, keyword, or hybrid retrieval across authorized recordings.

    Payload:
    - query: str (required)
    - limit: int (optional, default 10)
    - recording_id: str UUID (optional)
    - recording_ids: list of str UUIDs (optional)
    - mode: 'hybrid' | 'semantic' | 'keyword' (optional, default 'hybrid')
    - min_score: float (optional)
    """
    user, workspace = WorkspaceService.get_or_create_default_context()

    payload = request.get_json(silent=True) or {}
    query = payload.get("query", "").strip()
    if not query:
        return api_error(
            "Query parameter is required",
            code="VALIDATION_ERROR",
            status_code=400,
        )

    if len(query) > 500:
        return api_error(
            "Query exceeds maximum allowed length of 500 characters",
            code="VALIDATION_ERROR",
            status_code=400,
        )

    try:
        limit = min(50, max(1, int(payload.get("limit", 10))))
    except (ValueError, TypeError):
        limit = 10

    mode = payload.get("mode", "hybrid").lower()
    if mode not in ("hybrid", "semantic", "keyword"):
        mode = "hybrid"

    # Optional recording scoping
    rec_id: Optional[uuid.UUID] = None
    rec_id_str = payload.get("recording_id")
    if rec_id_str:
        try:
            rec_id = uuid.UUID(rec_id_str)
        except (ValueError, TypeError):
            return api_error("Invalid recording_id format", code="BAD_REQUEST", status_code=400)

    rec_ids: Optional[List[uuid.UUID]] = None
    rec_ids_raw = payload.get("recording_ids")
    if isinstance(rec_ids_raw, list):
        parsed = []
        for r_item in rec_ids_raw:
            try:
                parsed.append(uuid.UUID(str(r_item)))
            except (ValueError, TypeError):
                pass
        if parsed:
            rec_ids = parsed

    min_score = payload.get("min_score")
    if min_score is not None:
        try:
            min_score = float(min_score)
        except (ValueError, TypeError):
            min_score = None

    try:
        results = SearchService.search(
            query=query,
            workspace_id=workspace.id,
            user_id=user.id,
            recording_id=rec_id,
            recording_ids=rec_ids,
            limit=limit,
            min_score=min_score,
            mode=mode,
        )

        return api_success(
            data={
                "query": query,
                "mode": mode,
                "total": len(results),
                "results": results,
            }
        )
    except Exception as exc:
        logger.exception("Error executing search: %s", exc)
        return api_error(
            f"Search failed: {str(exc)}",
            code="SEARCH_ERROR",
            status_code=500,
        )


@search_bp.route("/knowledge/ask", methods=["POST"])
def ask_knowledge():
    """
    Evidence-grounded Question Answering across authorized recordings using local Ollama.

    Payload:
    - question: str (required)
    - recording_ids: list of str UUIDs (optional)
    - max_passages: int (optional, default 5)
    """
    user, workspace = WorkspaceService.get_or_create_default_context()

    payload = request.get_json(silent=True) or {}
    question = payload.get("question", "").strip()
    if not question:
        return api_error(
            "Question parameter is required",
            code="VALIDATION_ERROR",
            status_code=400,
        )

    if len(question) > 1000:
        return api_error(
            "Question exceeds maximum allowed length of 1000 characters",
            code="VALIDATION_ERROR",
            status_code=400,
        )

    try:
        max_passages = min(10, max(1, int(payload.get("max_passages", 5))))
    except (ValueError, TypeError):
        max_passages = 5

    rec_ids: Optional[List[uuid.UUID]] = None
    rec_ids_raw = payload.get("recording_ids")
    if isinstance(rec_ids_raw, list):
        parsed = []
        for r_item in rec_ids_raw:
            try:
                parsed.append(uuid.UUID(str(r_item)))
            except (ValueError, TypeError):
                pass
        if parsed:
            rec_ids = parsed

    try:
        result = RAGService.ask_knowledge(
            question=question,
            workspace_id=workspace.id,
            user_id=user.id,
            recording_ids=rec_ids,
            max_passages=max_passages,
        )

        return api_success(data=result)
    except Exception as exc:
        logger.exception("Error executing RAG knowledge question: %s", exc)
        return api_error(
            f"Knowledge QA failed: {str(exc)}",
            code="RAG_ERROR",
            status_code=500,
        )
