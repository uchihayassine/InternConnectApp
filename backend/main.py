import json
import logging
import math
import os
import re
import time

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.api_core.exceptions import (
    InternalServerError,
    ResourceExhausted,
    ServiceUnavailable,
    TooManyRequests,
)
from pydantic import BaseModel
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing. Add it to backend/.env.")
genai.configure(api_key=api_key, transport="rest")

EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768
ACTIONS = {"location", "emergency", "general"}
CHAT_MODELS = (
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
)
SYSTEM_INSTRUCTION = (
    "You are the InterConnect campus guide for international students at "
    "Fachhochschule Dortmund. Base the answer strictly on the provided context. "
    "If the context does not contain the answer, politely state what information is missing. "
    "Return only a raw JSON object with exactly two keys: "
    '"reply" (string) and "action" ("location", "emergency", or "general"). '
    'Use "location" when the query or the reply references a specific campus building, room, or library navigation. '
    'Use "emergency" when the topic is security, medical help, or campus police. '
    'Use "general" for standard questions and answers. Do not use markdown.'
)

logger = logging.getLogger("uvicorn.error")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_supabase = None
_supabase_checked = False


class ChatRequest(BaseModel):
    query: str


class ChatResponse(BaseModel):
    reply: str
    action: str


def normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def embed_query(text: str) -> list[float]:
    result = genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type="retrieval_query",
        output_dimensionality=EMBED_DIM,
    )
    vector = result["embedding"]
    if len(vector) != EMBED_DIM:
        raise RuntimeError(f"Expected {EMBED_DIM} dimensions, got {len(vector)}")
    return normalize(vector)


def get_supabase():
    global _supabase, _supabase_checked
    if _supabase_checked:
        return _supabase
    _supabase_checked = True
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key or url.startswith("your_") or key.startswith("your_"):
        return None
    _supabase = create_client(url, key)
    return _supabase


def parse_agent_response(text: str) -> ChatResponse:
    raw = (text or "").strip()
    candidate = raw
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate, flags=re.IGNORECASE)
        candidate = re.sub(r"\s*```$", "", candidate)
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end > start:
        candidate = candidate[start : end + 1]
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        data = {}
    reply = data.get("reply") if isinstance(data, dict) else None
    action = data.get("action") if isinstance(data, dict) else None
    if not isinstance(reply, str) or not reply.strip():
        reply = raw or "I do not know."
    action = action.strip().lower() if isinstance(action, str) else ""
    if action not in ACTIONS:
        action = "general"
    return ChatResponse(reply=reply.strip(), action=action)


def retrieve_context(query: str) -> str:
    client = get_supabase()
    if client is None:
        return ""
    query_vec = embed_query(query)
    result = client.rpc(
        "match_documents",
        {
            "query_embedding": query_vec,
            "match_threshold": 0.5,
            "match_count": 4,
        },
    ).execute()
    rows = result.data or []
    parts = []
    for row in rows:
        content = (row.get("content") or "").strip()
        if not content:
            continue
        metadata = row.get("metadata") or {}
        title = metadata.get("title") if isinstance(metadata, dict) else ""
        parts.append(f"{title}\n{content}".strip() if title else content)
    return "\n\n".join(parts)


def chat_model(name: str):
    return genai.GenerativeModel(
        name,
        system_instruction=SYSTEM_INSTRUCTION,
        generation_config={"response_mime_type": "application/json"},
    )


def generate_reply(user_prompt: str) -> ChatResponse:
    last_error = None
    for name in CHAT_MODELS:
        for attempt in range(2):
            try:
                response = chat_model(name).generate_content(user_prompt)
                return parse_agent_response(response.text or "")
            except (ResourceExhausted, TooManyRequests) as error:
                last_error = error
                break
            except (ServiceUnavailable, InternalServerError) as error:
                last_error = error
                if attempt == 1:
                    break
                time.sleep(1.5)
            except ValueError:
                return parse_agent_response("")
    if last_error:
        raise last_error
    return ChatResponse(
        reply="I could not reach the campus guide. Please try again.",
        action="general",
    )


@app.get("/ping")
def ping():
    return {"status": "InterConnect API running"}


@app.post("/chat")
def chat(request: ChatRequest) -> ChatResponse:
    query = request.query.strip()
    if not query:
        return ChatResponse(reply="Ask a question about campus and I will look it up.", action="general")

    context = ""
    try:
        context = retrieve_context(query)
    except Exception:
        logger.exception("chat retrieval failed")
        context = ""

    if context:
        user_prompt = f"Context:\n{context}\n\nQuestion: {query}"
    else:
        user_prompt = (
            "No campus documents were retrieved. "
            "Do not invent buildings, hours, or phone numbers. "
            "Politely say what information is missing.\n\n"
            f"Question: {query}"
        )

    try:
        return generate_reply(user_prompt)
    except Exception:
        logger.exception("chat generation failed")
        return ChatResponse(
            reply="I could not reach the campus guide. Please try again.",
            action="general",
        )
