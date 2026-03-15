# MediMate — Voice-First Personal Health Companion

> Built for **GenAI Genesis 2026 Hackathon**
> A private, voice-first AI assistant for medication management, meal guidance, and caregiver awareness — all running locally on your own hardware.

---

## What Is MediMate?

MediMate is a personal health assistant that helps anyone who takes daily medications stay on track — through **voice conversation**, **personalized recipe suggestions**, and **automatic caregiver alerts** when something seems wrong.

It is **not just a senior care app**. MediMate scales to any user who benefits from medication reminders and health coaching:

| Who | How MediMate helps |
|---|---|
| Elderly users | Voice reminders, caregiver dashboard, distress detection |
| Young adults with chronic conditions | Diabetes, ADHD, asthma — same voice + log workflow |
| Busy professionals | Supplement and wellness routine tracking via quick voice logs |
| Parents managing kids' medications | Log by voice, share summary with pediatrician |
| Post-surgery recovery patients | Short-term adherence tracking with caregiver visibility |
| Caregivers & family | Real-time alerts, daily summaries, web dashboard |

### Core Principles

- **Privacy first** — Every model (LLaMA, Whisper) and every data file (recipes, logs) runs on your own machine. Nothing is sent to any cloud.
- **Voice first** — Speak to the app. It transcribes, understands intent, and speaks back.
- **Open source** — LLaMA 3.2 via Ollama, OpenAI Whisper locally, FastAPI, React Native (Expo).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                     │
│  HomeScreen · TimelineScreen · ChatScreen · Profile      │
│  VoiceModal (expo-audio) ──► expo-speech (TTS response) │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP (LAN WiFi)
┌────────────────────▼─────────────────────────────────────┐
│               FastAPI Backend (Python)                    │
│  /chat  /log  /voice/transcribe  /food-recommendation    │
│  /dashboard (Jinja2 HTML for caregiver)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  llm.py      │  │  rag.py      │  │notifications  │  │
│  │  Ollama API  │  │  recipes.json│  │  Gmail SMTP   │  │
│  │  (llama3.2)  │  │  RAG search  │  │  auto-alerts  │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│  SQLite (medimate.db) — User, Medication, ActivityLog     │
└────────────────────┬─────────────────────────────────────┘
                     │ localhost:8001
┌────────────────────▼─────────────────────────────────────┐
│            Whisper STT Server (Python)                    │
│  faster-whisper · base model · int8 · audio → text       │
└──────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo SDK 55), TypeScript |
| Voice in | expo-audio → faster-Whisper (local STT, int8) |
| Voice out | expo-speech (TTS) |
| AI chat | LLaMA 3.2:3b via Ollama · Gemini 2.5 Flash (fallback) |
| Recipe RAG | Custom keyword + condition scoring over recipes.json |
| Backend | FastAPI + SQLModel (SQLite) |
| Notifications | Gmail SMTP (HTML email to caregiver) |
| Dashboard | Server-rendered Jinja2 HTML |

---

## Prerequisites

Install these before the setup steps:

1. **Ollama** — https://ollama.com — runs LLaMA locally
2. **Python 3.11+** — https://python.org
3. **Node.js 18+** — https://nodejs.org
4. **Expo Go** — install on your phone from the App Store / Play Store
5. **Git** — to clone the repo

---

## Environment Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd medimate
```

### 2. Pull the LLaMA model

```bash
ollama pull llama3.2:3b
ollama serve          # keep this running in a terminal
```

### 3. Set up the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy the env template and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# LLM (Ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Whisper STT server
WHISPER_URL=http://localhost:8001

# Optional: Gmail SMTP for caregiver email alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16char_app_password   # Gmail → Security → 2-Step → App Passwords

# Optional: caregiver email used in demo seed data
CAREGIVER_EMAIL=caregiver@example.com

# Optional: Gemini fallback (if Ollama is unavailable)
GEMINI_API_KEY=
```

### 4. Start the Whisper STT server

In a new terminal:

```bash
pip install faster-whisper flask
python local_ai/whisper_server.py
# Runs on http://localhost:8001
```

