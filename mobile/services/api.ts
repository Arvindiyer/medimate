import axios from "axios";

// Local dev: your Mac's LAN IP (not localhost — phone can't reach localhost)
// Find it with: ifconfig | grep "inet " | grep -v 127
// Production: swap to your DigitalOcean droplet IP
// Real phone: use your Mac's LAN IP (phone and Mac must be on the same WiFi)
// Android emulator: change this to http://10.0.2.2:8000
const BASE_URL = "http://192.168.2.11:8000";

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });
const USER_ID = "default";

export const getMedications   = () => api.get(`/medications?user_id=${USER_ID}`);
export const addMedication    = (data: { name: string; dose: string; times: string[] }) =>
  api.post("/medications", { ...data, user_id: USER_ID });
export const deleteMedication = (id: number) => api.delete(`/medications/${id}`);

export const logActivity      = (type: string, med_id?: number, notes?: string) =>
  api.post("/log", { type, med_id, notes, user_id: USER_ID });

export const getTodayLogs     = () => api.get(`/logs/today?user_id=${USER_ID}`);
export const getHistory       = (days = 7) => api.get(`/logs/history?user_id=${USER_ID}&days=${days}`);
export const getDueReminders  = () => api.get(`/reminders/due?user_id=${USER_ID}`);

export const sendChat         = (messages: { role: string; content: string }[]) =>
  api.post("/chat", { messages, user_id: USER_ID });

export const getFoodRec       = () => api.get(`/food-recommendation?user_id=${USER_ID}`);
