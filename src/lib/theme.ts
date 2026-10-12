import { useSyncExternalStore } from "react";

/**
 * Night mode (Telegram-style dark theme).
 *
 * The choice lives in its own localStorage key so it survives logout and is
 * not reset by the app-state store, and the `data-theme` attribute on <html>
 * is the single switch the stylesheet reacts to. An inline script in
 * index.html applies it before first paint so there is no flash of light.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "eaa:theme";
const LIGHT_META = "#FFFFFF";
const DARK_META = "#17212B";

const listeners = new Set<() => void>();

function readStored(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* storage unavailable (private mode) — fall back to light */
  }
  return "light";
}

let theme: Theme = readStored();

function apply(t: Theme) {
  const root = document.documentElement;
  root.dataset.theme = t; // also drives `color-scheme` in index.css
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = t === "dark" ? DARK_META : LIGHT_META;
}

export function getTheme(): Theme {
  return theme;
}

export function setTheme(next: Theme) {
  if (next === theme) return;
  theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore quota errors — the theme still applies for this session */
  }
  apply(next);
  listeners.forEach((l) => l());
}

export function toggleTheme() {
  setTheme(theme === "dark" ? "light" : "dark");
}

/** Subscribe a component to the current theme (header switches). */
export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTheme,
    getTheme
  );
}

// Sync the markup with the stored choice on load (idempotent with the
// pre-paint script in index.html).
apply(theme);