### 5. Start the FastAPI backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# Runs on http://0.0.0.0:8000
```

### 6. Seed demo data (Eleanor Marsh)

With the backend running:

```bash
cd backend
python seed.py
```

This creates **Eleanor Marsh** (age 72) with 5 medications and 7 days of realistic activity logs including skipped doses and a distress alert. Note the **user ID** printed — you will select Eleanor in the app's onboarding screen.

### 7. Set up the mobile app

Find your Mac's local IP (phone and Mac must be on the **same WiFi network**):

```bash
ifconfig | grep "inet " | grep -v 127
# e.g. 192.168.1.42
```

Edit `mobile/services/api.ts` and update `BASE_URL`:

```typescript
const BASE_URL = "http://192.168.1.42:8000";  // ← your Mac's IP
```

Install dependencies and start:

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

---

## Running the Demo

### Onboarding

On first launch, tap **"Select Existing User"** and choose **Eleanor Marsh**.

### Feature walkthrough

| Step | Action | What you see |
|---|---|---|
| 1 | Home screen | Eleanor's pending meds, wellness score, today's activity |
| 2 | Tap mic → say *"Did I take my Metformin?"* | Transcribed, AI responds in context, **response spoken aloud** |
| 3 | Tap mic → say *"What should I eat for lunch?"* | App auto-navigates to Recipes tab, speaks intro |
| 4 | Chat → type *"I'm feeling a bit dizzy"* | AI responds with care; caregiver email sent if SMTP configured |
| 5 | Browser → `http://localhost:8000/dashboard?user_id=<id>` | Red alert banner for distress entries, full alert history |
| 6 | Profile tab | Eleanor Marsh, 72, 5 meds, 7-day adherence percentage |

---

## How the AI Works

### Voice pipeline (voice-to-voice)

```
User speaks
  → expo-audio records audio
  → POST /voice/transcribe → Whisper STT → plain text
  → Intent detection (keyword matching)
  → For chat intents: POST /chat → LLaMA 3.2 → reply text
  → expo-speech reads the reply aloud
```

### Chat with context memory

Every `/chat` request:
1. Builds health context (user's meds + today's logs)
2. Runs keyword/condition search over `recipes.json` (RAG)
3. Injects top-3 matching recipes into the system prompt
4. Calls Ollama (LLaMA 3.2) — reply capped at 3–5 sentences
5. Updates a rolling 10-message server-side conversation memory per user

### Distress detection

Keywords: `pain`, `fell`, `fall`, `dizzy`, `help`, `hurt`, `chest`, `breathe`, `fainted`

Checked on every chat message and voice transcription. On match:
- Immediate caregiver email sent (HTML alert)
- `NotificationLog` entry created (even if email fails)
- Red alert banner appears on caregiver dashboard

### Recipe RAG

`rag.py` scores each recipe by:
- Query token overlap (weight 2.0×)
- Health condition match via medication→condition map (weight 3.0×)
- Tag / name / description match

Top-3 recipes are formatted and injected into the LLM system prompt.

### Gemini fallback

If Ollama is unreachable and `GEMINI_API_KEY` is set, all LLM calls automatically fall back to Gemini 2.5 Flash. No code changes needed.

---

## Privacy & Local-First Design

MediMate was built with the belief that health data should never leave your device without your explicit consent:

- **LLaMA runs on your Mac** via Ollama — no calls to OpenAI or Anthropic
- **Whisper runs locally** — your voice audio is never uploaded anywhere
- **Recipes are a local JSON file** — no external food API queries
- **SQLite** stores all logs on disk — no cloud database
- **Email alerts** only fire if you configure SMTP; otherwise everything stays local

---

## Future Ideas

- **Wearable integration** — Apple Watch / Fitbit heart rate + step data logged automatically
- **Multi-user family mode** — one caregiver dashboard for multiple family members
- **Medication refill reminders** — count remaining pills, alert when running low
- **Offline-first mobile** — full AsyncStorage sync so the app works without WiFi
- **Multi-language support** — Whisper already handles 99 languages; add UI localisation
- **Pediatric mode** — simplified voice UI for parents logging children's medications
- **Mood tracking** — detect emotional trends over time, surface to caregiver gently
- **Pharmacy integration** — auto-import prescriptions via QR code or label photo

---

## Project Structure

```
medimate/
├── backend/
│   ├── main.py             # FastAPI routes + conversation memory
│   ├── db.py               # SQLModel schema + queries
│   ├── llm.py              # Ollama / Gemini LLM integration
│   ├── rag.py              # Recipe retrieval (keyword + condition scoring)
│   ├── notifications.py    # Gmail SMTP caregiver alerts
│   ├── seed.py             # Demo data — Eleanor Marsh (72)
│   ├── data/
│   │   └── recipes.json    # ~30 curated health-linked recipes with macros + conditions
│   └── templates/
│       └── dashboard.html  # Caregiver web dashboard
├── mobile/
│   ├── App.tsx             # Navigation + voice modal + nav ref
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── TimelineScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   ├── ProfileScreen.tsx   # Real user data + adherence stats
│   │   └── NutritionScreen.tsx # RAG-powered recipe view
│   ├── components/
│   │   └── VoiceFAB.tsx    # Voice modal + TTS + recipe navigation
│   └── services/
│       ├── api.ts          # Axios HTTP client
│       └── storage.ts      # In-memory session
└── local_ai/
    └── whisper_server.py   # Flask STT server (faster-whisper base, int8, port 8001)
```

---

*Made with care & ❤️ for GenAI Genesis 2026 (https://genaigenesis.ca/)*
