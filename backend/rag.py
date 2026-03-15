"""
rag.py — Simple keyword-based recipe retrieval for RAG pipeline.

No external dependencies beyond the standard library and the recipes.json file.
Scores recipes by matching query tokens + user medication conditions against
recipe tags, name, good_for, and ingredients.
"""

import json
import os
import re
from typing import Optional

# ── Load recipe data once at import time ──────────────────────────────────────

_DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "recipes.json")

with open(_DATA_PATH, "r") as f:
    _RECIPES: list[dict] = json.load(f)

# ── Medication → health condition mapping ─────────────────────────────────────
# Maps common medication name fragments to conditions used in recipe tags.

MED_CONDITION_MAP: dict[str, list[str]] = {
    "metformin":     ["diabetes", "diabetes-friendly", "low-sugar"],
    "insulin":       ["diabetes", "diabetes-friendly", "low-sugar"],
    "glipizide":     ["diabetes", "low-sugar"],
    "lisinopril":    ["hypertension", "heart-disease", "low-sodium"],
    "amlodipine":    ["hypertension", "heart-disease"],
    "losartan":      ["hypertension", "heart-disease", "kidney-health"],
    "atorvastatin":  ["high-cholesterol", "heart-healthy", "heart-disease"],
    "simvastatin":   ["high-cholesterol", "heart-healthy"],
    "rosuvastatin":  ["high-cholesterol", "heart-healthy"],
    "aspirin":       ["heart-disease", "heart-healthy", "anti-inflammatory"],
    "warfarin":      ["heart-disease"],
    "vitamin d":     ["bone-health", "calcium-rich"],
    "calcium":       ["bone-health"],
    "prednisone":    ["anti-inflammatory", "arthritis"],
    "ibuprofen":     ["anti-inflammatory", "arthritis"],
    "naproxen":      ["anti-inflammatory", "arthritis"],
    "furosemide":    ["hypertension", "kidney-health", "low-sodium"],
    "levothyroxine": ["general-wellness"],
    "omeprazole":    ["digestive-health"],
}

# ── Stop words to ignore in tokenisation ─────────────────────────────────────

_STOP = {
    "a", "an", "the", "is", "are", "was", "for", "and", "or", "to",
    "of", "in", "on", "at", "with", "i", "my", "me", "what", "should",
    "eat", "can", "do", "have", "need", "want", "like", "good", "bad",
    "today", "tonight", "morning", "evening", "something",
}


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {t for t in tokens if t not in _STOP and len(t) > 1}


def _score_recipe(recipe: dict, query_tokens: set[str], condition_tokens: set[str]) -> float:
    """Return a relevance score for a single recipe."""
    score = 0.0

    # Build a searchable text blob from the recipe
    name_tokens   = _tokenize(recipe["name"])
    tag_tokens    = _tokenize(" ".join(recipe["tags"]))
    good_tokens   = _tokenize(" ".join(recipe["good_for"]))
    ingr_tokens   = _tokenize(" ".join(recipe["ingredients"]))
    desc_tokens   = _tokenize(recipe.get("description", ""))

    all_tokens = name_tokens | tag_tokens | good_tokens | ingr_tokens | desc_tokens

    # Query token hits (high weight)
    score += len(query_tokens & all_tokens) * 2.0

    # Condition/medication hits against good_for tags (highest weight — core RAG signal)
    score += len(condition_tokens & good_tokens) * 3.0
    score += len(condition_tokens & tag_tokens)  * 2.0

    # Name match bonus
    score += len(query_tokens & name_tokens) * 1.5

    return score


def search_recipes(
    query: str,
    user_meds: Optional[list[str]] = None,
    meal_type: Optional[str] = None,
    top_k: int = 3,
) -> list[dict]:
    """
    Search recipes relevant to the query and user's medications.

    Args:
        query:     User's question or request (e.g. "dinner ideas for diabetes")
        user_meds: List of medication names the user takes
        meal_type: Optional filter — "breakfast", "lunch", "dinner", "snack"
        top_k:     Number of top recipes to return

    Returns:
        List of recipe dicts (top_k most relevant), each with a '_score' key.
    """
    query_tokens = _tokenize(query)

    # Derive condition tokens from medications
    condition_tokens: set[str] = set()
    if user_meds:
        for med in user_meds:
            med_lower = med.lower()
            for key, conditions in MED_CONDITION_MAP.items():
                if key in med_lower:
                    condition_tokens.update(conditions)

    # Also pull condition keywords directly from query
    health_keywords = {
        "diabetes", "hypertension", "cholesterol", "heart", "arthritis",
        "kidney", "bone", "inflammation", "blood", "pressure", "sugar",
    }
    condition_tokens.update(query_tokens & health_keywords)

    # Filter by meal type if provided
    candidates = _RECIPES
    if meal_type:
        mt = meal_type.lower()
        candidates = [r for r in candidates if mt in r["tags"]] or candidates

    # Score and sort
    scored = [
        {**r, "_score": _score_recipe(r, query_tokens, condition_tokens)}
        for r in candidates
    ]
    scored.sort(key=lambda r: r["_score"], reverse=True)

    return scored[:top_k]


def format_recipes_as_context(recipes: list[dict]) -> str:
    """
    Format retrieved recipes into a readable context block for the LLM prompt.
    """
    if not recipes:
        return "No specific recipe recommendations available."

    lines = ["Here are relevant recipes from our database:\n"]
    for i, r in enumerate(recipes, 1):
        lines.append(
            f"{i}. {r['emoji']} {r['name']}\n"
            f"   Tags: {', '.join(r['tags'][:5])}\n"
            f"   Good for: {', '.join(r['good_for'])}\n"
            f"   Nutrition: {r['nutrition']['calories']} cal | "
            f"Protein: {r['nutrition']['protein']} | "
            f"Carbs: {r['nutrition']['carbs']} | "
            f"Fats: {r['nutrition']['fats']}\n"
            f"   Why: {r['description']}\n"
            f"   Prep: {r['prep_time']}\n"
        )

    return "\n".join(lines)


def get_recommendations_for_user(
    user_meds: list[str],
    today_activity: str = "",
    top_k: int = 3,
) -> list[dict]:
    """
    Generate proactive meal recommendations based purely on the user's
    medication profile and today's activity — no explicit query needed.
    Used by the Nutrition screen.
    """
    query = f"healthy meal {today_activity}"
    return search_recipes(query, user_meds=user_meds, top_k=top_k)
