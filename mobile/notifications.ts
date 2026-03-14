// expo-notifications remote push was removed from Expo Go SDK 53+.
// These are no-ops for the Expo Go / emulator demo.
// In a production build (npx expo build), swap these back to real implementations.

export async function registerForPushNotifications() {
  return null;
}

export async function scheduleMedReminder(_medName: string, _time: string, _medId: number) {
  return;
}

export async function scheduleWalkReminder(_hour = 10, _minute = 0) {
  return;
}

export async function cancelAllReminders() {
  return;
}
