import { useState } from "react";
import { Archive, BellOff, TriangleAlert } from "lucide-react";
import { ALERTS, SEVERITY_COLOR, type Alert } from "../lib/data";
import { GhostButton, PrimaryButton } from "../components/ui";
import { useToast } from "../lib/toast";

export default function AlertsView() {
  const toast = useToast();
  const [read, setRead] = useState<Set<string>>(
    () => new Set(ALERTS.filter((a) => a.read).map((a) => a.id)),
  );

  const isRead = (a: Alert) => read.has(a.id);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted">
          <span className="font-mono text-ink">{ALERTS.length - read.size}</span> unread of {ALERTS.length}
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
        {ALERTS.map((a) => (
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
              {!isRead(a) && (
                <GhostButton
                  className="shrink-0 !py-1"
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
          </li>
        ))}
      </ul>
    </section>
  );
}
