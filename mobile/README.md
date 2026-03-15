# mobile/

React Native (Expo) application for MediMate. Runs on iOS and Android via Expo Go.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Language | TypeScript |
| Navigation | React Navigation v7 (bottom tabs) |
| Voice in | expo-audio (recording) → backend Whisper STT |
| Voice out | expo-speech (TTS) |
| HTTP client | Axios |
| Icons | react-native-svg (custom SVG paths) |
| Gradients | expo-linear-gradient |
| Blur | expo-blur (iOS tab bar) |
| Notifications | expo-notifications (local push) |

---

## Key Files

| File | Purpose |
|---|---|
| `App.tsx` | Root component — tab navigator, VoiceModal, nav ref |
| `VoiceContext.ts` | React context that exposes `openVoice()` to all screens |
| `theme.ts` | Shared colours, spacing, typography constants |
| `notifications.ts` | Schedules local push notifications for medication times |
| `index.ts` | Expo entry point |
| `app.json` | Expo config (name, slug, permissions) |

---

## Navigation Structure

```
Tab Navigator
├── Home          — HomeScreen.tsx
├── Timeline      — TimelineScreen.tsx
├── Voice (FAB)   — opens VoiceModal (not a screen)
├── Chat          — ChatScreen.tsx
└── Profile       — ProfileScreen.tsx

Hidden from tab bar (navigated via voice intent):
└── Nutrition     — NutritionScreen.tsx
```

Other screens (used during onboarding / setup):

- `OnboardingScreen.tsx` — select or create a user on first launch
- `SetupScreen.tsx` — add medications during initial setup
- `LogScreen.tsx` — manual activity log entry
- `HistoryScreen.tsx` — full activity log history

---

## Folders

| Folder | Contents |
|---|---|
| `screens/` | One file per screen — see [screens/README.md](screens/README.md) |
| `components/` | Reusable UI components — see [components/README.md](components/README.md) |
| `services/` | API client and session storage — see [services/README.md](services/README.md) |
| `assets/` | App icon, splash image |

---

## Setup

The phone and the Mac running the backend **must be on the same WiFi network**.

1. Find your Mac's local IP:
   ```bash
   ifconfig | grep "inet " | grep -v 127
   # e.g. 192.168.1.42
   ```

2. Update `services/api.ts`:
   ```typescript
   const BASE_URL = "http://192.168.1.42:8000";
   ```

3. Install dependencies and start:
   ```bash
   npm install
   npx expo start
   ```

4. Scan the QR code with **Expo Go** on your phone.

---

## Permissions Required

| Permission | Reason |
|---|---|
| Microphone | Voice recording via expo-audio |
| Notifications | Local medication reminders |

Both are requested at runtime on first use.
