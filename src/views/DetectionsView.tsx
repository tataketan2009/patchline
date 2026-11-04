import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import {
  DETECTIONS,
  type Detection,
  type DetectionStatus,
  type Severity,
} from "../lib/data";
import DetectionDetail from "../components/DetectionDetail";
import { Chip, PrimaryButton, SeverityBadge, StatusBadge } from "../components/ui";
import { useToast } from "../lib/toast";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const SEVERITY_DOTS: Record<Severity, string> = {
  critical: "#c75a50",
  high: "#d6a45b",
  medium: "#789477",
  low: "#5f6b62",
};
const STATUSES: DetectionStatus[] = ["new", "investigating", "resolved"];

export default function DetectionsView() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [sev, setSev] = useState<Set<Severity>>(() => new Set(SEVERITIES));
  const [status, setStatus] = useState<DetectionStatus | "all">("all");
  const [detail, setDetail] = useState<Detection | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DETECTIONS.filter((d) => {
      if (!sev.has(d.severity)) return false;
      if (status !== "all" && d.status !== status) return false;
      if (q && !d.id.toLowerCase().includes(q) && !d.region.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, sev, status]);

  const toggleSev = (s: Severity) =>
    setSev((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const effectiveStatus = (d: Detection): DetectionStatus =>
    resolved.has(d.id) ? "resolved" : d.status;

  return (
    <section className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-3">
        <Filter size={14} className="text-muted" aria-hidden />
        {SEVERITIES.map((s) => (
          <Chip key={s} active={sev.has(s)} color={SEVERITY_DOTS[s]} onClick={() => toggleSev(s)}>
            {s}
          </Chip>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-line sm:block" aria-hidden />
        {STATUSES.map((st) => (
          <Chip key={st} active={status === st} onClick={() => setStatus(status === st ? "all" : st)}>
            {st}
          </Chip>
        ))}
        <div className="ml-auto flex w-full max-w-56 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5">
          <Search size={13} className="text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ID or region…"
            aria-label="Filter detections by ID or region"
            className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">
            Forest-change detections for the monitored region (demo data)
          </caption>
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">ID</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Detected</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Region</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Area</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Severity</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-line transition-colors last:border-0 hover:bg-raised">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <button className="font-mono text-[12px] font-medium text-accent hover:underline" onClick={() => setDetail(d)}>
                    {d.id}
                  </button>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-muted md:table-cell">
                  {d.date}
                </td>
                <td className="max-w-44 truncate px-4 py-2.5 text-ink">{d.region}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] tabular-nums text-ink">
                  {d.areaHa.toFixed(1)} ha
                </td>
                <td className="whitespace-nowrap px-4 py-2.5"><SeverityBadge severity={d.severity} /></td>
                <td className="whitespace-nowrap px-4 py-2.5"><StatusBadge status={effectiveStatus(d)} /></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <PrimaryButton
                    small
                    onClick={() => {
                      setResolved((r) => new Set(r).add(d.id));
                      toast.push("success", `${d.id} marked resolved`, "Record archived to the evidence trail.");
                    }}
                  >
                    Resolve
                  </PrimaryButton>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-muted">
                  No detections match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <footer className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>
            <span className="font-mono text-ink">{rows.length}</span> of {DETECTIONS.length} detections
          </span>
          <span className="font-mono">Dataset: demo-snapshot-2026-11-02</span>
        </footer>
      </div>

      <DetectionDetail detection={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
