"""
Demo seed script — run once before the presentation to populate sample data.

Usage:
    cd medimate/backend
    python seed.py
"""

import sqlite3
import datetime
import requests

BASE = "http://localhost:8000"

# ── Add demo medications via API ──────────────────────────────────────────────

meds = [
    {"name": "Metformin",  "dose": "500mg",  "times": ["08:00", "20:00"]},
    {"name": "Lisinopril", "dose": "10mg",   "times": ["09:00"]},
    {"name": "Vitamin D",  "dose": "1000IU", "times": ["08:00"]},
]

med_ids = []
for m in meds:
    r = requests.post(f"{BASE}/medications", json={**m, "user_id": "default"})
    med_ids.append(r.json()["id"])
    print(f"Added: {m['name']} → id {r.json()['id']}")

# ── Backfill 5 days of activity directly in SQLite ───────────────────────────

conn = sqlite3.connect("medimate.db")
today = datetime.date.today()

for i in range(1, 6):          # 1-5 days ago
    d = (today - datetime.timedelta(days=i)).isoformat()

    # Morning walk
    conn.execute(
        "INSERT INTO activitylog (type, notes, timestamp, user_id) VALUES (?,?,?,?)",
        ("walk", "25 minutes", f"{d}T09:30:00", "default"),
    )

    # Metformin morning dose
    conn.execute(
        "INSERT INTO activitylog (type, med_id, notes, timestamp, user_id) VALUES (?,?,?,?,?)",
        ("medicine", med_ids[0], "Took Metformin 500mg", f"{d}T08:05:00", "default"),
    )

    # Lisinopril
    conn.execute(
        "INSERT INTO activitylog (type, med_id, notes, timestamp, user_id) VALUES (?,?,?,?,?)",
        ("medicine", med_ids[1], "Took Lisinopril 10mg", f"{d}T09:10:00", "default"),
    )

    # Skip Vitamin D and evening Metformin on day 3 to show a gap in history
    if i != 3:
        conn.execute(
            "INSERT INTO activitylog (type, med_id, notes, timestamp, user_id) VALUES (?,?,?,?,?)",
            ("medicine", med_ids[0], "Took Metformin 500mg", f"{d}T20:05:00", "default"),
        )

conn.commit()
conn.close()

print("\nDemo data seeded successfully.")
print("Medications: Metformin, Lisinopril, Vitamin D")
print("Activity: 5 days of walks + med logs (day 3 has a gap for demo)")
