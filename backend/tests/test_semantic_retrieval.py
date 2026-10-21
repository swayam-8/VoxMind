"""Automated tests for Phase 6 Semantic Search, Vector Retrieval, and RAG."""

import uuid
from app.extensions import db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.recording import Recording
from app.models.transcript import TranscriptSegment, TranscriptChunk
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.services.search_service import SearchService
from app.services.rag_service import RAGService
from app.services.workspace_service import WorkspaceService
from app.jobs.tasks import index_recording_chunks_task


def create_test_context(name_prefix: str = "test"):
    """Helper to create a valid User and Workspace with correct foreign keys."""
    user = User(
        id=uuid.uuid4(),
        email=f"{name_prefix}_{uuid.uuid4().hex[:6]}@voxmind.local",
        full_name=f"{name_prefix.capitalize()} User",
        password_hash="mock_hash",
    )
    db.session.add(user)
    db.session.flush()

    workspace = Workspace(
        id=uuid.uuid4(),
        name=f"{name_prefix.capitalize()} Workspace",
        slug=f"{name_prefix}-{uuid.uuid4().hex[:6]}",
        created_by_user_id=user.id,
    )
    db.session.add(workspace)
    db.session.commit()
    return user, workspace


def test_embedding_service_dimensions_and_batch(app):
    """Verify embedding service dimension adherence, batching, and empty input handling."""
    with app.app_context():
        # Empty input handling
        assert EmbeddingService.embed_texts([]) == []

        # Batch embedding
        passages = [
            "Voice intelligence platform for local audio transcripts.",
            "PostgreSQL pgvector storage enables semantic similarity retrieval.",
        ]
        vectors = EmbeddingService.embed_texts(passages)
        assert len(vectors) == 2
        for vec in vectors:
            assert len(vec) == 384
            # Verify normalized float values
            assert all(isinstance(val, float) for val in vec)

        # Single query embedding
        q_vec = EmbeddingService.embed_query("audio transcription latency")
        assert len(q_vec) == 384


def test_chunking_service_timestamp_preservation():
    """Verify deterministic transcript chunking and exact timestamp preservation."""
    seg1 = TranscriptSegment(
        id=uuid.uuid4(),
        recording_id=uuid.uuid4(),
        segment_index=0,
        start_time=0.0,
        end_time=4.5,
        speaker="Speaker 1",
        text="Welcome to VoxMind voice intelligence platform.",
    )
    seg2 = TranscriptSegment(
        id=uuid.uuid4(),
        recording_id=seg1.recording_id,
        segment_index=1,
        start_time=4.5,
        end_time=9.2,
        speaker="Speaker 2",
        text="We are discussing local-first audio indexing with faster-whisper.",
    )

    chunks = ChunkingService.chunk_segments([seg1, seg2], target_words=100, overlap_words=20)
    assert len(chunks) == 1

    chunk = chunks[0]
    assert chunk["chunk_index"] == 0
    assert chunk["start_time"] == 0.0
    assert chunk["end_time"] == 9.2
    assert "Speaker 1" in chunk["speaker"]
    assert "Speaker 2" in chunk["speaker"]
    assert "Speaker 1: Welcome to VoxMind" in chunk["text"]
    assert "Speaker 2: We are discussing" in chunk["text"]
    assert str(seg1.id) in chunk["source_segment_ids"]
    assert str(seg2.id) in chunk["source_segment_ids"]
    assert len(chunk["content_hash"]) == 64  # SHA-256


def test_chunking_service_empty_segments():
    """Verify empty or whitespace-only segments do not produce corrupt chunks."""
    empty_seg = TranscriptSegment(
        id=uuid.uuid4(),
        recording_id=uuid.uuid4(),
        segment_index=0,
        start_time=0.0,
        end_time=2.0,
        speaker="Speaker 1",
        text="   \n  ",
    )
    assert ChunkingService.chunk_segments([empty_seg]) == []
    assert ChunkingService.chunk_segments([]) == []


