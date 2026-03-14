from sqlmodel import SQLModel, Field, Session, create_engine, select
from typing import Optional
from datetime import datetime, date

DATABASE_URL = "sqlite:///medimate.db"
engine = create_engine(DATABASE_URL, echo=False)


# ── Models ────────────────────────────────────────────────────────────────────

class Medication(SQLModel, table=True):
    id:      Optional[int] = Field(default=None, primary_key=True)
    name:    str
    dose:    str
    times:   str        # "08:00,20:00" — comma-separated
    user_id: str = "default"


class ActivityLog(SQLModel, table=True):
    id:        Optional[int] = Field(default=None, primary_key=True)
    type:      str              # "medicine" | "walk" | "exercise"
    med_id:    Optional[int] = None
    notes:     Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    user_id:   str = "default"


# ── Setup ─────────────────────────────────────────────────────────────────────

def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


# ── Query helpers ─────────────────────────────────────────────────────────────

def get_medications(user_id: str = "default") -> list[Medication]:
    with Session(engine) as s:
        return s.exec(
            select(Medication).where(Medication.user_id == user_id)
        ).all()


def get_today_logs(user_id: str = "default") -> list[ActivityLog]:
    today = date.today().isoformat()
    with Session(engine) as s:
        all_logs = s.exec(
            select(ActivityLog).where(ActivityLog.user_id == user_id)
        ).all()
        return [l for l in all_logs if l.timestamp.startswith(today)]


def get_overdue_meds(user_id: str = "default") -> list[dict]:
    """Return meds scheduled before now that haven't been logged today."""
    now = datetime.now()
    today_logs = get_today_logs(user_id)
    logged_med_ids = {l.med_id for l in today_logs if l.type == "medicine"}

    overdue = []
    for med in get_medications(user_id):
        if med.id in logged_med_ids:
            continue
        for t in med.times.split(","):
            t = t.strip()
            try:
                h, m = map(int, t.split(":"))
            except ValueError:
                continue
            scheduled = now.replace(hour=h, minute=m, second=0, microsecond=0)
            if now > scheduled:
                overdue.append({
                    "med_id": med.id,
                    "name": med.name,
                    "dose": med.dose,
                    "time": t,
                })
    return overdue
