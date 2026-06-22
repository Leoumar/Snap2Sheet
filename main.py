"""
Snap2Sheet — main.py
FastAPI backend using LLMWhisperer for form extraction.
Run: uvicorn main:app --reload --port 8000
"""

import os, uuid, logging
from pathlib import Path
from typing import List

# Load .env first
try:
    from dotenv import load_dotenv
    _env = Path(__file__).parent / ".env"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    pass

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ocr_engine import extract_fields
from excel_export import build_excel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE    = Path(__file__).parent
UPLOADS = BASE / "uploads";  UPLOADS.mkdir(exist_ok=True)
OUTPUTS = BASE / "outputs";  OUTPUTS.mkdir(exist_ok=True)

app = FastAPI(title="Snap2Sheet", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

class Field(BaseModel):
    key:   str
    value: str
    type:  str = "printed"

class ExportRequest(BaseModel):
    fields: List[Field]


@app.get("/")
def root():
    api_key_set = bool(os.environ.get("LLMWHISPERER_API_KEY", ""))
    return {
        "status": "ok",
        "service": "Snap2Sheet v3",
        "llmwhisperer": "configured" if api_key_set else "⚠️ API key missing — add to backend/.env"
    }


@app.get("/health")
def health():
    key = os.environ.get("LLMWHISPERER_API_KEY", "")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="LLMWHISPERER_API_KEY not set. Get a free key at https://unstract.com/llmwhisperer/ and add it to backend/.env"
        )
    return {"status": "ok", "api_key": f"{key[:6]}…"}


@app.post("/extract")
async def extract(file: UploadFile = File(...), mode: str = Form("auto")):
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(400, f"Unsupported type: {file.content_type}. Use JPG/PNG/WEBP.")

    # Check API key early
    if not os.environ.get("LLMWHISPERER_API_KEY", ""):
        raise HTTPException(
            503,
            "LLMWHISPERER_API_KEY not configured. "
            "Get a free key at https://unstract.com/llmwhisperer/ "
            "and add it to backend/.env as: LLMWHISPERER_API_KEY=your_key"
        )

    ext  = Path(file.filename or "upload").suffix or ".jpg"
    path = UPLOADS / f"{uuid.uuid4().hex}{ext}"
    path.write_bytes(await file.read())
    logger.info(f"Upload: {path.name} ({path.stat().st_size//1024}KB) mode={mode}")

    try:
        result = extract_fields(str(path), mode)
    except Exception as e:
        logger.exception("Extraction failed")
        raise HTTPException(500, str(e))
    finally:
        try: path.unlink()
        except: pass

    return result


@app.post("/export")
def export(req: ExportRequest):
    if not req.fields:
        raise HTTPException(400, "No fields provided")
    out = OUTPUTS / f"snap2sheet_{uuid.uuid4().hex[:8]}.xlsx"
    try:
        build_excel([f.dict() for f in req.fields], str(out))
    except Exception as e:
        logger.exception("Excel export failed")
        raise HTTPException(500, str(e))
    return FileResponse(
        str(out),
        filename="snap2sheet_export.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
