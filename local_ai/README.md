# local_ai/

Local speech-to-text server that runs OpenAI Whisper entirely on-device. No audio ever leaves the machine.

---

## Files

| File | Purpose |
|---|---|
| `whisper_server.py` | Flask HTTP server exposing a `/transcribe` endpoint |

---

## How It Works

Uses **faster-whisper** (CTranslate2 backend) with the `base` model and `int8` quantization. On an M4 Mac this transcribes a 5-second audio clip in under 1 second.

```
Mobile app records audio (m4a)
  → POST /transcribe (multipart form-data, field: "audio")
  → faster-whisper decodes audio
  → Returns {text, language, duration}
  → FastAPI backend receives text, detects intent
```

### Optimisations applied

| Setting | Value | Reason |
|---|---|---|
| Model | `base` | ~150 MB, fast on CPU |
| Quantization | `int8` | Halves memory, minimal quality loss |
| `beam_size` | 3 | Faster than default 5 |
| `language` | `en` | Skips language detection pass |
| `vad_filter` | `True` | Trims leading/trailing silence |

---

## Endpoints

### `POST /transcribe`

Accepts audio via multipart form-data.

**Request**
```
Content-Type: multipart/form-data
Field: audio — audio file (m4a, wav, or mp3)
```

**Response**
```json
{
  "text": "I took my metformin this morning",
  "language": "en",
  "duration": 2.4
}
```

### `GET /health`

Returns `{"status": "ok"}` — used by the backend to check if Whisper is reachable before forwarding audio.

---

## Setup

```bash
pip install faster-whisper flask
python whisper_server.py
# Server starts on http://localhost:8001
```

The model (~150 MB) is downloaded automatically on first run and cached in `~/.cache/huggingface/`.

---

## Privacy

- Audio is processed entirely in-memory on the local machine.
- No data is sent to any external service.
- The Flask server binds to `127.0.0.1` by default — not accessible outside the host machine.
