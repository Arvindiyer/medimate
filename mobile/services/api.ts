import axios from "axios";
import { getUserId } from "./storage";

// Local dev: your Mac's LAN IP (phone and Mac must be on the same WiFi)
// Find it: ifconfig | grep "inet " | grep -v 127
// Android emulator: use http://10.0.2.2:8000
const BASE_URL = "http://192.168.2.11:8000";

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// ── User management ───────────────────────────────────────────────────────────

export const createUser = (name: string, age?: number, caregiverEmail?: string) =>
  api.post("/users", { name, age, caregiver_email: caregiverEmail });

export const listUsers = () =>
  api.get("/users");

export const getUser = (userId: string) =>
  api.get(`/users/${userId}`);

export const updateUser = (userId: number, name: string, age?: number, caregiverEmail?: string) =>
  api.put(`/users/${userId}`, { name, age, caregiver_email: caregiverEmail });

// ── Medications ───────────────────────────────────────────────────────────────

export const getMedications = () =>
  api.get(`/medications?user_id=${getUserId()}`);

export const addMedication = (data: { name: string; dose: string; times: string[] }) =>
  api.post("/medications", { ...data, user_id: getUserId() });

export const deleteMedication = (id: number) =>
  api.delete(`/medications/${id}`);

// ── Activity logging ──────────────────────────────────────────────────────────

export const logActivity = (type: string, med_id?: number, notes?: string) =>
  api.post("/log", { type, med_id, notes, user_id: getUserId() });

export const getTodayLogs = () =>
  api.get(`/logs/today?user_id=${getUserId()}`);

export const getHistory = (days = 7) =>
  api.get(`/logs/history?user_id=${getUserId()}&days=${days}`);

export const getDueReminders = () =>
  api.get(`/reminders/due?user_id=${getUserId()}`);

// ── AI chat ───────────────────────────────────────────────────────────────────

export const sendChat = (messages: { role: string; content: string }[]) =>
  api.post("/chat", { messages, user_id: getUserId() });

// ── Food recommendations (RAG-powered) ───────────────────────────────────────

export const getFoodRec = () =>
  api.get(`/food-recommendation?user_id=${getUserId()}`);

// ── Voice transcription ───────────────────────────────────────────────────────

export const transcribeVoice = async (audioUri: string): Promise<{
  text: string;
  intent: string;
  med_id?: number;
  med_name?: string;
}> => {
  const formData = new FormData();
  formData.append("audio", {
    uri:  audioUri,
    name: "voice.m4a",
    type: "audio/m4a",
  } as any);

  const resp = await api.post(`/voice/transcribe?user_id=${getUserId()}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 20000,
  });
  return resp.data;
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const runNotifyCheck = () =>
  api.post(`/notify/check?user_id=${getUserId()}`);

export const getNotifyHistory = () =>
  api.get(`/notify/history?user_id=${getUserId()}`);
