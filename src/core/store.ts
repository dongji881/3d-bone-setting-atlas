import { useSyncExternalStore } from "react";

export type ContentMode = "public" | "pro";

export interface Settings {
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt: string | null;
  mode: ContentMode;
  elderMode: boolean;
  theme: "dark" | "light";
  favorites: string[];
  offlineEnabled: boolean;
  offlineReady: boolean;
  lastRegion: string | null;
}

const KEY = "zgxt.settings.v1";

const DEFAULTS: Settings = {
  disclaimerAccepted: false,
  disclaimerAcceptedAt: null,
  mode: "public",
  elderMode: false,
  theme: "dark",
  favorites: [],
  offlineEnabled: false,
  offlineReady: false,
  lastRegion: null,
};

function read(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

let state: Settings = read();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — keep in-memory state */
  }
}

export function getSettings(): Settings {
  return state;
}

export function setSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function toggleFavorite(id: string): boolean {
  const has = state.favorites.includes(id);
  const favorites = has ? state.favorites.filter((f) => f !== id) : [...state.favorites, id];
  setSettings({ favorites });
  return !has;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/* ------------------------------------------------------------------ */
/* toasts                                                              */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: number;
  text: string;
}

let toastSeq = 0;
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();

export function toast(text: string): void {
  const item = { id: ++toastSeq, text };
  toasts = [...toasts, item];
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    toastListeners.forEach((l) => l());
  }, 2600);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}

/* ------------------------------------------------------------------ */
/* tiny hash router                                                    */
/* ------------------------------------------------------------------ */

export function currentRoute(): string {
  if (typeof window === "undefined") return "/";
  // 粘贴 URL 时容易带尾随空格（会被编码进 hash），统一去掉
  return window.location.hash.replace(/^#/, "").trim() || "/";
}

export function navigate(path: string): void {
  if (currentRoute() === path) return;
  window.location.hash = path;
}

export function useRoute(): string {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener("hashchange", l);
      return () => window.removeEventListener("hashchange", l);
    },
    currentRoute,
    currentRoute,
  );
}
