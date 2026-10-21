"""Deterministic Transcript Chunking Service."""

import hashlib
from typing import List, Dict, Any


class ChunkingService:
    """Combines adjacent transcript segments into coherent, timestamp-preserved passages."""

    @staticmethod
    def _get_val(seg: Any, key: str, default: Any = None) -> Any:
        if isinstance(seg, dict):
            return seg.get(key, default)
        return getattr(seg, key, default)

    @classmethod
    def chunk_segments(
        cls,
        segments: List[Any],
        target_words: int = 180,
        overlap_words: int = 35,
    ) -> List[Dict[str, Any]]:
        """Deterministically chunk transcript segments."""
        valid_segments = [
            s for s in segments
            if cls._get_val(s, "text") and str(cls._get_val(s, "text")).strip()
        ]
        if not valid_segments:
            return []

        chunks: List[Dict[str, Any]] = []
        current_chunk_segments: List[Any] = []
        current_word_count = 0
        chunk_index = 0

        for seg in valid_segments:
            seg_text = str(cls._get_val(seg, "text")).strip()
            seg_words = len(seg_text.split())

            if current_chunk_segments and (current_word_count + seg_words > target_words):
                chunk_dict = cls._build_chunk_dict(current_chunk_segments, chunk_index)
                chunks.append(chunk_dict)
                chunk_index += 1

                overlap_segments: List[Any] = []
                accumulated_overlap = 0
                for rev_seg in reversed(current_chunk_segments):
                    rev_words = len(str(cls._get_val(rev_seg, "text")).split())
                    if accumulated_overlap + rev_words <= overlap_words or not overlap_segments:
                        overlap_segments.insert(0, rev_seg)
                        accumulated_overlap += rev_words
                    else:
                        break

                current_chunk_segments = list(overlap_segments)
                current_word_count = sum(
                    len(str(cls._get_val(s, "text")).split()) for s in current_chunk_segments
                )

            current_chunk_segments.append(seg)
            current_word_count += seg_words

        if current_chunk_segments:
            final_dict = cls._build_chunk_dict(current_chunk_segments, chunk_index)
            if not chunks or final_dict["content_hash"] != chunks[-1]["content_hash"]:
                chunks.append(final_dict)

        return chunks

    @classmethod
    def _build_chunk_dict(
        cls,
        chunk_segments: List[Any],
        chunk_index: int,
    ) -> Dict[str, Any]:
        """Construct a structured chunk dictionary with metadata and content hash."""
        start_time = round(float(cls._get_val(chunk_segments[0], "start_time", cls._get_val(chunk_segments[0], "start", 0.0))), 2)
        end_time = round(float(cls._get_val(chunk_segments[-1], "end_time", cls._get_val(chunk_segments[-1], "end", 0.0))), 2)

        formatted_lines: List[str] = []
        primary_speakers = set()

        for seg in chunk_segments:
            speaker = str(cls._get_val(seg, "speaker", "Speaker 1"))
            primary_speakers.add(speaker)
            clean_text = str(cls._get_val(seg, "text", "")).strip()
            formatted_lines.append(f"{speaker}: {clean_text}")

        passage_text = "\n".join(formatted_lines)
        primary_speaker = ", ".join(sorted(primary_speakers)) if primary_speakers else "Speaker 1"
        content_hash = hashlib.sha256(passage_text.strip().encode("utf-8")).hexdigest()

        source_ids = []
        for s in chunk_segments:
            s_id = cls._get_val(s, "id")
            if s_id is not None:
                source_ids.append(str(s_id))

        return {
            "chunk_index": chunk_index,
            "start_time": start_time,
            "end_time": end_time,
            "speaker": primary_speaker,
            "text": passage_text,
            "source_segment_ids": source_ids,
            "content_hash": content_hash,
        }
