from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date, timedelta

import db
import llm

app = FastAPI(title="MediMate API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()


# ── Request / response schemas ────────────────────────────────────────────────

class MedCreate(BaseModel):
    name:    str
    dose:    str
    times:   list[str]   # ["08:00", "20:00"]
    user_id: str = "default"


class LogCreate(BaseModel):
    type:    str           # "medicine" | "walk" | "exercise"
    med_id:  Optional[int] = None
    notes:   Optional[str] = None
    user_id: str = "default"


class ChatMessage(BaseModel):
    role:    str           # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id:  str = "default"


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "MediMate API"}


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
    """Polled every 5 minutes by the app to surface overdue medications."""
    return db.get_overdue_meds(user_id)


# ── AI routes ─────────────────────────────────────────────────────────────────

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


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    context  = _build_context(req.user_id)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    reply    = llm.chat(messages, context)
    return {"reply": reply}


@app.get("/food-recommendation")
def food_recommendation(user_id: str = "default"):
    meds = db.get_medications(user_id)
    logs = db.get_today_logs(user_id)

    meds_summary = ", ".join(f"{m.name} {m.dose}" for m in meds) or "none"
    logs_summary = ", ".join(l.type for l in logs) or "no activity yet today"

    recommendation = llm.get_food_recommendation(logs_summary, meds_summary)
    return {"recommendation": recommendation}
