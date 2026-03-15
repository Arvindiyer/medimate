# screens/

One file per screen. All screens receive navigation props from React Navigation and pull user session from `services/storage.ts`.

---

## Screen Index

### `HomeScreen.tsx`

Entry point after onboarding. Shows a snapshot of the user's health day.

- Time-based greeting (Good Morning / Afternoon / Evening)
- Gradient wellness card — adherence %, status chips (On Track · Walk Due · Meds Left)
- Voice CTA card with mic icon — opens VoiceModal via `VoiceContext`
- List of overdue medications (top 3) with a one-tap "Log" button
- "All done" celebration state when all medications are taken

---

### `TimelineScreen.tsx`

Full task list for the day — every medication at every scheduled time, plus fixed walk (10:00) and stretching (14:00) tasks.

- Task status computed at render time against current clock and today's logs:
  - `taken` — logged today ✓
  - `missed` — scheduled time passed, not logged (shown in red)
  - `due` — scheduled within the next 30 minutes (highlighted)
  - `upcoming` — scheduled later today
- Action buttons: Mark Done / Log Now / (checkmark if taken)

---

### `ChatScreen.tsx`

Text-based multi-turn conversation with the MediMate AI.

- Opening message: "Hi! I'm MediMate 👋 Ask me about medications, food, health routine."
- User bubbles (teal), assistant bubbles (white with shadow)
- Sends to `POST /chat` via `api.ts`, maintains local conversation state
- Keyboard-aware scroll to latest message

---

### `NutritionScreen.tsx`

RAG-powered recipe recommendations personalised to the user's medications and today's activity. Not in the tab bar — reached via voice ("What should I eat?") or explicit navigation.

- AI context box explaining why these recipes were chosen
- `FoodCard` components for each recipe (emoji, name, description, macros, why it's good)
- Pull-to-refresh to regenerate recommendations
- Hardcoded fallback recipes if the API call fails

---

### `ProfileScreen.tsx`

User profile, medication management, and adherence history.

- User initials avatar, name, age
- Active medications list — swipe or tap delete icon to remove
- Add medication form: name, dose, times (comma-separated, e.g. `08:00,20:00`)
- 7-day adherence stats (% of expected doses taken)
- Activity log history grouped by date
- Walk reminder time picker — schedules a local push notification

---

### `OnboardingScreen.tsx`

Shown only on first launch (no stored user session).

- Option 1: **Select Existing User** — pick from users in the DB (e.g., Eleanor Marsh demo)
- Option 2: **Create New User** — enter name, age, caregiver email

Stores the selected `user_id` via `services/storage.ts` and navigates to the main tab navigator.

---

### `SetupScreen.tsx`

Optional post-onboarding step to add initial medications before entering the main app.

---

### `LogScreen.tsx`

Manual activity log entry form (type, notes, optional timestamp). Used when the user wants to log something without going through voice.

---

### `HistoryScreen.tsx`

Full scrollable activity log history, grouped by date with type icons and notes.
