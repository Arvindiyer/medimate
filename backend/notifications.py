"""
notifications.py — Email alerts to caregivers via Gmail SMTP.

Set these in .env:
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your_gmail@gmail.com
  SMTP_PASS=your_16char_app_password   # Gmail → Security → 2FA → App passwords
"""

import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")


# ── Core email sender ─────────────────────────────────────────────────────────

def send_email(to: str, subject: str, body_html: str) -> bool:
    """
    Send an HTML email. Returns True on success, False on failure.
    Prints a clear error if SMTP credentials are not configured.
    """
    if not SMTP_USER or not SMTP_PASS:
        print("[notify] SMTP not configured — skipping email. Set SMTP_USER and SMTP_PASS in .env")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"MediMate <{SMTP_USER}>"
    msg["To"]      = to
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"[notify] Email sent to {to}: {subject}")
        return True
    except smtplib.SMTPAuthenticationError:
        print("[notify] SMTP auth failed. Check SMTP_USER and SMTP_PASS in .env")
        return False
    except Exception as e:
        print(f"[notify] Email failed: {e}")
        return False


# ── Alert builders ────────────────────────────────────────────────────────────

def _html_wrapper(title: str, body: str, color: str = "#0d9488") -> str:
    return f"""
    <html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;
                box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
      <div style="background:{color};padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:20px;">{title}</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">
          MediMate Health Alert · {datetime.now().strftime("%B %d, %Y %I:%M %p")}
        </p>
      </div>
      <div style="padding:24px;">{body}</div>
      <div style="background:#f1f5f9;padding:12px 24px;font-size:11px;color:#94a3b8;">
        Sent by MediMate — Personal Health Companion
      </div>
    </div>
    </body></html>
    """


def send_missed_med_alert(
    caregiver_email: str, patient_name: str, med_names: list[str]
) -> bool:
    meds_list = "".join(f"<li>{m}</li>" for m in med_names)
    body = f"""
    <p style="font-size:16px;color:#1e293b;">
      <strong>{patient_name}</strong> has missed the following medication(s) today:
    </p>
    <ul style="color:#ef4444;font-size:15px;">{meds_list}</ul>
    <p style="color:#475569;">
      You may want to check in with them to make sure they're okay.
    </p>
    """
    return send_email(
        caregiver_email,
        f"⚠️ {patient_name} missed medication(s)",
        _html_wrapper(f"Missed Medication — {patient_name}", body, color="#ef4444"),
    )


def send_inactivity_alert(caregiver_email: str, patient_name: str) -> bool:
    body = f"""
    <p style="font-size:16px;color:#1e293b;">
      No activity has been logged for <strong>{patient_name}</strong> today.
    </p>
    <p style="color:#475569;">
      They haven't recorded any medications, meals, or exercise.
      It may be worth giving them a call to check in.
    </p>
    """
    return send_email(
        caregiver_email,
        f"📋 No activity logged for {patient_name} today",
        _html_wrapper(f"Inactivity Alert — {patient_name}", body, color="#f59e0b"),
    )


def send_distress_alert(
    caregiver_email: str, patient_name: str, message: str
) -> bool:
    body = f"""
    <p style="font-size:16px;color:#1e293b;">
      <strong>{patient_name}</strong> may need attention.
      Their recent message contained concerning keywords:
    </p>
    <blockquote style="border-left:4px solid #ef4444;padding:12px 16px;
                        background:#fef2f2;color:#7f1d1d;font-style:italic;border-radius:4px;">
      "{message}"
    </blockquote>
    <p style="color:#475569;">
      Please reach out to them as soon as possible.
    </p>
    """
    return send_email(
        caregiver_email,
        f"🚨 {patient_name} may need attention",
        _html_wrapper(f"Urgent Alert — {patient_name}", body, color="#dc2626"),
    )


def send_daily_summary(
    caregiver_email: str,
    patient_name: str,
    wellness_score: int,
    meds_taken: int,
    meds_total: int,
    activity_count: int,
) -> bool:
    score_color = "#16a34a" if wellness_score >= 70 else "#f59e0b" if wellness_score >= 40 else "#dc2626"
    body = f"""
    <p style="font-size:15px;color:#1e293b;">Here's <strong>{patient_name}</strong>'s daily summary:</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:12px 0;">
      <p style="margin:6px 0;color:#475569;">
        🎯 <strong>Wellness Score:</strong>
        <span style="color:{score_color};font-size:18px;font-weight:700;">{wellness_score}%</span>
      </p>
      <p style="margin:6px 0;color:#475569;">
        💊 <strong>Medications taken:</strong> {meds_taken} of {meds_total}
      </p>
      <p style="margin:6px 0;color:#475569;">
        📝 <strong>Activities logged:</strong> {activity_count}
      </p>
    </div>
    {"<p style='color:#16a34a'>✅ Great day overall!</p>" if wellness_score >= 70
     else "<p style='color:#f59e0b'>⚠️ Could use some encouragement tomorrow.</p>"}
    """
    return send_email(
        caregiver_email,
        f"📊 {patient_name}'s daily health summary",
        _html_wrapper(f"Daily Summary — {patient_name}", body),
    )


# ── Smart check — called after each activity log ─────────────────────────────

def check_and_notify(user_id: str, import_db=None) -> list[str]:
    """
    Analyse the user's current state and send alerts if needed.
    Returns list of alert types that were triggered.

    Imported lazily to avoid circular import with db.py.
    """
    import db as _db
    if import_db:
        _db = import_db

    user = _db.get_user(user_id)
    if not user or not user.caregiver_email:
        return []

    triggered = []

    # Check for missed medications (overdue by more than 1 hour)
    overdue = _db.get_overdue_meds(user_id)
    if overdue:
        med_names = list({o["name"] for o in overdue})
        sent = send_missed_med_alert(user.caregiver_email, user.name, med_names)
        if sent:
            _db.log_notification(
                user_id, "missed_med",
                f"Missed: {', '.join(med_names)}",
                user.caregiver_email,
            )
            triggered.append("missed_med")

    # Check for full-day inactivity
    today_logs = _db.get_today_logs(user_id)
    if not today_logs:
        sent = send_inactivity_alert(user.caregiver_email, user.name)
        if sent:
            _db.log_notification(
                user_id, "inactivity",
                "No activity logged today",
                user.caregiver_email,
            )
            triggered.append("inactivity")

    return triggered
