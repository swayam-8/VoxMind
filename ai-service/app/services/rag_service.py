"""Evidence-Grounded RAG Synthesis Service."""

import re
import logging
from typing import List, Dict, Any, Optional, Callable
from app import config
from app.services.ollama_service import OllamaService

logger = logging.getLogger(__name__)


class RAGService:
    """Orchestrates multi-recording semantic synthesis and citation-grounded LLM generation."""

    _mock_generator: Optional[Callable[[str, List[Dict[str, Any]]], Dict[str, Any]]] = None

    @classmethod
    def set_mock_generator(
        cls,
        mock_fn: Optional[Callable[[str, List[Dict[str, Any]]], Dict[str, Any]]],
    ) -> None:
        """Inject test mock generator for automated testing."""
        cls._mock_generator = mock_fn

    @classmethod
    def synthesize_answer(
        cls,
        question: str,
        passages: List[Dict[str, Any]],
        model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Synthesizes an evidence-backed answer strictly grounded in the supplied passages."""
        clean_question = question.strip()
        if not clean_question:
            return {
                "answer": "Please provide a question to answer.",
                "citations": [],
                "sufficient_evidence": False,
                "model_name": model_name or config.OLLAMA_MODEL,
            }

        min_score = config.RETRIEVAL_MIN_SCORE
        relevant_passages = [p for p in passages if p.get("score", 0.0) >= min_score]

        if not relevant_passages:
            return {
                "answer": "I could not find sufficient evidence in the retrieved passages to answer this question.",
                "citations": [],
                "sufficient_evidence": False,
                "model_name": model_name or config.OLLAMA_MODEL,
            }

        if cls._mock_generator is not None:
            return cls._mock_generator(clean_question, relevant_passages)

        evidence_blocks = []
        passage_map: Dict[int, Dict[str, Any]] = {}

        for idx, passage in enumerate(relevant_passages, 1):
            passage_map[idx] = passage
            passage_header = (
                f"[Passage {idx}] Recording: \"{passage.get('recording_title', 'Recording')}\", "
                f"Time: {int(passage.get('start_time', 0) // 60):02d}:{int(passage.get('start_time', 0) % 60):02d} - "
                f"{int(passage.get('end_time', 0) // 60):02d}:{int(passage.get('end_time', 0) % 60):02d}"
            )
            evidence_blocks.append(f"{passage_header}\n{passage.get('text', '')}")

        evidence_text = "\n\n".join(evidence_blocks)

        system_prompt = (
            "You are VoxMind AI, an evidence-grounded research assistant. "
            "Your task is to answer the user's question USING EXCLUSIVELY the provided transcript passages.\n\n"
            "Rules:\n"
            "1. Base your answer strictly on the facts stated in the passages.\n"
            "2. Whenever you state a claim or fact from a passage, cite it using [Passage X].\n"
            "3. If the evidence is insufficient, state clearly: 'I could not find sufficient evidence in your recordings.'\n"
            "4. Do NOT hallucinate or extrapolate beyond the transcript citations.\n"
            "5. Be concise, direct, and structured."
        )

        user_prompt = (
            f"Here are the relevant transcript passages:\n\n"
            f"{evidence_text}\n\n"
            f"Question: {clean_question}\n\n"
            f"Provide an evidence-grounded answer with [Passage X] citations:"
        )

        try:
            target_model = model_name or config.OLLAMA_MODEL
            raw_answer = OllamaService._call_ollama(
                prompt=user_prompt,
                system_prompt=system_prompt,
                model_name=target_model,
                json_format=False,
            )

            cited_indices = set()
            for match in re.finditer(r"\[Passage\s+(\d+)\]", raw_answer, re.IGNORECASE):
                try:
                    cited_indices.add(int(match.group(1)))
                except ValueError:
                    pass

            citations = []
            for p_idx in sorted(cited_indices):
                if p_idx in passage_map:
                    p = passage_map[p_idx]
                    citations.append(
                        {
                            "recording_id": str(p.get("recording_id", "")),
                            "recording_title": p.get("recording_title", "Unknown Recording"),
                            "chunk_id": str(p.get("chunk_id", p.get("id", ""))),
                            "start_time": float(p.get("start_time", 0.0)),
                            "end_time": float(p.get("end_time", 0.0)),
                            "speaker": p.get("speaker", "Speaker 1"),
                            "quote": p.get("text", "")[:200],
                            "score": round(float(p.get("score", 0.0)), 3),
                        }
                    )

            if not citations and relevant_passages:
                top_p = relevant_passages[0]
                citations.append(
                    {
                        "recording_id": str(top_p.get("recording_id", "")),
                        "recording_title": top_p.get("recording_title", "Unknown Recording"),
                        "chunk_id": str(top_p.get("chunk_id", top_p.get("id", ""))),
                        "start_time": float(top_p.get("start_time", 0.0)),
                        "end_time": float(top_p.get("end_time", 0.0)),
                        "speaker": top_p.get("speaker", "Speaker 1"),
                        "quote": top_p.get("text", "")[:200],
                        "score": round(float(top_p.get("score", 0.0)), 3),
                    }
                )

            insufficient = (
                "not find sufficient evidence" in raw_answer.lower()
                or "insufficient evidence" in raw_answer.lower()
            )

            return {
                "answer": raw_answer.strip(),
                "citations": citations,
                "sufficient_evidence": not insufficient,
                "model_name": target_model,
            }

        except Exception as exc:
            logger.exception("Error executing RAG synthesis: %s", exc)
            return {
                "answer": f"Knowledge synthesis error: {str(exc)}",
                "citations": [],
                "sufficient_evidence": False,
                "model_name": model_name or config.OLLAMA_MODEL,
            }
