import { useMemo, useState } from "react";
import { Archive, BellOff, Search, TriangleAlert } from "lucide-react";
import { ALERTS, DETECTIONS, SEVERITY_COLOR, type Alert, type Severity } from "../lib/data";
import { GhostButton, PrimaryButton } from "../components/ui";
import { useToast } from "../lib/toast";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export default function AlertsView() {
  const toast = useToast();
  const [read, setRead] = useState<Set<string>>(
    () => new Set(ALERTS.filter((a) => a.read).map((a) => a.id)),
  );
  const [sev, setSev] = useState<Set<Severity>>(() => new Set(SEVERITIES));
  const [region, setRegion] = useState("all");
  const [query, setQuery] = useState("");

  const regions = useMemo(() => Array.from(new Set(ALERTS.map((a) => a.region.split(" ")[0]))).sort(), []);

  const rows = useMemo(
    () =>
      ALERTS.filter((a) => {
        if (!sev.has(a.severity)) return false;
        if (region !== "all" && !a.region.startsWith(region)) return false;
        const q = query.trim().toLowerCase();
        if (q && !a.title.toLowerCase().includes(q) && !a.region.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false;
        return true;
      }),
    [sev, region, query],
  );

  const isRead = (a: Alert) => read.has(a.id);

  /** Related detections share the same block token as the alert region. */
  const relatedDetection = (a: Alert) => {
    const block = a.region.split(" ")[0];
    return DETECTIONS.find((d) => d.region.startsWith(block)) ?? null;
  };

  const toggleSev = (s: Severity) =>
    setSev((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <section className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-3">
        <TriangleAlert size={14} className="text-muted" aria-hidden />
        {SEVERITIES.map((s) => (
          <button
            key={s}
            onClick={() => toggleSev(s)}
            aria-pressed={sev.has(s)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              sev.has(s) ? "text-ink" : "text-muted hover:text-ink"
            }`}
            style={{
              borderColor: sev.has(s) ? `${SEVERITY_COLOR[s]}88` : "var(--pl-line-strong)",
              backgroundColor: sev.has(s) ? `${SEVERITY_COLOR[s]}1f` : "transparent",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[s] }} aria-hidden />
            {s}
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-line sm:block" aria-hidden />
        <label className="sr-only" htmlFor="alert-region">
          Filter by region
        </label>
        <select
          id="alert-region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent [&>option]:bg-panel"
        >
          <option value="all">All regions</option>
          {regions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="ml-auto flex w-full max-w-56 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5">
          <Search size={13} className="text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search alerts…"
            aria-label="Search alerts"
            className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted">
          <span className="font-mono text-ink">{rows.filter((a) => !isRead(a)).length}</span> unread of{" "}
          <span className="font-mono text-ink">{rows.length}</span> shown
        </p>
        <PrimaryButton
          onClick={() => {
            setRead(new Set(ALERTS.map((a) => a.id)));
            toast.push("info", "All alerts marked read");
          }}
        >
          <Archive size={13} aria-hidden />
          Mark all read
        </PrimaryButton>
      </div>

      <ul className="space-y-2" aria-label="Priority alerts">
        {rows.map((a) => {
          const rel = relatedDetection(a);
          return (
            <li
              key={a.id}
              className="relative overflow-hidden rounded-lg border border-line bg-panel transition-colors hover:border-line-strong"
            >
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: SEVERITY_COLOR[a.severity] }}
                aria-hidden
              />
              <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
                <TriangleAlert
                  size={16}
                  className="mt-0.5 shrink-0"
                  style={{ color: SEVERITY_COLOR[a.severity] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-snug ${isRead(a) ? "text-muted" : "font-medium text-ink"}`}>
                    {a.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    {a.id} · {a.region} · {a.time}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {rel && (
                    <GhostButton
                      className="!py-1"
                      onClick={() => {
                        window.location.hash = `#/detection/${rel.id}`;
                      }}
                    >
                      Open {rel.id}
                    </GhostButton>
                  )}
                  {!isRead(a) && (
                    <GhostButton
                      className="!py-1"
                      onClick={() => {
                        setRead((r) => new Set(r).add(a.id));
                        toast.push("info", "Alert acknowledged", `${a.id} moved to archive.`);
                      }}
                    >
                      <BellOff size={13} aria-hidden />
                      Acknowledge
                    </GhostButton>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-lg border border-line bg-panel px-4 py-10 text-center text-[13px] text-muted">
            No alerts match the current filters.
          </li>
        )}
      </ul>
    </section>
  );
}
