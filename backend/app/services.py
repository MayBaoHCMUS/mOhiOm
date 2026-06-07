"""Gemini API service for text generation and analysis."""

import json
import re
import hashlib
import base64
from urllib.parse import quote
import httpx

# google-genai is optional at import time so the app can start without it;
# we surface a clear error when the service is instantiated.
try:
    from google import genai
    from google.genai import errors as genai_errors
    from google.api_core import exceptions as google_exceptions
    genai_import_error = None
except ModuleNotFoundError as exc:  # pragma: no cover - environment dependent
    genai = None
    genai_errors = None
    google_exceptions = None
    genai_import_error = exc

from app.config import settings


class GeminiServiceError(Exception):
    """Gemini service error with an HTTP status code."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        retry_after_seconds: float | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


def _extract_retry_after_seconds(error_text: str) -> float | None:
    """Extract retry delay from Gemini error text when present."""
    if not error_text:
        return None

    decimal_match = re.search(r"Please retry in\s+([0-9]+(?:\.[0-9]+)?)s", error_text)
    if decimal_match:
        return float(decimal_match.group(1))

    seconds_match = re.search(r"'retryDelay':\s*'([0-9]+)s'", error_text)
    if seconds_match:
        return float(seconds_match.group(1))

    return None


def _extract_json_payload(text: str) -> dict:
    """Extract a JSON object from plain text or fenced markdown output."""
    candidate = text.strip()

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", candidate, re.DOTALL)
    if fenced_match:
        candidate = fenced_match.group(1).strip()

    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = candidate[start : end + 1]

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise GeminiServiceError(
            "Failed to parse structured JSON response for Step 1.", status_code=500
        ) from exc

    if not isinstance(parsed, dict):
        raise GeminiServiceError(
            "Structured Step 1 response is not a JSON object.", status_code=500
        )

    return parsed


def _first_nonempty_line(text: str) -> str:
    for line in text.splitlines():
        cleaned = line.strip().strip("*#- ")
        if cleaned:
            return cleaned
    return ""


def _slugify_identifier(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", (value or "").strip().lower()).strip("_")
    return cleaned or fallback


def _normalize_nine_router_url(raw_url: str) -> str:
    """Normalize a 9Router base URL by trimming whitespace and trailing slashes."""
    cleaned = (raw_url or "").strip()
    return cleaned.rstrip("/")


def _parse_nine_router_sse(raw_text: str) -> str:
    """Parse SSE-style chat.completion.chunk responses into a single string."""
    if not raw_text:
        return ""

    chunks: list[str] = []
    for line in raw_text.splitlines():
        cleaned = line.strip()
        if not cleaned.startswith("data:"):
            continue
        payload = cleaned[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        choices = data.get("choices") if isinstance(data, dict) else None
        if not isinstance(choices, list) or not choices:
            continue
        first_choice = choices[0] if isinstance(choices[0], dict) else None
        if not isinstance(first_choice, dict):
            continue
        delta = first_choice.get("delta")
        if isinstance(delta, dict) and delta.get("content"):
            chunks.append(str(delta.get("content")))
        elif first_choice.get("text"):
            chunks.append(str(first_choice.get("text")))

    return "".join(chunks)


def _extract_main_character_names_from_step1(step1_json: dict) -> list[str]:
    if not isinstance(step1_json, dict):
        return []

    main_characters = (
        step1_json.get("steps", {})
        .get("step_1_analysis", {})
        .get("data", {})
        .get("analysis", {})
        .get("main_characters", [])
    )
    if not isinstance(main_characters, list):
        return []

    names: list[str] = []
    for entry in main_characters:
        if isinstance(entry, dict):
            name = str(entry.get("name", "")).strip()
        else:
            name = str(entry).strip()
        if name:
            names.append(name)
    return names


def _extract_step2_markdown_character_prompts(design_markdown: str) -> list[dict[str, str]]:
    if not design_markdown:
        return []

    normalized = design_markdown.replace("\r\n", "\n")
    pattern = re.compile(
        r"^###\s+Character\s+\d+\s*:\s*(.+?)\s*$([\s\S]*?)(?=^###\s+Character\s+\d+\s*:|^##\s+\d+\.|\Z)",
        re.MULTILINE,
    )

    extracted: list[dict[str, str]] = []
    for match in pattern.finditer(normalized):
        name = match.group(1).strip()
        block = match.group(2)
        prompt_match = re.search(
            r"AI\s*Image\s*Prompt\s*Ready\s*:\s*([\s\S]*?)(?=\n\s*\*\s*\*|\n\s*###|\n\s*##|\Z)",
            block,
            re.IGNORECASE,
        )
        prompt = prompt_match.group(1).strip() if prompt_match else ""
        if name and prompt:
            extracted.append({"name": name, "prompt": prompt})

    return extracted


def _build_step2_main_designs(
    step1_json: dict,
    design_markdown: str,
    desired_main_characters: int,
    art_style_reference: str,
) -> dict:
    markdown_chars = _extract_step2_markdown_character_prompts(design_markdown)
    markdown_by_name = {entry["name"].lower(): entry for entry in markdown_chars}

    main_names = _extract_main_character_names_from_step1(step1_json)
    result: dict[str, dict] = {}
    used_names: set[str] = set()

    for idx, name in enumerate(main_names[: max(1, desired_main_characters)]):
        fallback_id = f"character_{idx + 1}"
        character_id = _slugify_identifier(name, fallback_id)
        prompt_entry = markdown_by_name.get(name.lower())
        if prompt_entry is None:
            prompt_entry = next(
                (entry for entry in markdown_chars if entry["name"].lower() not in used_names),
                None,
            )

        prompt_text = (
            prompt_entry["prompt"]
            if prompt_entry is not None
            else f"Detailed manga character design sheet of {name}, {art_style_reference}, full body, expression sheet, high detail"
        )
        if prompt_entry is not None:
            used_names.add(prompt_entry["name"].lower())

        result[character_id] = {
            "name": name,
            "physical_appearance": "",
            "outfit_casual": "",
            "expressions": {},
            "ai_image_prompt_ready": prompt_text,
        }

    if not result:
        for idx, entry in enumerate(markdown_chars[: max(1, desired_main_characters)]):
            character_id = _slugify_identifier(entry["name"], f"character_{idx + 1}")
            result[character_id] = {
                "name": entry["name"],
                "physical_appearance": "",
                "outfit_casual": "",
                "expressions": {},
                "ai_image_prompt_ready": entry["prompt"],
            }

    return result


def _build_step1_fallback_snapshot(
    project_id: str,
    story_text: str,
    genre_tone: str,
    art_style_reference: str,
    max_panels_per_page: int,
    special_requests: str,
    step_status: str,
    last_updated: str,
    num_chapters: int,
    analysis_markdown: str,
) -> dict:
    """Build a minimal, always-valid snapshot when model JSON is malformed."""
    story_preview = story_text[:4000]
    plot_line = _first_nonempty_line(analysis_markdown)
    total_scenes_guess = max(1, len(re.findall(r"\bscene\b", analysis_markdown, re.IGNORECASE)))

    return {
        "project_id": project_id,
        "project_status": "in_progress",
        "user_inputs": {
            "story_content": story_preview,
            "genre": genre_tone,
            "tone": genre_tone,
            "art_style_reference": art_style_reference,
            "max_panels_per_page": max_panels_per_page,
            "user_customizations": {
                "special_requests": special_requests,
            },
        },
        "steps": {
            "step_1_analysis": {
                "status": step_status,
                "last_updated": last_updated,
                "data": {
                    "analysis": {
                        "total_characters_detected": 0,
                        "main_characters": [],
                        "supporting_characters": [],
                        "plot": plot_line,
                        "arcs": [],
                        "structure": ""
                    },
                    "chapters_structure": [
                        {
                            "chapter_number": idx + 1,
                            "title": f"Chapter {idx + 1}",
                            "pages_estimate": "auto",
                            "scenes": []
                        }
                        for idx in range(max(1, num_chapters))
                    ],
                    "final_statistics": {
                        "total_chapters": max(1, num_chapters),
                        "total_pages": 0,
                        "total_scenes": total_scenes_guess
                    },
                    "analysis_markdown": analysis_markdown,
                    "parser_note": "Fallback JSON generated because model output was not valid JSON.",
                }
            }
        },
    }


def _build_step2_fallback_snapshot(
    project_id: str,
    genre_tone: str,
    art_style_reference: str,
    special_requests: str,
    step_status: str,
    last_updated: str,
    step1_json: dict,
    design_markdown: str,
    desired_main_characters: int,
) -> dict:
    """Build a minimal, valid Step 2 snapshot if model JSON output is malformed."""
    existing_steps = step1_json.get("steps", {}) if isinstance(step1_json, dict) else {}
    return {
        "project_id": project_id,
        "project_status": "in_progress",
        "user_inputs": {
            "genre": genre_tone,
            "tone": genre_tone,
            "art_style_reference": art_style_reference,
            "user_customizations": {"special_requests": special_requests},
        },
        "steps": {
            **existing_steps,
            "step_2_design": {
                "status": step_status,
                "last_updated": last_updated,
                "data": {
                    "main_characters_designs": _build_step2_main_designs(
                        step1_json=step1_json,
                        design_markdown=design_markdown,
                        desired_main_characters=desired_main_characters,
                        art_style_reference=art_style_reference,
                    ),
                    "supporting_designs": {},
                    "design_markdown": design_markdown,
                    "parser_note": "Fallback JSON generated because model output was not valid JSON.",
                },
            },
        },
    }


def _build_step3_fallback_snapshot(
    project_id: str,
    genre_tone: str,
    art_style_reference: str,
    max_panels_per_page: int,
    special_requests: str,
    step_status: str,
    last_updated: str,
    step2_json: dict,
    script_markdown: str,
) -> dict:
    """Build a minimal, valid Step 3 snapshot if model JSON output is malformed."""
    existing_steps = step2_json.get("steps", {}) if isinstance(step2_json, dict) else {}
    return {
        "project_id": project_id,
        "project_status": "in_progress",
        "user_inputs": {
            "genre": genre_tone,
            "tone": genre_tone,
            "art_style_reference": art_style_reference,
            "max_panels_per_page": max_panels_per_page,
            "user_customizations": {"special_requests": special_requests},
        },
        "steps": {
            **existing_steps,
            "step_3_script": {
                "status": step_status,
                "last_updated": last_updated,
                "data": {
                    "chapters": [],
                    "special_pages_inventory": [],
                    "final_summary": {
                        "total_pages_generated": 0,
                        "total_panels": 0,
                        "total_image_prompts": 0,
                        "chapters_completed": 0,
                        "chapters_target": 0,
                        "deviations": ""
                    },
                    "script_markdown": script_markdown,
                    "parser_note": "Fallback JSON generated because model output was not valid JSON.",
                },
            },
        },
    }


def _trim_json_for_prompt(obj, max_str: int = 600):
    """
    Recursively trim a JSON-serialisable object so it fits inside an LLM prompt.

    Rules applied:
    - Strings that start with 'data:' (base64 data URLs) → replaced with '[image_ref]'
    - Any other string longer than *max_str* characters → truncated with '…'
    - Lists and dicts are processed recursively.
    """
    if isinstance(obj, str):
        if obj.startswith("data:"):
            return "[image_ref]"
        return obj if len(obj) <= max_str else obj[:max_str] + "…"
    if isinstance(obj, list):
        return [_trim_json_for_prompt(v, max_str) for v in obj]
    if isinstance(obj, dict):
        return {k: _trim_json_for_prompt(v, max_str) for k, v in obj.items()}
    return obj


def _extract_step3_context(step1_json: dict, step2_json: dict) -> tuple[str, str]:
    """
    Extract the minimal fields from Step 1 and Step 2 structured JSON that
    Step 3 (panel script) actually needs, then serialise them compactly.

    This avoids sending:
    - full analysis/design markdown blobs (already processed into structured data)
    - the raw story_content again (already summarised in step 1)
    - base64 image data URLs (useless for text generation)
    - step_1 data repeated inside step_2 (it's always nested there)
    """
    # ── Step 1: chapter/scene structure + key character list ─────────────────
    s1_steps   = step1_json.get("steps", {})
    s1_analysis = s1_steps.get("step_1_analysis", {}).get("data", {})
    step1_ctx = {
        "chapter_outline":      _trim_json_for_prompt(s1_analysis.get("chapter_outline") or []),
        "narrative_structure":  _trim_json_for_prompt(s1_analysis.get("narrative_structure") or {}),
        "character_breakdown":  _trim_json_for_prompt(s1_analysis.get("character_breakdown") or []),
        "scene_breakdown":      _trim_json_for_prompt(s1_analysis.get("scene_breakdown") or []),
    }

    # ── Step 2: character names + image prompts only (no markdown, no base64) ─
    s2_steps  = step2_json.get("steps", {})
    s2_design = s2_steps.get("step_2_design", {}).get("data", {})
    s2_review = s2_steps.get("step_2_image_review", {}).get("data", {})

    main_designs = s2_design.get("main_characters_designs") or {}
    chars: dict = {}
    if isinstance(main_designs, dict):
        for char_id, char_data in main_designs.items():
            if not isinstance(char_data, dict):
                continue
            ref_url = char_data.get("selected_reference_image_url", "")
            chars[char_id] = {
                "name":                   char_data.get("name", char_id),
                "ai_image_prompt_ready":  _trim_json_for_prompt(
                    char_data.get("ai_image_prompt_ready") or "", max_str=400
                ),
                "selected_reference":     "[image provided]" if ref_url else "none",
            }

    selected_refs = [
        {
            "character_id": r.get("character_id"),
            "name":         r.get("name"),
            "prompt":       _trim_json_for_prompt(r.get("prompt") or "", max_str=300),
        }
        for r in (s2_review.get("selected_character_references") or [])
        if isinstance(r, dict)
    ]

    step2_ctx = {
        "main_characters":          chars,
        "selected_character_refs":  selected_refs,
    }

    return (
        json.dumps(step1_ctx, ensure_ascii=True, indent=2),
        json.dumps(step2_ctx, ensure_ascii=True, indent=2),
    )


class GeminiService:
    """Service class for interacting with Google's Gemini API."""

    def __init__(self, model: str | None = None):
        """Initialize Gemini API with API key from settings."""
        self.use_nine_router = bool(settings.NINE_ROUTER_URL)
        if self.use_nine_router:
            self.nine_router_url = _normalize_nine_router_url(settings.NINE_ROUTER_URL)
            if not self.nine_router_url:
                raise ValueError("NINE_ROUTER_URL is set but empty.")
            self.nine_router_api_key = settings.NINE_ROUTER_API_KEY
            self.nine_router_model = settings.NINE_ROUTER_MODEL
            self.nine_router_timeout = settings.NINE_ROUTER_TIMEOUT_SECONDS
            return

        if genai is None:
            raise ImportError(
                "google-genai is not installed. Run `pip install google-genai`."
            ) from genai_import_error
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set")

        self.model_name = model or settings.GEMINI_MODEL
        # Client-based SDK surface; avoids global state.
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def generate_text(self, prompt: str, stream: bool = False):
        """
        Generate text using Gemini API.

        Args:
            prompt: The input prompt for text generation
            stream: If True, returns an async generator for streaming responses

        Returns:
            Generated text response (str) or async generator for streaming
        """
        if self.use_nine_router:
            if stream:
                return self._generate_text_nine_router_stream(prompt)
            return await self._generate_text_nine_router(prompt)

        if stream:
            return self._generate_text_gemini_stream(prompt)

        try:
            response = self.client.models.generate_content(
                model=self.model_name, contents=prompt
            )
            return response.text
        except google_exceptions.ResourceExhausted as exc:
            retry_after = _extract_retry_after_seconds(str(exc))
            raise GeminiServiceError(
                "Gemini quota exceeded. Please retry later or check your billing/limits.",
                status_code=429,
                retry_after_seconds=retry_after,
            ) from exc
        except google_exceptions.NotFound as exc:
            raise GeminiServiceError(
                f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                status_code=404,
            ) from exc
        except genai_errors.ClientError as exc:
            status_code = int(getattr(exc, "code", 500) or 500)
            retry_after = _extract_retry_after_seconds(str(exc))
            if status_code == 429:
                raise GeminiServiceError(
                    "Gemini quota exceeded. Please retry later or check your billing/limits.",
                    status_code=429,
                    retry_after_seconds=retry_after,
                ) from exc
            if status_code == 404:
                raise GeminiServiceError(
                    f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                    status_code=404,
                ) from exc
            raise GeminiServiceError(
                f"Gemini API request failed: {exc}", status_code=status_code
            ) from exc
        except Exception as exc:
            raise GeminiServiceError(f"Failed to generate text: {exc}") from exc

    async def _generate_text_gemini_stream(self, prompt: str):
        """Stream text generation from Gemini API."""
        try:
            response = self.client.models.generate_content_stream(
                model=self.model_name, contents=prompt
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except google_exceptions.ResourceExhausted as exc:
            retry_after = _extract_retry_after_seconds(str(exc))
            raise GeminiServiceError(
                "Gemini quota exceeded. Please retry later or check your billing/limits.",
                status_code=429,
                retry_after_seconds=retry_after,
            ) from exc
        except google_exceptions.NotFound as exc:
            raise GeminiServiceError(
                f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                status_code=404,
            ) from exc
        except genai_errors.ClientError as exc:
            status_code = int(getattr(exc, "code", 500) or 500)
            retry_after = _extract_retry_after_seconds(str(exc))
            if status_code == 429:
                raise GeminiServiceError(
                    "Gemini quota exceeded. Please retry later or check your billing/limits.",
                    status_code=429,
                    retry_after_seconds=retry_after,
                ) from exc
            if status_code == 404:
                raise GeminiServiceError(
                    f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                    status_code=404,
                ) from exc
            raise GeminiServiceError(
                f"Gemini API request failed: {exc}", status_code=status_code
            ) from exc
        except Exception as exc:
            raise GeminiServiceError(f"Failed to generate text: {exc}") from exc

    async def _generate_text_nine_router(self, prompt: str) -> str:
        cleaned_prompt = (prompt or "").strip()
        if not cleaned_prompt:
            raise GeminiServiceError("Prompt is required.", status_code=400)

        payload = {
            "model": self.nine_router_model,
            "messages": [{"role": "user", "content": cleaned_prompt}],
        }
        headers = {"Content-Type": "application/json"}
        if self.nine_router_api_key:
            headers["Authorization"] = f"Bearer {self.nine_router_api_key}"

        try:
            async with httpx.AsyncClient(timeout=self.nine_router_timeout) as client:
                response = await client.post(
                    f"{self.nine_router_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
        except Exception as exc:
            raise GeminiServiceError(f"9Router request failed: {exc}") from exc

        if response.status_code >= 400:
            snippet = response.text.strip()[:500]
            message = f"9Router request failed with status {response.status_code}."
            if snippet:
                message = f"{message} Body preview: {snippet}"
            raise GeminiServiceError(message, status_code=502)

        try:
            data = response.json()
        except json.JSONDecodeError:
            streamed_text = _parse_nine_router_sse(response.text)
            if streamed_text:
                return streamed_text
            snippet = response.text.strip()[:500]
            message = "9Router response parsing failed: received non-JSON content."
            if snippet:
                message = f"{message} Body preview: {snippet}"
            raise GeminiServiceError(message, status_code=502)

        choices = data.get("choices") if isinstance(data, dict) else None
        if not isinstance(choices, list) or not choices:
            raise GeminiServiceError("9Router response missing choices.", status_code=502)

        first_choice = choices[0] if isinstance(choices[0], dict) else None
        content = None
        if isinstance(first_choice, dict):
            message = first_choice.get("message")
            if isinstance(message, dict):
                content = message.get("content")
            if not content:
                content = first_choice.get("text")

        if not content:
            raise GeminiServiceError("9Router response missing message content.", status_code=502)

        return str(content).strip()

    async def _generate_text_nine_router_stream(self, prompt: str):
        """Stream text generation from 9Router API."""
        cleaned_prompt = (prompt or "").strip()
        if not cleaned_prompt:
            raise GeminiServiceError("Prompt is required.", status_code=400)

        payload = {
            "model": self.nine_router_model,
            "messages": [{"role": "user", "content": cleaned_prompt}],
            "stream": True,
        }
        headers = {"Content-Type": "application/json"}
        if self.nine_router_api_key:
            headers["Authorization"] = f"Bearer {self.nine_router_api_key}"

        try:
            async with httpx.AsyncClient(timeout=self.nine_router_timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.nine_router_url}/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    if response.status_code >= 400:
                        snippet = (await response.aread()).decode("utf-8", errors="ignore")[:500]
                        message = f"9Router request failed with status {response.status_code}."
                        if snippet:
                            message = f"{message} Body preview: {snippet}"
                        raise GeminiServiceError(message, status_code=502)

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data:"):
                            continue

                        payload_text = line[5:].strip()
                        if not payload_text or payload_text == "[DONE]":
                            continue

                        try:
                            data = json.loads(payload_text)
                        except json.JSONDecodeError:
                            continue

                        choices = data.get("choices") if isinstance(data, dict) else None
                        if not isinstance(choices, list) or not choices:
                            continue

                        first_choice = choices[0] if isinstance(choices[0], dict) else None
                        if not isinstance(first_choice, dict):
                            continue

                        delta = first_choice.get("delta")
                        if isinstance(delta, dict) and delta.get("content"):
                            yield str(delta.get("content"))
                        elif first_choice.get("text"):
                            yield str(first_choice.get("text"))
        except GeminiServiceError:
            raise
        except Exception as exc:
            raise GeminiServiceError(f"9Router streaming request failed: {exc}") from exc

    def _raw_stream(self, prompt: str):
        """Return the right async-generator for the active provider (9Router or Gemini)."""
        if self.use_nine_router:
            return self._generate_text_nine_router_stream(prompt)
        return self._generate_text_gemini_stream(prompt)

    async def _stream_with_separator(self, prompt: str, sep: str = "===JSON==="):
        """
        Drive _raw_stream, splitting on `sep`.

        Yields:
          ("token", str)       — text before the separator (show to user)
          ("json_raw", str)    — complete accumulated text after the separator
          ("error", str, int)  — on failure
        """
        analysis_parts: list[str] = []
        json_parts: list[str] = []
        phase = "analysis"
        pending = ""

        try:
            async for token in self._raw_stream(prompt):
                if phase == "analysis":
                    pending += token
                    idx = pending.find(sep)
                    if idx >= 0:
                        pre = pending[:idx]
                        if pre:
                            yield ("token", pre)
                            analysis_parts.append(pre)
                        phase = "json"
                        after = pending[idx + len(sep):]
                        if after.strip():
                            json_parts.append(after)
                        pending = ""
                    else:
                        safe_until = max(0, len(pending) - len(sep) + 1)
                        if safe_until > 0:
                            safe = pending[:safe_until]
                            yield ("token", safe)
                            analysis_parts.append(safe)
                            pending = pending[safe_until:]
                else:
                    json_parts.append(token)
        except GeminiServiceError as exc:
            yield ("error", str(exc), exc.status_code)
            return
        except Exception as exc:
            yield ("error", f"Streaming failed: {exc}", 500)
            return

        if pending:
            if phase == "analysis":
                yield ("token", pending)
            else:
                json_parts.append(pending)

        yield ("json_raw", "".join(json_parts).strip())

    async def generate_step2_stream(
        self,
        project_id: str,
        step1_json: dict,
        desired_main_characters: int,
        genre_tone: str,
        art_style_reference: str,
        special_requests: str,
        step_status: str,
        last_updated: str,
    ):
        """
        Stream Step 2 character design markdown, then yield structured JSON.

        Yields same tuples as generate_step1_stream:
          ("token", str) | ("done", markdown_str, dict) | ("error", str, int)
        """
        sep = "===JSON==="
        step1_json_text = json.dumps(step1_json, ensure_ascii=True, indent=2)

        prompt = f"""You are a professional manga adaptation studio AI. Your only job right now is Step 2: Character Designs.

REFERENCE FROM STEP 1 (structured JSON):
{step1_json_text}

USER CUSTOMIZATION INPUTS:
- Desired total main characters: {desired_main_characters}
- Preferred manga genre & tone: {genre_tone}
- Art style reference: {art_style_reference}
- Any special requests for designs: {special_requests}

TASK – STEP 2 ONLY
Output EXACTLY in this order using clean markdown:

1. Global Design Guidelines
2. Main Character Design Sheets
For each main character:
- Name & Role
- Personality & Backstory (2-3 sentences)
- Physical Appearance
- Outfit & Accessories
- Expressions & Poses
- Visual Design Hook
- AI Image Prompt Ready: <single-line image generation prompt>
3. Supporting Character Design Sheets (brief)
4. Interaction & Relationship Notes
5. Final Design Summary (boxed table)

After you finish the markdown above, write this separator on its own line (nothing else on that line):
{sep}
Then immediately write one valid JSON object (no markdown, no code fence):
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "genre": "{genre_tone}",
    "tone": "{genre_tone}",
    "art_style_reference": "{art_style_reference}",
    "user_customizations": {{"special_requests": "{special_requests}"}}
  }},
  "steps": {{
    "step_1_analysis": <copy step_1_analysis from input JSON or {{}}>,
    "step_2_design": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "main_characters_designs": {{
          "<character_id>": {{
            "name": "",
            "physical_appearance": "",
            "outfit_casual": "",
            "expressions": {{}},
            "ai_image_prompt_ready": ""
          }}
        }},
        "supporting_designs": {{}}
      }}
    }}
  }}
}}
Rules: each main character needs ai_image_prompt_ready. Return valid JSON only after the separator."""

        analysis_parts: list[str] = []
        raw_json = ""

        async for event in self._stream_with_separator(prompt, sep):
            if event[0] == "token":
                yield ("token", event[1])
                analysis_parts.append(event[1])
            elif event[0] == "json_raw":
                raw_json = event[1]
            elif event[0] == "error":
                yield event
                return

        design_markdown = "".join(analysis_parts)

        if raw_json:
            try:
                structured = _extract_json_payload(raw_json)
            except GeminiServiceError:
                structured = _build_step2_fallback_snapshot(
                    project_id=project_id,
                    genre_tone=genre_tone,
                    art_style_reference=art_style_reference,
                    special_requests=special_requests,
                    step_status=step_status,
                    last_updated=last_updated,
                    step1_json=step1_json,
                    design_markdown=design_markdown,
                    desired_main_characters=desired_main_characters,
                )
        else:
            structured = _build_step2_fallback_snapshot(
                project_id=project_id,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                step1_json=step1_json,
                design_markdown=design_markdown,
                desired_main_characters=desired_main_characters,
            )

        # Merge step1 data if model didn't carry it over
        if isinstance(step1_json, dict):
            parsed_steps = structured.setdefault("steps", {})
            if "step_1_analysis" not in parsed_steps:
                prior = step1_json.get("steps", {}).get("step_1_analysis")
                if prior is not None:
                    parsed_steps["step_1_analysis"] = prior

        # Ensure ai_image_prompt_ready is populated for every character
        step2_data = structured.get("steps", {}).get("step_2_design", {}).get("data", {})
        main_designs = step2_data.get("main_characters_designs")
        if not isinstance(main_designs, dict) or not main_designs:
            step2_data["main_characters_designs"] = _build_step2_main_designs(
                step1_json=step1_json,
                design_markdown=design_markdown,
                desired_main_characters=desired_main_characters,
                art_style_reference=art_style_reference,
            )

        yield ("done", design_markdown, structured)

    async def generate_step3_stream(
        self,
        project_id: str,
        step1_json: dict,
        step2_json: dict,
        num_chapters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        step_status: str,
        last_updated: str,
    ):
        """
        Stream Step 3 panel script markdown, then yield structured JSON.

        Yields: ("token", str) | ("done", markdown_str, dict) | ("error", str, int)
        """
        sep = "===JSON==="

        # Trim context to only what Step 3 needs — strips base64 images, long
        # markdown blobs, and the duplicate step_1 data nested inside step_2.
        step1_ctx, step2_ctx = _extract_step3_context(step1_json, step2_json)

        prompt = f"""You are a professional manga adaptation studio AI. Your only job right now is Step 3: Panel-by-Panel Script & Image Prompts.

REFERENCE FROM PREVIOUS STEPS:
[STEP 1 – Chapter & Scene Structure]
{step1_ctx}

[STEP 2 – Character Designs & Image Prompts]
{step2_ctx}

USER CUSTOMIZATION INPUTS:
- Number of chapters: {num_chapters}
- Target total pages: {target_total_pages}
- Genre & tone: {genre_tone}
- Art style reference: {art_style_reference}
- Maximum panels per page: {max_panels_per_page}
- Special requests: {special_requests}

TASK – STEP 3 ONLY
Using the chapter/scene structure from Step 1 and character designs from Step 2, write the full panel-by-panel manga script.
Output EXACTLY in this order using clean markdown:

1. Global Scripting Rules
2. Chapter-by-Chapter Script
For each chapter:
  Chapter Title & Page Range
  For each page:
    Page Number:
    Layout Summary:
    Panel 1: [description]
    Dialogue/SFX/Thoughts: [content]
    AI Image Prompt: [detailed prompt — incorporate the character's ai_image_prompt_ready from Step 2 for visual consistency]
    (repeat for all panels up to {max_panels_per_page} per page)
  Chapter End Notes:
3. Special Pages Inventory (splash/spreads with prompts)
4. Final Script Summary (boxed table): total pages / panels / image prompts / chapters / deviations

IMPORTANT CHARACTER CONSISTENCY: For every character listed in Step 2, use their ai_image_prompt_ready text as the base of every AI Image Prompt that features them. If selected_reference is "[image provided]", note "consistent with approved reference" in that prompt.

After you finish the script above, write this separator on its own line (nothing else on that line):
{sep}
Then immediately write one valid JSON object (no markdown, no code fence):
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "steps": {{
    "step_3_script": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "chapters": [
          {{
            "chapter_number": 1,
            "title": "",
            "page_range": "",
            "pages": [
              {{
                "page_number": 1,
                "layout_summary": "",
                "panels": [
                  {{"panel_number":1,"description":"","dialogue_sfx_thoughts":"","ai_image_prompt":""}}
                ]
              }}
            ],
            "chapter_end_notes": ""
          }}
        ],
        "special_pages_inventory": [],
        "final_summary": {{
          "total_pages_generated": 0,
          "total_panels": 0,
          "total_image_prompts": 0,
          "chapters_completed": 0,
          "chapters_target": {num_chapters},
          "deviations": ""
        }}
      }}
    }}
  }}
}}
Rules: valid JSON only after the separator. Output only step_3_script — do NOT reproduce step_1 or step_2 data."""

        analysis_parts: list[str] = []
        raw_json = ""

        async for event in self._stream_with_separator(prompt, sep):
            if event[0] == "token":
                yield ("token", event[1])
                analysis_parts.append(event[1])
            elif event[0] == "json_raw":
                raw_json = event[1]
            elif event[0] == "error":
                yield event
                return

        script_markdown = "".join(analysis_parts)

        if raw_json:
            try:
                structured = _extract_json_payload(raw_json)
            except GeminiServiceError:
                structured = _build_step3_fallback_snapshot(
                    project_id=project_id,
                    genre_tone=genre_tone,
                    art_style_reference=art_style_reference,
                    max_panels_per_page=max_panels_per_page,
                    special_requests=special_requests,
                    step_status=step_status,
                    last_updated=last_updated,
                    step2_json=step2_json,
                    script_markdown=script_markdown,
                )
        else:
            structured = _build_step3_fallback_snapshot(
                project_id=project_id,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                max_panels_per_page=max_panels_per_page,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                step2_json=step2_json,
                script_markdown=script_markdown,
            )

        # Preserve prior steps if model dropped them
        if isinstance(step2_json, dict):
            parsed_steps = structured.setdefault("steps", {})
            prior = step2_json.get("steps", {})
            if "step_1_analysis" not in parsed_steps and isinstance(prior, dict):
                s1 = prior.get("step_1_analysis")
                if s1 is not None:
                    parsed_steps["step_1_analysis"] = s1
            if "step_2_design" not in parsed_steps and isinstance(prior, dict):
                s2 = prior.get("step_2_design")
                if s2 is not None:
                    parsed_steps["step_2_design"] = s2

        yield ("done", script_markdown, structured)

    async def generate_step1_stream(
        self,
        project_id: str,
        story_text: str,
        num_chapters: int,
        desired_main_characters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        step_status: str,
        last_updated: str,
    ):
        """
        Stream Step 1: Analysis & Planning.

        Yields 3-tuples:
          ("token", str)            – markdown analysis token (show to the user)
          ("status", str)           – brief status message ("Building structured data…")
          ("done", str, dict)       – (full_analysis_markdown, structured_json)
          ("error", str, int)       – (message, http_status_code)

        The LLM is asked to produce the full markdown analysis THEN write the separator
        "===JSON===" on its own line and output the structured JSON immediately after.
        This means there is exactly ONE LLM round-trip: no second call, no second 524.
        """
        sep = "===JSON==="

        prompt = f"""You are a professional manga adaptation studio AI. Your only job right now is Step 1: Analysis & Planning.

USER CUSTOMIZATION INPUTS:

Story text: '''{story_text}'''
Desired total main characters: {desired_main_characters}
Number of chapters: {num_chapters}
Target total pages: {target_total_pages}
Genre & tone: {genre_tone}
Art style reference: {art_style_reference}
Maximum panels per page: {max_panels_per_page}
Special requests: {special_requests}

TASK – STEP 1 ONLY
Output EXACTLY in this order using clean markdown:

1. Character Breakdown
Total characters detected: __
Main characters (exactly {desired_main_characters}): list with 1-sentence role + personality + visual design hook.
Supporting / minor characters (grouped or merged).
Characters you recommend removing or combining and why.

2. Plot & Arc Analysis
Main plot in one sentence.
Number of major plot arcs.
Subplots (each with importance: High / Medium / Low).
Overall story structure (3-act or 4-act) divided into exactly {num_chapters} chapters.

3. Chapter Division
Create exactly {num_chapters} chapters with: title, page estimate, scene list.

4. Scene-by-Scene Breakdown
For every scene: scene number, chapter, one-sentence summary, key visual moment, page count, panel layout notes, splash/spread needed?

5. Global Manga Layout Rules

6. Final Statistics Summary (boxed table)
Total chapters / scenes / pages / main characters / avg scenes per page / splash pages.

After completing the analysis above, write this separator on its own line (nothing else on that line):
{sep}
Then immediately write one valid JSON object (no markdown, no code fence):
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "story_content": "<first 400 chars of story>",
    "genre": "{genre_tone}",
    "tone": "{genre_tone}",
    "art_style_reference": "{art_style_reference}",
    "max_panels_per_page": {max_panels_per_page},
    "user_customizations": {{"special_requests": "{special_requests}"}}
  }},
  "steps": {{
    "step_1_analysis": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "analysis": {{
          "total_characters_detected": 0,
          "main_characters": [{{"id":"","name":"","role":"","visual_hook":""}}],
          "supporting_characters": [{{"id":"","name":"","role":""}}],
          "plot": "",
          "arcs": [],
          "structure": ""
        }},
        "chapters_structure": [{{"chapter_number":1,"title":"","pages_estimate":"","scenes":[]}}],
        "final_statistics": {{"total_chapters":0,"total_pages":0,"total_scenes":0}}
      }}
    }}
  }}
}}
Rules: chapters_structure must have exactly {num_chapters} entries. main_characters must list exactly {desired_main_characters} characters. Return valid JSON only after the separator."""

        analysis_parts: list[str] = []
        json_parts: list[str] = []
        phase = "analysis"
        pending = ""

        try:
            async for token in self._raw_stream(prompt):
                if phase == "analysis":
                    pending += token
                    idx = pending.find(sep)
                    if idx >= 0:
                        pre = pending[:idx]
                        if pre:
                            yield ("token", pre)
                            analysis_parts.append(pre)
                        phase = "json"
                        after = pending[idx + len(sep):]
                        if after.strip():
                            json_parts.append(after)
                        pending = ""
                    else:
                        # Keep a tail equal to sep-length to catch cross-chunk separators
                        safe_until = max(0, len(pending) - len(sep) + 1)
                        if safe_until > 0:
                            safe = pending[:safe_until]
                            yield ("token", safe)
                            analysis_parts.append(safe)
                            pending = pending[safe_until:]
                else:
                    json_parts.append(token)
        except GeminiServiceError as exc:
            yield ("error", str(exc), exc.status_code)
            return
        except Exception as exc:
            yield ("error", f"Streaming failed: {exc}", 500)
            return

        # Flush any pending analysis tail
        if pending:
            if phase == "analysis":
                yield ("token", pending)
                analysis_parts.append(pending)
            else:
                json_parts.append(pending)

        analysis_markdown = "".join(analysis_parts)
        raw_json = "".join(json_parts).strip()

        if raw_json:
            try:
                structured = _extract_json_payload(raw_json)
            except GeminiServiceError:
                structured = _build_step1_fallback_snapshot(
                    project_id=project_id,
                    story_text=story_text,
                    genre_tone=genre_tone,
                    art_style_reference=art_style_reference,
                    max_panels_per_page=max_panels_per_page,
                    special_requests=special_requests,
                    step_status=step_status,
                    last_updated=last_updated,
                    num_chapters=num_chapters,
                    analysis_markdown=analysis_markdown,
                )
        else:
            # Model didn't include the separator – treat full output as markdown
            structured = _build_step1_fallback_snapshot(
                project_id=project_id,
                story_text=story_text,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                max_panels_per_page=max_panels_per_page,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                num_chapters=num_chapters,
                analysis_markdown=analysis_markdown,
            )

        yield ("done", analysis_markdown, structured)

    async def analyze_story_lightweight_stream(
        self,
        story_text: str,
        genre_tone: str = "Adventure",
    ):
        """
        Lightweight story analysis — characters, beats, tone only.
        Much faster than generate_step1_stream; used by Story Setup preview.

        Yields:
          ("token", str)        — streaming summary token
          ("done", dict)        — {"detected_characters":[...], "tone_tags":[...], "scene_beats":N, "estimated_panels":N}
          ("error", str, int)   — (message, status_code)
        """
        sep = "===JSON==="
        prompt = f"""You are a story analyst helping adapt a story into a comic.

Read the story and write a 2-sentence summary, then output the separator below, then a JSON object.

Separator (output exactly, on its own line):
{sep}

JSON format (no markdown, no code fence):
{{
  "detected_characters": ["Name1", "Name2"],
  "tone_tags": ["Epic", "Hopeful"],
  "scene_beats": 12,
  "estimated_panels": 80
}}

Rules:
- detected_characters: 2–5 main character names as they appear in the story
- tone_tags: 2–4 single-word descriptors (e.g. "Epic", "Gritty", "Tender", "Dark")
- scene_beats: integer count of distinct narrative beats/scenes in the story
- estimated_panels: rough total comic panels (typically 5–8 per scene beat)
- Genre context: {genre_tone}

Story:
\"\"\"{story_text}\"\"\"
"""
        summary_parts: list[str] = []
        json_parts: list[str] = []
        phase = "summary"
        pending = ""

        try:
            async for token in self._raw_stream(prompt):
                if phase == "summary":
                    pending += token
                    idx = pending.find(sep)
                    if idx >= 0:
                        pre = pending[:idx]
                        if pre:
                            yield ("token", pre)
                            summary_parts.append(pre)
                        phase = "json"
                        after = pending[idx + len(sep):]
                        if after.strip():
                            json_parts.append(after)
                        pending = ""
                    else:
                        safe_until = max(0, len(pending) - len(sep) + 1)
                        if safe_until > 0:
                            safe = pending[:safe_until]
                            yield ("token", safe)
                            summary_parts.append(safe)
                            pending = pending[safe_until:]
                else:
                    json_parts.append(token)
        except GeminiServiceError as exc:
            yield ("error", str(exc), exc.status_code)
            return
        except Exception as exc:
            yield ("error", f"Streaming failed: {exc}", 500)
            return

        if pending:
            if phase == "summary":
                yield ("token", pending)
            else:
                json_parts.append(pending)

        raw_json = "".join(json_parts).strip()
        result: dict = {}
        if raw_json:
            try:
                parsed = _extract_json_payload(raw_json)
                result = parsed if isinstance(parsed, dict) else {}
            except GeminiServiceError:
                result = {}

        # Fallback: derive from story text if model didn't return valid JSON
        if not result.get("detected_characters"):
            import re as _re
            stopwords = {
                "The","When","But","Each","Master","She","Her","His","They","There",
                "This","That","What","Who","How","And","For","Not","Are","Was","Has",
            }
            names = list(dict.fromkeys(
                w for w in (_re.findall(r'\b[A-Z][a-z]{2,}\b', story_text) or [])
                if w not in stopwords
            ))[:3]
            result["detected_characters"] = names or ["Character"]

        if not result.get("tone_tags"):
            result["tone_tags"] = ["Adventure"]
        if not isinstance(result.get("scene_beats"), int):
            words = len(story_text.split())
            result["scene_beats"] = max(4, round(words / 15))
        if not isinstance(result.get("estimated_panels"), int):
            result["estimated_panels"] = result["scene_beats"] * 6

        yield ("done", result)

    async def generate_adapt_story_stream(
        self,
        original_story: str,
        creative_direction: str,
        genre_tone: str,
        art_style_reference: str,
        special_requests: str = "None",
    ):
        """
        Stream story adaptation by a Comic Scriptwriter persona.

        Yields:
          ("thinking", str)       — reasoning tokens before the JSON separator (show in Thinking… UI)
          ("done", str, list)     — (adapted_story_text, changes_summary list)
          ("error", str, int)     — on failure
        """
        sep = "===JSON==="
        prompt = f"""You are a professional and highly creative Comic Scriptwriter. Your task is to take an original story and adapt it based on the user's creative direction (e.g., adding a new character, creating a plot twist, changing the genre, etc.).

Core requirements:
- The new story must remain logical but introduce surprising and engaging elements.
- The writing style must be visual-rich so it can be easily adapted into comic panels.
- Describe scenes with vivid visual details: settings, lighting, character expressions, body language, and action.
- Include clear visual moments that would work well as individual comic panels.
- Maintain narrative coherence while incorporating the requested changes.
- Do not summarize — write the complete adapted story as a narrative, not bullet points.

Original Story:
{original_story}

User's Creative Direction:
{creative_direction}

Genre & Tone: {genre_tone}
Art Style Reference: {art_style_reference}
Special Requests: {special_requests}

Think carefully about how to adapt this story, then write the complete adapted version.
After your thinking and the full adapted narrative, output exactly this separator on its own line:

{sep}
{{
  "adapted_story": "<full adapted story here — every paragraph, complete narrative>",
  "changes_summary": ["<change 1>", "<change 2>", "<change 3>"]
}}

The adapted_story field must contain the complete prose narrative, not a summary."""

        thinking_parts: list[str] = []
        json_parts: list[str] = []
        phase = "thinking"
        pending = ""

        try:
            async for token in self._raw_stream(prompt):
                if phase == "thinking":
                    pending += token
                    idx = pending.find(sep)
                    if idx >= 0:
                        pre = pending[:idx]
                        if pre:
                            yield ("thinking", pre)
                            thinking_parts.append(pre)
                        phase = "json"
                        after = pending[idx + len(sep):]
                        if after.strip():
                            json_parts.append(after)
                        pending = ""
                    else:
                        safe_until = max(0, len(pending) - len(sep) + 1)
                        if safe_until > 0:
                            safe = pending[:safe_until]
                            yield ("thinking", safe)
                            thinking_parts.append(safe)
                            pending = pending[safe_until:]
                else:
                    json_parts.append(token)
        except GeminiServiceError as exc:
            yield ("error", str(exc), exc.status_code)
            return
        except Exception as exc:
            yield ("error", f"Streaming failed: {exc}", 500)
            return

        if pending:
            if phase == "thinking":
                yield ("thinking", pending)
                thinking_parts.append(pending)
            else:
                json_parts.append(pending)

        raw_json = "".join(json_parts).strip()
        if raw_json:
            try:
                payload = _extract_json_payload(raw_json)
                adapted_story = str(payload.get("adapted_story", "")).strip()
                changes_summary = payload.get("changes_summary", [])
                if not isinstance(changes_summary, list):
                    changes_summary = []
            except GeminiServiceError:
                # Separator found but JSON malformed — use thinking as story fallback
                adapted_story = "".join(thinking_parts).strip()
                changes_summary = []
        else:
            # No separator — model wrote the whole thing as prose; use it directly
            adapted_story = "".join(thinking_parts).strip()
            changes_summary = []

        yield ("done", adapted_story, changes_summary)

    async def generate_panel_image_url(
        self,
        image_prompt: str,
        width: int = 720,
        height: int = 960,
    ) -> str:
        """Return an image URL generated from prompt via backend-controlled provider."""
        cleaned_prompt = (image_prompt or "").strip()
        if not cleaned_prompt:
            raise GeminiServiceError("image_prompt is required.", status_code=400)

        # Provider URLs break easily with very long markdown-style prompts.
        # Normalize and keep a concise prompt for better reliability.
        compact_prompt = re.sub(r"\s+", " ", cleaned_prompt)
        compact_prompt = re.sub(r"\*{1,3}", "", compact_prompt)
        compact_prompt = re.sub(
            r"--[a-zA-Z0-9:_-]+(?:\s+[a-zA-Z0-9:./_-]+)?", "", compact_prompt
        )
        compact_prompt = compact_prompt.strip()
        compact_prompt = compact_prompt[:280] if len(compact_prompt) > 280 else compact_prompt
        if not compact_prompt:
            compact_prompt = "manga panel black and white dynamic composition"

        # Pollinations is used as a lightweight image provider behind backend endpoint.
        safe_prompt = quote(compact_prompt, safe="")
        safe_width = max(256, min(int(width or 720), 2048))
        safe_height = max(256, min(int(height or 960), 2048))
        seed = int(hashlib.sha256(compact_prompt.encode("utf-8")).hexdigest()[:8], 16)
        return (
            f"https://image.pollinations.ai/prompt/{safe_prompt}"
            f"?width={safe_width}&height={safe_height}&seed={seed}&nologo=true"
        )

    async def generate_panel_image_data_url(self, image_url: str) -> str:
        """Fetch an image URL and return a browser-safe data URL string."""
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(image_url)
                response.raise_for_status()

            content_type = response.headers.get("content-type", "image/png").split(";")[0].strip()
            if not content_type.startswith("image/"):
                raise GeminiServiceError(
                    f"Unexpected image content type from provider: {content_type}",
                    status_code=502,
                )

            encoded = base64.b64encode(response.content).decode("ascii")
            return f"data:{content_type};base64,{encoded}"
        except GeminiServiceError:
            raise
        except httpx.HTTPStatusError as exc:
            raise GeminiServiceError(
                f"Image provider request failed with status {exc.response.status_code}.",
                status_code=502,
            ) from exc
        except Exception as exc:
            raise GeminiServiceError(f"Failed to fetch generated image bytes: {exc}") from exc

    async def analyze_story(self, story_text: str) -> str:
        """
        Analyze a story for comic adaptation.

        Args:
            story_text: The story text to analyze

        Returns:
            Analysis of the story
        """
        prompt = f"""
Please analyze the following story for comic/manga adaptation:

{story_text}

Provide a detailed analysis including:
1. Main plot points
2. Character development arcs
3. Recommended pacing for comic panels
4. Key scenes for visual adaptation
5. Suggested art style considerations
        """
        return await self.generate_text(prompt)

    async def generate_plot_analysis(
        self,
        story_text: str,
        num_chapters: int = 3,
        desired_main_characters: int = 5,
        target_total_pages: str = "auto",
        genre_tone: str = "Shonen action",
        art_style_reference: str = "classic black-and-white weekly shonen",
        max_panels_per_page: int = 6,
        special_requests: str = "None",
        output_format: str = "markdown",
        project_id: str = "manga_project_001",
        step_status: str = "review_pending",
        last_updated: str | None = None,
        stream: bool = False,
    ):
        """
        Generate detailed plot analysis for story division.

        Args:
            story_text: The story to analyze
            num_chapters: Number of chapters to divide into

        Returns:
            Plot analysis and chapter breakdown
        """
        if output_format.lower() == "json":
            json_last_updated = last_updated or "1970-01-01T00:00:00Z"
            prompt = f"""
You are a professional manga adaptation studio AI.
Your task is Step 1: Analysis & Planning, and you must return one valid JSON object only.
Do not include markdown, explanation, comments, or code fences.

Generate JSON using this exact top-level structure:
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "story_content": "...",
    "genre": "...",
    "tone": "...",
    "art_style_reference": "...",
    "max_panels_per_page": 0,
    "user_customizations": {{
      "special_requests": "..."
    }}
  }},
  "steps": {{
    "step_1_analysis": {{
      "status": "{step_status}",
      "last_updated": "{json_last_updated}",
      "data": {{
        "analysis": {{
          "total_characters_detected": 0,
          "main_characters": [
            {{ "id": "", "name": "", "role": "", "visual_hook": "" }}
          ],
          "supporting_characters": [
            {{ "id": "", "name": "", "role": "" }}
          ],
          "plot": "",
          "arcs": [],
          "structure": ""
        }},
        "chapters_structure": [
          {{
            "chapter_number": 1,
            "title": "",
            "pages_estimate": "",
            "scenes": []
          }}
        ],
        "final_statistics": {{
          "total_chapters": 0,
          "total_pages": 0,
          "total_scenes": 0
        }}
      }}
    }}
  }}
}}

User input data:
- story_content: {story_text}
- desired_main_characters: {desired_main_characters}
- num_chapters: {num_chapters}
- target_total_pages: {target_total_pages}
- genre: {genre_tone}
- tone: {genre_tone}
- art_style_reference: {art_style_reference}
- max_panels_per_page: {max_panels_per_page}
- special_requests: {special_requests}

Rules:
- Return strict JSON only.
- Ensure chapters_structure has exactly {num_chapters} chapter objects.
- Keep all required keys present.
- Use numeric values for totals.
            """
            return await self.generate_text(prompt)

        prompt = f"""
You are a professional manga adaptation studio AI. Your only job right now is Step 1: Analysis & Planning. Never generate images or dialogue yet - only the structured plan.

USER CUSTOMIZATION INPUTS:

Story text: '''{story_text}'''
Desired total main characters: {desired_main_characters} (example: 5) -> If the story has more, you MUST suggest smart merges or which characters to keep/promote.
Number of chapters the manga should have: {num_chapters} (example: 8)
Target total pages for the whole manga: {target_total_pages} (example: 120 or auto)
Preferred manga genre & tone: {genre_tone}
Art style reference (optional): {art_style_reference}
Maximum panels per page allowed: {max_panels_per_page} (default 6-8; you can change to 4 for dramatic pacing)
Any special requests: {special_requests}

TASK - STEP 1 ONLY
Read the story and output EXACTLY in this order using clean markdown:

1. Character Breakdown

Total characters detected: __
Main characters (exactly the number the user requested): list them with 1-sentence role + personality + suggested visual design hook.
Supporting / minor characters (grouped or merged if needed to respect the user limit).
Any characters you recommend removing or combining and why.

2. Plot & Arc Analysis

Main plot in one sentence.
Number of major plot arcs.
Subplots (list each with importance level: High / Medium / Low).
Overall story structure (3-act or 4-act) and how it will be divided into the exact number of chapters the user wants.

3. Chapter Division
Create exactly {num_chapters} chapters.
For each chapter:

Chapter title (creative manga-style title)
Chapters covered pages estimate (so total matches user's target pages)
List of scenes inside this chapter (numbered)

4. Scene-by-Scene Breakdown (the most important part)
For every single scene across all chapters:

Scene number & chapter it belongs to
One-sentence summary
Key emotional/visual moment (what must be shown big)
Suggested number of pages this scene needs (1-4 pages)
Suggested number of panels on each of those pages (example: Page 1: 6 panels, Page 2: splash + 3 panels)
Panel layout notes (e.g. "double-page spread for the betrayal", "vertical 4-panel strip for tension", "cinematic wide panel for city reveal", etc.)
Whether this scene needs a splash page or double-page spread

5. Global Manga Layout Rules You Will Follow Later

Average panels per page for normal scenes
How many full splash pages you plan
Pacing rhythm (e.g. "Chapter 1: fast 5-7 panels/page, Chapter 4 climax: slower 3-4 panels/page")
Any recurring visual motifs or page tricks you will use

6. Final Statistics Summary (in a boxed table)

Total chapters: __
Total scenes: __
Total estimated pages: __
Main characters used: __
Average scenes per page across the whole manga: __
Number of splash/double pages: __

After you output everything above, end with this exact line:
"Step 1 complete. Reply with 'Proceed to Step 2 - Character Designs' if you want me to create full character sheets, or tell me any changes you want to the plan first."
        """
        return await self.generate_text(prompt, stream=stream)

    async def generate_plot_analysis_structured(
        self,
        project_id: str,
        story_text: str,
        num_chapters: int,
        desired_main_characters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        step_status: str,
        last_updated: str,
    ) -> dict:
        """Generate and parse Step 1 structured JSON directly from the Step 1 prompt."""
        raw_json = await self.generate_plot_analysis(
            story_text=story_text,
            num_chapters=num_chapters,
            desired_main_characters=desired_main_characters,
            target_total_pages=target_total_pages,
            genre_tone=genre_tone,
            art_style_reference=art_style_reference,
            max_panels_per_page=max_panels_per_page,
            special_requests=special_requests,
            output_format="json",
            project_id=project_id,
            step_status=step_status,
            last_updated=last_updated,
        )

        try:
            return _extract_json_payload(raw_json)
        except GeminiServiceError:
            return _build_step1_fallback_snapshot(
                project_id=project_id,
                story_text=story_text,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                max_panels_per_page=max_panels_per_page,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                num_chapters=num_chapters,
                analysis_markdown=raw_json,
            )

    async def generate_character_prompts(self, character_description: str) -> str:
        """
        Generate AI image prompts for a character.

        Args:
            character_description: Description of the character

        Returns:
            Image generation prompt
        """
        prompt = f"""
Create a detailed image generation prompt for this manga/anime character:

{character_description}

The prompt should include:
1. Character appearance details
2. Clothing and accessories
3. Pose suggestion
4. Art style specifications
5. Emotional expression
        """
        return await self.generate_text(prompt)

    async def generate_step2_character_design_markdown(
        self,
        step1_json: dict,
        desired_main_characters: int,
        genre_tone: str,
        art_style_reference: str,
        special_requests: str,
        stream: bool = False,
    ):
        """Generate Step 2 markdown design sheets using Step 1 structured JSON context."""
        step1_json_text = json.dumps(step1_json, ensure_ascii=True, indent=2)
        prompt = f"""
You are a professional manga adaptation studio AI. Your only job right now is Step 2: Character Designs. Never generate images yet - only text-based design sheets and descriptions that could be used for AI image prompts later.

REFERENCE FROM STEP 1 (structured JSON):
{step1_json_text}

USER CUSTOMIZATION INPUTS:
- Desired total main characters: {desired_main_characters}
- Preferred manga genre & tone: {genre_tone}
- Art style reference: {art_style_reference}
- Any special requests for designs: {special_requests}

TASK - STEP 2 ONLY
Based on the Step 1 plan, create detailed character design sheets for exactly the main characters specified, plus any supporting ones if they appear in multiple scenes.
Output EXACTLY in this order using clean markdown:

1. Global Design Guidelines
2. Main Character Design Sheets
3. Supporting Character Design Sheets
4. Interaction & Relationship Notes
5. Final Design Summary (in a boxed table)

For each main character include:
- Name & Role
- Personality & Backstory (2-3 sentences)
- Physical Appearance
- Outfit & Accessories
- Expressions & Poses
- Visual Design Hook
- AI Image Prompt Ready

After you output everything above, end with this exact line:
"Step 2 complete. Reply with 'Proceed to Step 3 - Panel-by-Panel Script & Image Prompts' if you want me to generate the full manga script with per-panel details, or tell me any changes you want to the designs first."
        """
        return await self.generate_text(prompt, stream=stream)

    async def generate_step2_structured_snapshot(
        self,
        project_id: str,
        step1_json: dict,
        desired_main_characters: int,
        genre_tone: str,
        art_style_reference: str,
        special_requests: str,
        step_status: str,
        last_updated: str,
        design_markdown: str,
    ) -> dict:
        """Generate strict Step 2 structured JSON using markdown + Step 1 JSON context."""
        step1_json_text = json.dumps(step1_json, ensure_ascii=True, indent=2)
        prompt = f"""
Convert the following Step 2 character design content into one strict JSON object.
Return JSON only (no markdown, no code fence, no comments).

Use this exact shape:
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "genre": "{genre_tone}",
    "tone": "{genre_tone}",
    "art_style_reference": "{art_style_reference}",
    "user_customizations": {{ "special_requests": "{special_requests}" }}
  }},
  "steps": {{
    "step_1_analysis": {{}},
    "step_2_design": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "main_characters_designs": {{
          "character_id": {{
            "name": "",
            "physical_appearance": "",
            "outfit_casual": "",
            "expressions": {{}},
            "ai_image_prompt_ready": ""
          }}
        }},
        "supporting_designs": {{}}
      }}
    }}
  }}
}}

Step 1 JSON reference:
{step1_json_text}

Step 2 markdown source:
{design_markdown}

Rules:
- Keep JSON valid.
- Keep step_1_analysis from input JSON if available.
- Ensure each main character includes ai_image_prompt_ready.
        """

        raw_json = await self.generate_text(prompt)
        try:
            parsed = _extract_json_payload(raw_json)
        except GeminiServiceError:
            return _build_step2_fallback_snapshot(
                project_id=project_id,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                step1_json=step1_json,
                design_markdown=design_markdown,
                desired_main_characters=desired_main_characters,
            )

        if isinstance(step1_json, dict):
            parsed_steps = parsed.setdefault("steps", {})
            if "step_1_analysis" not in parsed_steps and "steps" in step1_json:
                prior_step1 = step1_json.get("steps", {}).get("step_1_analysis")
                if prior_step1 is not None:
                    parsed_steps["step_1_analysis"] = prior_step1

        parsed_steps = parsed.setdefault("steps", {})
        step2_design = parsed_steps.setdefault("step_2_design", {})
        step2_data = step2_design.setdefault("data", {})
        main_designs = step2_data.get("main_characters_designs")
        if not isinstance(main_designs, dict) or len(main_designs) == 0:
            step2_data["main_characters_designs"] = _build_step2_main_designs(
                step1_json=step1_json,
                design_markdown=design_markdown,
                desired_main_characters=desired_main_characters,
                art_style_reference=art_style_reference,
            )
            step2_data["parser_note"] = (
                "Step 2 JSON normalized because main_characters_designs was missing or empty."
            )

        return parsed

    async def generate_step3_panel_script_markdown(
        self,
        step1_json: dict,
        step2_json: dict,
        num_chapters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        stream: bool = False,
    ):
        """Generate Step 3 markdown script using Step 1 and Step 2 structured context."""
        step1_json_text = json.dumps(step1_json, ensure_ascii=True, indent=2)
        step2_json_text = json.dumps(step2_json, ensure_ascii=True, indent=2)
        prompt = f"""
You are a professional manga adaptation studio AI. Your only job right now is Step 3: Panel-by-Panel Script & Image Prompts. Now you can generate detailed scripts and image prompts, but do not actually create images - only text prompts that could be fed into an AI image generator like Midjourney or Stable Diffusion.

REFERENCE FROM PREVIOUS STEPS:

[STEP 1 JSON]
{step1_json_text}

[STEP 2 JSON]
{step2_json_text}

USER CUSTOMIZATION INPUTS:
- Number of chapters: {num_chapters}
- Target total pages: {target_total_pages}
- Preferred manga genre & tone: {genre_tone}
- Art style reference: {art_style_reference}
- Maximum panels per page: {max_panels_per_page}
- Any special requests: {special_requests}

TASK - STEP 3 ONLY
Using the scene breakdowns from Step 1 and designs from Step 2, create a full manga script. Output EXACTLY in this order using clean markdown:

IMPORTANT CHARACTER CONSISTENCY RULE:
- Step 2 JSON may include user-approved character reference image URLs at:
  steps.step_2_design.data.main_characters_designs[*].selected_reference_image_url
  and/or steps.step_2_design.data.selected_character_references.
- When present, treat these as the canonical look for that character and mention consistent traits in each AI Image Prompt.
- Do not output the URLs in every panel line; use them internally as references for appearance consistency.

1. Global Scripting Rules

Dialogue style (e.g. "Casual teen speak for protagonists, formal for villains").
Sound effects & text integration (e.g. "Use bold for SFX, italics for thoughts").
Pacing adherence: Stick to Step 1's scenes-per-page and panels-per-page.
Image prompt style: Make them detailed, consistent (include art style, character designs, composition, mood, lighting, etc.).

2. Chapter-by-Chapter Script
For each chapter (exactly the number from Step 1):

Chapter Title & Page Range: [Title] - Pages [X-Y]
Then, for each page in the chapter:
Page Number: [e.g. Page 1 of Chapter 1]
Layout Summary: Number of panels, any spreads/splashes.
Panel-by-Panel Breakdown:
Panel 1: [Description]
Dialogue/SFX/Thoughts: [content]
AI Image Prompt: [full prompt]

Repeat for all panels on the page.

End each chapter with: "Chapter End Notes: [Any cliffhanger setup or visual recap]"

3. Special Pages Inventory

List all splash pages, double-spreads, or covers with their prompts.
Any recurring elements.

4. Final Script Summary (in a boxed table)

Total pages generated: __
Total panels: __
Total image prompts: __
Chapters completed: __ / {num_chapters}
Any deviations from Step 1 plan and why

After you output everything above, end with this exact line:
"Step 3 complete. This is the full manga script ready for image generation. Reply with 'Generate Images' if you want me to simulate or batch the image creation process, or tell me any revisions."
        """
        return await self.generate_text(prompt, stream=stream)

    async def generate_step3_structured_snapshot(
        self,
        project_id: str,
        step2_json: dict,
        num_chapters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        step_status: str,
        last_updated: str,
        script_markdown: str,
    ) -> dict:
        """Generate strict Step 3 structured JSON using markdown + Step 2 JSON context."""
        step2_json_text = json.dumps(step2_json, ensure_ascii=True, indent=2)
        prompt = f"""
Convert the following Step 3 panel script content into one strict JSON object.
Return JSON only (no markdown, no code fence, no comments).

Use this exact shape:
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "genre": "{genre_tone}",
    "tone": "{genre_tone}",
    "art_style_reference": "{art_style_reference}",
    "max_panels_per_page": {max_panels_per_page},
    "user_customizations": {{ "special_requests": "{special_requests}" }}
  }},
  "steps": {{
    "step_1_analysis": {{}},
    "step_2_design": {{}},
    "step_3_script": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "chapters": [
          {{
            "chapter_number": 1,
            "title": "",
            "page_range": "",
            "pages": [
              {{
                "page_number": 1,
                "layout_summary": "",
                "panels": [
                  {{
                    "panel_number": 1,
                    "description": "",
                    "dialogue_sfx_thoughts": "",
                    "ai_image_prompt": ""
                  }}
                ]
              }}
            ],
            "chapter_end_notes": ""
          }}
        ],
        "special_pages_inventory": [
          {{ "type": "splash", "label": "", "prompt": "" }}
        ],
        "final_summary": {{
          "total_pages_generated": 0,
          "total_panels": 0,
          "total_image_prompts": 0,
          "chapters_completed": 0,
          "chapters_target": {num_chapters},
          "deviations": ""
        }}
      }}
    }}
  }}
}}

Step 2 JSON reference:
{step2_json_text}

Step 3 markdown source:
{script_markdown}

Rules:
- Keep JSON valid.
- Preserve step_1_analysis and step_2_design from Step 2 JSON if available.
- Keep only necessary text for downstream context efficiency.
- chapters_completed should reflect generated chapter count.
- target pages input: {target_total_pages}
        """

        raw_json = await self.generate_text(prompt)
        try:
            parsed = _extract_json_payload(raw_json)
        except GeminiServiceError:
            return _build_step3_fallback_snapshot(
                project_id=project_id,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                max_panels_per_page=max_panels_per_page,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                step2_json=step2_json,
                script_markdown=script_markdown,
            )

        if isinstance(step2_json, dict):
            parsed_steps = parsed.setdefault("steps", {})
            prior_steps = step2_json.get("steps", {})
            if "step_1_analysis" not in parsed_steps and isinstance(prior_steps, dict):
                prior_step1 = prior_steps.get("step_1_analysis")
                if prior_step1 is not None:
                    parsed_steps["step_1_analysis"] = prior_step1
            if "step_2_design" not in parsed_steps and isinstance(prior_steps, dict):
                prior_step2 = prior_steps.get("step_2_design")
                if prior_step2 is not None:
                    parsed_steps["step_2_design"] = prior_step2

        return parsed

    async def generate_panel_script(self, scene_description: str) -> str:
        """
        Generate detailed panel scripts for a scene.

        Args:
            scene_description: Description of the scene

        Returns:
            Detailed panel breakdown
        """
        prompt = f"""
Create a detailed manga panel script for this scene:

{scene_description}

Include:
1. Panel layout (number and arrangement)
2. Each panel's visual description
3. Dialogue and thoughts
4. Action sequences
5. Visual effects and emphasis
        """
        return await self.generate_text(prompt)

    async def generate_step1_structured_snapshot(
        self,
        project_id: str,
        story_text: str,
        num_chapters: int,
        desired_main_characters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        analysis_markdown: str,
        step_status: str,
        last_updated: str,
    ) -> dict:
        """Generate a strict JSON snapshot for Step 1 using the markdown analysis context."""
        prompt = f"""
Convert the following Step 1 manga analysis into one strict JSON object.
Return JSON only (no markdown, no code fence, no comments).

Use this exact top-level schema:
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "story_content": "...",
    "genre": "...",
    "tone": "...",
    "art_style_reference": "...",
    "max_panels_per_page": 0,
    "user_customizations": {{
      "special_requests": "..."
    }}
  }},
  "steps": {{
    "step_1_analysis": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "analysis": {{
          "total_characters_detected": 0,
          "main_characters": [],
          "supporting_characters": [],
          "plot": "",
          "arcs": [],
          "structure": ""
        }},
        "chapters_structure": [],
        "final_statistics": {{
          "total_chapters": 0,
          "total_pages": 0,
          "total_scenes": 0
        }}
      }}
    }}
  }}
}}

Known user inputs:
- story_content: {story_text}
- genre: {genre_tone}
- tone: {genre_tone}
- art_style_reference: {art_style_reference}
- max_panels_per_page: {max_panels_per_page}
- special_requests: {special_requests}
- desired_main_characters: {desired_main_characters}
- num_chapters: {num_chapters}
- target_total_pages: {target_total_pages}

Source Step 1 markdown:
{analysis_markdown}

Rules:
- Keep JSON valid.
- Use numeric values for totals where possible.
- chapters_structure must be an array of chapter objects.
- main_characters and supporting_characters must be arrays of objects.
- If a value is unavailable, infer conservatively but keep schema complete.
        """

        raw_json = await self.generate_text(prompt)
        try:
            return _extract_json_payload(raw_json)
        except GeminiServiceError:
            return _build_step1_fallback_snapshot(
                project_id=project_id,
                story_text=story_text,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                max_panels_per_page=max_panels_per_page,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                num_chapters=num_chapters,
                analysis_markdown=analysis_markdown,
            )

