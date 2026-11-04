"""
PATCHLINE backend API — the complete backend, written entirely in Python.

FastAPI service that owns ALL application state:
  • SQLite persistence (std library sqlite3)
  • Explainable priority scoring (scoring.py)
  • Six-stage investigation review workflow
  • Alerts, activity, region status, statistics
  • Baseline NDVI-diff change-detection pipeline (pipeline.py, STAC/Sentinel-2)
  • Pipeline output import into the detection store
  • Evidence report generation (markdown download)
  • Optional serving of the built frontend (../dist) — one Python process

Run:  uvicorn main:app --reload --port 8000     (from inside backend/)
"""

from __future__ import annotations

import csv
import io
import json
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from config import (
    DEMO_NOTE,
    DIST_DIR,
    REGION,
    REGION_BOUNDARY,
    REVIEW_LABELS,
    REVIEW_STATUSES,
)
import store
from scoring import priority_score
from store import INVESTIGATION_STAGES, PRIORITIES

app = FastAPI(title="PATCHLINE forest intelligence API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

store.init_db()


# ---------------------------------------------------------------- schemas ---

class ReviewPatch(BaseModel):
    status: Literal["new", "under-review", "verified", "false-positive", "escalated", "resolved"] | None = None
    notes: str | None = None


class PipelineRun(BaseModel):
    minLon: float
    minLat: float
    maxLon: float
    maxLat: float
    before_from: str = Field(examples=["2025-06-01"])
    before_to: str = Field(examples=["2025-06-30"])
    after_from: str = Field(examples=["2025-10-01"])
    after_to: str = Field(examples=["2025-10-31"])
    max_cloud: float = 20.0
    import_result: bool = False  # store candidates as detections in the DB


# ------------------------------------------------------------------ meta ---

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "backend_language": "python",
        "pipeline": "baseline-ndvi-difference (classical — NOT a neural network)",
        "storage": f"sqlite ({store.DB_PATH.name})",
        "note": "Advisory output for human review; no fabricated confidence scores.",
    }


@app.get("/api/meta")
def meta():
    """Region info + enums the frontend needs to render."""
    return {
        "region": REGION,
        "boundary": REGION_BOUNDARY,
        "reviewStatuses": [{"id": s, "label": REVIEW_LABELS[s]} for s in REVIEW_STATUSES],
        "demoNote": DEMO_NOTE,
    }


# ------------------------------------------------------ detections/review ---

@app.get("/api/detections")
def detections(
    severity: str | None = None,
    status: str | None = None,
    region: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    sort: Literal["priority", "date"] = "date",
):
    rows = store.list_detections(
        severity=severity, status=status, region_prefix=region,
        date_from=from_date, date_to=to_date,
    )
    for d in rows:
        d["priority"] = priority_score(d)
    if sort == "priority":
        rows.sort(key=lambda d: d["priority"]["score"], reverse=True)
    return {"detections": rows, "demoNote": DEMO_NOTE}


@app.get("/api/detections/{det_id}")
def detection_detail(det_id: str):
    d = store.get_detection(det_id)
    if not d:
        raise HTTPException(404, f"Detection {det_id} not found")
    d["priority"] = priority_score(d)
    d["review"] = store.get_review(det_id)
    d["demoNote"] = DEMO_NOTE
    return d


@app.patch("/api/detections/{det_id}/review")
def update_review(det_id: str, patch: ReviewPatch):
    if not store.get_detection(det_id):
        raise HTTPException(404, f"Detection {det_id} not found")
    try:
        review = store.set_review(det_id, patch.status, patch.notes)
    except ValueError as e:
        raise HTTPException(400, str(e))
    # Activity trail + automatic alert on escalation (deduped per event).
    store.add_activity("detection", det_id, "Analyst", f"Review status → {review['status']}")
    if patch.status == "escalated":
        d = store.get_detection(det_id)
        alert_id, created = store.insert_alert(
            severity="critical",
            title=f"{det_id} escalated for priority investigation",
            region=d["region"],
            time="Just now",
            source_ref=f"escalation:{det_id}",
            detection_id=det_id,
        )
    return {"review": review}


# ------------------------------------------------------------ investigations ---

class InvestigationCreate(BaseModel):
    detectionId: str
    officer: str = "Unassigned"
    stage: Literal["new", "assigned", "investigating", "pending-verification", "resolved", "closed"] = "new"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    due: str = ""


class InvestigationPatch(BaseModel):
    stage: Literal["new", "assigned", "investigating", "pending-verification", "resolved", "closed"] | None = None
    officer: str | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    due: str | None = None
    progress: int | None = Field(default=None, ge=0, le=100)


class NoteCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    actor: str = "Analyst"


class AlertCreate(BaseModel):
    severity: Literal["critical", "high", "medium", "low"]
    title: str = Field(min_length=3, max_length=140)
    region: str
    source_ref: str | None = None
    detection_id: str | None = None


