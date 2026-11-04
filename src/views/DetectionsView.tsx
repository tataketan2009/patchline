import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Filter, Search } from "lucide-react";
import {
  DETECTIONS,
  type Detection,
  type DetectionStatus,
  type Severity,
} from "../lib/data";
import DetectionDetail from "../components/DetectionDetail";
import { Chip, GhostButton, PrimaryButton, SeverityBadge } from "../components/ui";
import { useToast } from "../lib/toast";
import { getReview, priorityScore, REVIEW_LABEL, setReview } from "../lib/review";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const SEVERITY_DOTS: Record<Severity, string> = {
  critical: "#c75a50",
  high: "#d6a45b",
  medium: "#789477",
  low: "#5f6b62",
};
const STATUSES: DetectionStatus[] = ["new", "investigating", "resolved"];
const PAGE_SIZE = 5;

type SortKey = "date" | "areaHa" | "severity" | "priority";
const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default function DetectionsView() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [sev, setSev] = useState<Set<Severity>>(() => new Set(SEVERITIES));
  const [status, setStatus] = useState<DetectionStatus | "all">("all");
  const [region, setRegion] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detection | null>(null);

  const regionTokens = useMemo(
    () => Array.from(new Set(DETECTIONS.map((d) => d.region.split(" ")[0]))).sort(),
    [],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = DETECTIONS.filter((d) => {
      if (!sev.has(d.severity)) return false;
      if (status !== "all" && d.status !== status) return false;
      if (region !== "all" && !d.region.startsWith(region)) return false;
      if (q && !d.id.toLowerCase().includes(q) && !d.region.toLowerCase().includes(q)) return false;
      return true;
    });
    const val = (d: Detection) =>
      sortKey === "severity" ? SEVERITY_RANK[d.severity]
      : sortKey === "priority" ? priorityScore(d).score
      : sortKey === "areaHa" ? d.areaHa
      : new Date(d.date).getTime();
    const sorted = [...filtered].sort((a, b) => (asc ? 1 : -1) * (val(a) - val(b)));
    return sorted;
  }, [query, sev, status, region, sortKey, asc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSev = (s: Severity) =>
    setSev((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        if (sortKey === key) setAsc((a) => !a);
        else {
          setSortKey(key);
          setAsc(false);
        }
      }}
      className={`inline-flex items-center gap-0.5 hover:text-ink ${sortKey === key ? "text-ink" : ""}`}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sortKey === key && (asc ? <ArrowUp size={10} aria-hidden /> : <ArrowDown size={10} aria-hidden />)}
    </button>
  );

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
        <label className="sr-only" htmlFor="det-region">Region filter</label>
        <select
          id="det-region"
          value={region}
          onChange={(e) => { setRegion(e.target.value); setPage(0); }}
          className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent [&>option]:bg-panel"
        >
          <option value="all">All regions</option>
          {regionTokens.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="ml-auto flex w-full max-w-56 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5">
          <Search size={13} className="text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="ID or region…"
            aria-label="Filter detections by ID or region"
            className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <GhostButton
          onClick={() => {
            import("../lib/report").then((m) => m.downloadDetectionsCsv(rows));
            toast.push("info", "CSV export started", `${rows.length} filtered detections exported.`);
          }}
        >
          <Download size={13} aria-hidden /> CSV
        </GhostButton>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">
              Forest-change detections for the monitored region (demo data)
            </caption>
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                <th scope="col" className="px-4 py-2.5 font-medium">{sortBtn("date", "Detected")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">ID</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Region</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{sortBtn("areaHa", "Area")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium"><span className="hidden sm:inline">{sortBtn("severity", "Severity")}</span><span className="sm:hidden">Severity</span></th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">{sortBtn("priority", "Review")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((d) => (
                <tr key={d.id} className="border-b border-line transition-colors last:border-0 hover:bg-raised">
                  <td className="hidden whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-muted md:table-cell">
                    {d.date}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <button className="font-mono text-[12px] font-medium text-accent hover:underline" onClick={() => setDetail(d)}>
                      {d.id}
                    </button>
                  </td>
                  <td className="max-w-44 truncate px-4 py-2.5 text-ink">{d.region}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] tabular-nums text-ink">
                    {d.areaHa.toFixed(1)} ha
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5"><SeverityBadge severity={d.severity} /></td>
                  <td className="hidden whitespace-nowrap px-4 py-2.5 text-[11px] text-muted md:table-cell">
                    {REVIEW_LABEL[getReview(d.id).status]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <PrimaryButton
                      small
                      onClick={() => {
                        setReview(d.id, { status: "resolved" });
                        toast.push("success", `${d.id} marked resolved`, "Review status updated — reflected across dashboard, map and exports.");
                      }}
                    >
                      Resolve
                    </PrimaryButton>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-muted">
                    No detections match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>
            <span className="font-mono text-ink">{rows.length}</span> of {DETECTIONS.length} detections · page {safePage + 1}/{pageCount}
          </span>
          <span className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="rounded border border-line-strong px-2 py-0.5 font-medium text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              className="rounded border border-line-strong px-2 py-0.5 font-medium text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
            <span className="font-mono">demo-snapshot-2026-11-02</span>
          </span>
        </footer>
      </div>

      <DetectionDetail detection={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
