"""Unified Semantic and Hybrid Retrieval Service for VoxMind."""

import logging
from typing import List, Dict, Any, Optional
import uuid
import numpy as np
from flask import current_app
from sqlalchemy import or_
from app.extensions import db
from app.models.recording import Recording
from app.models.transcript import TranscriptChunk
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class SearchService:
    """Provides semantic vector search, keyword search, and hybrid reciprocal rank fusion."""

    @classmethod
    def search(
        cls,
        query: str,
        workspace_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        recording_id: Optional[uuid.UUID] = None,
        recording_ids: Optional[List[uuid.UUID]] = None,
        limit: int = 10,
        min_score: Optional[float] = None,
        mode: str = "hybrid",  # 'semantic', 'keyword', or 'hybrid'
    ) -> List[Dict[str, Any]]:
        """
        Executes tenant-isolated search across authorized transcript chunks.
        Supports single-recording or multi-recording scopes.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        configured_min_score = (
            min_score
            if min_score is not None
            else (
                current_app.config.get("RETRIEVAL_MIN_SCORE", 0.35)
                if current_app
                else 0.35
            )
        )
        fetch_limit = min(max(1, limit), 50)

        # Base query filtered strictly to authorized workspace
        base_chunks = (
            db.session.query(TranscriptChunk, Recording)
            .join(Recording, TranscriptChunk.recording_id == Recording.id)
            .filter(TranscriptChunk.workspace_id == workspace_id)
        )

        # Scope filters
        if recording_id:
            base_chunks = base_chunks.filter(TranscriptChunk.recording_id == recording_id)
        elif recording_ids:
            base_chunks = base_chunks.filter(TranscriptChunk.recording_id.in_(recording_ids))

        # Check database engine dialect (PostgreSQL vs SQLite)
        engine_dialect = db.engine.dialect.name.lower()

        if mode == "keyword":
            return cls._search_keyword(
                base_chunks, clean_query, fetch_limit, configured_min_score
            )
        elif mode == "semantic":
            query_vector = EmbeddingService.embed_query(clean_query)
            if engine_dialect == "postgresql":
                return cls._search_semantic_pg(
                    base_chunks, query_vector, fetch_limit, configured_min_score
                )
            else:
                return cls._search_semantic_fallback(
                    base_chunks, query_vector, fetch_limit, configured_min_score
                )
        else:
            # Hybrid search combining semantic + keyword
            query_vector = EmbeddingService.embed_query(clean_query)
            if engine_dialect == "postgresql":
                semantic_results = cls._search_semantic_pg(
                    base_chunks, query_vector, fetch_limit * 2, 0.1
                )
            else:
                semantic_results = cls._search_semantic_fallback(
                    base_chunks, query_vector, fetch_limit * 2, 0.1
                )

            keyword_results = cls._search_keyword(
                base_chunks, clean_query, fetch_limit * 2, 0.0
            )

            return cls._reciprocal_rank_fusion(
                semantic_results, keyword_results, fetch_limit, configured_min_score
            )

    @classmethod
    def _search_semantic_pg(
        cls,
        query_set,
        query_vector: List[float],
        limit: int,
        min_score: float,
    ) -> List[Dict[str, Any]]:
        """pgvector native cosine distance retrieval."""
        # cosine_distance in pgvector: distance = 1 - cosine_similarity
        # similarity = 1 - distance
        cosine_dist = TranscriptChunk.embedding.cosine_distance(query_vector)
        rows = (
            query_set.order_by(cosine_dist.asc())
            .limit(limit)
            .all()
        )

        results: List[Dict[str, Any]] = []
        for chunk, rec in rows:
            # Calculate similarity score: cosine distance ranges from 0 (identical) to 2
            # For normalized vectors, similarity = 1 - distance
            # When using pgvector expression directly:
            # We can compute score in python or evaluate
            raw_chunk_vec = np.array(chunk.embedding, dtype=np.float32)
            q_vec = np.array(query_vector, dtype=np.float32)
            similarity = float(np.dot(raw_chunk_vec, q_vec))

            if similarity >= min_score:
                results.append(cls._format_result_item(chunk, rec, similarity))

        return results

    @classmethod
    def _search_semantic_fallback(
        cls,
        query_set,
        query_vector: List[float],
        limit: int,
        min_score: float,
    ) -> List[Dict[str, Any]]:
        """In-memory cosine similarity fallback (for SQLite development & unit tests)."""
        rows = query_set.all()
        if not rows:
            return []

        q_arr = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_arr)
        if q_norm == 0:
            return []

        scored_items = []
        for chunk, rec in rows:
            c_arr = np.array(chunk.embedding, dtype=np.float32)
            c_norm = np.linalg.norm(c_arr)
            if c_norm > 0:
                similarity = float(np.dot(c_arr, q_arr) / (c_norm * q_norm))
            else:
                similarity = 0.0

            if similarity >= min_score:
                scored_items.append((similarity, chunk, rec))

        scored_items.sort(key=lambda x: x[0], reverse=True)
        return [
            cls._format_result_item(chunk, rec, score)
            for score, chunk, rec in scored_items[:limit]
        ]

    @classmethod
    def _search_keyword(
        cls,
        query_set,
        query: str,
        limit: int,
        min_score: float,
    ) -> List[Dict[str, Any]]:
        """Token-based keyword matching."""
        tokens = [t.lower() for t in query.split() if len(t) > 2]
        if not tokens:
            return []

        filters = [TranscriptChunk.text.ilike(f"%{tok}%") for tok in tokens]
        # Any token match
        rows = query_set.filter(or_(*filters)).limit(limit * 2).all()

        results: List[Dict[str, Any]] = []
        for chunk, rec in rows:
            chunk_lower = chunk.text.lower()
            matches = sum(1 for tok in tokens if tok in chunk_lower)
            score = round(min(1.0, matches / len(tokens)), 3)
            if score >= min_score:
                results.append(cls._format_result_item(chunk, rec, score))

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    @classmethod
    def _reciprocal_rank_fusion(
        cls,
        semantic_list: List[Dict[str, Any]],
        keyword_list: List[Dict[str, Any]],
        limit: int,
        min_score: float,
        k: int = 60,
    ) -> List[Dict[str, Any]]:
        """Reciprocal Rank Fusion (RRF) combining semantic and keyword rankings."""
        fused_scores: Dict[str, float] = {}
        item_map: Dict[str, Dict[str, Any]] = {}

        for rank, item in enumerate(semantic_list):
            cid = item["chunk_id"]
            item_map[cid] = item
            fused_scores[cid] = fused_scores.get(cid, 0.0) + (1.0 / (k + rank + 1))

        for rank, item in enumerate(keyword_list):
            cid = item["chunk_id"]
            if cid not in item_map:
                item_map[cid] = item
            fused_scores[cid] = fused_scores.get(cid, 0.0) + (1.0 / (k + rank + 1))

        sorted_chunks = sorted(
            fused_scores.items(), key=lambda x: x[1], reverse=True
        )

        final_results: List[Dict[str, Any]] = []
        for cid, rrf_score in sorted_chunks[:limit]:
            item = dict(item_map[cid])
            # Normalize display score roughly between 0.35 and 0.99
            # Max possible RRF with 2 lists ranked #1 is 2/(61) ~ 0.0328
            normalized_score = round(min(0.99, max(0.40, rrf_score * 30.0)), 3)
            item["score"] = normalized_score
            item["rrf_score"] = round(rrf_score, 5)
            final_results.append(item)

        return final_results

    @classmethod
    def _format_result_item(
        cls,
        chunk: TranscriptChunk,
        rec: Recording,
        score: float,
    ) -> Dict[str, Any]:
        """Formats search match item with display metadata."""
        return {
            "chunk_id": str(chunk.id),
            "recording_id": str(rec.id),
            "recording_title": rec.title,
            "chunk_index": chunk.chunk_index,
            "start_time": chunk.start_time,
            "end_time": chunk.end_time,
            "speaker": chunk.speaker,
            "text": chunk.text,
            "score": round(score, 3),
            "source_segment_ids": chunk.source_segment_ids,
        }