@app.get("/api/investigations")
def investigations(detection_id: str | None = None, stage: str | None = None):
    if stage and stage not in INVESTIGATION_STAGES:
        raise HTTPException(400, f"Unknown stage; use one of {INVESTIGATION_STAGES}")
    rows = store.list_investigations(detection_id=detection_id, stage=stage)
    for i in rows:
        i["activityCount"] = len(store.list_activity("investigation", i["id"]))
    return {"investigations": rows, "stages": INVESTIGATION_STAGES}


@app.post("/api/investigations")
def create_investigation(c: InvestigationCreate):
    if c.detectionId and not store.get_detection(c.detectionId):
        raise HTTPException(404, f"Detection {c.detectionId} not found")
    try:
        inv_id = store.insert_investigation(
            c.detectionId, c.officer, c.stage, c.priority, c.due,
            10 if c.stage != "new" else 0,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"investigation": store.get_investigation(inv_id)}


def _require_inv(inv_id: str) -> dict[str, Any]:
    inv = store.get_investigation(inv_id)
    if not inv:
        raise HTTPException(404, f"Investigation {inv_id} not found")
    return inv


@app.patch("/api/investigations/{inv_id}")
def patch_investigation(inv_id: str, patch: InvestigationPatch):
    _require_inv(inv_id)
    try:
        updated = store.update_investigation(inv_id, patch.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"investigation": updated}


@app.post("/api/investigations/{inv_id}/notes")
def inv_note(inv_id: str, n: NoteCreate):
    _require_inv(inv_id)
    store.add_activity("investigation", inv_id, n.actor, f"Note: {n.text}")
    return {"ok": True, "activity": store.list_activity("investigation", inv_id)[:1]}


@app.get("/api/investigations/{inv_id}/activity")
def inv_activity(inv_id: str):
    _require_inv(inv_id)
    return {"activity": store.list_activity("investigation", inv_id)}


@app.get("/api/detections/{det_id}/activity")
def det_activity(det_id: str):
    if not store.get_detection(det_id):
        raise HTTPException(404, f"Detection {det_id} not found")
    return {"activity": store.list_activity("detection", det_id)}


# ------------------------------------------------------------ alerts & export ---

@app.post("/api/alerts")
def create_alert(a: AlertCreate):
    alert_id, created = store.insert_alert(
        a.severity, a.title, a.region, "Just now", a.source_ref, a.detection_id,
    )
    return {"id": alert_id, "created": created}


@app.patch("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    rows = store.list_alerts()
    if not any(a["id"] == alert_id for a in rows):
        raise HTTPException(404, f"Alert {alert_id} not found")
    store.mark_alert_resolved(alert_id)
    return {"ok": True}


@app.get("/api/analytics")
def analytics():
    return {"analytics": store.analytics(), "demoNote": DEMO_NOTE}


@app.get("/api/export/detections.csv")
def export_csv(
    severity: str | None = None,
    status: str | None = None,
    region: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
):
    rows = store.list_detections(
        severity=severity, status=status, region_prefix=region,
        date_from=from_date, date_to=to_date,
    )
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["detection_id", "date", "region", "area_ha", "lat", "lon",
                "severity", "status", "evidence", "source", "priority_score"])
    for d in rows:
        w.writerow([d["id"], d["date"], d["region"], d["area_ha"], d["lat"], d["lon"],
                    d["severity"], d["status"], d["evidence"], d["source"],
                    priority_score(d)["score"]])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=patchline-detections.csv"},
    )


@app.get("/api/detections/{det_id}/report")
def evidence_report(det_id: str):
    """Downloadable evidence report (markdown). Includes honest limitations."""
    d = store.get_detection(det_id)
    if not d:
        raise HTTPException(404, f"Detection {det_id} not found")
    p = priority_score(d)
    r = store.get_review(det_id)
    lines = [
        f"# PATCHLINE evidence report — {d['id']}",
        "",
        f"**Region:** {d['region']}  ",
        f"**Detection date:** {d['date']}  ",
        f"**Centroid:** {d['lat']:.4f}°N, {d['lon']:.4f}°E  ",
        f"**Affected area (projected CRS):** {d['area_ha']:.1f} ha  ",
        f"**Severity (ranking):** {d['severity']}  ",
        f"**Priority score (advisory):** {p['score']}/100",
        "",
        "## Factor breakdown",
    ]
    lines += [f"- {f['label']}: {f['points']}/{f['max']} — {f['detail']}" for f in p["factors"]]
    lines += [
        "",
        "## Analysis method",
        "- Baseline: NDVI differencing between Sentinel-2 L2A observations",
        "- Imagery source: Sentinel-2 (ESA/Copernicus) via Earth Search STAC",
        f"- Polygon vertices (WGS84): {json.dumps(d['polygon'])}",
        "",
        "## Review workflow",
        f"- Status: {REVIEW_LABELS.get(r['status'], r['status'])}",
        f"- Notes: {r['notes'] or '(none)'}",
        f"- Last review update: {r['updated'] or '(none)'}",
        "",
        "## Limitations (must read)",
        "- This report describes **change observed between imagery dates**.",
        "- A detected change does **not** prove illegal deforestation; legal",
        "  classification requires field verification and official records.",
        "- Sample data is clearly labelled; no confidence score is asserted",
        "  because none is calibrated in this build.",
    ]
    text = "\n".join(lines)
    return Response(
        content=text,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{det_id}-evidence-report.md"'},
    )


