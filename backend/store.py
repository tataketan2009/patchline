"""PATCHLINE persistence — SQLite (Python standard library only).

All application state (detections, review workflow, alerts) lives in a
single-file SQLite database seeded on first run from the labelled sample
dataset. No other database engine or service is required.
"""

from __future__ import annotations

import sqlite3
import threading
from typing import Any

from config import DB_PATH, REVIEW_STATUSES
from seed_data import (
    SEED_ALERTS,
    SEED_DETECTIONS,
)

_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables and seed the labelled demo dataset on first run."""
    with _lock, _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS detections (
                id        TEXT PRIMARY KEY,
                date      TEXT NOT NULL,
                region    TEXT NOT NULL,
                area_ha   REAL NOT NULL,
                lat       REAL NOT NULL,
                lon       REAL NOT NULL,
                severity  TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
                status    TEXT NOT NULL CHECK (status IN ('new','investigating','resolved')),
                evidence  INTEGER NOT NULL,
                polygon   TEXT NOT NULL,          -- JSON [[lat, lon], ...]
                source    TEXT NOT NULL DEFAULT 'sample-seed'
            );

            CREATE TABLE IF NOT EXISTS reviews (
                detection_id TEXT PRIMARY KEY REFERENCES detections(id),
                status  TEXT NOT NULL DEFAULT 'new',
                notes   TEXT NOT NULL DEFAULT '',
                updated TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id       TEXT PRIMARY KEY,
                severity TEXT NOT NULL,
                title    TEXT NOT NULL,
                region   TEXT NOT NULL,
                time     TEXT NOT NULL,
                read     INTEGER NOT NULL DEFAULT 0
            );
            """
        )

        if not conn.execute("SELECT 1 FROM detections LIMIT 1").fetchone():
            cols = "id, date, region, area_ha, lat, lon, severity, status, evidence, polygon, source"
            for d in SEED_DETECTIONS:
                conn.execute(
                    f"INSERT INTO detections ({cols}) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        d["id"], d["date"], d["region"], d["area_ha"], d["lat"],
                        d["lon"], d["severity"], d["status"], int(d["evidence"]),
                        _json_polygon(d["polygon"]), "sample-seed"),
                )
            for d in SEED_DETECTIONS:
                conn.execute("INSERT INTO reviews (detection_id) VALUES (?)", (d["id"],))
        if not conn.execute("SELECT 1 FROM alerts LIMIT 1").fetchone():
            for a in SEED_ALERTS:
                conn.execute(
                    "INSERT INTO alerts VALUES (?,?,?,?,?,?)",
                    (a["id"], a["severity"], a["title"], a["region"], a["time"], int(a["read"])),
                )


def _json_polygon(poly: list[list[float]]) -> str:
    import json
    return json.dumps(poly)


# ---------------------------------------------------------------- queries ---

def list_detections(
    severity: str | None = None,
    status: str | None = None,
    region_prefix: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM detections WHERE 1=1"
    params: list[Any] = []
    if severity:
        sql += " AND severity = ?"
        params.append(severity)
    if status:
        sql += " AND status = ?"
        params.append(status)
    if region_prefix:
        sql += " AND region LIKE ?"
        params.append(f"{region_prefix}%")
    if date_from:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND date <= ?"
        params.append(date_to)
    sql += " ORDER BY date DESC"
    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(sql, params)]
    for r in rows:
        r["evidence"] = bool(r["evidence"])
        r["polygon"] = json_loads(r["polygon"])
    return rows


def get_detection(det_id: str) -> dict[str, Any] | None:
    rows = [d for d in list_detections() if d["id"] == det_id]
    return rows[0] if rows else None


def next_detection_id() -> str:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM detections WHERE id LIKE 'PL-%' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    year = "2026"
    seq = 798  # floor for synthesis: seed max
    if row and len(row["id"].split("-")) == 3:
        year, seq = row["id"].split("-")[1], int(row["id"].split("-")[2])
    return f"PL-{year}-{seq + 1:04d}"


def insert_detection(d: dict[str, Any]) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO detections
               (id, date, region, area_ha, lat, lon, severity, status, evidence, polygon, source)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                d["id"], d["date"], d["region"], d["area_ha"], d["lat"], d["lon"],
                d["severity"], d["status"], int(d["evidence"]),
                _json_polygon(d["polygon"]), d.get("source", "pipeline-import"),
            ),
        )
        conn.execute("INSERT OR IGNORE INTO reviews (detection_id) VALUES (?)", (d["id"],))


def get_review(det_id: str) -> dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM reviews WHERE detection_id = ?", (det_id,)).fetchone()
    return dict(row) if row else {"detection_id": det_id, "status": "new", "notes": "", "updated": ""}


def set_review(det_id: str, status: str | None, notes: str | None) -> dict[str, Any]:
    current = get_review(det_id)
    status = status if status is not None else current["status"]
    if status not in REVIEW_STATUSES:
        raise ValueError(f"Unknown review status: {status}")
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO reviews (detection_id, status, notes, updated)
               VALUES (?,?,?,datetime('now'))
               ON CONFLICT(detection_id) DO UPDATE SET
                 status = excluded.status,
                 notes = excluded.notes,
                 updated = excluded.updated""",
            (det_id, status, notes if notes is not None else current["notes"]),
        )
    return get_review(det_id)


def list_alerts(severity: str | None = None, only_unread: bool = False) -> list[dict[str, Any]]:
    sql = "SELECT * FROM alerts WHERE 1=1"
    params: list[Any] = []
    if severity:
        sql += " AND severity = ?"
        params.append(severity)
    if only_unread:
        sql += " AND read = 0"
    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(sql, params)]
    for r in rows:
        r["read"] = bool(r["read"])
    return rows


def mark_alert_read(alert_id: str, read: bool) -> None:
    with _lock, _connect() as conn:
        conn.execute("UPDATE alerts SET read = ? WHERE id = ?", (int(read), alert_id))


def json_loads(s: str) -> Any:
    import json
    return json.loads(s)
