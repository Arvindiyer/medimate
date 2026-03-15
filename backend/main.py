from dotenv import load_dotenv
load_dotenv()

import os
import tempfile
import httpx
from datetime import datetime, date, timedelta

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

import db
import llm
import notifications

app = FastAPI(title="MediMate API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

WHISPER_URL = os.getenv("WHISPER_URL", "http://localhost:8001")

db.init_db()


# ── Request / response schemas ────────────────────────────────────────────────

class UserCreate(BaseModel):
    name:            str
    age:             Optional[int] = None
    caregiver_email: Optional[str] = None


class MedCreate(BaseModel):
    name:    str
    dose:    str
    times:   list[str]
    user_id: str = "default"


class LogCreate(BaseModel):
    type:    str
    med_id:  Optional[int] = None
    notes:   Optional[str] = None
    user_id: str = "default"


class ChatMessage(BaseModel):
    role:    str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id:  str = "default"


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "MediMate API v2"}


# ── User routes ───────────────────────────────────────────────────────────────

@app.post("/users", status_code=201)
def create_user(data: UserCreate):
    with Session(db.engine) as s:
        user = db.User(
            name=data.name,
            age=data.age,
            caregiver_email=data.caregiver_email,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        return {"id": user.id, "name": user.name, "age": user.age, "caregiver_email": user.caregiver_email}


@app.get("/users")
def list_users():
    users = db.list_users()
    return [{"id": u.id, "name": u.name, "age": u.age, "caregiver_email": u.caregiver_email} for u in users]


@app.get("/users/{user_id}")
def get_user(user_id: int):
    user = db.get_user(str(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "name": user.name, "age": user.age, "caregiver_email": user.caregiver_email}


@app.put("/users/{user_id}")
def update_user(user_id: int, data: UserCreate):
    with Session(db.engine) as s:
        user = s.get(db.User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.name            = data.name
        user.age             = data.age
        user.caregiver_email = data.caregiver_email
        s.add(user)
        s.commit()
        s.refresh(user)
        return {"id": user.id, "name": user.name, "age": user.age, "caregiver_email": user.caregiver_email}


# ── Medication routes ─────────────────────────────────────────────────────────

@app.post("/medications", status_code=201)
def add_medication(med: MedCreate):
    with Session(db.engine) as session:
        new_med = db.Medication(
            name=med.name,
            dose=med.dose,
            times=",".join(med.times),
            user_id=med.user_id,
        )
        session.add(new_med)
        session.commit()
        session.refresh(new_med)
        return {
            "id": new_med.id,
            "name": new_med.name,
            "dose": new_med.dose,
            "times": new_med.times.split(","),
            "user_id": new_med.user_id,
        }


@app.get("/medications")
def list_medications(user_id: str = "default"):
    meds = db.get_medications(user_id)
    return [
        {"id": m.id, "name": m.name, "dose": m.dose, "times": m.times.split(",")}
        for m in meds
    ]


@app.delete("/medications/{med_id}")
def delete_medication(med_id: int):
    with Session(db.engine) as session:
        med = session.get(db.Medication, med_id)
        if not med:
            raise HTTPException(status_code=404, detail="Medication not found")
        session.delete(med)
        session.commit()
    return {"ok": True}


# ── Activity log routes ───────────────────────────────────────────────────────

@app.post("/log", status_code=201)
def log_activity(entry: LogCreate):
    with Session(db.engine) as session:
        log = db.ActivityLog(
            type=entry.type,
            med_id=entry.med_id,
            notes=entry.notes,
            user_id=entry.user_id,
            timestamp=datetime.now().isoformat(),
        )
        session.add(log)
        session.commit()
        session.refresh(log)

    # Check for distress keywords in notes
    if entry.notes and llm.check_distress(entry.notes):
        _trigger_distress_alert(entry.user_id, entry.notes)

    return log


@app.get("/logs/today")
def today_logs(user_id: str = "default"):
    return db.get_today_logs(user_id)


@app.get("/logs/history")
def history(user_id: str = "default", days: int = 7):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    with Session(db.engine) as s:
        logs = s.exec(
            select(db.ActivityLog)
            .where(db.ActivityLog.user_id == user_id)
            .where(db.ActivityLog.timestamp >= cutoff)
            .order_by(db.ActivityLog.timestamp.desc())
        ).all()
    return logs


# ── Reminder route ────────────────────────────────────────────────────────────

@app.get("/reminders/due")
def get_due_reminders(user_id: str = "default"):
    return db.get_overdue_meds(user_id)


# ── AI chat route (with RAG) ──────────────────────────────────────────────────

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    context  = _build_context(req.user_id)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    # Check last user message for distress
    last_msg = messages[-1]["content"] if messages else ""
    if llm.check_distress(last_msg):
        _trigger_distress_alert(req.user_id, last_msg)

    try:
        reply = llm.chat(messages, context)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"reply": reply}


# ── Food recommendation route (RAG-powered) ───────────────────────────────────

@app.get("/food-recommendation")
def food_recommendation(user_id: str = "default"):
    meds = db.get_medications(user_id)
    logs = db.get_today_logs(user_id)

    meds_summary = ", ".join(f"{m.name} {m.dose}" for m in meds) or "none"
    logs_summary = ", ".join(l.type for l in logs) or "no activity yet today"

    try:
        return llm.get_food_recommendation(logs_summary, meds_summary)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── Voice transcription route ─────────────────────────────────────────────────

@app.post("/voice/transcribe")
async def transcribe_voice(audio: UploadFile = File(...), user_id: str = "default"):
    """
    Receive audio from mobile, forward to Whisper server, return transcription
    and detected intent.
    """
    # Save upload to temp file
    suffix = os.path.splitext(audio.filename or "audio.m4a")[1] or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Forward to Whisper server
        async with httpx.AsyncClient(timeout=20) as client:
            with open(tmp_path, "rb") as f:
                resp = await client.post(
                    f"{WHISPER_URL}/transcribe",
                    files={"audio": (audio.filename or "audio.m4a", f, "audio/m4a")},
                )
        resp.raise_for_status()
        text = resp.json().get("text", "").strip()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Whisper STT server not reachable at {WHISPER_URL}. Run: python whisper_server.py",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {e}")
    finally:
        os.unlink(tmp_path)

    # Detect intent from transcription
    intent, meta = _detect_intent(text, user_id)

    # If a distress keyword was spoken, alert caregiver
    if llm.check_distress(text):
        _trigger_distress_alert(user_id, text)

    return {"text": text, "intent": intent, **meta}


# ── Notification routes ───────────────────────────────────────────────────────

@app.post("/notify/check")
def run_notification_check(user_id: str = "default"):
    """Manually trigger the caregiver alert check for a user."""
    triggered = notifications.check_and_notify(user_id)
    return {"triggered": triggered, "count": len(triggered)}


@app.get("/notify/history")
def notification_history(user_id: str = "default"):
    history = db.get_notification_history(user_id)
    return [
        {
            "alert_type": n.alert_type,
            "message":    n.message,
            "sent_to":    n.sent_to,
            "timestamp":  n.timestamp,
        }
        for n in history
    ]


# ── Caregiver web dashboard ───────────────────────────────────────────────────

@app.get("/dashboard", response_class=HTMLResponse)
def caregiver_dashboard(request: Request, user_id: str = "default"):
    """Server-rendered caregiver dashboard. Open in a browser."""
    user      = db.get_user(user_id)
    meds      = db.get_medications(user_id)
    logs      = db.get_today_logs(user_id)
    overdue   = db.get_overdue_meds(user_id)
    alerts    = db.get_notification_history(user_id, limit=8)

    # Wellness score: 70% meds + 20% any walk + 10% exercise
    meds_taken = len({l.med_id for l in logs if l.type == "medicine"})
    meds_total = len(meds) if meds else 1
    has_walk   = any(l.type == "walk" for l in logs)
    has_ex     = any(l.type == "exercise" for l in logs)
    meals      = sum(1 for l in logs if l.type == "meal")
    activity_count = sum(1 for l in logs if l.type in {"walk", "exercise"})
    score = int(
        (meds_taken / meds_total) * 70
        + (20 if has_walk else 0)
        + (10 if has_ex else 0)
    )

    # Enrich medication list with taken status
    logged_med_ids = {l.med_id for l in logs if l.type == "medicine"}
    meds_display = [
        {
            "name":  m.name,
            "dose":  m.dose,
            "times": m.times,
            "taken": m.id in logged_med_ids,
        }
        for m in meds
    ]

    # Last seen — most recent log timestamp
    last_seen = "No activity yet"
    if logs:
        latest = max(logs, key=lambda l: l.timestamp)
        last_seen = latest.timestamp[11:16]

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request":        request,
            "user_id":        user_id,
            "patient_name":   user.name if user else "Patient",
            "patient_age":    user.age  if user else None,
            "wellness_score": score,
            "meds_taken":     meds_taken,
            "meds_total":     meds_total,
            "meals_logged":   meals,
            "activity_count": activity_count,
            "total_logs":     len(logs),
            "last_seen":      last_seen,
            "medications":    meds_display,
            "today_logs":     logs,
            "alerts":         alerts,
            "now":            datetime.now().strftime("%B %d, %Y %I:%M %p"),
        },
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_context(user_id: str) -> str:
    meds = db.get_medications(user_id)
    logs = db.get_today_logs(user_id)

    med_lines = "\n".join(
        f"- {m.name} {m.dose} at {m.times}" for m in meds
    ) or "No medications set up."

    log_lines = "\n".join(
        f"- [{l.timestamp[11:16]}] {l.type}: {l.notes or ''}" for l in logs
    ) or "Nothing logged today."

    return f"Medications:\n{med_lines}\n\nToday's log:\n{log_lines}"