def test_index_recording_chunks_task_success(app):
    """Verify Celery task creates transcript chunks with vectors and updates recording index."""
    with app.app_context():
        user, workspace = create_test_context("idx")

        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Roadmap Discussion",
            filename="roadmap.mp3",
            storage_path="/tmp/roadmap.mp3",
            file_size_bytes=1024,
            mime_type="audio/mpeg",
            status="ready",
        )
        db.session.add(rec)
        db.session.commit()

        seg1 = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=0,
            start_time=0.0,
            end_time=5.0,
            speaker="Alice",
            text="Let's prioritize vector retrieval and pgvector storage for Phase 6.",
        )
        seg2 = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=1,
            start_time=5.0,
            end_time=10.0,
            speaker="Bob",
            text="Agreed, sentence-transformers with all-MiniLM-L6-v2 will run fast locally.",
        )
        db.session.add_all([seg1, seg2])
        db.session.commit()

        # Run task
        res = index_recording_chunks_task(str(rec.id))
        assert res["success"] is True
        assert res["chunks_count"] > 0

        # Verify DB state
        db.session.refresh(rec)
        assert rec.index_status == "completed"
        assert rec.indexed_at is not None
        assert rec.index_error is None

        chunks = db.session.query(TranscriptChunk).filter_by(recording_id=rec.id).all()
        assert len(chunks) == res["chunks_count"]
        for chk in chunks:
            assert chk.workspace_id == workspace.id
            assert chk.user_id == user.id
            assert len(chk.embedding) == 384
            assert chk.embedding_model == "all-MiniLM-L6-v2"


def test_index_recording_chunks_task_idempotency(app):
    """Verify that re-indexing safely replaces old chunks without duplication."""
    with app.app_context():
        user, workspace = create_test_context("idemp")

        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Idempotency Test",
            filename="idemp.mp3",
            storage_path="/tmp/idemp.mp3",
            file_size_bytes=1024,
            mime_type="audio/mpeg",
            status="ready",
        )
        db.session.add(rec)
        db.session.commit()

        seg = TranscriptSegment(
            id=uuid.uuid4(),
            recording_id=rec.id,
            segment_index=0,
            start_time=0.0,
            end_time=4.0,
            speaker="Speaker",
            text="Initial transcript line.",
        )
        db.session.add(seg)
        db.session.commit()

        # First indexing run
        res1 = index_recording_chunks_task(str(rec.id))
        assert res1["success"] is True
        count1 = db.session.query(TranscriptChunk).filter_by(recording_id=rec.id).count()

        # Second indexing run (re-indexing)
        res2 = index_recording_chunks_task(str(rec.id))
        assert res2["success"] is True
        count2 = db.session.query(TranscriptChunk).filter_by(recording_id=rec.id).count()

        assert count1 == count2 == 1


def test_search_service_tenant_isolation(app):
    """Verify that search queries strictly exclude chunks from unauthorized workspaces."""
    with app.app_context():
        u1, w1 = create_test_context("t1")
        u2, w2 = create_test_context("t2")

        r1 = Recording(
            id=uuid.uuid4(),
            workspace_id=w1.id,
            user_id=u1.id,
            title="Tenant 1 Secret Project",
            filename="t1.mp3",
            storage_path="/tmp/t1.mp3",
            file_size_bytes=500,
            mime_type="audio/mpeg",
            status="ready",
        )
        r2 = Recording(
            id=uuid.uuid4(),
            workspace_id=w2.id,
            user_id=u2.id,
            title="Tenant 2 Public Project",
            filename="t2.mp3",
            storage_path="/tmp/t2.mp3",
            file_size_bytes=500,
            mime_type="audio/mpeg",
            status="ready",
        )
        db.session.add_all([r1, r2])
        db.session.commit()

        c1 = TranscriptChunk(
            id=uuid.uuid4(),
            recording_id=r1.id,
            workspace_id=w1.id,
            user_id=u1.id,
            chunk_index=0,
            start_time=0.0,
            end_time=5.0,
            speaker="Speaker 1",
            text="Confidential merger details between Company Alpha and Company Beta.",
            source_segment_ids=[],
            content_hash="hash1",
            embedding_model="all-MiniLM-L6-v2",
            embedding=[0.5] * 384,
        )
        c2 = TranscriptChunk(
            id=uuid.uuid4(),
            recording_id=r2.id,
            workspace_id=w2.id,
            user_id=u2.id,
            chunk_index=0,
            start_time=0.0,
            end_time=5.0,
            speaker="Speaker 2",
            text="General marketing updates for Q3 product launch.",
            source_segment_ids=[],
            content_hash="hash2",
            embedding_model="all-MiniLM-L6-v2",
            embedding=[0.5] * 384,
        )
        db.session.add_all([c1, c2])
        db.session.commit()

        # Tenant 1 searches for "Alpha"
        results_t1 = SearchService.search(
            query="Alpha",
            workspace_id=w1.id,
            mode="keyword",
        )
        assert len(results_t1) == 1
        assert results_t1[0]["recording_id"] == str(r1.id)

        # Tenant 2 searches for "Alpha" -> MUST BE EMPTY (zero cross-tenant leak)
        results_t2 = SearchService.search(
            query="Alpha",
            workspace_id=w2.id,
            mode="keyword",
        )
        assert len(results_t2) == 0


