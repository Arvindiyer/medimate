"""
llm.py — LLM integration using Ollama (local, open source).

Primary: Ollama with llama3.2:3b running on http://localhost:11434
Fallback: Gemini API (if GEMINI_API_KEY is set and Ollama is unavailable)
"""

import json
import os
import requests
from dotenv import load_dotenv

import rag

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
USE_GEMINI_FALLBACK = bool(os.getenv("GEMINI_API_KEY"))

# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are MediMate, a friendly health companion for elderly users.

Guidelines:
- Use simple, warm language — no medical jargon
- Keep replies SHORT (3-5 sentences max) — displayed on a small phone screen
- Be encouraging, never alarming
- Use the recipe context below to give specific, practical food suggestions
- NEVER invent medical advice. For real concerns say: "Please mention this to your doctor."
- If the user asks about food, reference the provided recipes by name
"""

NUTRITIONIST_SYSTEM = """You are a caring nutritionist helping elderly people eat well.
Suggest meals from the provided recipe list. Be brief and practical.
Always mention WHY the meal is good for their specific medications or conditions.
Keep your response under 150 words."""


# ── Ollama client ─────────────────────────────────────────────────────────────

def _ollama_chat(system: str, messages: list[dict], timeout: int = 30) -> str:
    """Send messages to Ollama and return the assistant reply."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "system", "content": system}] + messages,
        "stream": False,
        "options": {"num_predict": 400, "temperature": 0.7},
    }
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=timeout,
        )
        r.raise_for_status()
        return r.json()["message"]["content"].strip()
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            f"Cannot reach Ollama at {OLLAMA_URL}. "
            "Make sure Ollama is running: ollama serve"
        )
    except requests.exceptions.Timeout:
        raise RuntimeError("Ollama request timed out. The model may be loading — try again.")
    except Exception as e:
        raise RuntimeError(f"Ollama error: {e}")


def _gemini_fallback_chat(system: str, messages: list[dict]) -> str:
    """Fallback to Gemini if Ollama is unavailable and GEMINI_API_KEY is set."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    history = []
    for m in messages[:-1]:
        role = "model" if m["role"] == "assistant" else "user"
        history.append(types.Content(role=role, parts=[types.Part(text=m["content"])]))
    session = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction=system, max_output_tokens=300
        ),
        history=history,
    )
    return session.send_message(messages[-1]["content"]).text


def _call_llm(system: str, messages: list[dict]) -> str:
    """Try Ollama first, fall back to Gemini if configured."""
    try:
        return _ollama_chat(system, messages)
    except RuntimeError as e:
        if USE_GEMINI_FALLBACK:
            print(f"[llm] Ollama unavailable ({e}), falling back to Gemini.")
            return _gemini_fallback_chat(system, messages)
        raise


# ── Public API ────────────────────────────────────────────────────────────────

def chat(messages: list[dict], context: str) -> str:
    """
    Multi-turn health chat with RAG-injected recipe context.

    Args:
        messages: list of {"role": "user"|"assistant", "content": "..."}
        context:  user's medications + today's activity log

    Returns:
        Assistant reply as plain string.
    """
    # Extract user query for RAG retrieval
    last_user_msg = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )

    # Parse medication names from context for better RAG results
    med_names = _extract_med_names(context)

    # Retrieve relevant recipes
    relevant_recipes = rag.search_recipes(last_user_msg, user_meds=med_names, top_k=3)
    recipe_context   = rag.format_recipes_as_context(relevant_recipes)

    system = (
        SYSTEM_PROMPT
        + f"\n\n## User's health context:\n{context}"
        + f"\n\n## Relevant recipes from our database:\n{recipe_context}"
    )

    return _call_llm(system, messages)


def get_food_recommendation(logs_summary: str, meds_summary: str) -> dict:
    """
    Generate personalised meal recommendations using RAG over recipe database.

    Returns:
        {"context": str, "recommendations": [{"emoji", "name", "description", "macros", "why"}]}
    """
    # Retrieve top recipes based on user's medications
    med_names = [m.strip().split()[0] for m in meds_summary.split(",") if m.strip()]
    recipes   = rag.get_recommendations_for_user(med_names, today_activity=logs_summary, top_k=3)
    recipe_ctx = rag.format_recipes_as_context(recipes)

    prompt = (
        f"The user takes: {meds_summary}\n"
        f"Today's activity: {logs_summary}\n\n"
        f"{recipe_ctx}\n\n"
        "Pick the 2 BEST recipes from the list above for this person. "
        "Return ONLY valid JSON — no markdown fences — in exactly this shape:\n"
        '{"context":"<1 sentence why these were chosen>",'
        '"recommendations":['
        '{"emoji":"<emoji>","name":"<name>","description":"<8 words max>",'
        '"macros":{"protein":"Xg","carbs":"Xg","fats":"Xg"},'
        '"why":"<2 sentences linking to their meds or activity>"}]}'
    )

    messages = [{"role": "user", "content": prompt}]

    try:
        raw = _call_llm(NUTRITIONIST_SYSTEM, messages)
        # Strip markdown fences if the model adds them despite instructions
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except (json.JSONDecodeError, ValueError):
        # Graceful fallback: return top RAG recipes directly
        return _recipes_to_response(recipes[:2], meds_summary)
    except RuntimeError as e:
        return {"context": str(e), "recommendations": _recipes_to_response(recipes[:2], meds_summary)["recommendations"]}


def check_distress(text: str) -> bool:
    """Return True if text contains distress keywords requiring caregiver alert."""
    keywords = {"pain", "fell", "fall", "dizzy", "dizziness", "emergency",
                "help", "hurt", "chest", "breathe", "breathing", "fainted"}
    tokens = set(text.lower().split())
    return bool(tokens & keywords)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_med_names(context: str) -> list[str]:
    """Pull medication names out of the context string."""
    names = []
    for line in context.splitlines():
        if line.strip().startswith("- ") and "at " in line:
            # Format: "- MedName Dose at HH:MM"
            part = line.strip()[2:].split()[0]
            names.append(part)
    return names


def _recipes_to_response(recipes: list[dict], meds_summary: str) -> dict:
    """Convert raw recipe dicts into the mobile-expected response shape."""
    recs = [
        {
            "emoji": r["emoji"],
            "name":  r["name"],
            "description": r["description"][:60],
            "macros": r["nutrition"],
            "why": f"Good for your conditions. {r['description']}",
        }
        for r in recipes
    ]
    return {
        "context": f"Recommendations based on your medications: {meds_summary}",
        "recommendations": recs,
    }
