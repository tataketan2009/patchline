import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  FileSearch,
  Layers,
  MapPin,
  Save,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DETECTIONS,
  SEVERITY_COLOR,
} from "../lib/data";
import ImageryCompare, { seedFromId } from "../lib/imagery";
import { downloadEvidenceReport } from "../lib/report";
import { REVIEW_LABEL, REVIEW_STYLE, getReview, priorityScore, setReview, type ReviewStatus } from "../lib/review";
import { useToast } from "../lib/toast";
import { SeverityBadge } from "../components/ui";

const REVIEW_ORDER: ReviewStatus[] = [
  "new",
  "under-review",
  "verified",
  "false-positive",
  "escalated",
  "resolved",
];

/** Turn this into a legend: 'priority' is advisory ranking, not a verdict. */
function Value({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-[13px] text-ink">{children}</p>
    </div>
  );
}

function CopyRow({ icon: Icon, value }: { icon: typeof MapPin; value: string }) {
  const toast = useToast();
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => toast.push("info", "Copied", value),
          () => toast.push("danger", "Copy failed", "Clipboard is blocked in this browser."),
        );
      }}
      className="flex w-full items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-left transition-colors hover:bg-raised"
      title="Copy to clipboard"
    >
      <Icon size={13} className="shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{value}</span>
      <Copy size={12} className="shrink-0 text-muted" aria-hidden />
    </button>
  );
}

