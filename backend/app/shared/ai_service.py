"""
AI Service — Core Platform module.

Every business module that wants AI (SOP generation, cover letters,
document analysis, missing-document detection, client summaries, visa
pathway suggestions, internal knowledge search) calls `ai_service.chat()`
or `ai_service.chat_json()` below — never OpenRouter's SDK/HTTP directly.

Swapping models or providers later means editing OPENROUTER_DEFAULT_MODEL
in config, or replacing this one file — zero changes anywhere else.
"""
import json
from typing import Any, Optional

import httpx

from app.core.config import get_settings

settings = get_settings()


class AIServiceError(Exception):
    pass


async def chat(
    messages: list[dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 1000,
) -> str:
    """Generic chat completion. `messages` follows the standard
    [{"role": "system"|"user"|"assistant", "content": "..."}] shape."""
    if not settings.OPENROUTER_API_KEY:
        raise AIServiceError("OPENROUTER_API_KEY is not configured")

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
            json={
                "model": model or settings.OPENROUTER_DEFAULT_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
    if response.status_code != 200:
        raise AIServiceError(f"OpenRouter error {response.status_code}: {response.text}")

    data = response.json()
    return data["choices"][0]["message"]["content"]


async def chat_json(
    messages: list[dict[str, str]],
    model: Optional[str] = None,
) -> dict[str, Any]:
    """Same as chat(), but instructs the model to return parseable JSON —
    used by structured features like missing-document detection."""
    system_note = {
        "role": "system",
        "content": "Respond ONLY with valid JSON. No prose, no markdown fences.",
    }
    raw = await chat([system_note, *messages], model=model, temperature=0.0)
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AIServiceError(f"AI did not return valid JSON: {exc}") from exc
