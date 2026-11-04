import { INVESTIGATIONS } from "./data";

/**
 * Investigation workflow (client-side demo store).
 * Mirrors the Python backend's investigations API shapes; in this static demo
 * build it persists to localStorage and is clearly labelled as demo data.
 * Backend endpoints (investigations CRUD + activity) back the same schema.
 */

export type InvStage =
  | "new"
  | "assigned"
  | "investigating"
  | "pending-verification"
  | "resolved"
  | "closed";

export const INV_STAGES: InvStage[] = [
  "new",
  "assigned",
  "investigating",
  "pending-verification",
  "resolved",
  "closed",
];

export const INV_STAGE_LABEL: Record<InvStage, string> = {
  new: "New",
  assigned: "Assigned",
  investigating: "Investigating",
  "pending-verification": "Pending verification",
  resolved: "Resolved",
  closed: "Closed",
};

export type InvPriority = "low" | "medium" | "high" | "critical";

export interface InvRec {
  id: string;
  detectionId: string;
  officer: string;
  stage: InvStage;
  priority: InvPriority;
  due: string;
  progress: number;
  created: string;
}

export interface ActivityRow {
  ts: string;
  actor: string;
  text: string;
}

const INV_KEY = "patchline-investigations";
const ACT_KEY = "patchline-investigation-activity";

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16);
}

function loadRaw(): InvRec[] {
  try {
    const raw = localStorage.getItem(INV_KEY);
    if (raw) return JSON.parse(raw) as InvRec[];
  } catch {
    /* fall through to seed */
  }
  // Seed once from the labelled demo dataset, mapped to canonical stages.
  const stageMap: Record<string, InvStage> = {
    triage: "new",
    "field-verification": "investigating",
    "evidence-review": "investigating",
    enforcement: "pending-verification",
  };
  const seeded: InvRec[] = INVESTIGATIONS.map((i) => ({
    id: i.id,
    detectionId: i.detectionId,
    officer: i.officer,
    stage: stageMap[i.stage] ?? "new",
    priority: i.progress >= 70 ? "high" : "medium",
    due: i.due,
    progress: i.progress,
    created: "2026-11-02 08:15",
  }));
  persist(seeded);
  return seeded;
}

function persist(rows: InvRec[]) {
  try {
    localStorage.setItem(INV_KEY, JSON.stringify(rows));
  } catch {
    /* non-fatal in blocked-storage environments */
  }
}

export function listInvestigations(): InvRec[] {
  return [...loadRaw()].sort((a, b) => b.id.localeCompare(a.id));
}

export function investigationsFor(detectionId: string): InvRec[] {
  return loadRaw().filter((i) => i.detectionId === detectionId);
}

export function nextInvId(rows: InvRec[]): string {
  const max = rows.reduce((m, r) => {
    const n = Number(r.id.split("-")[1]);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 100);
  return `INV-${String(max + 1).padStart(3, "0")}`;
}

export function createInvestigation(opts: {
  detectionId: string;
  officer?: string;
  priority?: InvPriority;
  due?: string;
}): InvRec {
  const rows = loadRaw();
  const rec: InvRec = {
    id: nextInvId(rows),
    detectionId: opts.detectionId,
    officer: opts.officer || "Unassigned",
    stage: opts.officer && opts.officer !== "Unassigned" ? "assigned" : "new",
    priority: opts.priority ?? "medium",
    due: opts.due || "",
    progress: 5,
    created: now(),
  };
  rows.push(rec);
  persist(rows);
  addActivity(rec.id, { ts: now(), actor: "Analyst", text: `Investigation opened for ${opts.detectionId}` });
  return rec;
}

export function updateInvestigation(id: string, patch: Partial<Omit<InvRec, "id" | "detectionId">>): InvRec | null {
  const rows = loadRaw();
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const prev = rows[i];
  rows[i] = { ...prev, ...patch, id: prev.id, detectionId: prev.detectionId };
  persist(rows);
  const changes: string[] = [];
  for (const k of ["stage", "officer", "due", "priority", "progress"] as const) {
    if (patch[k] !== undefined && prev[k] !== patch[k]) changes.push(`${k} → ${String(patch[k])}`);
  }
  if (changes.length) addActivity(id, { ts: now(), actor: "Analyst", text: changes.join("; ") });
  return rows[i];
}

export function addNote(id: string, text: string, actor = "Analyst"): void {
  addActivity(id, { ts: now(), actor, text: `Note: ${text}` });
}

function loadActivity(): Record<string, ActivityRow[]> {
  try {
    return JSON.parse(localStorage.getItem(ACT_KEY) ?? "{}") as Record<string, ActivityRow[]>;
  } catch {
    return {};
  }
}

export function addActivity(id: string, row: ActivityRow): void {
  const all = loadActivity();
  (all[id] ??= []).unshift(row);
  try {
    localStorage.setItem(ACT_KEY, JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}

export function activityFor(id: string): ActivityRow[] {
  return loadActivity()[id] ?? [];
}

export function investigationCompletionRate(): number | null {
  const rows = loadRaw();
  if (rows.length === 0) return null;
  const done = rows.filter((r) => r.stage === "resolved" || r.stage === "closed").length;
  return Math.round((100 * done) / rows.length);
}