def test_rag_knowledge_ask_service(app):
    """Verify RAG service generates answers grounded in retrieved passages with citations."""
    with app.app_context():
        user, workspace = create_test_context("rag")

        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Q4 Benchmarks",
            filename="benchmarks.mp3",
            storage_path="/tmp/benchmarks.mp3",
            file_size_bytes=1000,
            mime_type="audio/mpeg",
            status="ready",
        )
        db.session.add(rec)
        db.session.commit()

        chunk = TranscriptChunk(
            id=uuid.uuid4(),
            recording_id=rec.id,
            workspace_id=workspace.id,
            user_id=user.id,
            chunk_index=0,
            start_time=12.0,
            end_time=24.5,
            speaker="Devon",
            text="int8 compute achieved a 2.8x speedup on CPU with WER under 4.2 percent.",
            source_segment_ids=[],
            content_hash="benchhash",
            embedding_model="all-MiniLM-L6-v2",
            embedding=[0.8] * 384,
        )
        db.session.add(chunk)
        db.session.commit()

        # Query with match
        res = RAGService.ask_knowledge(
            question="What was the speedup achieved with int8?",
            workspace_id=workspace.id,
            user_id=user.id,
        )
        assert res["sufficient_evidence"] is True
        assert len(res["citations"]) > 0
        citation = res["citations"][0]
        assert citation["recording_id"] == str(rec.id)
        assert citation["start_time"] == 12.0
        assert citation["end_time"] == 24.5

        # Query without match / empty scope
        empty_res = RAGService.ask_knowledge(
            question="insufficient details about quantum gravity",
            workspace_id=workspace.id,
            user_id=user.id,
        )
        assert empty_res["sufficient_evidence"] is False
        assert "sufficient evidence" in empty_res["answer"].lower()


def test_post_search_endpoint(client):
    """Verify POST /api/v1/search endpoint contract and validation."""
    # Missing query
    res_bad = client.post("/api/v1/search", json={})
    assert res_bad.status_code == 400
    assert res_bad.get_json()["code"] == "VALIDATION_ERROR"

    # Valid search request
    res = client.post(
        "/api/v1/search",
        json={"query": "transcription performance", "limit": 5, "mode": "hybrid"},
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    assert "results" in body["data"]
    assert "query" in body["data"]


def test_post_knowledge_ask_endpoint(client):
    """Verify POST /api/v1/knowledge/ask endpoint contract and validation."""
    # Missing question
    res_bad = client.post("/api/v1/knowledge/ask", json={})
    assert res_bad.status_code == 400
    assert res_bad.get_json()["code"] == "VALIDATION_ERROR"

    # Valid question
    res = client.post(
        "/api/v1/knowledge/ask",
        json={"question": "What commitments were made about latency?"},
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    assert "answer" in body["data"]
    assert "citations" in body["data"]
    assert "sufficient_evidence" in body["data"]


def test_recording_index_status_and_reindex_endpoints(client, app):
    """Verify GET /api/v1/recordings/<id>/index-status and POST /api/v1/recordings/<id>/reindex."""
    with app.app_context():
        user, workspace = WorkspaceService.get_or_create_default_context()

        rec = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            title="Index Status Test",
            filename="status.mp3",
            storage_path="/tmp/status.mp3",
            file_size_bytes=1000,
            mime_type="audio/mpeg",
            status="ready",
            index_status="pending",
        )
        db.session.add(rec)
        db.session.commit()

        rec_id = str(rec.id)

    # 1. Check index status
    res_status = client.get(f"/api/v1/recordings/{rec_id}/index-status")
    assert res_status.status_code == 200
    status_data = res_status.get_json()["data"]
    assert status_data["recording_id"] == rec_id
    assert status_data["index_status"] == "pending"
    assert status_data["chunk_count"] == 0

    # 2. Trigger re-index
    res_reindex = client.post(f"/api/v1/recordings/{rec_id}/reindex")
    assert res_reindex.status_code == 202
    assert res_reindex.get_json()["data"]["index_status"] == "indexing"
