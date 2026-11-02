import { CalendarClock, CircleAlert } from "lucide-react";
import { INVESTIGATIONS } from "../lib/data";
import { Panel } from "../components/ui";

const STAGE_LABEL: Record<string, string> = {
  triage: "Triage",
  "field-verification": "Field verification",
  "evidence-review": "Evidence review",
  enforcement: "Enforcement",
};

export default function InvestigationsView() {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {INVESTIGATIONS.map((inv) => {
        const overdue = inv.progress < 50;
        return (
          <Panel key={inv.id} bodyClassName="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[13px] font-medium text-ink">{inv.id}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  linked to <span className="font-mono">{inv.detectionId}</span>
                </p>
              </div>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                {STAGE_LABEL[inv.stage]}
              </span>
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-muted">
                <span>Progress</span>
                <span className="font-mono text-ink">{inv.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${inv.progress}%` }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
              <span>
                Officer:{" "}
                {inv.officer === "Unassigned" ? (
                  <span className="inline-flex items-center gap-1 text-warn">
                    <CircleAlert size={11} aria-hidden /> Unassigned
                  </span>
                ) : (
                  <span className="text-ink">{inv.officer}</span>
                )}
              </span>
              <span className={`inline-flex items-center gap-1 ${overdue && inv.progress < 50 ? "text-warn" : ""}`}>
                <CalendarClock size={11} aria-hidden />
                Due {inv.due}
              </span>
            </div>
          </Panel>
        );
      })}
    </section>
  );
}
