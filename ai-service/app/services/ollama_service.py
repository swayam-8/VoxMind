"""Local Ollama AI Intelligence Service."""

import json
import logging
import math
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Tuple, Optional
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
            if http_err.code == 404:
                raise OllamaServiceError(f"The AI model '{model}' is not available yet. Wait for its download to finish, then retry.") from http_err
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
    def _repair_json(cls, raw: str) -> Optional[Dict[str, Any]]:
        """Attempt to repair incomplete or cut-off JSON from LLMs."""
        cleaned = cls._clean_json_markdown(raw)
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        # Try appending quotes/brackets/braces
        for suffix in ['"', '"}', '"]}', '"}]}', ']}', '}']:
            try:
                parsed = json.loads(cleaned + suffix)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

        # Try trimming back to last comma or brace
        for cut_char in [',', '\n', '}']:
            last_idx = cleaned.rfind(cut_char)
            if last_idx > 20:
                truncated = cleaned[:last_idx].rstrip().rstrip(',')
                for suffix in ['}', ']}', '"}]}', ']}']:
                    try:
                        parsed = json.loads(truncated + suffix)
                        if isinstance(parsed, dict):
                            return parsed
                    except Exception:
                        pass
        return None

    @classmethod
    def _validate_and_normalize_insights(cls, raw_json_str: str) -> Dict[str, Any]:
        """Parse and strictly validate raw JSON from Ollama against the expected schema."""
        parsed = cls._repair_json(raw_json_str)
        if not parsed:
            cleaned = cls._clean_json_markdown(raw_json_str)
            logger.warning("Failed to decode Ollama JSON. Raw preview: %s", cleaned[:200])
            raise OllamaValidationError(f"Invalid JSON returned by Ollama: output could not be parsed.")

        if not isinstance(parsed, dict):
            raise OllamaValidationError("Root output from Ollama must be a JSON object.")

        def text(value):
            if not isinstance(value, str):
                return None
            value = value.strip()
            return value if value and value.lower() not in {"null", "none", "n/a"} else None

        def timestamp(value):
            if value is None or isinstance(value, bool):
                return None
            try:
                if isinstance(value, str) and ":" in value:
                    parts = [float(part) for part in value.strip("[] ").split(":")]
                    if len(parts) not in (2, 3) or any(part < 0 for part in parts) or any(part >= 60 for part in parts[1:]):
                        return None
                    result = sum(part * 60 ** index for index, part in enumerate(reversed(parts)))
                else:
                    result = float(value)
                return result if math.isfinite(result) and result >= 0 else None
            except (TypeError, ValueError):
                return None

        summary = text(parsed.get("summary"))
        if not summary:
            raise OllamaValidationError("The AI returned an empty summary. Please regenerate the analysis.")

        raw_takeaways = parsed.get("key_takeaways", [])
        key_takeaways = []
        if isinstance(raw_takeaways, list):
            for item in raw_takeaways:
                value = text(item.get("takeaway") or item.get("text") or item.get("decision")) if isinstance(item, dict) else text(item)
                if value and value not in key_takeaways:
                    key_takeaways.append(value)

        raw_decisions = parsed.get("decisions", [])
        decisions = []
        seen_decisions = set()
        if isinstance(raw_decisions, list):
            for item in raw_decisions:
                value = text(item.get("decision") or item.get("text")) if isinstance(item, dict) else text(item)
                if not value or value in seen_decisions:
                    continue
                seen_decisions.add(value)
                decisions.append({
                    "decision": value,
                    "context": text(item.get("context")) if isinstance(item, dict) else None,
                    "source_timestamp": timestamp(item.get("source_timestamp", item.get("sourceTimestamp"))) if isinstance(item, dict) else None,
                })

        raw_actions = parsed.get("action_items", [])
        action_items = []
        seen_actions = set()
        if isinstance(raw_actions, list):
            for item in raw_actions:
                value = text(item.get("task") or item.get("text") or item.get("action")) if isinstance(item, dict) else text(item)
                if not value or value in seen_actions:
                    continue
                seen_actions.add(value)
                completed = item.get("completed", False) if isinstance(item, dict) else False
                action_items.append({
                    "task": value,
                    "assignee": text(item.get("assignee")) if isinstance(item, dict) else None,
                    "due_date": text(item.get("due_date", item.get("dueDate"))) if isinstance(item, dict) else None,
                    "completed": completed is True or (isinstance(completed, str) and completed.lower() == "true"),
                    "source_timestamp": timestamp(item.get("source_timestamp", item.get("sourceTimestamp"))) if isinstance(item, dict) else None,
                })

        raw_topics = parsed.get("topics", [])
        topics = list(dict.fromkeys(filter(None, (text(item) for item in raw_topics)))) if isinstance(raw_topics, list) else []

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
            "You are VoxMind AI, an intelligent voice meeting assistant.\n"
            "Analyze the meeting dialogue transcript and extract the key points, decisions, and action items.\n"
            "Respond ONLY with a valid JSON object using exactly these keys:\n"
            "{\n"
            '  "summary": "2-3 sentence overview of what was discussed",\n'
            '  "key_takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],\n'
            '  "decisions": [{"decision": "The decision made", "context": "Why or how", "source_timestamp": null}],\n'
            '  "action_items": [{"task": "Specific task to do", "assignee": "Person responsible or null", "due_date": "Deadline or null", "completed": false, "source_timestamp": null}],\n'
            '  "topics": ["topic1", "topic2", "topic3"]\n'
            "}\n"
            "Strict rules:\n"
            "- Include only tasks or next steps explicitly committed to in the transcript. Return [] when none are stated.\n"
            "- Include only explicit decisions or agreements, not general findings. Return [] when none were made.\n"
            "- Do not invent decisions, tasks, assignees, or deadlines. Use null for unstated owners and dates.\n"
            "- Source timestamps must be seconds from the transcript labels; use null when uncertain.\n"
            "- Do not repeat items.\n"
            "- Return strictly valid JSON."
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

        data = cls._repair_json(raw_output)
        if not data or not isinstance(data.get("answer"), str) or not data["answer"].strip():
            raise OllamaServiceError("The AI returned an incomplete answer. Please retry your question.")

        timestamps = []
        if isinstance(data.get("timestamps"), list):
            for value in data["timestamps"]:
                if isinstance(value, bool):
                    continue
                try:
                    timestamp = float(value)
                    if math.isfinite(timestamp) and timestamp >= 0 and timestamp not in timestamps:
                        timestamps.append(timestamp)
                except (TypeError, ValueError):
                    continue

        return {
            "answer": str(data.get("answer", "")).strip(),
            "supported_by_transcript": data.get("supported_by_transcript") is True,
            "timestamps": timestamps,
            "model_name": model_name or cfg["model"],
        }
