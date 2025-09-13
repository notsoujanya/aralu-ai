
# app.py
# Run: uvicorn app:app --host 0.0.0.0 --port 8000 --reload

from flask import Flask, request, jsonify
from flask_cors import CORS  

app = Flask(__name__)
CORS(app)

import os
import time
import json
from datetime import datetime
from typing import List, Optional

import requests
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------- Embeddings & Vector Store ----------
from langchain_huggingface import HuggingFaceEmbeddings   # future-proof import
from langchain_community.vectorstores import FAISS

# ---------- Local Llama via Transformers ----------
from transformers import AutoTokenizer, AutoModelForCausalLM

# ===============================
# CONFIG — EDIT ME
# ===============================
FAISS_INDEX_DIR = r"C:\SPD_data\embeddings"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

LLAMA_MODEL_ID = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

# Free live sources
WHO_ENDPOINT = "https://ghoapi.azureedge.net/api/WHOSIS_000001"
NIH_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
NIH_ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

# Cache & rate limiting
API_RATE_LIMIT_SECONDS = 1.0
CACHE_FILE = "api_cache.json"

# Guardrails
ALLOWED_TOPICS = [
    "menstrual", "period", "menstruation", "premenstrual", "pmdd",
    "puberty", "adolescent", "reproductive", "uterus", "hygiene",
    "sanitation", "cramps", "dysmenorrhea", "endometriosis", "pcos",
]

# Output style
MAX_SENTENCES = 4
# ===============================

# ---------- Cache / Rate Limit ----------
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        API_CACHE = json.load(f)
else:
    API_CACHE = {}

_last_api_call_ts = 0.0
def rate_limit_block():
    global _last_api_call_ts
    now = time.time()
    wait = API_RATE_LIMIT_SECONDS - (now - _last_api_call_ts)
    if wait > 0:
        time.sleep(wait)
    _last_api_call_ts = time.time()

def cache_get(key: str) -> Optional[str]:
    return API_CACHE.get(key)

def cache_set(key: str, value: str) -> None:
    API_CACHE[key] = value
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(API_CACHE, f, indent=2)


# ---------- Live Data Fetchers ----------
def fetch_who_summary() -> str:
    key = f"WHO_{datetime.utcnow().strftime('%Y-%m-%d')}"
    cached = cache_get(key)
    if cached:
        return cached
    rate_limit_block()
    r = requests.get(WHO_ENDPOINT, timeout=20)
    if r.status_code != 200:
        return "WHO data temporarily unavailable."
    try:
        data = r.json()
        values = data.get("value", [])
        snippet = f"WHO dataset rows available today: {len(values)}."
    except Exception:
        snippet = "WHO response parsing failed."
    cache_set(key, snippet)
    return snippet

def fetch_pubmed_titles(term: str = "menstrual health", retmax: int = 5) -> str:
    key = f"PUBMED_{term}_{datetime.utcnow().strftime('%Y-%m-%d')}"
    cached = cache_get(key)
    if cached:
        return cached

    rate_limit_block()
    es = requests.get(
        NIH_ESEARCH,
        params={"db": "pubmed", "term": term, "retmode": "json", "retmax": str(retmax), "sort": "most+recent"},
        timeout=20,
    )
    if es.status_code != 200:
        return "PubMed search unavailable."
    ids = es.json().get("esearchresult", {}).get("idlist", [])
    if not ids:
        cache_set(key, "No recent PubMed items found.")
        return "No recent PubMed items found."

    rate_limit_block()
    sm = requests.get(NIH_ESUMMARY, params={"db": "pubmed", "id": ",".join(ids), "retmode": "json"}, timeout=20)
    if sm.status_code != 200:
        return "PubMed summary unavailable."
    try:
        res = sm.json()
        result_map = res.get("result", {})
        titles = []
        for pid in ids:
            info = result_map.get(pid, {})
            t = info.get("title")
            if t:
                titles.append(t.strip())
        snippet = "Recent PubMed titles: " + " | ".join(titles[:retmax]) if titles else "No titles available."
    except Exception:
        snippet = "PubMed parsing failed."
    cache_set(key, snippet)
    return snippet


# ---------- Domain / Intent ----------
def in_domain(q: str) -> bool:
    ql = q.lower()
    return any(t in ql for t in ALLOWED_TOPICS)

def wants_live(q: str) -> bool:
    ql = q.lower()
    return any(w in ql for w in ["current", "latest", "today", "recent", "update", "stats", "statistics", "new"])


# ---------- Load FAISS & Embeddings ----------
embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
vector_store = FAISS.load_local(FAISS_INDEX_DIR, embeddings, allow_dangerous_deserialization=True)

def retrieve_context(query: str, k: int = 3) -> str:  # reduced k for concise answers
    docs = vector_store.similarity_search(query, k=k)
    chunks = [d.page_content.strip() for d in docs if d.page_content]
    return ("\n\n".join(chunks))[:3000]  # limit context for small local model


# ---------- Load Local Llama ----------
tokenizer = AutoTokenizer.from_pretrained(LLAMA_MODEL_ID, use_fast=True)
model = AutoModelForCausalLM.from_pretrained(
    LLAMA_MODEL_ID,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto"
)

def generate_llama(system_msg: str, user_msg: str, max_new_tokens: int = 512) -> str:
    prompt = f"<<SYS>>{system_msg}<</SYS>>\n[USER]: {user_msg}\n[ASSISTANT]:"
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=0.5,
            top_p=0.9,
            eos_token_id=tokenizer.eos_token_id,
        )
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    if "[ASSISTANT]:" in text:
        text = text.split("[ASSISTANT]:", 1)[-1].strip()
    # ensure text ends with punctuation
    if not text.endswith(('.', '!', '?')):
        text += "..."
    return text.strip()

