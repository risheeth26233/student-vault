"""Bounded local PDF text extraction for the Student-Vault study assistant."""

import json
import sys
from io import BytesIO

MAX_PAGES = 40
MAX_PAGE_CHARS = 8_000
MAX_TOTAL_CHARS = 24_000


def main() -> int:
    raw = sys.stdin.buffer.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024:
        print(json.dumps({"error": "file_too_large"}))
        return 0
    if not raw.startswith(b"%PDF-"):
        print(json.dumps({"error": "invalid_pdf"}))
        return 0

    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(raw), strict=True)
        if reader.is_encrypted:
            print(json.dumps({"error": "encrypted_pdf"}))
            return 0
        page_count = len(reader.pages)
        if page_count < 1:
            print(json.dumps({"error": "empty_pdf"}))
            return 0
        if page_count > MAX_PAGES:
            print(json.dumps({"error": "too_many_pages"}))
            return 0

        pages = []
        remaining = MAX_TOTAL_CHARS
        for index, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            text = text[: min(MAX_PAGE_CHARS, remaining)]
            remaining -= len(text)
            pages.append({"page": index, "text": text})
            if remaining <= 0:
                break

        if not any(page["text"] for page in pages):
            print(json.dumps({"error": "no_extractable_text"}))
            return 0
        print(json.dumps({"pages": pages, "truncated": remaining <= 0}))
        return 0
    except ImportError:
        print(json.dumps({"error": "extractor_unavailable"}))
        return 0
    except Exception:
        # Parsing diagnostics may contain document data; return only a stable code.
        print(json.dumps({"error": "malformed_pdf"}))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