# -------------------------------------------------------- alerts & panels ---

@app.get("/api/alerts")
def alerts(severity: str | None = None, unread_only: bool = False):
    return {"alerts": store.list_alerts(severity=severity, only_unread=unread_only)}


@app.post("/api/alerts/{alert_id}/read")
def alert_read(alert_id: str, read: bool = True):
    if read and not any(a["id"] == alert_id for a in store.list_alerts()):
        raise HTTPException(404, f"Alert {alert_id} not found")
    store.mark_alert_read(alert_id, read)
    return {"ok": True}


@app.get("/api/stats")
def stats():
    ds = store.list_detections()
    return {
        "monitoredKm2": REGION["monitoredKm2"],
        "totalDetections": len(ds),
        "affectedHa": round(sum(d["area_ha"] for d in ds), 1),
        "newDetections": sum(1 for d in ds if d["date"] >= "2026-10-26"),
        "highPriority": sum(1 for d in ds if d["severity"] in ("critical", "high")),
        "weeklyHistory": _cached("weekly"),
        "monthlyTrend": _cached("monthlyTrend"),
        "regionStatuses": _cached("regionStatuses"),
        "activity": _cached("activity"),
        "investigations": _cached("investigations"),
        "demoNote": DEMO_NOTE,
    }


def _cached(key: str) -> Any:
    from seed_data import (
        SEED_ACTIVITY, SEED_INVESTIGATIONS, SEED_MONTHLY_TREND,
        SEED_REGION_STATUSES, SEED_WEEKLY_HISTORY,
    )
    return {
        "weekly": SEED_WEEKLY_HISTORY,
        "monthlyTrend": SEED_MONTHLY_TREND,
        "regionStatuses": SEED_REGION_STATUSES,
        "activity": SEED_ACTIVITY,
        "investigations": SEED_INVESTIGATIONS,
    }[key]


# -------------------------------------------------- geospatial pipeline ---

@app.post("/api/pipeline/run")
def pipeline_run(p: PipelineRun):
    """Execute the baseline NDVI-diff pipeline (STAC / Sentinel-2)."""
    try:
        from pipeline import run_detection
        fc = run_detection(
            (p.minLon, p.minLat, p.maxLon, p.maxLat),
            p.before_from, p.before_to, p.after_from, p.after_to, p.max_cloud,
        )
    except RuntimeError as e:
        raise HTTPException(404, str(e))
    except Exception as e:  # network/scoped errors → 502 with honest message
        raise HTTPException(502, f"Pipeline failed: {e}") from e

    if p.import_result and fc.get("features"):
        _import_features(fc)
        fc["importedAs"] = "detections"
    return fc


def _import_features(fc: dict[str, Any]) -> list[str]:
    """Turn pipeline GeoJSON candidates into persisted detections."""
    created: list[str] = []
    for feat in fc.get("features", []):
        props = feat.get("properties", {})
        geom = feat["geometry"]
        ring = geom["coordinates"][0]
        xs = [pt[0] for pt in ring]
        ys = [pt[1] for pt in ring]
        lat, lon = (min(ys) + max(ys)) / 2, (min(xs) + max(xs)) / 2
        area_ha = float(props.get("area_ha", 0.0))
        det = {
            "id": store.next_detection_id(),
            "date": fc["summary"]["observations"]["after"]["datetime"],
            "region": "Pipeline Import (RENAME ME)",
            "area_ha": round(area_ha, 2) or 0.01,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "severity": "high" if area_ha >= 30 else "medium" if area_ha >= 10 else "low",
            "status": "new",
            "evidence": True,
            "polygon": [[y, x] for x, y in ring],
            "source": "pipeline-ndvi-diff",
        }
        store.insert_detection(det)
        created.append(det["id"])
        # Automatic, deduped alert per imported candidate:
        store.insert_alert(
            severity=det["severity"],
            title=f"Pipeline candidate {det['id']} — {det['area_ha']:.1f} ha potential change",
            region=det["region"],
            time="Just now",
            source_ref=f"pipeline:{det['id']}",
            detection_id=det["id"],
        )
        store.add_activity("detection", det["id"], "PATCHLINE baseline pipeline",
                           f"Candidate imported from NDVI-diff run ({det['area_ha']:.1f} ha, advisory)")
    return created


@app.get("/api/pipeline/summary")
def pipeline_summary():
    from pipeline import COLLECTION, DEFAULT_MIN_AREA, DEFAULT_NDVI_DROP, STAC_URL
    return {
        "pipeline": "baseline-ndvi-difference",
        "model": "none (classical — labelled BASELINE, no neural network)",
        "confidence": None,
        "collection": COLLECTION,
        "stac": STAC_URL,
        "thresholds": {"ndvi_drop": DEFAULT_NDVI_DROP, "min_area_m2": DEFAULT_MIN_AREA},
        "note": DEMO_NOTE,
    }


# Optionally serve the built frontend so the whole app can run as ONE
# Python process (uvicorn main:app). Falls back silently when absent.
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="site")
