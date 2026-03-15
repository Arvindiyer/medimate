# components/

Reusable UI components shared across screens.

---

## `VoiceFAB.tsx`

The core voice interaction component. Renders as a floating action button in the center tab and as a full-screen modal when active.

### Phases

```
idle → recording → processing → result → (loop or close)
```

### Flow

1. User taps the mic button — modal opens, microphone recording starts automatically.
2. Animated waveform (20 bars, staggered CSS delays) plays during recording.
3. User taps **Stop & Transcribe**.
4. Audio (m4a) is POSTed to `POST /voice/transcribe`.
5. Backend returns `{ text, intent, med_id?, med_name? }`.
6. Intent fan-out:

| Intent | Behaviour |
|---|---|
| `log_medication` | Shows detected med name, user confirms, POSTs `/log`, speaks confirmation |
| `log_walk` | Confirms walk, POSTs `/log`, speaks confirmation |
| `log_exercise` | Confirms exercise, POSTs `/log`, speaks confirmation |
| `log_meal` | Confirms meal, POSTs `/log`, speaks confirmation |
| `chat` | Auto-fetches `/chat` reply, speaks it aloud |
| `chat_food` | Fetches `/chat` reply, speaks it, shows "View Recipe Recommendations" button → navigates to NutritionScreen |

7. `expo-speech` reads the reply aloud (rate 0.88, pitch 1.05, first 300 chars).
8. Transcript panel below shows the full session history ("You: …" / "✅ Logged").
9. "Done" phrase detection — if the user says "done", "thanks", "goodbye", "no", "stop" — speaks "Goodbye!" and closes.

### Error handling

If transcription fails or the Whisper server is unreachable, an error state is shown with a **Try Again** button that restarts the recording phase.

---

## `FoodCard.tsx`

Card component used by `NutritionScreen` to render a single recipe recommendation.

**Props received from the API (`/food-recommendation`):**

| Prop | Type | Description |
|---|---|---|
| `emoji` | string | Recipe emoji icon |
| `name` | string | Recipe name |
| `description` | string | Short description |
| `macros` | object | `{ protein, carbs, fats }` in grams |
| `why` | string | Why this recipe suits the user today |

Displays macros as a horizontal row of chips (protein / carbs / fats).

---

## `ProgressRing.tsx`

Circular SVG progress ring used on the Home screen wellness card.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `progress` | number | 0–1 fill level |
| `size` | number | Diameter in px |
| `strokeWidth` | number | Ring thickness |
| `color` | string | Ring colour |

Animates fill on mount using `react-native`'s `Animated` API.
