import { REGION_BOUNDARY, type Detection } from "./data";

/** Detections snapshot used for block-recurrence counting (set at app bootstrap). */
let store: Detection[] = [];

export function initRecurrenceScan(all: Detection[]) {
  store = all;
}

/**
 * Review workflow state (local persistence). In production this maps to a
 * PostGIS-backed investigations table; here it persists per browser session
 * so the workflow can be demonstrated without a backend.
 */

export type ReviewStatus =
  | "new"
  | "under-review"
  | "verified"
  | "false-positive"
  | "escalated"
  | "resolved";

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  new: "New",
  "under-review": "Under review",
  verified: "Verified change",
  "false-positive": "False positive",
  escalated: "Escalated",
  resolved: "Resolved",
};

export const REVIEW_STYLE: Record<ReviewStatus, string> = {
  new: "text-warn bg-warn-soft",
  "under-review": "text-accent bg-accent-soft",
  verified: "text-danger bg-danger-soft/60",
  "false-positive": "text-muted bg-muted/10",
  escalated: "text-danger bg-danger-soft",
  resolved: "text-muted bg-muted/10",
};

export interface ReviewEntry {
  status: ReviewStatus;
  notes: string;
  updated: string;
}

const KEY = "patchline-review-state";

function load(): Record<string, ReviewEntry> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, ReviewEntry>;
  } catch {
    return {};
  }
}

function save(state: Record<string, ReviewEntry>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* non-fatal: review state just won't survive a reload */
  }
}

export function getReview(id: string): ReviewEntry {
  return load()[id] ?? { status: "new", notes: "", updated: "" };
}

export function setReview(id: string, patch: Partial<ReviewEntry>) {
  const state = load();
  state[id] = { ...getReview(id), ...patch, updated: new Date().toISOString().slice(0, 16).replace("T", " ") };
  save(state);
}

/* ------------------------------------------------------------------ */
/* Explainable investigation priority                                  */
/*                                                                     */
/* Weighted, rule-based score ' 0'100 with a full factor breakdown.    */
/* A high score MUST NOT be read as proof of illegal activity ' it     */
/* only ranks detections for human review.                             */
/* ------------------------------------------------------------------ */

export interface PriorityFactor {
  label: string;
  points: number;
  max: number;
  detail: string;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const f = Math.PI / 180;
  const dLat = (lat2 - lat1) * f;
  const dLon = (lon2 - lon1) * f;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * f) * Math.cos(lat2 * f) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Rough protected-boundary proximity: distance from centroid to nearest boundary vertex (m). */
function boundaryDistanceKm(d: Detection) {
  let min = Infinity;
  for (const [plat, plon] of REGION_BOUNDARY) {
    min = Math.min(min, haversineMeters(d.lat, d.lon, plat, plon));
  }
  return min / 1000;
}

export function priorityScore(d: Detection): { score: number; factors: PriorityFactor[] } {
  const factors: PriorityFactor[] = [];

  // 1. Affected area ' larger clearings rank higher (0'35)
  const areaPts = Math.min(35, Math.round(d.areaHa * 0.65));
  factors.push({ label: "Affected area", points: areaPts, max: 35, detail: `${d.areaHa.toFixed(1)} ha ' ${areaPts}/35` });

  // 2. Proximity to protected/reserve boundary (0'25)
  const distKm = boundaryDistanceKm(d);
  const proxPts = distKm <= 2 ? 25 : distKm <= 6 ? 16 : distKm <= 12 ? 8 : 3;
  factors.push({
    label: "Protected-boundary proximity",
    points: proxPts,
    max: 25,
    detail: `${distKm.toFixed(1)} km from sanctuary boundary ' ${proxPts}/25`,
  });

  // 3. Persistence: recurrence of changes in the same named block (0'20)
  const block = d.region.split(" ")[0];
  const recurrences = countRecurrences(d);
  const persPts = recurrences >= 3 ? 20 : recurrences === 2 ? 13 : 5;
  factors.push({
    label: "Persistence in block",
    points: persPts,
    max: 20,
    detail: `${recurrences} detection${recurrences === 1 ? "" : "s"} recorded in ${block} ' ${persPts}/20`,
  });
  // 4. Evidence availability (0'10) ' verified imagery chips speed up review
  const evPts = d.evidence ? 10 : 4;
  factors.push({ label: "Evidence availability", points: evPts, max: 10, detail: d.evidence ? "Evidence bundle captured ' 10/10" : "Awaiting next pass ' 4/10" });

  // 5. Road-adjacency signal placeholder (0'10) ' populated when road-detection runs
  factors.push({ label: "Road-adjacency signal", points: 0, max: 10, detail: "Road-feature classifier not active in this build ' 0/10" });

  const score = factors.reduce((s, f) => s + f.points, 0);
  return { score, factors };
}

function countRecurrences(d: Detection): number {
  const block = d.region.split(" ")[0];
  let n = 0;
  for (const o of store) {
    if (o.region.split(" ")[0] === block) n++;
  }
  return Math.max(n, 1);
}
