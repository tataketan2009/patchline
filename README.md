# PATCHLINE — Forest Intelligence Platform

Detecting potential deforestation in Telangana using satellite imagery,
geospatial analysis and explainable prioritization. Demo region: **Pakhal
Wildlife Sanctuary, Warangal district — 879 km² monitored**.

> **Detections are advisory candidates for human review. A detected change
> never proves illegal activity — verification is a field process.**

- 🔗 **Live site:** https://patchline-q6ma.onrender.com
- 🗺 **Full feature map** — interactive Leaflet map with detection polygons, severity/date/region filters, legend, search, FIRMS live-fire overlay and GeoJSON analyst import
- 🧠 **Explainable priority scoring** — 0–100 with per-factor breakdown (area, boundary proximity, block persistence, evidence); advisory only
- 🔀 **Side-by-side / swipe imagery comparison** on every detection page

---

## Tech stack

**Frontend — TypeScript/React (the deployed static site)**

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript, Vite 8, single-file offline build |
| Styling | Tailwind CSS v4, custom forest-green theme, Inter + JetBrains Mono |
| Map | Leaflet + react-leaflet (Sentinel-2/Esri basemaps, FIRMS live-fire overlay, GeoJSON import) |
| Charts | Hand-built SVG/bar charts (no chart library bloat) |
| Routing/state | Hash routing (`#/detection/PL-2026-0841`, `#/view/investigations`) + localStorage demo stores |
| Tests | Vitest — 14 tests (priority scoring, GeoJSON parser, review store) |
| Hosting | Render static site (free tier) + GitHub |

**Backend — 100% Python (no other language)**

| Layer | Technology |
|---|---|
| API | FastAPI + Pydantic, auto OpenAPI docs at `/docs` |
| Storage | SQLite via Python stdlib `sqlite3` — detections, review workflow, alerts (deduped), investigations, activity log |
| Scoring | Explainable priority engine (`backend/scoring.py`) — same weights as the frontend |
| Change detection | Baseline NDVI differencing over Sentinel-2 L2A (Earth Search STAC), NumPy + Rasterio + SCL cloud masking |
| Geometry | Shapely polygonisation, area in EPSG:32744 (UTM 44N) via PyProj |
| Investigations | Officer workflow: New → Assigned → Investigating → Pending verification → Resolved → Closed, with notes + activity trail |
| Alerts | Auto-generated + deduplicated per processing event (`source_ref`), acknowledge/resolve |
| Tests | pytest — 14 tests (`backend/test_backend.py`) |

**Deployment (Render Blueprint — `render.yaml`)**

| Service | Runtime | Purpose |
|---|---|---|
| `patchline` | static site | the built React frontend (free tier) |
| `patchline-api` | **Python** · uvicorn | the entire backend API + SQLite |

The built frontend is also auto-mounted by the backend when `../dist` exists,
so a **single** `uvicorn main:app` process can serve the whole application.

---

## Feature tour

- **Dashboard** — monitored area, affected ha, new/critical detections, pending cases (all computed from the labelled sample dataset), priority queue, region overview, detection history & monthly trend charts, imagery-sync + AI-model status (labelled *baseline*, no fabricated confidence)
- **Map** — detection polygons styled by severity, sanctuary boundary, basemap switcher, zoom, live FIRMS hotspots (real NASA VIIRS data with a MAP_KEY), before/after FIRMS spot-check
- **Detections** — search, severity/status/region filters, sortable (date, area, severity, priority), paginated, CSV export, detail pages with status workflow + notes + PDF/HTML evidence reports
- **Alerts** — auto-raising, deduped per event; acknowledge/resolve with Open vs History views and honest unread counts
- **Investigations** — create from scratch or straight from a detection page; assign officer, deadline, priority, progress; notes + persisted activity trail
- **Analytics** — monthly forest-loss trend, severity distribution, region-wise affected area, investigation pipeline by stage, completion rate, CSV export

---

## Structure

```
src/                    frontend (React + TS) — dashboard, map, detection pages,
                        alerts, investigations, analytics, settings
backend/                the entire backend — Python only
  main.py               FastAPI app: all API endpoints (+ serves ../dist if built)
  store.py              SQLite persistence (stdlib sqlite3) + migrations + analytics
  scoring.py            explainable priority score mirror
  pipeline.py           baseline NDVI-diff change-detection (STAC/Sentinel-2)
  seed_data.py          clearly-labelled demo dataset
  config.py             region constants, enums
  test_backend.py       14 pytest tests
demo-import.geojson     sample file for the map's Import button
render.yaml             Render Blueprint: static site + Python API service
```

---

## Run locally

**Frontend**

```
npm install
npm run dev        # dev server (FIRMS proxy included)
npm run build      # single-file production build → dist/index.html (works offline)
npm test           # 14 unit tests
npm run lint       # oxlint
```

**Backend (Python)**

```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
python -m pytest test_backend.py -v      # 14 tests
```

Then open `http://localhost:8010/docs` — FastAPI's interactive API docs.
Because `../dist` is auto-mounted, `http://localhost:8010` serves the **entire app**.

**End-to-end demo chain**

detection on the map → review it (escalate ⇒ an alert auto-fires, deduped) →
acknowledge/resolve the alert → open an investigation → add notes, progress →
resolve it → watch Analytics update → export the CSV/report.

---

## API surface (summary)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` · `/api/meta` | service status, region metadata |
| GET | `/api/detections` | filters (severity, status, region, dates), sort by priority |
| GET | `/api/detections/{id}` | detail + priority breakdown + review |
| PATCH | `/api/detections/{id}/review` | 6-stage review workflow (auto-alert on escalate) |
| GET | `/api/detections/{id}/report` | markdown evidence report |
| GET | `/api/detections/{id}/activity` | detection activity trail |
| GET/POST | `/api/investigations` | list / open investigations |
| PATCH | `/api/investigations/{id}` | stage, officer, priority, due, progress |
| POST | `/api/investigations/{id}/notes` | add note → activity trail |
| GET/POST | `/api/alerts` | feed / create (deduped by `source_ref`) |
| PATCH | `/api/alerts/{id}/resolve` | resolve |
| GET | `/api/stats` · `/api/analytics` | dashboard stats · analytics aggregates |
| GET | `/api/export/detections.csv` | filterable CSV export |
| POST | `/api/pipeline/run` | run the baseline NDVI-diff pipeline; `import_result: true` persists detections **and auto-raises deduped alerts** |

Full table: [`backend/README.md`](backend/README.md)

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_FIRMS_KEY` | frontend build | NASA FIRMS MAP_KEY so the 🔥 Fires toggle shows **real live VIIRS hotspot data** (free at firms.modaps.eosdis.nasa.gov); visitors can also paste their own key in Settings |
| `PYTHON_VERSION` `NODE_VERSION` | Render | set via `render.yaml` |

---

## Honest-data policy

- Every statistic is **computed from the clearly-labelled sample dataset** —
  nothing invented, nothing scraped to look busy.
- The change-detection pipeline is a **clearly-labelled classical baseline**
  (NDVI differencing). It is not presented as a neural network, and **no
  confidence scores are displayed** because none are calibrated.
- A high priority score is **rank-for-review only** — it never implies
  illegality; verification is a human, field-based process.
- Imagery comparisons are labelled **DEMO IMAGERY — synthetic render, not
  satellite pixels** (procedurally generated, works offline).
- FIRMS live-fire data is **real NASA/VIIRS data** when a MAP_KEY is configured.

---

## License

© 2026 PATCHLINE team. Built for a 48-hour hackathon.
