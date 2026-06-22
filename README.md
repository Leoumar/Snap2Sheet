# Snap2Sheet

Upload a form image → AI extracts every field → download Excel.
Powered by **LLMWhisperer** — the best OCR API for forms and handwriting.

---

## Setup (Windows) — 3 steps

### Step 1 — Get LLMWhisperer API Key (Free)
1. Go to https://unstract.com/llmwhisperer/
2. Click **"Get API Key"**
3. Sign up — free tier gives **100 pages/month**
4. Copy your API key

### Step 2 — Add API Key
1. Copy `backend\.env.example` → rename to `backend\.env`
2. Open `backend\.env` in Notepad
3. Replace `your_api_key_here` with your actual key:
```
LLMWHISPERER_API_KEY=llmw-xxxxxxxxxxxxxxxx
```

### Step 3 — Run
Double-click **START.bat**

Browser opens automatically at http://localhost:3000

---

## Install dependencies (VS Code terminal)
```
pip install fastapi "uvicorn[standard]" python-multipart pydantic python-dotenv llmwhisperer-client openpyxl
```

## Run manually (VS Code)
```
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
python -m http.server 3000
```

---

## Why LLMWhisperer?

| Feature | Tesseract | LLMWhisperer |
|---------|-----------|--------------|
| Handwriting | ❌ Poor | ✅ Excellent |
| Mixed forms | ⚠️ Partial | ✅ Full |
| Form mode | ❌ No | ✅ Yes |
| Setup | Complex | API key only |
| Speed | ~3s | ~2-5s |

## Extraction Modes
| Mode | LLMWhisperer | Best for |
|------|-------------|----------|
| Auto | `form` | Printed + mixed forms |
| Handwritten | `high_quality` | Cursive, messy writing |
| Printed | `form` | Clean printed forms |
