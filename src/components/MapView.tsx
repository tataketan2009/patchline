import { useEffect, useMemo, useRef, useState } from "react";
import { Map as LeafletMap } from "leaflet";
import {
  MapContainer,
  CircleMarker,
  Polygon,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  Crosshair,
  Flame,
  Layers,
  Search,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  DETECTIONS,
  REGION,
  REGION_BOUNDARY,
  SEVERITY_COLOR,
  type Detection,
  type Severity,
} from "../lib/data";
import { Chip } from "./ui";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../lib/toast";
import { downloadEvidenceReport } from "../lib/report";
import { parseGeoJSON } from "../lib/geojson";

/* ------------------------------------------------------------------ */
/* Basemaps                                                            */
/* ------------------------------------------------------------------ */const BASEMAPS = {
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
    maxNativeZoom: 18,
    maxZoom: 19,
  },
  terrain: {
    label: "Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: " Tiles © Esri — Source: USGS, Esri, FAA",
    maxNativeZoom: 18,
    maxZoom: 19,
  },
  dark: {
    label: "Dark",
    url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors © CARTO",
    maxNativeZoom: 20,
    maxZoom: 20,
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

/**
 * Synthetic demo imagery thumbnail (no live change-imagery backend).
 * Rendered as pure CSS so the panel works offline.
 */
function ImageryThumb({ before }: { before: boolean }) {
  const canopy = before
    ? "radial-gradient(circle at 22% 30%, rgba(120,148,119,.55) 0 12%, transparent 13%), radial-gradient(circle at 62% 22%, rgba(94,118,96,.5) 0 10%, transparent 11%), radial-gradient(circle at 44% 66%, rgba(120,148,119,.45) 0 14%, transparent 15%), radial-gradient(circle at 78% 70%, rgba(94,118,96,.5) 0 11%, transparent 12%), radial-gradient(circle at 14% 78%, rgba(120,148,119,.4) 0 9%, transparent 10%)"
    : "radial-gradient(circle at 18% 34%, rgba(120,148,119,.35) 0 8%, transparent 9%), radial-gradient(circle at 55% 60%, rgba(199,90,80,.75) 0 26%, transparent 27%), radial-gradient(circle at 74% 26%, rgba(94,118,96,.4) 0 7%, transparent 8%), radial-gradient(circle at 84% 76%, rgba(214,164,91,.55) 0 12%, transparent 13%)";
  return (
    <div className="flex flex-1">
      <div
        className="h-24 w-full rounded-md border border-line-strong sm:h-28"
        style={{ backgroundColor: "var(--pl-raised)", backgroundImage: canopy, backgroundSize: "520% 520%" }}
      />
      <p className="mt-1.5 shrink-0 font-mono text-[10px] text-muted">{before ? "BEFORE" : "AFTER"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Map helpers                                                        */
/* ------------------------------------------------------------------ */

/** Recenter the map programmatically. Keyed on the target. */
function FlyTo({ target, zoom }: { target: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom, { duration: 0.6 });
  }, [target, zoom, map]);
  return null;
}

/* ------------------------------------------------------------------ */
/* DetectionPanel — contextual info for the selected polygon           */
/* ------------------------------------------------------------------ */

export function DetectionPanel({
  detection,
  onClose,
  onResolve,
  onEscalate,
}: {
  detection: Detection;
  onClose: () => void;
  onResolve: (d: Detection) => void;
  onEscalate: (d: Detection) => void;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 14 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      aria-label={`Detection ${detection.id}`}
      className="glass pointer-events-auto absolute inset-x-3 top-3 bottom-3 z-[900] flex flex-col overflow-y-auto rounded-lg p-4 sm:inset-x-auto sm:right-3 sm:w-[22.5rem]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[13px] font-medium text-ink">{detection.id}</p>
          <p className="mt-0.5 text-[11px] text-muted">{detection.region}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detection panel"
          className="rounded p-1 text-muted transition-colors hover:text-ink"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[13px]">
        <div className="rounded-md border border-line bg-panel px-3 py-2.5">
          <dt className="text-[10px] tracking-wide text-muted uppercase">Affected area</dt>
          <dd className="mt-1 font-mono text-ink">{detection.areaHa.toFixed(1)} ha</dd>
        </div>
        <div className="rounded-md border border-line bg-panel px-3 py-2.5">
          <dt className="text-[10px] tracking-wide text-muted uppercase">Detected</dt>
          <dd className="mt-1 font-mono text-ink">{detection.date}</dd>
        </div>
        <div className="col-span-2 rounded-md border border-line bg-panel px-3 py-2.5">
          <dt className="text-[10px] tracking-wide text-muted uppercase">Centroid coordinates</dt>
          <dd className="mt-1 font-mono text-ink">
            <span className="tabular-nums">{detection.lat.toFixed(4)}°</span>, {detection.lon.toFixed(4)}°
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <Chip
          active={detection.severity === "critical" || detection.severity === "high"}
          color={SEVERITY_COLOR[detection.severity]}
          onClick={() => {}}
        >
          {detection.severity === "critical" || detection.severity === "high"
            ? "Priority investigation"
            : "Routine review"}
        </Chip>
      </div>

      <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Before / after imagery</h3>
      <div className="mt-1.5 flex gap-2">
        <ImageryThumb before />
        <ImageryThumb before={false} />
      </div>
      <p className="mt-1 text-[10px] text-muted">
        Synthetic demo imagery — production renders image chips from the ingest pipeline.
      </p>

      <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Evidence</h3>
      {detection.evidence ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Available: Sentinel-2 chips, polygon shapefile, activity trail
        </p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
          Pending capture — next pass scheduled
        </p>
      )}

      <div className="mt-4 flex gap-2 border-t border-line pt-3">
        <button
          onClick={() => {
            location.hash = `#/detection/${detection.id}`;
            onClose();
          }}
          className="flex-1 rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-raised"
        >
          Full page ↗
        </button>
        <button
          onClick={() => downloadEvidenceReport(detection)}
          className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-raised"
          aria-label="Download evidence report"
        >
          Report
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onEscalate(detection)}
          disabled={detection.status === "investigating"}
          className="flex-1 rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
        >
          Escalate
        </button>
        <button
          onClick={() => onResolve(detection)}
          disabled={detection.status === "resolved"}
          className="flex-1 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-transform hover:bg-accent/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mark resolved
        </button>
      </div>
    </motion.aside>
  );
}