def _detect_intent(text: str, user_id: str) -> tuple[str, dict]:
    """
    Simple keyword-based intent detection on transcribed voice text.
    Returns (intent_name, extra_meta_dict).
    """
    text_lower = text.lower()
    meds = db.get_medications(user_id)

    # Check for medication logging
    for med in meds:
        if med.name.lower() in text_lower:
            return "log_medication", {"med_id": med.id, "med_name": med.name}

    if any(w in text_lower for w in ["took", "taken", "medicine", "pill", "medication"]):
        return "log_medication", {"med_id": None, "med_name": None}

    if any(w in text_lower for w in ["walk", "walked", "walking", "stroll"]):
        return "log_walk", {}

    if any(w in text_lower for w in ["exercise", "workout", "gym", "yoga", "ran", "run"]):
        return "log_exercise", {}

    if any(w in text_lower for w in ["ate", "eaten", "meal", "food", "breakfast", "lunch", "dinner", "snack"]):
        return "log_meal", {}

    if any(w in text_lower for w in ["recommend", "suggest", "what", "should", "eat", "food", "recipe"]):
        return "chat_food", {}

    return "chat", {}


def _trigger_distress_alert(user_id: str, message: str):
    """Fire distress email if user has a caregiver configured."""
    user = db.get_user(user_id)
    if user and user.caregiver_email:
        sent = notifications.send_distress_alert(user.caregiver_email, user.name, message)
        if sent:
            db.log_notification(user_id, "distress", message[:200], user.caregiver_email)
