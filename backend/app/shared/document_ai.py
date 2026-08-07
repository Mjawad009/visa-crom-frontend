"""
Document AI analysis. Built entirely on app/shared/ai_service.py (Phase
2) — this file adds no new AI provider logic, just a document-specific
prompt and expected JSON shape. Swapping the underlying model or
provider never touches this file.
"""
from typing import Any, Optional

from app.shared.ai_service import AIServiceError, chat_json

ANALYSIS_PROMPT = """You are reviewing a document uploaded to a visa \
consultancy CRM. The document's category is: {category}

Extracted text (via OCR, may contain errors):
---
{text}
---

Return a JSON object with exactly these fields:
- "detected_document_type": your best guess at what this document actually is
- "category_match": true if it plausibly matches the stated category "{category}", false otherwise
- "key_fields": an object of any names, numbers, or dates you can confidently extract (e.g. passport_number, expiry_date, full_name) — omit fields you can't find
- "issues": an array of short strings flagging anything concerning (blurry/unreadable, expired, mismatched name, missing signature, etc.) — empty array if none
- "confidence": "high" | "medium" | "low", your confidence in this analysis given the OCR quality
"""


async def analyze_document_text(text: str, category: Optional[str]) -> dict[str, Any]:
    if not text.strip():
        return {
            "detected_document_type": None,
            "category_match": None,
            "key_fields": {},
            "issues": ["No text could be extracted from this document."],
            "confidence": "low",
        }

    prompt = ANALYSIS_PROMPT.format(category=category or "unspecified", text=text[:6000])
    try:
        return await chat_json([{"role": "user", "content": prompt}])
    except AIServiceError as exc:
        return {
            "detected_document_type": None,
            "category_match": None,
            "key_fields": {},
            "issues": [f"AI analysis failed: {exc}"],
            "confidence": "low",
        }
