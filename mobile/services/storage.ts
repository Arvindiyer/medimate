/**
 * storage.ts — Simple in-memory user session store.
 *
 * For POC: persists for the app session. In production, swap the backing
 * store to AsyncStorage or expo-secure-store.
 */

let _userId: string = "default";
let _userName: string = "";
let _caregiverEmail: string = "";

export const setUser = (id: string | number, name: string, caregiverEmail = "") => {
  _userId        = String(id);
  _userName      = name;
  _caregiverEmail = caregiverEmail;
};

export const getUserId       = (): string => _userId;
export const getUserName     = (): string => _userName;
export const getCaregiverEmail = (): string => _caregiverEmail;
export const isLoggedIn      = (): boolean => _userId !== "default" && _userName !== "";
