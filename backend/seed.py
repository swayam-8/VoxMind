"""Seed development database with verified sample voice intelligence assets."""

import os
import uuid
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
from app.models.collection import Collection
from app.models.recording import Recording
from app.models.transcript import TranscriptSegment
from app.models.insight import Summary, ActionItem

app = create_app()

with app.app_context():
    print("Seeding database...")

    # 1. User
    user = db.session.query(User).filter_by(email="admin@voxmind.internal").first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email="admin@voxmind.internal",
            full_name="Elena Vance",
            is_active=True,
            is_superuser=True,
        )
        user.set_password("VoxMind2026Secure!")
        db.session.add(user)
        db.session.flush()

    # 2. Workspace
    workspace = db.session.query(Workspace).filter_by(slug="default").first()
    if not workspace:
        workspace = Workspace(
            id=uuid.uuid4(),
            name="Default Workspace",
            slug="default",
            created_by_user_id=user.id,
        )
        db.session.add(workspace)
        db.session.flush()

        membership = WorkspaceMembership(
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
        )
        db.session.add(membership)

    # 3. Collections
    col1 = (
        db.session.query(Collection)
        .filter_by(name="Product & Architecture", workspace_id=workspace.id)
        .first()
    )
    if not col1:
        col1 = Collection(
            workspace_id=workspace.id,
            name="Product & Architecture",
            description="Core roadmap, tech debt evaluations, and infrastructure decisions.",
            color="#8B5CF6",
        )
        db.session.add(col1)

    col2 = (
        db.session.query(Collection)
        .filter_by(name="Customer & User Research", workspace_id=workspace.id)
        .first()
    )
    if not col2:
        col2 = Collection(
            workspace_id=workspace.id,
            name="Customer & User Research",
            description="Interviews, feedback sessions, and UX discovery calls.",
            color="#10B981",
        )
        db.session.add(col2)

    db.session.flush()

    # 4. Recording 1 (Ready with segments, summary, actions)
    rec1 = (
        db.session.query(Recording)
        .filter_by(filename="eng_arch_q4_sync.mp3", workspace_id=workspace.id)
        .first()
    )
    if not rec1:
        rec1_path = os.path.join(
            app.config["UPLOAD_DIR"], str(workspace.id), "eng_arch_q4_sync.mp3"
        )
        os.makedirs(os.path.dirname(rec1_path), exist_ok=True)
        if not os.path.exists(rec1_path):
            with open(rec1_path, "wb") as f:
                f.write(b"SAMPLE_AUDIO_BYTES_HEADER")

        rec1 = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            collection_id=col1.id,
            title="Q4 Voice Engine Architecture & Latency Benchmark",
            filename="eng_arch_q4_sync.mp3",
            storage_path=rec1_path,
            file_size_bytes=24680000,
            duration_seconds=1124.0,
            mime_type="audio/mpeg",
            status="ready",
        )
        db.session.add(rec1)
        db.session.flush()

        # Transcript segments
        segments_data = [
            (
                0.0,
                6.8,
                "Elena Vance (Platform Lead)",
                "Let's review the memory footprint benchmarks for faster-whisper int8 quantization against our baseline on the GPU cluster.",
                0.98,
            ),
            (
                7.2,
                16.4,
                "Marcus Thorne (Staff ML Eng)",
                "With int8 compute on standard CPU nodes, we achieved a 2.8x speedup over PyTorch FP16 while maintaining a Word Error Rate under 4.2%.",
                0.97,
            ),
            (
                17.0,
                25.5,
                "Elena Vance (Platform Lead)",
                "That confirms we can safely default to local CPU transcription for users running without dedicated NVIDIA hardware.",
                0.99,
            ),
            (
                26.2,
                38.0,
                "Devon Reed (Audio Architect)",
                "Agreed. I also tested the chunking pipeline. By splitting at silent pauses longer than 600 milliseconds, we eliminate hallucinations entirely on non-speech segments.",
                0.96,
            ),
            (
                38.8,
                49.3,
                "Marcus Thorne (Staff ML Eng)",
                "Next step is connecting Ollama's structured output schema to parse decisions and action items immediately after the transcription worker completes.",
                0.98,
            ),
            (
                50.1,
                62.0,
                "Elena Vance (Platform Lead)",
                "Let's lock that in. Devon will standardize the pause detection threshold, and Marcus will finalize the Ollama JSON extractor.",
                0.99,
            ),
        ]
        for idx, (st, et, spk, txt, conf) in enumerate(segments_data):
            seg = TranscriptSegment(
                recording_id=rec1.id,
                segment_index=idx,
                start_time=st,
                end_time=et,
                speaker=spk,
                text=txt,
                confidence=conf,
            )
            db.session.add(seg)

        # Summary
        summary = Summary(
            recording_id=rec1.id,
            model_name="llama3.2:3b",
            summary_markdown="The team evaluated faster-whisper int8 quantization on standard CPU infrastructure, confirming a 2.8x throughput increase with negligible accuracy degradation (<4.2% WER). Devon validated silence-based chunking (>600ms pauses) to eliminate hallucinated segments, and the team committed to integrating Ollama structured schema extraction into the post-transcription Celery worker.",
            decisions=[
                {
                    "decision": "Default to int8 quantized faster-whisper on CPU for non-GPU host environments.",
                    "context": "Yields 2.8x speedup and prevents GPU-out-of-memory bottlenecks.",
                    "sourceTimestamp": 17.0,
                },
                {
                    "decision": "Set silence boundary detection to 600ms before chunk dispatching.",
                    "context": "Prevents whisper hallucinations over ambient noise.",
                    "sourceTimestamp": 26.2,
                },
            ],
            topics=[
                "faster-whisper",
                "quantization",
                "latency benchmarks",
                "Ollama",
                "audio chunking",
            ],
        )
        db.session.add(summary)

        # Action Items
        act1 = ActionItem(
            recording_id=rec1.id,
            task="Standardize 600ms silence detection filter in audio normalization service",
            assignee="Devon Reed",
            due_date="2026-10-24",
            completed=False,
            source_timestamp=50.1,
        )
        act2 = ActionItem(
            recording_id=rec1.id,
            task="Implement Ollama structured JSON extraction schema for insights pipeline",
            assignee="Marcus Thorne",
            due_date="2026-10-25",
            completed=True,
            source_timestamp=38.8,
        )
        db.session.add(act1)
        db.session.add(act2)

    # 5. Recording 2 (Customer interview)
    rec2 = (
        db.session.query(Recording)
        .filter_by(filename="customer_interview_compliance.wav", workspace_id=workspace.id)
        .first()
    )
    if not rec2:
        rec2_path = os.path.join(
            app.config["UPLOAD_DIR"], str(workspace.id), "customer_interview_compliance.wav"
        )
        if not os.path.exists(rec2_path):
            with open(rec2_path, "wb") as f:
                f.write(b"SAMPLE_AUDIO_BYTES_HEADER")

        rec2 = Recording(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            collection_id=col2.id,
            title="Customer Discovery Interview: Enterprise Compliance Lead",
            filename="customer_interview_compliance.wav",
            storage_path=rec2_path,
            file_size_bytes=48100000,
            duration_seconds=1840.0,
            mime_type="audio/wav",
            status="ready",
        )
        db.session.add(rec2)
        db.session.flush()

        seg2 = TranscriptSegment(
            recording_id=rec2.id,
            segment_index=0,
            start_time=0.0,
            end_time=12.0,
            speaker="David Kim",
            text="Our core constraint is simple: no raw audio or identifiable transcripts may ever leave our self-hosted VPC perimeter.",
            confidence=0.99,
        )
        db.session.add(seg2)

        sum2 = Summary(
            recording_id=rec2.id,
            model_name="llama3.2:3b",
            summary_markdown="Enterprise compliance interview with David Kim highlighting strict data residency demands.",
            decisions=[
                {
                    "decision": "Ensure total air-gapped compatibility without external phoning home.",
                    "context": "Required by financial compliance.",
                    "sourceTimestamp": 0.0,
                }
            ],
            topics=["compliance", "air-gapped", "data residency"],
        )
        db.session.add(sum2)

    db.session.commit()
    print("Database successfully seeded with realistic enterprise voice intelligence records.")
