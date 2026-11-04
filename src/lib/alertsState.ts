import { ALERTS } from "./data";

/**
 * Alert acknowledgement/resolve state (client-side demo persistence).
 * Mirrors the backend alerts API (status open/acknowledged/resolved).
 */

export interface AlertState {
  ack: Record<string, true>;
  resolved: Record<string, true>;
}

const KEY = "patchline-alert-state";

function load(): AlertState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AlertState;
      return { ack: s.ack ?? {}, resolved: s.resolved ?? {} };
    }
  } catch {
    /* fall through to seed */
  }
  // Seed: alerts marked read in the labelled dataset start acknowledged.
  const seeded: AlertState = { ack: {}, resolved: {} };
  for (const a of ALERTS) if (a.read) seeded.ack[a.id] = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(seeded));
  } catch {
    /* non-fatal */
  }
  return seeded;
}

function save(s: AlertState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

export function alertState(): AlertState {
  return load();
}

export function acknowledge(id: string) {
  const s = load();
  s.ack[id] = true;
  delete s.resolved[id];
  save(s);
}

export function resolveAlert(id: string) {
  const s = load();
  s.resolved[id] = true;
  s.ack[id] = true;
  save(s);
}

/** Unread = visible in feed but neither acknowledged nor resolved. */
export function unreadIds(): string[] {
  const s = load();
  return ALERTS.filter((a) => !s.ack[a.id] && !s.resolved[a.id]).map((a) => a.id);
}
