# PATCHLINE — Forest Intelligence Platform

Detecting potential illegal deforestation in Telangana using satellite imagery,
geospatial analysis and explainable prioritization. Demo region: **Pakhal
Wildlife Sanctuary, Warangal district — 879 km² monitored**.

> **Detections are advisory candidates for human review. A detected change
> never proves illegal activity — verification is a field process.**

Live site: https://patchline-q6ma.onrender.com

## Tech stack

**Frontend — TypeScript/React (the deployed static site)**

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript, Vite 8, single-file offline build |
| Styling | Tailwind CSS v4, custom forest theme, Inter + JetBrains Mono |
| Map | Leaflet + react-leaflet (Sentinel-2/Esri basemaps, FIRMS live-fire overlay, GeoJSON import) |
| Routing/state | Hash routing + localStorage (demo review workflow) |
| Tests | Vitest (scoring, GeoJSON parser, review store) |
| Hosting | Render static site (free tier) + GitHub |

**Backend — 100% Python (no other language)**

| Layer | Technology |
|---|---|
| API | FastAPI + Pydantic |
| Storage | SQLite via Python stdlib `sqlite3` (Python-only persistence) |
| Scoring | Explainable priority engine (`backend/scoring.py`) — same weights as the frontend |
| Change detection | NDVI differencing over Sentinel-2 L2A (Earth Search STAC), NumPy + Rasterio |
| Geometry | Shapely polygonisation, areas in EPSG:32744 (UTM 44N) via PyProj |
| Tests | pytest (`backend/test_backend.py`) |

See [`backend/README.md`](backend/README.md) for the full API surface and run
instructions. Because the built frontend is auto-mounted when present, one
`uvicorn` process can serve **both** the API and the website.

## Structure

```
src/                  frontend (React + TS) — dashboards, map, detection pages
backend/              entire backend — Python only (FastAPI, SQLite, STAC pipeline)
demo-import.geojson   sample file for the map's Import button
render.yaml           Render deployment config
```

## Run locally

```
npm install && npm run dev     # frontend dev server
npm run build                  # single-file production build → dist/index.html
npm test                       # frontend unit tests

cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8010   # entire backend (Python)
python -m pytest test_backend.py -v     # backend tests
```

## Honest-data policy

- Every statistic on the dashboard is computed from the clearly-labelled
  sample dataset — nothing invented.
- No confidence scores are displayed because none are calibrated in this
  build; the pipeline is a clearly-labelled classical baseline, not a
  neural-network claim.
- Satellite imagery chips in detail pages are labelled **DEMO IMAGERY**.
- FIRMS live-fire data is real NASA/VIIRS data when a MAP_KEY is configured.