export default function DetectionPage({ id, onBack }: { id: string; onBack: () => void }) {
  const toast = useToast();
  const detection = useMemo(() => DETECTIONS.find((d) => d.id === id) ?? null, [id]);
  const [review, setReviewState] = useState(() => getReview(id));
  const [notes, setNotes] = useState(() => getReview(id).notes);

  useEffect(() => {
    setReviewState(getReview(id));
    setNotes(getReview(id).notes);
  }, [id]);

  if (!detection) {
    return (
      <div className="rounded-lg border border-line bg-panel p-8 text-center">
        <p className="text-[13px] text-muted">Detection {id} was not found in this demo dataset.</p>
        <button
          onClick={onBack}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-raised"
        >
          <ArrowLeft size={14} aria-hidden /> Back to dashboard
        </button>
      </div>
    );
  }

  const { score, factors } = priorityScore(detection);
  const scoreTier = score >= 70 ? "text-danger" : score >= 45 ? "text-warn" : "text-accent";

  const saveNotes = () => {
    setReview(id, { notes });
    setReviewState(getReview(id));
    toast.push("success", "Investigation note saved", `${detection.id} · ${review.updated ? "" : ""}${notes.length} chars`);
  };

  const changeStatus = (status: ReviewStatus) => {
    setReview(id, { status });
    setReviewState(getReview(id));
    toast.push("info", `Status: ${REVIEW_LABEL[status]}`, `${detection.id} workflow updated (stored locally in this demo).`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-raised"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={13} aria-hidden /> Dashboard
        </button>
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: SEVERITY_COLOR[detection.severity] }}
          aria-hidden
        />
        <h1 className="font-mono text-[15px] font-semibold text-ink">{detection.id}</h1>
        <SeverityBadge severity={detection.severity} />
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REVIEW_STYLE[review.status]}`}>
          {REVIEW_LABEL[review.status]}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted">SAMPLE DATA — synthetic detection</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Left column — fields, imagery, notes */}
        <div className="space-y-3 lg:col-span-7">
          <section className="rounded-lg border border-line bg-panel p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Value label="Region">{detection.region}</Value>
              <Value label="Detected">{detection.date}</Value>
              <Value label="Affected area">{detection.areaHa.toFixed(1)} ha</Value>
              <Value label="Coordinates">
                {detection.lat.toFixed(4)}°, {detection.lon.toFixed(4)}°
              </Value>
              <Value label="Prior observation">2026-06-12</Value>
              <Value label="Current observation">2026-10-28</Value>
              <Value label="Satellite source">Sentinel-2 L2A (demo)</Value>
              <Value label="Detection method">NDVI-diff baseline</Value>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <CopyRow icon={MapPin} value={`${detection.lat.toFixed(6)}, ${detection.lon.toFixed(6)}`} />
              <CopyRow icon={FileSearch} value={detection.id} />
            </div>

            {/* model / confidence disclosure — honest by design */}
            <p className="mt-3 rounded-md border border-line bg-canvas px-3 py-2 text-[12px] leading-relaxed text-muted">
              <strong className="font-medium text-ink">Model & confidence:</strong> this build runs the classical
              NDVI-difference baseline (measured ΔNDVI threshold per cell) — no calibrated confidence score is produced,
              so none is displayed. A Siamese U-Net (PyTorch) replaces the baseline once labelled pairs are curated.
              Imagery chips below are <span className="text-warn">synthetic placeholders</span>, not real pixels.
            </p>
          </section>

          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">Before / after imagery</h2>
            <div className="mt-2">
              <ImageryCompare size={size()} seed={seedFromId(detection.id)} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">Investigation notes</h2>
            <label htmlFor="notes" className="sr-only">
              Investigation notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Field observations, verification steps, officer remarks…"
              className="mt-2 w-full resize-none rounded-md border border-line bg-canvas p-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={saveNotes}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-transform hover:bg-accent/90 active:scale-[0.97]"
              >
                <Save size={13} aria-hidden /> Save note
              </button>
              <button
                onClick={() => downloadEvidenceReport(detection)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-raised"
              >
                <Download size={13} aria-hidden /> Evidence report
              </button>
              {review.updated && (
                <span className="font-mono text-[10px] text-muted">last review {review.updated}</span>
              )}
            </div>
          </section>
        </div>

        {/* Right column — priority, status, geometry, timeline */}
        <div className="space-y-3 lg:col-span-5">
          <section className="rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-ink">Priority score</h2>
              <span className={`ml-auto font-mono text-[22px] font-semibold tabular-nums ${scoreTier}`}>{score}</span>
              <span className="font-mono text-[11px] text-muted">/100</span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {factors.map((f) => (
                <li key={f.label}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">{f.label}</span>
                    <span className="font-mono text-ink">
                      {f.points}/{f.max}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-raised">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(f.points / f.max) * 100}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">{f.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-md border border-line bg-canvas px-3 py-2 text-[11px] leading-relaxed text-muted">
              Rank-for-review advisory only. <span className="text-ink">A high score never implies illegality</span> —
              verification is a human field process.
            </p>
          </section>

          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">Investigation status</h2>
            <label htmlFor="review-status" className="sr-only">
              Review status
            </label>
            <select
              id="review-status"
              value={review.status}
              onChange={(e) => changeStatus(e.target.value as ReviewStatus)}
              className="mt-2 w-full rounded-md border border-line bg-canvas px-2.5 py-2 text-[13px] text-ink outline-none focus:border-accent"
            >
              {REVIEW_ORDER.map((s) => (
                <option key={s} value={s}>
                  {REVIEW_LABEL[s]}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Layers size={13} className="text-accent" aria-hidden /> Polygon geometry (WGS84)
            </h2>
            <p className="mt-1.5 max-h-24 overflow-y-auto font-mono text-[11px] leading-relaxed text-muted">
              {detection.polygon.map((p) => `[${p[0]}, ${p[1]}]`).join(" · ")}
            </p>
          </section>

          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">Evidence timeline</h2>
            <ol className="mt-2 space-y-0">
              {[
                { t: "2026-06-12", e: "Sentinel-2 pass acquired (before state)", who: "Ingest · QC passed" },
                { t: detection.date, e: "NDVI-difference flagged candidate polygon", who: "PATCHLINE baseline" },
                { t: "2026-10-29", e: "Priority assigned, added to investigation queue", who: "PATCHLINE AI" },
                review.updated
                  ? { t: review.updated, e: "Review activity: note/status stored locally", who: "Analyst session" }
                  : { t: "—", e: "Field verification pending", who: "Awaiting officer" },
              ].map((row, i) => (
                <li key={i} className="flex gap-2.5 py-1.5">
                  <span className="mt-0.5 flex flex-col items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                    {i < 3 && <span className="mt-0.5 h-full w-px bg-line" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 pb-1">
                    <span className="block text-[12px] leading-snug text-ink">{row.e}</span>
                    <span className="block font-mono text-[10px] text-muted">
                      {row.t} · {row.who}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </motion.div>
  );

  function size() {
    return window.innerWidth >= 1024 ? "lg" : "sm";
  }
}
