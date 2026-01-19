export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

const STORAGE_KEY = "daily-mood-auth-user";
export const AUTH_EVENT_NAME = "mood-auth-change";

const emitAuthChange = (user: AuthUser | null) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthUser | null>(AUTH_EVENT_NAME, { detail: user }));
};

export function saveAuthUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  emitAuthChange(user);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch (error) {
    console.error("Failed to parse auth user from storage", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearAuthUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitAuthChange(null);
}
