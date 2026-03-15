# backend/

FastAPI server that powers MediMate. Handles AI chat, medication logging, voice transcription forwarding, caregiver alerts, and the caregiver web dashboard.

---

## Files

| File | Purpose |
|---|---|
| `main.py` | All FastAPI routes, intent detection, conversation memory |
| `db.py` | SQLModel schema and query helpers (SQLite) |
| `llm.py` | LLM integration — Ollama primary, Gemini 2.5 Flash fallback |
| `rag.py` | Recipe retrieval — keyword + medication-condition scoring |
| `notifications.py` | Gmail SMTP caregiver alerts (distress / missed med / inactivity) |
| `seed.py` | Populate the DB with Eleanor Marsh demo data |
| `requirements.txt` | Python dependencies |
| `data/recipes.json` | ~30 structured recipes with macros, health conditions, tags |
| `templates/dashboard.html` | Jinja2 caregiver dashboard template |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/users` | Create a new user |
| `GET` | `/users` | List all users |
| `GET` | `/users/{user_id}` | Get user profile |
| `POST` | `/medications` | Add a medication |
| `GET` | `/medications/{user_id}` | List medications for a user |
| `DELETE` | `/medications/{med_id}` | Remove a medication |
| `POST` | `/log` | Log an activity (medicine / walk / exercise / meal) |
| `GET` | `/logs/today` | Today's activity logs for a user |
| `GET` | `/logs/history` | Full log history for a user |
| `GET` | `/reminders/due` | Medications overdue and not yet logged |
| `POST` | `/chat` | Multi-turn AI chat with RAG context injection |
| `POST` | `/voice/transcribe` | Forward audio to Whisper, detect intent + distress |
| `GET` | `/food-recommendation` | Top recipe recommendations as JSON |
| `GET` | `/notify/check` | Trigger caregiver alerts if conditions met |
| `GET` | `/notify/history` | Recent notification log |
| `GET` | `/dashboard` | Server-rendered caregiver HTML view |

---

## Database Schema

```
User            id, name, age, caregiver_email, created_at
Medication      id, name, dose, times (comma-separated), user_id
ActivityLog     id, type, med_id, notes, timestamp, user_id
NotificationLog id, user_id, alert_type, message, sent_to, timestamp
```

SQLite database file: `medimate.db` (created automatically on first run).

---

## AI Components

### LLM (`llm.py`)

- Primary: `llama3.2:3b` via Ollama at `http://localhost:11434`
- Fallback: Gemini 2.5 Flash if Ollama is unreachable and `GEMINI_API_KEY` is set
- Temperature 0.7, max 400 tokens, single non-streamed call
- System prompt sets the MediMate persona: warm, concise (3–5 sentences), health-focused

### RAG (`rag.py`)

Scores recipes against the user's query and active medications — no external dependencies, pure Python:

| Signal | Weight |
|---|---|
| Query token overlap | ×2.0 |
| Medication → condition match | ×3.0 |
| Tag / name match | ×1.5–2.0 |

Medication-to-condition map translates drug names (e.g., `metformin` → `diabetes`, `low-sugar`) into recipe tag lookups.

### Conversation memory (`main.py`)

Each user has a rolling 10-message history shared across `/chat` and `/voice/transcribe`, so voice and text sessions stay in context.

### Wellness score

```
Score = 70% × (meds_taken / meds_due) + 20% × walk_done + 10% × exercise_done
```

Used on the caregiver dashboard and Home screen summary card.

---

## Caregiver Alerts (`notifications.py`)

| Alert | Trigger | Colour |
|---|---|---|
| Distress | Distress keyword in any message or voice log | Red |
| Missed Medication | Medication >1 hour overdue, not logged | Red |
| Inactivity | No activity logged all day | Amber |
| Daily Summary | End-of-day wellness score card | Green / Amber |

Distress keywords: `pain, fell, fall, dizzy, dizziness, emergency, help, hurt, chest, breathe, breathing, fainted`

All alerts are written to `NotificationLog` and shown on the dashboard even when SMTP is not configured.

---

## Setup

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # fill in your values
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Environment variables (`.env`)

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
WHISPER_URL=http://localhost:8001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_app_password       # Gmail → Security → App Passwords
CAREGIVER_EMAIL=caregiver@example.com
GEMINI_API_KEY=                   # optional fallback
```

### Seed demo data

```bash
python seed.py
```

Creates **Eleanor Marsh** (age 72) with 5 medications and 7 days of realistic activity logs, including skipped doses, a distress entry, and pre-seeded notification history.
