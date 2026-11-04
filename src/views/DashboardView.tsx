import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight as Chevron,
  Clock,
  Cpu,
  Database,
  FileText,
  Globe2,
  Leaf,
  RefreshCw,
  Radar,
  Satellite,
  ShieldAlert,
  TriangleAlert,
  TrendingDown,
} from "lucide-react";
import {
  ACTIVITY,
  ALERTS,
  DETECTIONS,
  INVESTIGATIONS,
  MONTHLY_TREND,
  REGION,
  SEVERITY_COLOR,
  STATS,
  WEEKLY_HISTORY,
  type Detection,
} from "../lib/data";
import MapView from "../components/MapView";
import DetectionDetail from "../components/DetectionDetail";
import { ConfirmDialog, Panel, SeverityBadge, Skeleton, StatusBadge } from "../components/ui";
import { priorityScore } from "../lib/review";
import { useToast } from "../lib/toast";
import type { ViewId } from "../components/Sidebar";

/* ------------------------------------------------------------------ */
/* Stat card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaDir,
  note,
  loading,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  delta: string;
  deltaDir: "up" | "down";
  note: string;
  loading: boolean;
}) {
  return (
    <Panel bodyClassName="p-4">
      {loading ? (
        <>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-3 h-3 w-28" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-medium whitespace-nowrap uppercase tracking-wider text-muted">
              {label}
            </p>
            <Icon size={15} className="shrink-0 text-muted" aria-hidden />
          </div>
          <p className="mt-2.5 font-mono text-[27px] leading-none font-medium tabular-nums text-ink sm:text-[30px]">
            {value}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted">
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 font-medium ${
                deltaDir === "up" ? "text-danger" : "text-accent"
              }`}
              aria-label={`${deltaDir === "up" ? "Increasing" : "Decreasing"}`}
            >
              {deltaDir === "up" ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
              {delta}
            </span>
            <span className="min-w-0 truncate">{note}</span>
          </p>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Charts — lightweight inline SVG, mono ticks, no decoration          */
/* ------------------------------------------------------------------ */

function TrendChart() {
  const max = Math.max(...MONTHLY_TREND.map((m) => m.value));
  const w = 300;
  const h = 84;
  const pts = MONTHLY_TREND.map((m, i) => [
    (i / (MONTHLY_TREND.length - 1)) * (w - 8) + 4,
    h - 14 - (m.value / max) * (h - 26),
  ] as const);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `${line} ${w - 4},${h} 4,${h}`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Monthly forest-loss trend, hectares">
        <polygon points={area} fill="var(--pl-accent)" opacity="0.12" />
        <polyline points={line} fill="none" stroke="var(--pl-accent)" strokeWidth="1.6" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill="var(--pl-accent)" />
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-muted">
        <span>{MONTHLY_TREND[0].label}</span>
        <span>{MONTHLY_TREND[Math.floor(MONTHLY_TREND.length / 2)].label}</span>
        <span>Oct</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-muted">
          Loss peaked at <span className="font-mono text-ink">{max} ha</span> — dry season.
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
          <TrendingDown size={11} aria-hidden /> +38%
        </span>
      </div>
    </div>
  );
}

