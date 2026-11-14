"""Optional AI answers for "Ask the archive", built on the team's RAG module (RAG/, by Omar).

Retrieval: the Chroma vector database in RAG/database (4,086 chunks of NASA PSI reports and NASA web pages, embedded
with Gemini). Generation: Gemini, with the rules in RAG/src/prompts.py (answer only from the retrieved documents,
cite them, say "insufficient data" otherwise, never extrapolate to partial gravity).

Needs a Google API key (Streamlit secret or environment variable GOOGLE_API_KEY). Without one, or without the
packages, the dashboard keeps its offline cited search and says why the AI answer is unavailable.
"""
from __future__ import annotations

import importlib.util
import os
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAG_DIR = ROOT / "RAG"
DB_DIR = RAG_DIR / "database"
COLLECTION = "NasaSpaceApps"
EMBED_MODEL = "gemini-embedding-2"      # must match the model the database was built with (RAG/src/gemini.py)
CHAT_MODEL = "gemini-3.1-flash-lite"    # as in RAG/src/gemini.py
K = 10                                  # passages retrieved, as in RAG/src/data.py


def _from_env_file() -> str | None:
    """Read GOOGLE_API_KEY from a .env file in the repository root or RAG/ (never committed: see .gitignore)."""
    for p in (ROOT / ".env", RAG_DIR / ".env", RAG_DIR / "src" / ".env"):
        if p.exists():
            for line in p.read_text(errors="ignore").splitlines():
                k, _, v = line.partition("=")
                if k.strip() == "GOOGLE_API_KEY" and v.strip():
                    return v.strip().strip('"').strip("'")
    return None


def api_key() -> str | None:
    key = os.environ.get("GOOGLE_API_KEY") or _from_env_file()
    if key:
        return key
    try:
        import streamlit as st
        return st.secrets.get("GOOGLE_API_KEY")  # type: ignore[no-any-return]
    except Exception:
        return None


def status() -> tuple[bool, str]:
    """(available, reason shown to the user when it is not)."""
    if not (DB_DIR / "chroma.sqlite3").exists():
        return False, "the RAG database (RAG/database) is not in this deployment"
    for mod in ("chromadb", "langchain_google_genai"):
        if importlib.util.find_spec(mod) is None:
            return False, f"the package '{mod}' is not installed"
    if not api_key():
        return False, "no Google API key is set (set the GOOGLE_API_KEY environment variable, or the Streamlit secret on the dashboard)"
    return True, ""


def _prompt_module():
    spec = importlib.util.spec_from_file_location("rag_prompts", RAG_DIR / "src" / "prompts.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


class GeminiRAG:
    """Opens a private copy of the vector database (Chroma writes to the files it opens) and answers questions."""

    def __init__(self) -> None:
        import chromadb
        from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
        key = api_key()
        self._tmp = Path(tempfile.mkdtemp(prefix="fif_rag_"))
        shutil.copytree(DB_DIR, self._tmp / "db")
        self.col = chromadb.PersistentClient(path=str(self._tmp / "db")).get_collection(COLLECTION)
        self.emb = GoogleGenerativeAIEmbeddings(model=EMBED_MODEL, google_api_key=key)
        self.llm = ChatGoogleGenerativeAI(model=CHAT_MODEL, google_api_key=key, temperature=0)
        self.prompts = _prompt_module()

    def retrieve(self, q: str, k: int = K) -> list[dict]:
        v = self.emb.embed_query(q)
        r = self.col.query(query_embeddings=[v], n_results=k)
        out = []
        for doc, meta, dist in zip(r["documents"][0], r["metadatas"][0], r["distances"][0]):
            heads = [str(meta[h]).replace("**", "").strip() for h in ("Header 1", "Header 2", "Header 3") if meta.get(h)]
            out.append(dict(text=doc, section=" › ".join(heads) or "untitled section", distance=float(dist)))
        return out

    def answer(self, q: str) -> dict:
        docs = self.retrieve(q)
        block = "\n\n".join(f"[Document {i + 1}: {d['section']}]\n{d['text']}" for i, d in enumerate(docs))
        prompt = self.prompts.response_generation_prompt(q, block)
        msg = self.llm.invoke(prompt)
        text = msg.content if isinstance(msg.content, str) else " ".join(
            c.get("text", "") if isinstance(c, dict) else str(c) for c in msg.content)
        return dict(answer=text.strip(), documents=docs, model=CHAT_MODEL)
