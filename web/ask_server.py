"""Optional AI answers for the website's "Ask the archive" chat.

The website works without this: the chat then shows the cited NASA passages it finds (retrieval only).
Run this small server next to the site to add the team's Gemini RAG answer on top:

    pip install -r RAG/requirements.txt fastapi uvicorn
    export GOOGLE_API_KEY=...            # or put it in .env, as for the dashboard
    uvicorn web.ask_server:app --port 8787
    # then build the site with:  VITE_ASK_URL=http://localhost:8787/ask npm run build

It reuses src/fif/genai.py (the same Gemini RAG module the Streamlit dashboard uses).
"""
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fif import genai  # noqa: E402

app = FastAPI(title="Flame in Freefall · Ask the archive")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["POST", "GET"], allow_headers=["*"])
_rag = None


class Q(BaseModel):
    question: str


@app.get("/health")
def health():
    ok, why = genai.status()
    return {"available": ok, "reason": why}


@app.post("/ask")
def ask(q: Q):
    global _rag
    ok, why = genai.status()
    if not ok:
        return {"answer": None, "reason": why}
    if _rag is None:
        _rag = genai.GeminiRAG()
    r = _rag.answer(q.question[:1000])
    return {"answer": r["answer"], "sources": [d["section"] for d in r["documents"]], "model": r["model"]}