function HistoryBars() {
  const max = Math.max(...WEEKLY_HISTORY.map((w) => w.count));
  return (
    <div>
      <div className="flex h-24 gap-1">
        {WEEKLY_HISTORY.map((w) => (
          <div key={w.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[9px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
              {w.count}
            </span>
            <div
              className="w-full rounded-sm bg-accent/70 transition-colors group-hover:bg-accent"
              style={{ height: `${(w.count / max) * 100}%` }}
              title={`${w.label}: ${w.count} detections`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 font-mono text-[9px] text-muted">
        {WEEKLY_HISTORY.map((w) => (
          <span key={w.label} className="flex-1 text-center">
            {w.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  triage: "Triage",
  "field-verification": "Field verification",
  "evidence-review": "Evidence review",
  enforcement: "Enforcement",
};

function InvestigationBars() {
  const counts = INVESTIGATIONS.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.stage] = (acc[inv.stage] ?? 0) + 1;
    return acc;
  }, {});
  const total = INVESTIGATIONS.length;
  return (
    <ul className="space-y-2.5">
      {Object.entries(STAGE_LABELS).map(([stage, label]) => {
        const n = counts[stage] ?? 0;
        return (
          <li key={stage}>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted">{label}</span>
              <span className="font-mono text-ink">
                {n}/{total}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-raised">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(n / total) * 100}%`, backgroundColor: n === 0 ? "var(--pl-line-strong)" : undefined }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const ACTIVITY_ICON: Record<string, { icon: typeof TriangleAlert; className: string }> = {
  detection: { icon: Radar, className: "text-accent bg-accent-soft" },
  alert: { icon: TriangleAlert, className: "text-danger bg-danger-soft" },
  report: { icon: FileText, className: "text-muted bg-raised" },
  sync: { icon: Database, className: "text-warn bg-warn-soft" },
};

/* ------------------------------------------------------------------ */
/* Dashboard view                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [mapSelected, setMapSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detection | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Detection | null>(null);

  // Honest sample-set statistics computed from the data module
  const affectedHa = DETECTIONS.reduce((s, d) => s + d.areaHa, 0);
  const sampleSet = DETECTIONS.length;
  const newCount = DETECTIONS.filter((d) => d.status === "new" && d.date >= "2026-10-26").length;
  const highCount = DETECTIONS.filter((d) => d.severity === "critical" || d.severity === "high").length;
  const priorityQueue = [...DETECTIONS]
    .map((d) => ({ d, score: priorityScore(d).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 850);
    return () => window.clearTimeout(t);
  }, []);

  const selected = DETECTIONS.find((d) => d.id === mapSelected) ?? null;
  const recent = DETECTIONS.slice(0, 4);
  const activeAlerts = ALERTS.filter((a) => !a.read).slice(0, 3);

  return (
    <div className="space-y-3">
      {/* Row 1 — overview */}
      <div className="grid grid-cols-12 gap-3">
        <Panel bodyClassName="" className="col-span-12 md:col-span-8">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Leaf size={16} className="text-accent" aria-hidden />
                Good morning, Officer Silva
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1 font-medium text-ink">
                  <Globe2 size={12} aria-hidden />
                  {REGION.name}
                </span>
                · {REGION.subregion} · <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden />synced {REGION.lastUpdated}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2.5 py-1.5 font-mono text-[11px] text-muted">
                <RefreshCw size={12} className="text-accent" aria-hidden />
                Sentinel-2 v4.2
              </span>
            </div>
          </div>
        </Panel>

        <Panel bodyClassName="" className="col-span-12 md:col-span-4">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-line text-center md:grid-cols-3">
            {[
              { label: "Ingest", value: "OK", cls: "text-accent" },
              { label: "Model", value: "v4.2", cls: "text-ink font-mono" },
              { label: "Queue", value: "23", cls: "text-warn font-mono" },
            ].map((c) => (
              <div key={c.label} className="bg-panel px-2 py-3">
                <p className={`text-[13px] font-semibold ${c.cls}`}>{c.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{c.label}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 2 — statistics: 2 cols on phones, 5 across from tablet up.
          Values computed from the labelled sample dataset, not invented. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={Globe2}
          label="Monitored area"
          value={`${STATS.monitoredKm2.toLocaleString()} km²`}
          delta="2.1%"
          deltaDir="down"
          note="expansion this quarter"
          loading={loading}
        />
        <StatCard
          icon={Radar}
          label="Area affected"
          value={`${affectedHa.toFixed(1)} ha`}
          delta={`${sampleSet}`}
          deltaDir="up"
          note="in sample detections"
          loading={loading}
        />
        <StatCard
          icon={Leaf}
          label="New detections"
          value={String(newCount)}
          delta="2"
          deltaDir="up"
          note="last 7 days"
          loading={loading}
        />
        <StatCard
          icon={ShieldAlert}
          label="High priority"
          value={String(highCount)}
          delta="3"
          deltaDir="down"
          note="cleared this week"
          loading={loading}
        />
        <StatCard
          icon={FileText}
          label="Pending cases"
          value={String(STATS.pendingInvestigations)}
          delta="2"
          deltaDir="up"
          note="due over 72 h"
          loading={loading}
        />
      </div>

      {/* Row 3 — map + side information */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-8">
          <div className="h-[420px] sm:h-[500px] lg:h-[560px]">
            <MapView
              selectedId={mapSelected}
              onSelect={setMapSelected}
              onResolve={setResolveTarget}
              onEscalate={(d) => {
                setMapSelected(null);
                toast.push("warning", `${d.id} escalated`, "Moved to the front of the investigation queue (demo).");
              }}
            />
            {/* Exported from MapView internals for readability when a polygon is picked */}
            {selected && (
              <p className="sr-only" role="status">
                Selected detection {selected.id}, {SEVERITY_COLOR[selected.severity]}
              </p>
            )}
          </div>
        </div>

        <div className="col-span-12 flex flex-col gap-3 lg:col-span-4">
          <Panel title="Priority queue" meta={<span className="font-mono text-[10px] text-muted">score /100</span>}>
            {loading ? (
              <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <ul className="divide-y divide-line">
                {priorityQueue.map(({ d, score }) => (
                  <li key={d.id}>
                    <button
                      onClick={() => {
                        window.location.hash = `#/detection/${d.id}`;
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLOR[d.severity] }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12px] text-ink">{d.id}</span>
                        <span className="block truncate text-[11px] text-muted">{d.region}</span>
                      </span>
                      <span
                        className={`font-mono text-[13px] font-semibold tabular-nums ${
                          score >= 70 ? "text-danger" : score >= 45 ? "text-warn" : "text-accent"
                        }`}
                      >
                        {score}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="System status" meta={<span className="font-mono text-[10px] text-muted">demo</span>}>
            <ul className="divide-y divide-line text-[12px]">
              <li className="flex items-center gap-2.5 px-4 py-2.5">
                <Satellite size={13} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">Sentinel-2 imagery sync</span>
                  <span className="block font-mono text-[10px] text-muted">L2A · last ingest 2026-11-02 07:12 UTC</span>
                </span>
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">synced</span>
              </li>
              <li className="flex items-center gap-2.5 px-4 py-2.5">
                <Cpu size={13} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">Change-detection model</span>
                  <span className="block font-mono text-[10px] text-muted">baseline NDVI-diff v0 · no calibrated confidence</span>
                </span>
                <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-warn">baseline</span>
              </li>
              <li className="flex items-center gap-2.5 px-4 py-2.5">
                <Database size={13} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">Detection store</span>
                  <span className="block font-mono text-[10px] text-muted">SQLite (backend) · mirrored locally in demo</span>
                </span>
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">ok</span>
              </li>
            </ul>
          </Panel>

          <Panel title="Recent detections" meta={<span className="font-mono text-[10px] text-muted">48 h</span>} action={<button onClick={() => onNavigate("detections")} className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent-soft">All<Chevron size={12} /></button>}>
            {loading ? (
              <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => setDetail(d)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLOR[d.severity] }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12px] text-ink">{d.id}</span>
                        <span className="block truncate text-[11px] text-muted">{d.region}</span>
                      </span>
                      <span className="font-mono text-[12px] text-muted">{d.areaHa.toFixed(1)} ha</span>
                      <StatusBadge status={d.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Priority alerts" action={<button onClick={() => onNavigate("alerts")} className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent-soft">Archive<Chevron size={12} /></button>}>
            {loading ? (
              <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <ul className="divide-y divide-line">
                {activeAlerts.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <span className="ml-auto font-mono text-[10px] text-muted">{a.id}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-snug text-ink">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{a.region} · {a.time}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Row 4 — analysis */}
      <div className="grid grid-cols-12 gap-3">
        <Panel
          title="Forest-loss trend"
          meta={<span className="font-mono text-[10px] text-muted">12 mo · ha / month</span>}
          className="col-span-12 lg:col-span-4"
        >
          <div className="p-4">{loading ? <Skeleton className="h-28 w-full" /> : <TrendChart />}</div>
        </Panel>

        <Panel
          title="Detection history"
          meta={<span className="font-mono text-[10px] text-muted">8 wk</span>}
          className="col-span-6 lg:col-span-2"
        >
          <div className="p-4">{loading ? <Skeleton className="h-28 w-full" /> : <HistoryBars />}</div>
        </Panel>

        <Panel title="Recent activity" className="col-span-12 lg:col-span-3">
          {loading ? (
            <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : (
            <ul className="px-4 py-3">
              {ACTIVITY.slice(0, 5).map((a, i) => {
                const cfg = ACTIVITY_ICON[a.type];
                const Icon = cfg.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5 py-1.5">
                    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ${cfg.className}`}>
                      <Icon size={12} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] leading-snug text-ink">{a.text}</span>
                      <span className="block text-[10px] text-muted">
                        {a.user} · {a.time}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Investigation pipeline" className="col-span-6 lg:col-span-3">
          <div className="p-4">{loading ? <Skeleton className="h-28 w-full" /> : <InvestigationBars />}</div>
        </Panel>
      </div>

      <DetectionDetail detection={detail} onClose={() => setDetail(null)} />

      <ConfirmDialog
        open={resolveTarget !== null}
        onClose={() => setResolveTarget(null)}
        onConfirm={() => {
          if (resolveTarget) {
            setMapSelected(null);
            toast.push(
              "success",
              `${resolveTarget.id} resolved`,
              "Detection closed and archived to the evidence trail (demo).",
            );
          }
        }}
        title="Mark detection resolved?"
        body={
          resolveTarget
            ? `Detection ${resolveTarget.id} (${resolveTarget.areaHa.toFixed(1)} ha, ${resolveTarget.region}) will be closed in this demo session. In production this writes to the enforcement record and publishes the evidence bundle.`
            : ""
        }
        confirmLabel="Resolve detection"
      />
    </div>
  );
}
