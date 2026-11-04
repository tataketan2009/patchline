import { useMemo, useState } from "react";
import { CircleAlert, ClipboardPlus, ExternalLink, Hash, NotebookPen } from "lucide-react";
import { DETECTIONS } from "../lib/data";
import {
  INV_STAGES,
  INV_STAGE_LABEL,
  activityFor,
  addNote,
  createInvestigation,
  listInvestigations,
  updateInvestigation,
  type InvPriority,
  type InvRec,
  type InvStage,
} from "../lib/investigations";
import { Panel, PrimaryButton, SeverityBadge } from "../components/ui";
import { useToast } from "../lib/toast";

const PRIORITY_OPTIONS: InvPriority[] = ["low", "medium", "high", "critical"];
const STAGE_CLASS: Record<InvStage, string> = {
  new: "text-warn bg-warn-soft",
  assigned: "text-accent bg-accent-soft",
  investigating: "text-accent bg-accent-soft",
  "pending-verification": "text-warn bg-warn-soft",
  resolved: "text-muted bg-muted/10",
  closed: "text-muted bg-muted/10",
};
const DONE_STAGES: InvStage[] = ["resolved", "closed"];

const det = (id: string) => DETECTIONS.find((d) => d.id === id);

function InvCard({ inv }: { inv: InvRec }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const activity = activityFor(inv.id);
  const done = DONE_STAGES.includes(inv.stage);
  const linked = det(inv.detectionId);

  const stageChange = (stage: InvStage) => {
    const patch: Partial<InvRec> = { stage };
    if (DONE_STAGES.includes(stage)) patch.progress = 100;
    updateInvestigation(inv.id, patch);
    toast.push("info", INV_STAGE_LABEL[stage], `${inv.id} workflow updated (stored locally in this demo — the backend API mirrors it).`);
    setOpen((o) => o || !DONE_STAGES.includes(stage));
  };

  return (
    <Panel bodyClassName="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[13px] font-medium text-ink">
            <Hash size={11} className="text-muted" aria-hidden /> {inv.id}
          </p>
          <button
            onClick={() => {
              window.location.hash = `#/detection/${inv.detectionId}`;
            }}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            linked to <span className="font-mono">{inv.detectionId}</span> <ExternalLink size={10} aria-hidden />
          </button>
          {linked && <span className="ml-2 inline-block align-middle"><SeverityBadge severity={linked.severity} /></span>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_CLASS[inv.stage]}`}>
          {INV_STAGE_LABEL[inv.stage]}
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
        <label className="sr-only" htmlFor={`prog-${inv.id}`}>Progress</label>
        <input
          id={`prog-${inv.id}`}
          type="range"
          min={0}
          max={100}
          value={inv.progress}
          disabled={done}
          onChange={(e) => updateInvestigation(inv.id, { progress: Number(e.target.value) })}
          className="mt-1.5 w-full accent-[var(--pl-accent)] disabled:opacity-40"
          aria-label={`Progress for ${inv.id}`}
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-[11px] text-muted">
          Officer
          <input
            value={inv.officer}
            disabled={done}
            onChange={(e) => updateInvestigation(inv.id, { officer: e.target.value || "Unassigned", stage: inv.stage === "new" && e.target.value ? "assigned" : inv.stage })}
            className="rounded border border-line bg-canvas px-2 py-1 text-[12px] text-ink outline-none focus:border-accent disabled:opacity-40"
          />
        </label>
        <label className="grid gap-1 text-[11px] text-muted">
          Deadline
          <input
            value={inv.due}
            placeholder="e.g. Nov 30"
            disabled={done}
            onChange={(e) => updateInvestigation(inv.id, { due: e.target.value })}
            className="rounded border border-line bg-canvas px-2 py-1 text-[12px] text-ink outline-none placeholder:text-muted focus:border-accent disabled:opacity-40"
          />
        </label>
        <label className="grid gap-1 text-[11px] text-muted">
          Priority
          <select
            value={inv.priority}
            disabled={done}
            onChange={(e) => updateInvestigation(inv.id, { priority: e.target.value as InvPriority })}
            className="rounded border border-line bg-canvas px-2 py-1 text-[12px] text-ink outline-none focus:border-accent disabled:opacity-40 [&>option]:bg-panel"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-muted">
          Status
          <select
            value={inv.stage}
            disabled={done}
            onChange={(e) => stageChange(e.target.value as InvStage)}
            className="rounded border border-line bg-canvas px-2 py-1 text-[12px] text-ink outline-none focus:border-accent disabled:opacity-40 [&>option]:bg-panel"
          >
            {INV_STAGES.map((s) => (
              <option key={s} value={s}>{INV_STAGE_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
        <span className="text-[11px] text-muted">
          Officer:{" "}
          {inv.officer === "Unassigned" ? (
            <span className="inline-flex items-center gap-1 text-warn">
              <CircleAlert size={11} aria-hidden /> Unassigned
            </span>
          ) : (
            <span className="font-medium text-ink">{inv.officer}</span>
          )}
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
          aria-expanded={open}
        >
          <NotebookPen size={11} aria-hidden /> {open ? "Hide" : "Notes & activity"} ({activity.length})
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <label className="grid gap-1 text-[11px] text-muted">
            Add note
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Field observations, evidence references…"
              className="resize-none rounded border border-line bg-canvas p-2 text-[12px] text-ink outline-none placeholder:text-muted focus:border-accent"
            />
          </label>
          <button
            disabled={!note.trim() || done}
            onClick={() => {
              addNote(inv.id, note.trim());
              setNote("");
              toast.push("success", "Note added", `${inv.id} activity trail updated.`);
            }}
            className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white transition-transform hover:bg-accent/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save note
          </button>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line bg-canvas p-2">
            {activity.map((a, i) => (
              <li key={i} className="text-[11px] leading-snug">
                <span className="font-mono text-muted">{a.ts}</span>{" "}
                <span className="text-ink">{a.text}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-[11px] text-muted">No activity yet.</li>}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export default function InvestigationsView() {
  const toast = useToast();
  const rows = useMemo(() => listInvestigations(), []);
  const [detectionId, setDetectionId] = useState(DETECTIONS[0].id);
  const [officer, setOfficer] = useState("");

  const create = () => {
    const inv = createInvestigation({ detectionId, officer: officer || undefined });
    setOfficer("");
    toast.push("success", `${inv.id} created`, `Linked to ${inv.detectionId} (persisted locally; the backend API mirrors this workflow).`);
  };

  const noDetectionOptions = DETECTIONS.filter((d) => d.status !== "resolved");

  return (
    <section className="space-y-3">
      {/* Create investigation */}
      <Panel title="Open a new investigation" meta={<span className="font-mono text-[10px] text-muted">links to a detection</span>}>
        <div className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-[11px] text-muted">
            Detection
            <select
              value={detectionId}
              onChange={(e) => setDetectionId(e.target.value)}
              className="rounded border border-line bg-canvas px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent [&>option]:bg-panel"
            >
              {(noDetectionOptions.length ? noDetectionOptions : DETECTIONS).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} — {d.region}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] text-muted">
            Assign officer (optional)
            <input
              value={officer}
              onChange={(e) => setOfficer(e.target.value)}
              placeholder="Officer name…"
              className="rounded border border-line bg-canvas px-2 py-1.5 text-[12px] text-ink outline-none placeholder:text-muted focus:border-accent"
            />
          </label>
          <PrimaryButton onClick={create} className="self-end">
            <ClipboardPlus size={13} aria-hidden /> Create
          </PrimaryButton>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((inv) => (
          <InvCard key={inv.id} inv={inv} />
        ))}
        {rows.length === 0 && (
          <p className="rounded-lg border border-line bg-panel p-8 text-center text-[13px] text-muted md:col-span-2">
            No investigations yet — open one above or from a detection page.
          </p>
        )}
      </div>
    </section>
  );
}
