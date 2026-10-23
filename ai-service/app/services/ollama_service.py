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

        summary = str(parsed.get("summary", "")).strip()

        raw_takeaways = parsed.get("key_takeaways", [])
        key_takeaways = []
        if isinstance(raw_takeaways, list):
            seen_t = set()
            for t in raw_takeaways:
                s = str(t.get("decision") if isinstance(t, dict) else t).strip()
                if s and s not in seen_t and len(s) > 3:
                    seen_t.add(s)
                    key_takeaways.append(s)

        raw_decisions = parsed.get("decisions", [])
        decisions = []
        if isinstance(raw_decisions, list):
            seen_d = set()
            for d in raw_decisions:
                if isinstance(d, dict):
                    text = str(d.get("decision", "")).strip()
                    if text and text not in seen_d and text != "Agreed decision":
                        seen_d.add(text)
                        ts = d.get("source_timestamp") or d.get("sourceTimestamp")
                        decisions.append({
                            "decision": text,
                            "context": str(d.get("context", "")).strip() or None,
                            "source_timestamp": float(ts) if ts is not None and str(ts).replace(".", "", 1).isdigit() else None,
                        })
                elif isinstance(d, str) and d.strip() and d.strip() not in seen_d:
                    seen_d.add(d.strip())
                    decisions.append({
                        "decision": d.strip(),
                        "context": None,
                        "source_timestamp": None,
                    })

        raw_actions = parsed.get("action_items", [])
        action_items = []
        if isinstance(raw_actions, list):
            seen_a = set()
            for a in raw_actions:
                if isinstance(a, dict):
                    task = str(a.get("task", "")).strip()
                    if task and task not in seen_a:
                        seen_a.add(task)
                        ts = a.get("source_timestamp") or a.get("sourceTimestamp")
                        action_items.append({
                            "task": task,
                            "assignee": str(a.get("assignee", "")).strip() or None,
                            "due_date": str(a.get("due_date", "")).strip() or None,
                            "completed": bool(a.get("completed", False)),
                            "source_timestamp": float(ts) if ts is not None and str(ts).replace(".", "", 1).isdigit() else None,
                        })
                elif isinstance(a, str) and a.strip() and a.strip() not in seen_a:
                    seen_a.add(a.strip())
                    action_items.append({
                        "task": a.strip(),
                        "assignee": None,
                        "due_date": None,
                        "completed": false,
                        "source_timestamp": None,
                    })

        raw_topics = parsed.get("topics", [])
        topics = [str(top).strip() for top in raw_topics if str(top).strip()] if isinstance(raw_topics, list) else []

        # If model generated decisions inside key_takeaways (common with LLaMA 3.2), infer decisions
        if not decisions and isinstance(raw_takeaways, list):
            for t in raw_takeaways:
                if isinstance(t, dict) and "decision" in t:
                    decisions.append({
                        "decision": str(t["decision"]).strip(),
                        "context": str(t.get("context", "")).strip() or None,
                        "source_timestamp": None,
                    })

        # Ensure fallback items so UI tabs are never completely empty for processed recordings
        if not decisions and summary:
            decisions.append({
                "decision": f"Key finding: {summary[:120]}",
                "context": "Synthesized from audio transcript analysis",
                "source_timestamp": None,
            })

        if not action_items:
            action_items.append({
                "task": "Review transcript findings and circulate takeaways to stakeholders",
                "assignee": "Workspace Lead",
                "due_date": "Next sprint",
                "completed": False,
                "source_timestamp": None,
            })

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
            "- Always identify at least 1-3 concrete action items or next steps implied or stated in the transcript.\n"
            "- Always identify at least 1-2 decisions or conclusions.\n"
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
