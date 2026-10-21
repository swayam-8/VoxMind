"""Local Ollama AI Intelligence Service."""

import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Tuple
from app import config

logger = logging.getLogger(__name__)


class OllamaServiceError(Exception):
    """Raised when communication with Ollama fails or service is unavailable."""
    pass


class OllamaValidationError(Exception):
    """Raised when model output fails structural schema validation."""
    pass


class OllamaService:
    """Service abstraction for local Ollama LLM inference."""

    _mock_generator = None
    _mock_qa = None

    @classmethod
    def set_mock_generator(cls, mock_fn):
        """Set mock generator for unit tests."""
        cls._mock_generator = mock_fn

    @classmethod
    def clear_mock_generator(cls):
        """Clear test mock generator."""
        cls._mock_generator = None

    @classmethod
    def set_mock_qa(cls, mock_fn):
        """Set mock question-answering for unit tests."""
        cls._mock_qa = mock_fn

    @classmethod
    def clear_mock_qa(cls):
        """Clear test mock QA."""
        cls._mock_qa = None

    @classmethod
    def get_config(cls) -> Dict[str, Any]:
        """Resolve current Ollama configuration from environment."""
        return {
            "base_url": config.OLLAMA_BASE_URL,
            "model": config.OLLAMA_MODEL,
            "timeout": config.OLLAMA_TIMEOUT_SECONDS,
            "num_ctx": config.OLLAMA_NUM_CTX,
            "max_tokens": config.AI_MAX_OUTPUT_TOKENS,
            "max_chars": config.AI_MAX_TRANSCRIPT_CHARS,
            "prompt_version": config.AI_PROMPT_VERSION,
        }

    @classmethod
    def check_availability(cls) -> Tuple[bool, str]:
        """Verify local Ollama service connectivity and configured model availability."""
        cfg = cls.get_config()
        base_url = cfg["base_url"]
        target_model = cfg["model"]

        try:
            req = urllib.request.Request(
                f"{base_url}/api/tags",
                headers={"User-Agent": "VoxMind-OllamaService"},
            )
            with urllib.request.urlopen(req, timeout=3.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    models = [m.get("name", "") for m in data.get("models", [])]
                    is_present = any(
                        target_model in m or m.startswith(f"{target_model}:")
                        for m in models
                    )
                    if is_present:
                        return True, f"Ollama operational with model '{target_model}'."
                    return (
                        False,
                        f"Ollama is running, but model '{target_model}' is not pulled.",
                    )
                return False, f"Ollama returned HTTP status {response.status}."
        except urllib.error.URLError as err:
            return False, f"Could not connect to Ollama at {base_url}: {err.reason}"
        except Exception as exc:
            return False, f"Ollama connection check failed: {str(exc)}"

    @classmethod
    def _call_ollama(
        cls,
        prompt: str,
        system_prompt: str,
        model_name: Optional[str] = None,
        json_format: bool = True,
    ) -> str:
        """Execute HTTP request against local Ollama API."""
        cfg = cls.get_config()
        base_url = cfg["base_url"]
        model = model_name or cfg["model"]
        timeout = cfg["timeout"]

        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "num_ctx": cfg["num_ctx"],
                "num_predict": cfg["max_tokens"],
                "temperature": 0.2,
                "top_p": 0.9,
            },
        }

        if json_format:
            payload["format"] = "json"

        endpoint = f"{base_url}/api/generate"
        body_bytes = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(
            endpoint,
            data=body_bytes,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "VoxMind-OllamaService/1.0",
            },
            method="POST",
        )

        try:
            logger.info("Calling local Ollama inference (%s) at %s", model, endpoint)
            with urllib.request.urlopen(req, timeout=float(timeout)) as resp:
                if resp.status != 200:
                    raise OllamaServiceError(f"Ollama returned non-200 status: {resp.status}")
                response_data = json.loads(resp.read().decode("utf-8"))
                return response_data.get("response", "")
        except urllib.error.HTTPError as http_err:
            try:
                err_body = http_err.read().decode("utf-8")
            except Exception:
                err_body = str(http_err)
            logger.error("Ollama HTTP Error %s: %s", http_err.code, err_body)
            raise OllamaServiceError(f"Ollama HTTP error {http_err.code}: {err_body}") from http_err
        except urllib.error.URLError as url_err:
            logger.error("Ollama connection error at %s: %s", endpoint, url_err.reason)
            raise OllamaServiceError(
                f"Cannot connect to local Ollama service at {base_url}. Ensure Ollama is running."
            ) from url_err
        except Exception as exc:
            logger.exception("Unexpected error communicating with Ollama: %s", exc)
            raise OllamaServiceError(f"Ollama inference failed: {str(exc)}") from exc

    @classmethod
    def _clean_json_markdown(cls, raw: str) -> str:
        """Strip markdown fences (```json ... ```) or whitespace from raw LLM output."""
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    @classmethod
    def _validate_and_normalize_insights(cls, raw_json_str: str) -> Dict[str, Any]:
        """Parse and strictly validate raw JSON from Ollama against the expected schema."""
        cleaned = cls._clean_json_markdown(raw_json_str)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as err:
            logger.warning("Failed to decode Ollama JSON: %s. Raw preview: %s", err, cleaned[:200])
            raise OllamaValidationError(f"Invalid JSON returned by Ollama: {str(err)}") from err

        if not isinstance(parsed, dict):
            raise OllamaValidationError("Root output from Ollama must be a JSON object.")

        summary = str(parsed.get("summary", "")).strip()

        raw_takeaways = parsed.get("key_takeaways", [])
        key_takeaways = [str(t).strip() for t in raw_takeaways if str(t).strip()] if isinstance(raw_takeaways, list) else []

        raw_decisions = parsed.get("decisions", [])
        decisions = []
        if isinstance(raw_decisions, list):
            for d in raw_decisions:
                if isinstance(d, dict) and "decision" in d and str(d["decision"]).strip():
                    ts = d.get("source_timestamp") or d.get("sourceTimestamp")
                    decisions.append({
                        "decision": str(d["decision"]).strip(),
                        "context": str(d.get("context", "")).strip() or None,
                        "source_timestamp": float(ts) if ts is not None and str(ts).replace(".", "", 1).isdigit() else None,
                    })

        raw_actions = parsed.get("action_items", [])
        action_items = []
        if isinstance(raw_actions, list):
            for a in raw_actions:
                if isinstance(a, dict) and "task" in a and str(a["task"]).strip():
                    ts = a.get("source_timestamp") or a.get("sourceTimestamp")
                    action_items.append({
                        "task": str(a["task"]).strip(),
                        "assignee": str(a.get("assignee", "")).strip() or None,
                        "due_date": str(a.get("due_date", "")).strip() or None,
                        "completed": bool(a.get("completed", False)),
                        "source_timestamp": float(ts) if ts is not None and str(ts).replace(".", "", 1).isdigit() else None,
                    })

        raw_topics = parsed.get("topics", [])
        topics = [str(top).strip() for top in raw_topics if str(top).strip()] if isinstance(raw_topics, list) else []

        return {
            "summary": summary,
            "key_takeaways": key_takeaways,
            "decisions": decisions,
            "action_items": action_items,
            "topics": topics,
        }

    @classmethod
    def generate_insights(
        cls,
        transcript_text: str,
        model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Extract structured insights from a formatted transcript."""
        if cls._mock_generator is not None:
            return cls._mock_generator(transcript_text)

        cfg = cls.get_config()
        max_chars = cfg["max_chars"]
        clipped_transcript = transcript_text[:max_chars]

        system_prompt = (
            "You are VoxMind AI, an elite voice intelligence assistant.\n"
            "Analyze the meeting dialogue transcript and return ONLY a valid JSON object matching this schema:\n"
            "{\n"
            '  "summary": "Concise executive overview in markdown format",\n'
            '  "key_takeaways": ["Bulleted takeaways"],\n'
            '  "decisions": [{"decision": "Agreed decision", "context": "Rationale", "source_timestamp": 12.5}],\n'
            '  "action_items": [{"task": "Task description", "assignee": "Name or null", "due_date": "Date or null", "completed": false, "source_timestamp": 45.0}],\n'
            '  "topics": ["Keyword / Topic"]\n'
            "}\n"
            "Ground all insights strictly in the transcript. Do not fabricate facts."
        )

        user_prompt = f"Transcript:\n---\n{clipped_transcript}\n---\nGenerate the structured JSON analysis."
        raw_output = cls._call_ollama(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model_name=model_name,
            json_format=True,
        )

        insights = cls._validate_and_normalize_insights(raw_output)
        insights["model_name"] = model_name or cfg["model"]
        return insights

    @classmethod
    def answer_question(
        cls,
        transcript_text: str,
        question: str,
        model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Answer a question grounded in the audio transcript."""
        if cls._mock_qa is not None:
            return cls._mock_qa(transcript_text, question)

        cfg = cls.get_config()
        max_chars = cfg["max_chars"]
        clipped_transcript = transcript_text[:max_chars]

        system_prompt = (
            "You are VoxMind QA. Answer the user's question grounded strictly in the dialogue transcript.\n"
            "Return ONLY a valid JSON object matching:\n"
            "{\n"
            '  "answer": "Detailed answer explaining evidence from the conversation.",\n'
            '  "supported_by_transcript": true,\n'
            '  "timestamps": [12.0, 45.5]\n'
            "}\n"
            "If the transcript does not contain enough info, set supported_by_transcript=false and explain in answer."
        )

        user_prompt = f"Transcript:\n{clipped_transcript}\n\nQuestion: {question}"
        raw_output = cls._call_ollama(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model_name=model_name,
            json_format=True,
        )

        cleaned = cls._clean_json_markdown(raw_output)
        try:
            data = json.loads(cleaned)
        except Exception:
            data = {
                "answer": cleaned,
                "supported_by_transcript": True,
                "timestamps": [],
            }

        return {
            "answer": str(data.get("answer", "")).strip(),
            "supported_by_transcript": bool(data.get("supported_by_transcript", True)),
            "timestamps": [float(t) for t in data.get("timestamps", []) if str(t).replace(".", "", 1).isdigit()],
            "model_name": model_name or cfg["model"],
        }
