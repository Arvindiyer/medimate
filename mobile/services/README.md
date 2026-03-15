# services/

Thin layer between the React Native screens and the MediMate backend.

---

## `api.ts`

Axios HTTP client. All screens import their API calls from here — no raw `fetch` or `axios` calls elsewhere.

### Configuration

```typescript
const BASE_URL = "http://<your-mac-ip>:8000";
```

Update this to your Mac's local IP before running on a physical device (see [mobile/README.md](../README.md)).

### Exported functions

| Function | Method + Path | Purpose |
|---|---|---|
| `getUsers()` | `GET /users` | List all users |
| `createUser(data)` | `POST /users` | Create a new user |
| `getMedications(userId)` | `GET /medications/{userId}` | List medications |
| `addMedication(data)` | `POST /medications` | Add a medication |
| `deleteMedication(medId)` | `DELETE /medications/{medId}` | Remove a medication |
| `logActivity(data)` | `POST /log` | Log an activity event |
| `getTodayLogs(userId)` | `GET /logs/today` | Today's activity logs |
| `getHistory(userId)` | `GET /logs/history` | Full log history |
| `getDueReminders(userId)` | `GET /reminders/due` | Overdue medications |
| `sendChat(userId, message)` | `POST /chat` | Send a chat message |
| `transcribeVoice(audioFile)` | `POST /voice/transcribe` | Upload audio, get intent |
| `getFoodRecommendation(userId)` | `GET /food-recommendation` | Recipe recommendations |

All functions are `async` and return the `response.data` field directly. Errors propagate as thrown exceptions — callers wrap in try/catch.

---

## `storage.ts`

Lightweight in-memory session store for the current user.

Holds:

| Key | Type | Description |
|---|---|---|
| `userId` | `number \| null` | Currently selected user ID |
| `userName` | `string \| null` | Display name for greeting |

Functions:

| Function | Description |
|---|---|
| `setUser(id, name)` | Store session after onboarding |
| `getUser()` | Read current session |
| `clearUser()` | Clear session (logout / switch user) |

This is intentionally simple (no AsyncStorage / persistence) — the user selects their profile on each app launch during the hackathon demo. Persistent storage is listed as a future improvement.
