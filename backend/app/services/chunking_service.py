"""Deterministic Transcript Chunking Service for VoxMind Semantic Retrieval."""

import hashlib
from typing import List, Dict, Any
from app.models.transcript import TranscriptSegment


class ChunkingService:
    """Combines adjacent transcript segments into coherent, timestamp-preserved passages."""

    @classmethod
    def chunk_segments(
        cls,
        segments: List[TranscriptSegment],
        target_words: int = 180,
        overlap_words: int = 35,
    ) -> List[Dict[str, Any]]:
        """
        Deterministically chunk transcript segments.

        Preserves:
        - Exact start_time of the first segment in the chunk.
        - Exact end_time of the last segment in the chunk.
        - Source segment IDs for full traceability.
        - Speaker attribution in the passage text.
        - Deterministic content_hash (SHA-256) of normalized passage text.
        """
        # Filter out empty or whitespace-only segments
        valid_segments = [
            s for s in segments
            if s.text and s.text.strip()
        ]
        if not valid_segments:
            return []

        chunks: List[Dict[str, Any]] = []
        current_chunk_segments: List[TranscriptSegment] = []
        current_word_count = 0
        chunk_index = 0

        for seg in valid_segments:
            seg_words = len(seg.text.split())

            # If current chunk has content and adding this segment exceeds target_words:
            if current_chunk_segments and (current_word_count + seg_words > target_words):
                chunk_dict = cls._build_chunk_dict(current_chunk_segments, chunk_index)
                chunks.append(chunk_dict)
                chunk_index += 1

                # Retain overlap: take trailing segments that fit within overlap_words
                overlap_segments: List[TranscriptSegment] = []
                accumulated_overlap = 0
                for rev_seg in reversed(current_chunk_segments):
                    rev_words = len(rev_seg.text.split())
                    if accumulated_overlap + rev_words <= overlap_words or not overlap_segments:
                        overlap_segments.insert(0, rev_seg)
                        accumulated_overlap += rev_words
                    else:
                        break

                current_chunk_segments = list(overlap_segments)
                current_word_count = sum(len(s.text.split()) for s in current_chunk_segments)

            current_chunk_segments.append(seg)
            current_word_count += seg_words

        # Flush the final chunk
        if current_chunk_segments:
            # If the final chunk is strictly a duplicate of the previous chunk due to overlap, skip
            final_dict = cls._build_chunk_dict(current_chunk_segments, chunk_index)
            if not chunks or final_dict["content_hash"] != chunks[-1]["content_hash"]:
                chunks.append(final_dict)

        return chunks

    @classmethod
    def _build_chunk_dict(
        cls,
        chunk_segments: List[TranscriptSegment],
        chunk_index: int,
    ) -> Dict[str, Any]:
        """Construct a structured chunk dictionary with metadata and content hash."""
        start_time = round(chunk_segments[0].start_time, 2)
        end_time = round(chunk_segments[-1].end_time, 2)

        # Build composite dialogue text with speaker tags
        formatted_lines: List[str] = []
        primary_speakers = set()

        for seg in chunk_segments:
            primary_speakers.add(seg.speaker)
            speaker_tag = seg.speaker if seg.speaker else "Speaker 1"
            clean_text = seg.text.strip()
            formatted_lines.append(f"{speaker_tag}: {clean_text}")

        passage_text = "\n".join(formatted_lines)
        primary_speaker = ", ".join(sorted(primary_speakers)) if primary_speakers else "Speaker 1"

        # Deterministic SHA-256 hash of the normalized passage text
        content_hash = hashlib.sha256(passage_text.strip().encode("utf-8")).hexdigest()

        return {
            "chunk_index": chunk_index,
            "start_time": start_time,
            "end_time": end_time,
            "speaker": primary_speaker,
            "text": passage_text,
            "source_segment_ids": [str(seg.id) for seg in chunk_segments],
            "content_hash": content_hash,
        }
