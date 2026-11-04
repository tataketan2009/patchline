import { useMemo } from "react";
import { ChartColumn, Clock4, Flame, MapPinned, TrendingUp } from "lucide-react";
import { DETECTIONS, INVESTIGATIONS, MONTHLY_TREND, REGION, SEVERITY_COLOR, type Severity } from "../lib/data";
import { investigationCompletionRate, listInvestigations } from "../lib/investigations";
import { Panel, PrimaryButton } from "../components/ui";

/**
 * Analytics — every figure is computed from the clearly-labelled sample
 * dataset (mirrors GET /api/analytics on the Python backend).
 */

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <Icon size={14} className={tone ?? "text-accent"} aria-hidden />
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-2 font-mono text-[24px] font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function BarRows({ rows, unit }: { rows: { label: string; value: number; color?: string }[]; unit: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-[11px]">
            <span className="truncate text-muted">{r.label}</span>
            <span className="ml-2 font-mono tabular-nums text-ink">
              {r.value} {unit}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-raised">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? "var(--pl-accent)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MonthlyTrend() {
  const w = 320, h = 96;
  const max = Math.max(...MONTHLY_TREND.map((m) => m.value));
  const pts = MONTHLY_TREND.map((m, i) => [
    (i / (MONTHLY_TREND.length - 1)) * (w - 10) + 5,
    h - 16 - (m.value / max) * (h - 30),
  ] as const);
  const line = pts.map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-label="Forest-loss hectares per month, 12 months">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="4" x2={w - 4} y1={h - 16 - f * (h - 30)} y2={h - 16 - f * (h - 30)} stroke="var(--pl-line)" strokeWidth="0.6" />
      ))}
      <polygon points={`${line} ${w - 5},${h} 5,${h}`} fill="var(--pl-accent)" opacity="0.14" />
      <polyline points={line} fill="none" stroke="var(--pl-accent)" strokeWidth="1.8" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="1.6" fill="var(--pl-accent)" />
      ))}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="var(--pl-danger, #C75A50)" />
    </svg>
  );
}

const allStages = ["new", "assigned", "investigating", "pending-verification", "resolved", "closed"] as const;

export default function AnalyticsView() {
  const completions = useMemo(() => {
    const rows = listInvestigations();
    const done = rows.filter((r) => r.stage === "resolved" || r.stage === "closed");
    return { total: rows.length, done: done.length, rate: investigationCompletionRate() };
  }, []);

  const computed = useMemo(() => {
    const affectedHa = DETECTIONS.reduce((s, d) => s + d.areaHa, 0);
    const bySeverity = (["critical", "high", "medium", "low"] as Severity[]).map((s) => ({
      label: s, value: DETECTIONS.filter((d) => d.severity === s).length, color: SEVERITY_COLOR[s],
    }));
    const byRegion = Object.entries(
      DETECTIONS.reduce<Record<string, number>>((acc, d) => {
        const blk = d.region.split(" ")[0];
        acc[blk] = (acc[blk] ?? 0) + d.areaHa;
        return acc;
      }, {}),
    )
      .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.value - a.value);
    const validInvs = INVESTIGATIONS.length;
    const activeStages = allStages.map((st) => ({
      label: st,
      value: listInvestigations().filter((r) => r.stage === st).length,
    }));
    return { affectedHa, bySeverity, byRegion, validInvs, activeStages };
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-3">
        <ChartColumn size={14} className="text-muted" aria-hidden />
        <h1 className="text-[13px] font-semibold text-ink">Analytics — Pakhal sector</h1>
        <span className="ml-auto font-mono text-[10px] text-muted">
          computed from the labelled sample dataset · mirrors <code>GET /api/analytics</code>
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={MapPinned} label="Monitored area" value={`${REGION.monitoredKm2} km²`} sub={REGION.subregion} />
        <Kpi icon={Flame} label="Total affected" value={`${computed.affectedHa.toFixed(1)} ha`} sub="across all sample detections" tone="text-danger" />
        <Kpi icon={ChartColumn} label="Detections" value={String(DETECTIONS.length)} sub="current dataset snapshot" />
        <Kpi
          icon={Clock4}
          label="Investigation completion"
          value={completions.rate != null ? `${completions.rate}%` : "—"}
          sub={`${completions.done} of ${completions.total} resolved/closed`}
          tone="text-warn"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Monthly forest-loss trend" meta={<span className="font-mono text-[10px] text-muted">hectares / month</span>}>
          <div className="p-4">
            <MonthlyTrend />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
              <span>{MONTHLY_TREND[0].label}</span>
              <span>{MONTHLY_TREND[MONTHLY_TREND.length - 1].label}</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
              <TrendingUp size={11} aria-hidden /> Rolling 12-month trend (demo series); production data lands
              pipeline-sourced hectares here.
            </p>
          </div>
        </Panel>

        <Panel title="Severity distribution">
          <div className="p-4">
            <BarRows rows={computed.bySeverity.map((r) => ({ ...r, unit: r.value === 1 ? "detection" : "detections" }))} unit="" />
          </div>
        </Panel>

        <Panel title="Region-wise affected area">
          <div className="p-4">
            <BarRows rows={computed.byRegion} unit="ha" />
          </div>
        </Panel>

        <Panel title="Investigation pipeline by stage">
          <div className="p-4">
            <BarRows rows={computed.activeStages.map((r) => ({ ...r, unit: "cases" }))} unit="" />
            <p className="mt-3 text-[11px] text-muted">
              {computed.validInvs} investigations linked to detections · states follow the officer workflow.
            </p>
          </div>
        </Panel>
      </div>

      {/* Export */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-3">
        <p className="text-[12px] text-muted">Export the detection dataset for GIS or spreadsheet analysis:</p>
        <PrimaryButton
          className="ml-auto"
          onClick={() => {
            import("../lib/report").then((m) => m.downloadDetectionsCsv(DETECTIONS));
          }}
          small={false}
        >
          Download CSV
        </PrimaryButton>
      </div>
    </section>
  );
}
