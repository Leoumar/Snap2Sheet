"""
ocr_engine.py — Snap2Sheet
Uses LLMWhisperer API for superior form extraction.
"""

import os
import re
import logging
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ── Load .env ─────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    _env = Path(__file__).parent / ".env"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    pass

LLMWHISPERER_API_KEY  = os.environ.get("LLMWHISPERER_API_KEY", "")
LLMWHISPERER_BASE_URL = os.environ.get(
    "LLMWHISPERER_BASE_URL",
    "https://llmwhisperer-api.us-central.unstract.com/api/v2"
)


# ── Public API ────────────────────────────────────────────────────────────────

def extract_fields(image_path: str, mode: str = "auto") -> Dict[str, Any]:
    if not Path(image_path).exists():
        raise FileNotFoundError(image_path)

    if not LLMWHISPERER_API_KEY:
        raise ValueError(
            "LLMWHISPERER_API_KEY not set. "
            "Create backend/.env with: LLMWHISPERER_API_KEY=your_key"
        )

    whisper_mode = "high_quality" if mode == "handwritten" else "form"
    logger.info(f"LLMWhisperer mode: {whisper_mode}")

    raw_text = _call_llmwhisperer(image_path, whisper_mode)
    logger.info(f"LLMWhisperer output ({len(raw_text)} chars):\n{raw_text}")

    fields = _smart_parse(raw_text)
    if not fields:
        fields = _line_fields(raw_text)

    ftype = "handwritten" if mode == "handwritten" else "printed"
    for f in fields:
        if "type" not in f:
            f["type"] = ftype

    return {
        "fields": fields,
        "stats": {
            "handwritten": sum(1 for f in fields if f.get("type") == "handwritten"),
            "printed":     sum(1 for f in fields if f.get("type") == "printed"),
            "engine":      f"LLMWhisperer ({whisper_mode})",
        }
    }


# ── LLMWhisperer API call ─────────────────────────────────────────────────────

def _call_llmwhisperer(image_path: str, whisper_mode: str) -> str:
    # Correct import: unstract.llmwhisperer (not llmwhisperer)
    from unstract.llmwhisperer import LLMWhispererClientV2
    from unstract.llmwhisperer.client_v2 import LLMWhispererClientException

    client = LLMWhispererClientV2(
        base_url=LLMWHISPERER_BASE_URL,
        api_key=LLMWHISPERER_API_KEY,
    )

    try:
        logger.info(f"Sending to LLMWhisperer: {Path(image_path).name}")
        result = client.whisper(
            file_path=image_path,
            mode=whisper_mode,
            output_mode="layout_preserving",
            wait_for_completion=True,   # handles async automatically
            wait_timeout=120,
        )
        extracted = result.get("extraction", {}).get("result_text", "") \
                    or result.get("extracted_text", "") \
                    or ""
        return extracted

    except LLMWhispererClientException as e:
        logger.exception(f"LLMWhisperer API error: {e}")
        raise RuntimeError(f"LLMWhisperer error: {e}")


# ── Field parsers ─────────────────────────────────────────────────────────────

def _smart_parse(text: str) -> List[Dict]:
    """
    Parse 'Label: value' with multi-line value support.
    Continuation lines (no colon prefix) are joined to the previous field.
    """
    LABEL = re.compile(r'^([A-Za-z][A-Za-z0-9 _\-/\.]{0,35}?)\s*:\s*(.*)$')
    fields, seen, lines = [], set(), [l.rstrip() for l in text.splitlines()]

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        m = LABEL.match(line)
        if m:
            key = _norm_key(m.group(1))
            val = m.group(2).strip()

            j = i + 1
            while j < len(lines):
                nxt = lines[j].strip()
                if not nxt:
                    j += 1
                    continue
                if LABEL.match(nxt):
                    break
                if nxt.isupper() and len(nxt.split()) <= 5 and not any(c.isdigit() for c in nxt):
                    break
                val = (val + " " + nxt).strip()
                j += 1

            i = j
            if key and key.lower() not in seen:
                seen.add(key.lower())
                fields.append({"key": key, "value": val, "type": "printed"})
        else:
            i += 1

    return fields


def _line_fields(text: str) -> List[Dict]:
    return [
        {"key": f"Line {i+1}", "value": l.strip(), "type": "printed"}
        for i, l in enumerate(text.splitlines())
        if l.strip() and len(l.strip()) > 1
    ]


def _norm_key(raw: str) -> str:
    k = raw.strip(" .-_()[]{}*#|\\/@!?:")
    k = re.sub(r"\s+", " ", k).strip()
    return k.title()[:60] if k else ""