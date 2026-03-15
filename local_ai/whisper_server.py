"""
whisper_server.py — Local Whisper STT server using faster-whisper.

Hardware: M4 MacBook 16GB
Model:    "base" with int8 quantization (~150MB, <1s per 5-second clip on M4 CPU)

Setup:
  pip install faster-whisper flask

Run:
  python whisper_server.py

Endpoints:
  POST /transcribe   multipart form-data, field name "audio"
  GET  /health       check the server is up
"""

import os
import tempfile
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

app = Flask(__name__)

# ── Load model once at startup ────────────────────────────────────────────────
# "base" is the best balance of speed and accuracy for M4 CPU.
# int8 compute type halves memory use with minimal quality loss.
print("[whisper] Loading model 'base' (int8) — first run downloads ~150MB...")
model = WhisperModel("base", device="cpu", compute_type="int8")
print("[whisper] Model ready.")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "whisper-base-int8"})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file — send as multipart field 'audio'"}), 400

    audio_file = request.files["audio"]
    filename   = audio_file.filename or "audio.m4a"
    suffix     = os.path.splitext(filename)[1] or ".m4a"

    # Save to temp file (faster-whisper needs a file path)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            beam_size=3,           # faster than default 5, good enough for voice commands
            language="en",         # skip language detection — saves ~0.2s
            vad_filter=True,       # skip silent segments
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return jsonify({
            "text":     text,
            "language": info.language,
            "duration": round(info.duration, 1),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp_path)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("[whisper] Starting server on http://0.0.0.0:8001")
    print("[whisper] Test: curl -F 'audio=@test.m4a' http://localhost:8001/transcribe")
    app.run(host="0.0.0.0", port=8001, debug=False)