/* ------------------------------------------------------------------ */
/* MapView                                                            */
/* ------------------------------------------------------------------ */

export default function MapView({
  selectedId,
  onSelect,
  onResolve,
  onEscalate,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onResolve: (d: Detection) => void;
  onEscalate: (d: Detection) => void;
}) {
  const toast = useToast();
  const mapRef = useRef<LeafletMap | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState(11);
  const [basemap, setBasemap] = useState<BasemapKey>("satellite");
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(
    () => new Set<Severity>(["critical", "high", "medium", "low"]),
  );
  const [query, setQuery] = useState("");
  const [imported, setImported] = useState<{ key: number; positions: [number, number][] }[]>([]);
  const [showFires, setShowFires] = useState(false);
  const [fireDots, setFireDots] = useState<
    { id: string; lat: number; lon: number; frp: number; date: string; conf: string }[]
  >([]);
  const [dateCut, setDateCut] = useState<0 | 14 | 90>(0);
  const [regionFilter, setRegionFilter] = useState("all");

  const regionTokens = useMemo(
    () => Array.from(new Set(DETECTIONS.map((d) => d.region.split(" ")[0]))).sort(),
    [],
  );

  const refDate = useMemo(() => new Date("2026-11-02"), []);
  const daysSince = (d: Detection) => Math.round((refDate.getTime() - new Date(d.date).getTime()) / 86400000);

  const visible = useMemo(
    () =>
      DETECTIONS.filter(
        (d) =>
          activeSeverities.has(d.severity) &&
          (dateCut === 0 || daysSince(d) <= dateCut) &&
          (regionFilter === "all" || d.region.startsWith(regionFilter)),
      ),
    [activeSeverities, regionFilter, dateCut, daysSince],
  );


  /** Fetches NASA FIRMS VIIRS hotspots for the sanctuary box (needs dev proxy + MAP_KEY). */
  const toggleFires = async () => {
    if (showFires) {
      setShowFires(false);
      return;
    }
    // Key precedence: visitor's own key (Settings) → build-time env var (baked in on Render) → none
    const key =
      localStorage.getItem("firms-map-key") ||
      (import.meta.env.VITE_FIRMS_KEY as string | undefined) ||
      "";
    if (!key) {
      toast.push("warning", "FIRMS key missing", "Paste your free NASA FIRMS MAP_KEY in Settings to enable live fire data.");
      return;
    }
    // west,south,east,north box around the sanctuary, last 24 h.
    // Format per FIRMS docs: /api/area/csv/{MAP_KEY}/{SOURCE}/{AREA}/{DAY_RANGE}
    // Production: call FIRMS directly. Local dev: fall back to the Vite proxy at /firms.
    const path = `/api/area/csv/${key}/VIIRS_NOAA20_NRT/79.71,17.71,80.06,18.14/1`;
    let res: Response;
    try {
      res = await fetch(`https://firms.modaps.eosdis.nasa.gov${path}`);
      if (!res.ok) throw new Error("direct");
    } catch {
      res = await fetch(`/firms${path}`);
    }
    try {
      if (!res.ok) {
        throw new Error(res.status === 403 ? "invalid key" : `HTTP ${res.status}`);
      }
      const text = await res.text();
      if (text.trim().toLowerCase().startsWith("invalid")) {
        throw new Error("FIRMS rejected the request — check the MAP_KEY and source name.");
      }
      const lines = text.trim().startsWith("latitude") ? text.trim().split("\n").slice(1) : text.trim().split("\n");
      const dots = lines
        .filter((l) => l.trim().length > 10)
        .map((l, i) => {
          const c = l.split(",");
          return {
            id: `F${i}-${c[6] ?? ""}`,
            lat: Number(c[0]),
            lon: Number(c[1]),
            frp: Number(c[11]),
            date: c[6] ?? "",
            conf: (c[8] ?? "nominal").trim(),
          };
        })
        .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon) && Math.abs(d.lat) < 90 && Math.abs(d.lon) < 180);
      setFireDots(dots);
      setShowFires(true);
      toast.push(
        dots.length > 0 ? "warning" : "info",
        `${dots.length} live hotspot${dots.length === 1 ? "" : "s"}`,
        `VIIRS/NOAA-20 · last 24 h · Pakhal sanctuary box${dots.length > 0 ? " — plotted in red-orange" : ""}`,
      );
    } catch {
      toast.push(
        "danger",
        "FIRMS fetch failed",
        "Run `npm run dev` (the proxy only works there) and check your MAP_KEY in Settings.",
      );
    }
  };

  const onImportFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const gj = JSON.parse(String(reader.result));
        const rings = parseGeoJSON(gj);
        if (rings.length === 0) throw new Error("no polygons");
        setImported((prev) => [
          ...prev,
          ...rings.map((positions, i) => ({ key: Date.now() + i, positions })),
        ]);
        toast.push(
          "success",
          `Imported ${file.name}`,
          `${rings.length} polygon${rings.length === 1 ? "" : "s"} added as analyst layer.`,
        );
      } catch {
        toast.push("danger", "Import failed", "Could not read a Polygon or FeatureCollection from that file.");
      }
    };
    reader.readAsText(file);
  };


  const selected = useMemo(() => DETECTIONS.find((d) => d.id === selectedId) ?? null, [selectedId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return DETECTIONS.filter((d) => d.id.toLowerCase().includes(q) || d.region.toLowerCase().includes(q)).slice(0, 5);
  }, [query]);

  const toggleSeverity = (s: Severity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const flyToDetection = (d: Detection) => {
    setFlyTarget([d.lat, d.lon]);
    setFlyZoom(13);
    onSelect(d.id);
    setQuery("");
  };

  const resetView = () => {
    setFlyTarget(REGION.center);
    setFlyZoom(10.25);
    onSelect(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-line bg-canvas">
      <MapContainer
        ref={(m) => {
          mapRef.current = m;
        }}
        center={REGION.center}
        zoom={10.25}
        zoomSnap={0.25}
        minZoom={7}
        maxZoom={19}
        zoomControl={false}
        attributionControl
        className="h-full w-full"
        aria-label="Satellite monitoring map"
      >
        <TileLayer {...BASEMAPS[basemap]} />
        <ScaleControl position="bottomleft" imperial={false} />
        <FlyTo target={flyTarget} zoom={flyZoom} />

        {/* Forest concession boundary */}
        <Polygon
          positions={REGION_BOUNDARY}
          pathOptions={{
            color: "var(--pl-accent)",
            weight: 1.5,
            dashArray: "6 6",
            fill: false,
            opacity: 0.9,
          }}
          interactive={false}
        />

        {/* Detection polygons */}
        {visible.map((d) => {
          const isSel = d.id === selectedId;
          return (
            <Polygon
              key={d.id}
              positions={d.polygon}
              className="pl-poly"
              pathOptions={{
                color: SEVERITY_COLOR[d.severity],
                fillColor: SEVERITY_COLOR[d.severity],
                fillOpacity: isSel ? 0.4 : 0.2,
                weight: isSel ? 3 : 1.5,
                opacity: isSel ? 1 : 0.8,
              }}
              eventHandlers={{
                click: () => onSelect(isSel ? null : d.id),
              }}
            />
          );
        })}

        {/* Analyst-imported layers (e.g. NDVI change polygons) */}
        {imported.map((im) => (
          <Polygon
            key={im.key}
            positions={im.positions}
            pathOptions={{
              color: "#789477",
              fillColor: "#789477",
              fillOpacity: 0.18,
              weight: 2,
              dashArray: "3 4",
            }}
          />
        ))}

        {/* NASA FIRMS live fire hotspots */}
        {showFires &&
          fireDots.map((f) => (
            <CircleMarker
              key={f.id}
              center={[f.lat, f.lon]}
              radius={6}
              pathOptions={{
                color: "#ff7a45",
                weight: 1.5,
                fillColor: "#c75a50",
                fillOpacity: 0.85,
              }}
            >
              <Tooltip>
                <span className="font-mono text-[10px]">
                  {f.date} · FRP {Number.isFinite(f.frp) ? f.frp.toFixed(1) : "—"} MW · {f.conf}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Floating controls — the only place glassmorphism is allowed */}
      <div className="pointer-events-none absolute inset-0">
        {/* Search + filters */}
        <div className="pointer-events-auto absolute top-3 left-3 z-[800] flex max-w-[calc(100%-3.5rem)] flex-col gap-2">
          <div className="glass relative flex items-center gap-2 rounded-md px-2.5 py-2">
            <Search size={13} className="text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search detections…"
              aria-label="Search detections"
              className="w-44 bg-transparent text-[12px] text-ink outline-none placeholder:text-muted [&:not(:placeholder-shown)]:w-56"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted hover:text-ink">
                <X size={12} aria-hidden />
              </button>
            )}
            {results.length > 0 && (
              <ul className="glass absolute top-full left-0 mt-1 w-64 overflow-hidden rounded-md p-1" role="listbox">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => flyToDetection(r)}
                      role="option"
                      aria-selected={false}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[12px] text-ink transition-colors hover:bg-raised"
                    >
                      <span className="font-mono">{r.id}</span>
                      <span className="truncate text-muted">{r.region}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass flex items-center gap-1.5 rounded-md px-2 py-1.5">
            <span className="pl-1 pr-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Dates</span>
            {([0, 14, 90] as const).map((days) => (
              <Chip key={days} active={dateCut === days} onClick={() => setDateCut(days)}>
                {days === 0 ? "All" : `≤${days}d`}
              </Chip>
            ))}
          </div>

          <div className="glass flex items-center gap-2 rounded-md px-2 py-1.5">
            <span className="pl-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Region</span>
            <label className="sr-only" htmlFor="region-filter">
              Filter by region
            </label>
            <select
              id="region-filter"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-ink outline-none [&>option]:bg-panel"
            >
              <option value="all">All regions</option>
              {regionTokens.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="glass flex items-center gap-1.5 rounded-md px-2 py-1.5">
            <span className="pl-1 pr-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Severity</span>
            {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
              <Chip key={s} active={activeSeverities.has(s)} color={SEVERITY_COLOR[s]} onClick={() => toggleSeverity(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>

        {/* Detection info panel — mounted directly on the map area, so on
            phones its width tracks the map rather than the zoom controls. */}
        {selected && (
          <AnimatePresence>
            <DetectionPanel
              detection={selected}
              onClose={() => onSelect(null)}
              onResolve={onResolve}
              onEscalate={onEscalate}
            />
          </AnimatePresence>
        )}

        {/* Zoom + recenter, right edge */}
        <div className="pointer-events-auto absolute top-3 right-3 z-[810] flex flex-col items-end gap-2">
          {!selected && (
            <div className="glass flex flex-col overflow-hidden rounded-md">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                aria-label="Zoom in"
                className="border-b border-[color:var(--pl-glass-line)] p-2 text-ink transition-colors hover:bg-raised"
              >
                <ZoomIn size={15} aria-hidden />
              </button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                aria-label="Zoom out"
                className="p-2 text-ink transition-colors hover:bg-raised"
              >
                <ZoomOut size={15} aria-hidden />
              </button>
            </div>
          )}
          {!selected && (
            <button
              onClick={resetView}
              aria-label="Recenter on monitoring region"
              className="glass rounded-md p-2 text-ink transition-colors hover:bg-raised"
            >
              <Crosshair size={15} aria-hidden />
            </button>
          )}
        </div>

        {/* Legend */}
        {!selected && (
          <div className="glass pointer-events-auto absolute bottom-16 left-3 z-[800] rounded-md p-2.5">
            <p className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Legend</p>
            <ul className="space-y-1">
              {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
                <li key={s} className="flex items-center gap-1.5 text-[11px] text-ink">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[s] }} aria-hidden />
                  <span className="capitalize">{s} detection</span>
                </li>
              ))}
              <li className="flex items-center gap-1.5 text-[11px] text-ink">
                <span
                  className="w-4 border-t-2 border-dashed"
                  style={{ borderColor: "var(--pl-accent)" }}
                  aria-hidden
                />
                Sanctuary boundary
              </li>
              <li className="flex items-center gap-1.5 text-[11px] text-ink">
                <span className="w-4 border-t-2 border-dashed border-accent" aria-hidden />
                Analyst / imported layers
              </li>
              {showFires && (
                <li className="flex items-center gap-1.5 text-[11px] text-ink">
                  <span className="h-2 w-2 rounded-full bg-warn" aria-hidden />
                  Live FIRMS hotspot
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Layer switcher + analyst import */}
        <div className="glass pointer-events-auto absolute bottom-9 left-3 z-[800] flex items-center gap-0.5 rounded-md p-1">
          <Layers size={13} className="mr-1 ml-1 text-muted" aria-hidden />
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setBasemap(k)}
              aria-pressed={basemap === k}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                basemap === k ? "bg-raised text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {BASEMAPS[k].label}
            </button>
          ))}
          <label
            className="mt-0.5 cursor-pointer rounded px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-raised"
            title="Import NDVI change polygons or any GeoJSON file"
          >
            <span className="inline-flex items-center gap-1">
              <Upload size={12} aria-hidden />
              Import
            </span>
            <input
              type="file"
              accept=".json,.geojson,application/geo+json,application/json"
              className="sr-only"
              onChange={(e) => {
                onImportFile(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button
            onClick={toggleFires}
            aria-pressed={showFires}
            title="NASA FIRMS live fire hotspots (last 24 h)"
            className={`ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              showFires ? "bg-danger-soft text-danger" : "text-muted hover:text-ink"
            }`}
          >
            <Flame size={12} aria-hidden />
            Fires
          </button>
        </div>
      </div>
    </div>
  );
}
