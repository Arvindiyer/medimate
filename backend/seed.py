"""
Demo seed script — run ONCE before the presentation to populate Eleanor's data.

Usage:
    cd medimate/backend
    # Backend must be running first: uvicorn main:app --reload
    python seed.py

Env (optional — set in .env):
    CAREGIVER_EMAIL=your_caregiver@email.com
"""

import sqlite3
import datetime
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BASE = "http://localhost:8000"
CAREGIVER_EMAIL = os.getenv("CAREGIVER_EMAIL", "caregiver@example.com")


def seed():
    print("=" * 52)
    print("  MediMate Demo Seed — Eleanor Marsh")
    print("=" * 52)

    # ── 1. Create demo user ───────────────────────────────────────────────────
    print("\n[1/4] Creating user Eleanor Marsh...")
    r = requests.post(f"{BASE}/users", json={
        "name": "Eleanor Marsh",
        "age": 72,
        "caregiver_email": CAREGIVER_EMAIL,
    })
    if r.status_code not in (200, 201):
        print(f"  ✗ Error: {r.status_code} — {r.text}")
        print("  Make sure the backend is running: uvicorn main:app --reload")
        sys.exit(1)
    user_id = str(r.json()["id"])
    print(f"  ✓ User created — id={user_id}, caregiver={CAREGIVER_EMAIL}")

    # ── 2. Add medications ────────────────────────────────────────────────────
    print("\n[2/4] Adding 5 medications...")
    meds_data = [
        {"name": "Metformin",    "dose": "500mg",  "times": ["08:00", "20:00"]},
        {"name": "Lisinopril",   "dose": "10mg",   "times": ["09:00"]},
        {"name": "Atorvastatin", "dose": "20mg",   "times": ["21:00"]},
        {"name": "Aspirin",      "dose": "81mg",   "times": ["08:00"]},
        {"name": "Vitamin D3",   "dose": "1000IU", "times": ["08:00"]},
    ]
    med_ids: dict[str, int] = {}
    for m in meds_data:
        r = requests.post(f"{BASE}/medications", json={**m, "user_id": user_id})
        mid = r.json()["id"]
        med_ids[m["name"]] = mid
        print(f"  ✓ {m['name']} {m['dose']} → id={mid}")

    # ── 3. Backfill 7 days of activity logs ──────────────────────────────────
    print("\n[3/4] Seeding 7 days of activity logs...")
    conn = sqlite3.connect("medimate.db")
    today = datetime.date.today()

    def log(day_offset: int, log_type: str, med_name: str | None, time_str: str, notes: str):
        d = (today - datetime.timedelta(days=day_offset)).isoformat()
        mid = med_ids.get(med_name) if med_name else None
        conn.execute(
            "INSERT INTO activitylog (type, med_id, notes, timestamp, user_id) VALUES (?,?,?,?,?)",
            (log_type, mid, notes, f"{d}T{time_str}:00", user_id),
        )

    # ── Day 7 — all meds taken, great day ────────────────────────────────────
    log(7, "medicine", "Metformin",    "08:05", "Took Metformin with breakfast")
    log(7, "medicine", "Lisinopril",   "09:10", "Took Lisinopril")
    log(7, "medicine", "Aspirin",      "08:05", "Took Aspirin")
    log(7, "medicine", "Vitamin D3",   "08:05", "Took Vitamin D with orange juice")
    log(7, "medicine", "Atorvastatin", "21:10", "Took Atorvastatin before bed")
    log(7, "walk",     None,           "09:30", "30 minute morning walk, feeling great")

    # ── Day 6 — all meds taken, normal day ───────────────────────────────────
    log(6, "medicine", "Metformin",    "08:10", "Took with oatmeal")
    log(6, "medicine", "Lisinopril",   "09:15", "Took Lisinopril on time")
    log(6, "medicine", "Aspirin",      "08:10", "Aspirin taken as usual")
    log(6, "medicine", "Vitamin D3",   "08:10", "Took Vitamin D")
    log(6, "medicine", "Atorvastatin", "21:05", "Atorvastatin before bed")
    log(6, "walk",     None,           "10:00", "20 min walk around the block")

    # ── Day 5 — all meds taken, normal day ───────────────────────────────────
    log(5, "medicine", "Metformin",    "08:05", "Took morning Metformin")
    log(5, "medicine", "Lisinopril",   "09:20", "Lisinopril taken")
    log(5, "medicine", "Aspirin",      "08:05", "Took Aspirin")
    log(5, "medicine", "Vitamin D3",   "08:05", "Vitamin D3 taken")
    log(5, "medicine", "Atorvastatin", "21:00", "Took Atorvastatin")
    log(5, "walk",     None,           "09:45", "25 minute walk, nice weather")

    # ── Day 4 — Aspirin missed, borderline note (low mood) → amber alert ─────
    log(4, "medicine", "Metformin",    "08:30", "Feeling a bit low today, not much energy")
    log(4, "medicine", "Lisinopril",   "09:15", "Took Lisinopril")
    # Aspirin SKIPPED — no log entry
    log(4, "medicine", "Vitamin D3",   "08:30", "Took Vitamin D")
    log(4, "medicine", "Atorvastatin", "21:15", "Took Atorvastatin")
    log(4, "walk",     None,           "10:30", "Short walk, felt tired and sluggish")

    # ── Day 3 — distress keyword: dizzy → 🚨 red alert ───────────────────────
    log(3, "medicine", "Metformin",    "08:10", "Took Metformin")
    log(3, "medicine", "Lisinopril",   "09:10", "Took Lisinopril")
    log(3, "medicine", "Aspirin",      "08:10", "Took Aspirin")
    log(3, "medicine", "Vitamin D3",   "08:10", "Took Vitamin D3")
    log(3, "medicine", "Atorvastatin", "21:05", "Took Atorvastatin")
    log(3, "walk",     None,           "09:30", "A little dizzy after morning walk, had to sit down")

    # ── Day 2 — Lisinopril missed, Atorvastatin taken late ───────────────────
    log(2, "medicine", "Metformin",    "08:15", "Took Metformin with breakfast")
    # Lisinopril SKIPPED — no log entry
    log(2, "medicine", "Aspirin",      "08:15", "Took Aspirin")
    log(2, "medicine", "Vitamin D3",   "08:15", "Took Vitamin D3")
    log(2, "medicine", "Atorvastatin", "22:30", "Forgot earlier, took it late tonight")
    log(2, "walk",     None,           "11:00", "Longer walk today, feeling better")

    # ── Day 1 (yesterday) — all taken, good day ───────────────────────────────
    log(1, "medicine", "Metformin",    "08:05", "Took Metformin")
    log(1, "medicine", "Lisinopril",   "09:10", "Took Lisinopril")
    log(1, "medicine", "Aspirin",      "08:05", "Took Aspirin")
    log(1, "medicine", "Vitamin D3",   "08:05", "Took Vitamin D3")
    log(1, "medicine", "Atorvastatin", "21:10", "Took Atorvastatin")
    log(1, "walk",     None,           "09:30", "Morning walk felt good")
    log(1, "meal",     None,           "12:30", "Had the grilled salmon recipe from the app — delicious!")

    # ── Today — morning meds taken, evening still pending ────────────────────
    log(0, "medicine", "Metformin",    "08:05", "Took morning Metformin")
    log(0, "medicine", "Lisinopril",   "09:05", "Took Lisinopril")
    log(0, "medicine", "Aspirin",      "08:05", "Took Aspirin")
    log(0, "medicine", "Vitamin D3",   "08:05", "Took Vitamin D3")
    # Atorvastatin (21:00) + evening Metformin (20:00) still pending

    conn.commit()
    conn.close()
    print("  ✓ 7 days + today seeded")

    # ── 4. Seed notification log entries for dashboard ────────────────────────
    print("\n[4/4] Seeding notification history for dashboard...")
    day4_str = (today - datetime.timedelta(days=4)).isoformat()
    day3_str = (today - datetime.timedelta(days=3)).isoformat()
    day2_str = (today - datetime.timedelta(days=2)).isoformat()

    conn = sqlite3.connect("medimate.db")
    conn.execute(
        "INSERT INTO notificationlog (user_id, alert_type, message, sent_to, timestamp) VALUES (?,?,?,?,?)",
        (user_id, "missed_med",
         "Eleanor Marsh missed: Aspirin (scheduled 08:00)",
         CAREGIVER_EMAIL,
         f"{day4_str}T18:00:00"),
    )
    conn.execute(
        "INSERT INTO notificationlog (user_id, alert_type, message, sent_to, timestamp) VALUES (?,?,?,?,?)",
        (user_id, "distress",
         "A little dizzy after morning walk, had to sit down",
         CAREGIVER_EMAIL,
         f"{day3_str}T09:35:00"),
    )
    conn.execute(
        "INSERT INTO notificationlog (user_id, alert_type, message, sent_to, timestamp) VALUES (?,?,?,?,?)",
        (user_id, "missed_med",
         "Eleanor Marsh missed: Lisinopril (scheduled 09:00)",
         CAREGIVER_EMAIL,
         f"{day2_str}T18:00:00"),
    )
    conn.commit()
    conn.close()
    print("  ✓ Distress alert (day 3) + missed med alerts (days 4 & 2) seeded")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 52)
    print("  ✅  Seed complete!")
    print("=" * 52)
    print(f"  User:          Eleanor Marsh, age 72")
    print(f"  User ID:       {user_id}")
    print(f"  Caregiver:     {CAREGIVER_EMAIL}")
    print(f"  Medications:   Metformin, Lisinopril, Atorvastatin,")
    print(f"                 Aspirin, Vitamin D3")
    print(f"  Log days:      7 days + today")
    print(f"  Alert events:")
    print(f"    Day 4 → 🟡 Aspirin missed + low mood note")
    print(f"    Day 3 → 🔴 Distress (dizzy after walk)")
    print(f"    Day 2 → 🟡 Lisinopril missed")
    print()
    print(f"  Next steps:")
    print(f"    1. In app: tap 'Select Existing User' → choose Eleanor")
    print(f"    2. Dashboard: http://localhost:8000/dashboard?user_id={user_id}")
    print("=" * 52)


if __name__ == "__main__":
    seed()