def summarize_context(context: str) -> str:
    """
    Convert long context into short bullet points for internal use.
    """
    # This is a simple placeholder; you can improve with NLP
    lines = context.split(". ")
    bullets = [f"- {line.strip()}" for line in lines[:5] if line.strip()]
    return "\n".join(bullets)



def build_user_prompt(query: str, context: str, live_blocks: List[str]) -> str:
    live = ("\n\nLIVE DATA:\n" + "\n".join(live_blocks)) if live_blocks else ""
    instructions = (
    f"Answer in a warm, supportive tone using simple, clear language. "
    f"Keep answers practical and easy to follow, with a maximum of {MAX_SENTENCES} sentences. "
    "Use any context or live data to answer, but **do not quote or repeat it verbatim**.\n"

    "Always clarify that this is general menstrual health information, not personal medical advice. "
    "Encourage healthy self-care habits and provide actionable steps when possible. "
    "If the query is outside menstrual health, politely explain it’s out of scope. "
    "If the query suggests self-harm, respond with compassion, encourage seeking immediate support, "
    "and provide a crisis helpline suggestion (without fabricating numbers). "
)

    return (
        f"{instructions}\n\n"
        f"CONTEXT:\n{context}\n"
        f"{live}\n\n"
        f"QUESTION:\n{query}\n"
        f"FINAL ANSWER:"
    )

# ---------- Updated user prompt builder ----------
def build_user_prompt(query: str, context: str, live_blocks: List[str], concise: bool = True) -> str:
    """
    Build a user prompt for the Llama model.
    concise=True -> short, bullet-point responses
    concise=False -> more detailed responses
    """
    live = ("\n\nLIVE DATA:\n" + "\n".join(live_blocks)) if live_blocks else ""
    
    instructions = (
    "You are a friendly assistant specializing in menstrual health and puberty.\n"
    "Respond directly to the user in first-person.\n"
    "Use any context or live data to answer, but **do not quote or repeat it verbatim**.\n"
    "Keep answers concise (max 4 sentences, use bullet points if needed).\n"
    "Only answer questions about menstrual health, puberty, or adolescent health.\n"
    "If out-of-domain, politely decline.\n"
)

    return (
        f"{instructions}\n\n"
        f"CONTEXT:\n{context}\n"
        f"{live}\n\n"
        f"QUESTION:\n{query}\n"
        f"ANSWER:"
    )

    


# ---------- Helper to remove repeated sentences ----------
def remove_repetition(text: str) -> str:
    seen = set()
    lines = text.split(". ")
    cleaned = []
    for line in lines:
        line_strip = line.strip()
        if line_strip and line_strip not in seen:
            cleaned.append(line_strip)
            seen.add(line_strip)
    return ". ".join(cleaned)




# ---------- FastAPI ----------
app = FastAPI(title="Menstrual Health RAG (FAISS + Llama + WHO/PubMed)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    query: str
    require_domain: Optional[bool] = False
    k: Optional[int] = 5
    use_live: Optional[bool] = False


class ChatResponse(BaseModel):
    answer: str
    used_live_sources: List[str] = []
    retrieved_chunks: int = 0

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    q = req.query.strip()

    # Ensure question is in-domain
    if req.require_domain and not in_domain(q):
        polite_message = (
            "I’m here to help with topics related to menstrual health, puberty, "
            "and adolescent well-being. Could you please ask something within these areas?"
        )
        return ChatResponse(
            answer=polite_message,
            used_live_sources=[],
            retrieved_chunks=0
        )

    # Retrieve FAISS context
    context = retrieve_context(q, k=req.k)
    used_live = []
    live_blocks: List[str] = []

    # Fetch live data if requested or needed
    if req.use_live and (wants_live(q) or "age" in q.lower() or "first period" in q.lower()):
        who = fetch_who_summary()
        live_blocks.append(who); used_live.append("WHO")
        pm = fetch_pubmed_titles(term="menstrual health", retmax=5)
        live_blocks.append(pm); used_live.append("PubMed")

    # Decide concise vs detailed
    concise = True  # default
    if any(w in q.lower() for w in ["explain", "details", "how", "why", "more"]):
        concise = False

    # Build prompt
    system_msg = "You are a concise, factual assistant for menstrual health and puberty."
    user_msg = build_user_prompt(q, context, live_blocks, concise=concise)

    # Generate answer
    answer = generate_llama(system_msg, user_msg, max_new_tokens=512)

    return ChatResponse(
        answer=answer,
        used_live_sources=used_live,
        retrieved_chunks=(len(context.split("\n\n")) if context else 0)
    )

def paraphrase_context(context_chunks: List[str]) -> str:
    """
    Converts retrieved context into first-person friendly points without copying exact sentences.
    """
    paraphrased = []
    for chunk in context_chunks:
        # Use a simple heuristic: take key sentences and remove article citations
        sentences = chunk.split(". ")
        sentences = [s for s in sentences if "article" not in s.lower() and "study" not in s.lower()]
        paraphrased.extend(sentences[:2])  # take first 2 sentences for conciseness
    return "\n".join(paraphrased)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(model.device),
        "faiss_dir": FAISS_INDEX_DIR,
        "embedding_model": EMBEDDING_MODEL,
        "llama_model": LLAMA_MODEL_ID
    }

if __name__ == "__main__":
    print("🚀 Starting chatbot backend...")
    app.run(host="0.0.0.0", port=5000, debug=True)


