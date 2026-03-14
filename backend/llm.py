import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# ── Client setup ──────────────────────────────────────────────────────────────
# Get a FREE key at https://aistudio.google.com → "Get API key"
# Make sure you create the key inside AI Studio (not Google Cloud Console)
# — AI Studio keys have the free tier quota automatically enabled.

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL  = "gemini-2.5-flash"

# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are MediMate, a friendly and caring health companion for elderly users.

Your personality:
- Warm, simple language — no medical jargon
- Keep replies SHORT (2-4 sentences) — they appear on a small phone screen
- Be encouraging, never alarming
- For food recommendations: suggest simple, practical meals based on the user's \
logged activity and medications

You will receive the user's current medication list and today's activity log as context.
NEVER invent medical advice. For any real medical concern say:
"That's worth mentioning to your doctor."
"""

NUTRITIONIST_SYSTEM = (
    "You are a caring nutritionist giving simple, practical advice to elderly people."
)

# ── Functions ─────────────────────────────────────────────────────────────────

def chat(messages: list[dict], context: str) -> str:
    """
    Send a multi-turn conversation to Gemini with live DB context injected.

    Args:
        messages: list of {"role": "user"|"assistant", "content": "..."}
        context:  formatted string of the user's medications + today's logs

    Returns:
        Assistant reply as a plain string.
    """
    system = SYSTEM_PROMPT + f"\n\nUser's current context:\n{context}"

    # Build history from all messages except the last one
    history = []
    for m in messages[:-1]:
        role = "model" if m["role"] == "assistant" else "user"
        history.append(types.Content(role=role, parts=[types.Part(text=m["content"])]))

    chat_session = client.chats.create(
        model=MODEL,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=300,
        ),
        history=history,
    )

    response = chat_session.send_message(messages[-1]["content"])
    return response.text


def get_food_recommendation(logs_summary: str, meds_summary: str) -> str:
    """
    One-shot call to get a personalised meal suggestion.

    Args:
        logs_summary: comma-separated activity types logged today
        meds_summary: comma-separated medication names + doses

    Returns:
        2-3 sentence meal recommendation.
    """
    prompt = (
        f"Based on this person's health data, suggest a simple, practical meal.\n\n"
        f"Their medications: {meds_summary}\n"
        f"Today's activity: {logs_summary}\n\n"
        f"Give ONE specific meal suggestion with a brief reason. 2-3 sentences max."
    )

    response = client.models.generate_content(
        model=MODEL,
        config=types.GenerateContentConfig(
            system_instruction=NUTRITIONIST_SYSTEM,
            max_output_tokens=150,
        ),
        contents=prompt,
    )
    return response.text
