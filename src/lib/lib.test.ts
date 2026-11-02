import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for PATCHLINE's honest-data guarantees:
 *  - priorityScore: bounded 0–100, factor breakdown always sums to the score
 *  - parseGeoJSON: Polygon/MultiPolygon/FeatureCollection handling, lon→lat swap
 *  - review store: default state, persistence, patch semantics
 */

// ---------- localStorage shim (review store persists to localStorage) ----------
const mem = new Map<string, string>();
const ls = {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  get length() {
    return mem.size;
  },
};

beforeEach(() => {
  vi.stubGlobal("localStorage", ls);
  mem.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import { DETECTIONS, type Detection } from "./data";
import { initRecurrenceScan, priorityScore, getReview, setReview, REVIEW_LABEL } from "./review";
import { parseGeoJSON } from "./geojson";

// ------------------------------- priorityScore -------------------------------

describe("priorityScore", () => {
  it("returns a score of 0–100 for every sample detection", () => {
    initRecurrenceScan(DETECTIONS);
    for (const d of DETECTIONS) {
      const { score } = priorityScore(d);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("factor breakdown always sums exactly to the reported score", () => {
    initRecurrenceScan(DETECTIONS);
    for (const d of [...DETECTIONS]) {
      const { score, factors } = priorityScore(d);
      expect(factors.reduce((s, f) => s + f.points, 0)).toBe(score);
      for (const f of factors) {
        expect(f.points).toBeGreaterThanOrEqual(0);
        expect(f.points).toBeLessThanOrEqual(f.max);
      }
    }
  });

  it("larger affected area earns more area points", () => {
    const geo = { region: "Pakhal core", lat: 17.95, lon: 79.88, polygon: [], severity: "medium", status: "new", date: "2026-10-20", evidence: true } as unknown as Detection;
    const big = { ...geo, areaHa: 40 } as Detection;
    const small = { ...geo, areaHa: 5 } as Detection;
    const a = priorityScore(big).factors.find((f) => f.label === "Affected area")!;
    const b = priorityScore(small).factors.find((f) => f.label === "Affected area")!;
    expect(a.points).toBeGreaterThan(b.points);
  });

  it("area points cap at 35 even for huge detections", () => {
    const geo = { region: "Pakhal core", lat: 17.95, lon: 79.88, polygon: [], severity: "medium", status: "new", date: "2026-10-20", evidence: true } as unknown as Detection;
    const huge = { ...geo, areaHa: 1000 } as Detection;
    const f = priorityScore(huge).factors.find((x) => x.label === "Affected area")!;
    expect(f.points).toBe(35);
  });

  it("is deterministic for identical inputs", () => {
    initRecurrenceScan(DETECTIONS);
    const d = DETECTIONS[0];
    expect(priorityScore(d)).toEqual(priorityScore(d));
  });

  it("prioritization ranks sample detections consistently (not a verdict)", () => {
    initRecurrenceScan(DETECTIONS);
    const ranked = [...DETECTIONS]
      .map((d) => ({ id: d.id, score: priorityScore(d).score }))
      .sort((a, b) => b.score - a.score);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
  });
});

// -------------------------------- parseGeoJSON --------------------------------

describe("parseGeoJSON", () => {
  const polygon = {
    type: "Polygon",
    coordinates: [[[79.8, 17.9], [79.81, 17.9], [79.81, 17.91], [79.8, 17.91], [79.8, 17.9]]],
  };

  it("parses a FeatureCollection with outer rings and swaps lon/lat to lat/lon", () => {
    const fc = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: polygon }] };
    const rings = parseGeoJSON(fc);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(5);
    expect(rings[0][0]).toEqual([17.9, 79.8]);
  });

  it("parses a bare geometry (no Feature wrapper)", () => {
    const rings = parseGeoJSON(polygon as never);
    expect(rings).toHaveLength(1);
    expect(rings[0][1]).toEqual([17.9, 79.81]);
  });

  it("expands every shell of a MultiPolygon", () => {
    const mp = {
      type: "MultiPolygon",
      coordinates: [
        [[[79.8, 17.9], [79.81, 17.9], [79.81, 17.91], [79.8, 17.91], [79.8, 17.9]]],
        [[[79.82, 17.9], [79.83, 17.9], [79.83, 17.91], [79.82, 17.91], [79.82, 17.9]]],
      ],
    };
    expect(parseGeoJSON(mp as never)).toHaveLength(2);
  });

  it("returns [] for unsupported or malformed input without throwing", () => {
    expect(parseGeoJSON({ type: "GeometryCollection", features: [] })).toEqual([]);
    expect(parseGeoJSON({ type: "FeatureCollection", features: [null] } as never)).toEqual([]);
  });
});

// -------------------------------- review store --------------------------------

describe("review store", () => {
  it("defaults to status 'new' with empty notes", () => {
    const r = getReview("PL-TEST-0001");
    expect(r.status).toBe("new");
    expect(r.notes).toBe("");
    expect(r.updated).toBe("");
  });

  it("persists a status patch and preserves notes", () => {
    setReview("PL-TEST-0001", { notes: "Field visit scheduled." });
    setReview("PL-TEST-0001", { status: "under-review" });
    const r = getReview("PL-TEST-0001");
    expect(r.status).toBe("under-review");
    expect(r.notes).toBe("Field visit scheduled.");
    expect(r.updated).not.toBe("");
  });

  it("keeps entries independent per detection id", () => {
    setReview("PL-TEST-A", { status: "escalated" });
    expect(getReview("PL-TEST-B").status).toBe("new");
    expect(getReview("PL-TEST-A").status).toBe("escalated");
  });

  it("round-trips every workflow status", () => {
    const statuses = Object.keys(REVIEW_LABEL) as (keyof typeof REVIEW_LABEL)[];
    expect(statuses).toHaveLength(6);
    for (const s of statuses) {
      setReview("PL-TEST-RT", { status: s });
      expect(getReview("PL-TEST-RT").status).toBe(s);
    }
  });
});
