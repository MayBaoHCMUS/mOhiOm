"""Per-provider adapter functions for BYOK image generation.

Unlike text-gen (where all providers speak OpenAI-compatible chat/completions
and can share one GeminiService client), Gemini and OpenAI image APIs use
different wire formats, so each provider gets its own adapter function here.
"""

import base64
from typing import Optional, Tuple

import httpx

from app.services import (
    genai,
    genai_errors,
    google_exceptions,
    genai_import_error,
    GeminiServiceError,
    _extract_retry_after_seconds,
)


def _openai_size(width: Optional[int], height: Optional[int]) -> str:
    if not width or not height:
        return "1024x1024"
    ratio = width / height
    if ratio > 1.2:
        return "1536x1024"
    if ratio < 0.8:
        return "1024x1536"
    return "1024x1024"


async def generate_image_gemini(prompt: str, api_key: str, model: str) -> Tuple[bytes, str]:
    if genai is None:
        raise GeminiServiceError(
            "google-genai is not installed on the server.", status_code=500
        ) from genai_import_error
    if not api_key:
        raise GeminiServiceError("Missing Gemini API key.", status_code=400)

    client = genai.Client(api_key=api_key)
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
        )
    except google_exceptions.ResourceExhausted as exc:
        raise GeminiServiceError(
            "Gemini quota exceeded. Please retry later or check your billing/limits.",
            status_code=429,
            retry_after_seconds=_extract_retry_after_seconds(str(exc)),
        ) from exc
    except genai_errors.ClientError as exc:
        status_code = int(getattr(exc, "code", 500) or 500)
        raise GeminiServiceError(
            f"Gemini image request failed: {exc}",
            status_code=status_code,
            retry_after_seconds=_extract_retry_after_seconds(str(exc)) if status_code == 429 else None,
        ) from exc
    except Exception as exc:
        raise GeminiServiceError(f"Gemini image generation failed: {exc}") from exc

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        parts = getattr(candidate.content, "parts", None) or []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                return inline.data, inline.mime_type or "image/png"

    raise GeminiServiceError(
        "Gemini did not return an image (it may have refused the prompt).",
        status_code=400,
    )


async def generate_image_openai(
    prompt: str, api_key: str, model: str, width: Optional[int], height: Optional[int]
) -> Tuple[bytes, str]:
    if not api_key:
        raise GeminiServiceError("Missing OpenAI API key.", status_code=400)

    payload = {"model": model, "prompt": prompt, "size": _openai_size(width, height), "n": 1}
    if model != "gpt-image-1":
        # gpt-image-1 always returns b64_json; other models default to a URL response.
        payload["response_format"] = "b64_json"

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
    except Exception as exc:
        raise GeminiServiceError(f"OpenAI image request failed: {exc}") from exc

    if resp.status_code == 429:
        retry_after = resp.headers.get("retry-after")
        raise GeminiServiceError(
            "OpenAI quota/rate limit exceeded.",
            status_code=429,
            retry_after_seconds=float(retry_after) if retry_after else None,
        )
    if resp.status_code >= 400:
        snippet = resp.text.strip()[:500]
        status_code = resp.status_code if resp.status_code in (400, 401, 403) else 502
        raise GeminiServiceError(
            f"OpenAI image request failed ({resp.status_code}): {snippet}", status_code=status_code
        )

    data = resp.json()
    try:
        b64 = data["data"][0]["b64_json"]
    except (KeyError, IndexError) as exc:
        raise GeminiServiceError("OpenAI response did not contain an image.", status_code=502) from exc
    return base64.b64decode(b64), "image/png"


async def generate_byok_image(
    provider: str,
    prompt: str,
    api_key: str,
    model: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
) -> Tuple[bytes, str]:
    if provider == "gemini":
        return await generate_image_gemini(prompt, api_key, model)
    if provider == "openai":
        return await generate_image_openai(prompt, api_key, model, width, height)
    raise GeminiServiceError(f"Unsupported image provider: {provider}", status_code=400)
