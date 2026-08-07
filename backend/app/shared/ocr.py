"""
OCR — single seam over Tesseract.

Only this file imports pytesseract/PIL directly. Image documents (JPEG,
PNG, TIFF, WEBP) are supported directly. PDF OCR needs page rasterization
(poppler/pdf2image), which isn't installed in the base Dockerfile yet —
`extract_text` raises a clear OCRUnsupportedError for PDFs rather than
failing silently, so the caller can surface a helpful message instead of
an empty result that looks like "no text found."
"""
import io

import pytesseract
from PIL import Image

from app.core.config import get_settings

settings = get_settings()
pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/tiff", "image/webp", "image/bmp"}


class OCRUnsupportedError(Exception):
    pass


def extract_text(file_bytes: bytes, content_type: str) -> str:
    if content_type not in IMAGE_CONTENT_TYPES:
        raise OCRUnsupportedError(
            f"OCR for '{content_type}' is not supported yet. Image formats "
            "(JPEG, PNG, TIFF, WEBP) are supported; PDF OCR needs poppler/"
            "pdf2image, which is a future infra addition."
        )
    image = Image.open(io.BytesIO(file_bytes))
    return pytesseract.image_to_string(image).strip()
