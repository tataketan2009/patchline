import { useState, type CSSProperties } from "react";
import { ArrowLeftRight, Columns2 } from "lucide-react";

/**
 * Synthetic demo imagery chips.
 * In production these render real before/after Sentinel-2 chips from the
 * ingest bucket; here they are pure CSS so the app works offline.
 * Always labelled as demo imagery wherever used.
 */
export function ImageryChip({ before, height }: { before: boolean; height?: string }) {
  const canopy = before
    ? "radial-gradient(circle at 22% 30%, rgba(120,148,119,.55) 0 12%, transparent 13%), radial-gradient(circle at 62% 22%, rgba(94,118,96,.5) 0 10%, transparent 11%), radial-gradient(circle at 44% 66%, rgba(120,148,119,.45) 0 14%, transparent 15%), radial-gradient(circle at 78% 70%, rgba(94,118,96,.5) 0 11%, transparent 12%), radial-gradient(circle at 14% 78%, rgba(120,148,119,.4) 0 9%, transparent 10%)"
    : "radial-gradient(circle at 18% 34%, rgba(120,148,119,.35) 0 8%, transparent 9%), radial-gradient(circle at 55% 60%, rgba(199,90,80,.75) 0 26%, transparent 27%), radial-gradient(circle at 74% 26%, rgba(94,118,96,.4) 0 7%, transparent 8%), radial-gradient(circle at 84% 76%, rgba(214,164,91,.55) 0 12%, transparent 13%)";
  return (
    <div
      className={`w-full rounded-md border border-line-strong ${height ?? "h-24"}`}
      style={{ backgroundColor: "var(--pl-raised)", backgroundImage: canopy, backgroundSize: "520% 520%" } as CSSProperties}
    />
  );
}

/** Side-by-side vs draggable swipe comparison of before/after synthetic imagery. */
export default function ImageryCompare({ size = "sm" }: { size?: "sm" | "lg" }) {
  const [mode, setMode] = useState<"swipe" | "split">("swipe");
  const [split, setSplit] = useState(48);
  const h = size === "lg" ? "h-64 sm:h-72" : "h-40";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Comparison mode">
          <button
            onClick={() => setMode("swipe")}
            aria-pressed={mode === "swipe"}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors ${
              mode === "swipe" ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            <ArrowLeftRight size={12} aria-hidden /> Swipe
          </button>
          <button
            onClick={() => setMode("split")}
            aria-pressed={mode === "split"}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors ${
              mode === "split" ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            <Columns2 size={12} aria-hidden /> Side by side
          </button>
        </div>
        <span className="ml-auto font-mono text-[10px] text-muted">DEMO IMAGERY — not satellite pixels</span>
      </div>

      {mode === "split" ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Before", before: true },
            { label: "After", before: false },
          ].map((c) => (
            <div key={c.label}>
              <ImageryChip before={c.before} height={h} />
              <p className="mt-1 font-mono text-[10px] text-muted">
                {c.label} · {c.before ? "2026-06-12" : "2026-10-28"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`relative w-full overflow-hidden rounded-md border border-line-strong ${h}`}
          style={{ backgroundColor: "var(--pl-raised)" }}
        >
          {/* after layer clipped from the right of the divider */}
          <div
            className="absolute inset-y-0 right-0"
            style={{
              left: `${split}%`,
              backgroundColor: "var(--pl-raised)",
              backgroundImage:
                "radial-gradient(circle at 18% 34%, rgba(120,148,119,.35) 0 8%, transparent 9%), radial-gradient(circle at 55% 60%, rgba(199,90,80,.75) 0 26%, transparent 27%), radial-gradient(circle at 74% 26%, rgba(94,118,96,.4) 0 7%, transparent 8%), radial-gradient(circle at 84% 76%, rgba(214,164,91,.55) 0 12%, transparent 13%)",
              backgroundSize: "520% 520%",
            }}
          />
          <div
            className="absolute inset-y-0 left-0"
            style={{
              right: `${100 - split}%`,
              backgroundColor: "var(--pl-raised)",
              backgroundImage:
                "radial-gradient(circle at 22% 30%, rgba(120,148,119,.55) 0 12%, transparent 13%), radial-gradient(circle at 62% 22%, rgba(94,118,96,.5) 0 10%, transparent 11%), radial-gradient(circle at 44% 66%, rgba(120,148,119,.45) 0 14%, transparent 15%), radial-gradient(circle at 78% 70%, rgba(94,118,96,.5) 0 11%, transparent 12%), radial-gradient(circle at 14% 78%, rgba(120,148,119,.4) 0 9%, transparent 10%)",
              backgroundSize: "520% 520%",
            }}
          />
          {/* divider handle */}
          <div className="absolute inset-y-0" style={{ left: `${split}%` }} aria-hidden>
            <div className="ml-[-1px] h-full w-0.5 bg-white/80" />
            <div className="absolute top-1/2 left-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/40 text-white">
              <ArrowLeftRight size={12} aria-hidden />
            </div>
          </div>
          <span className="absolute top-2 left-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">
            BEFORE · 2026-06-12
          </span>
          <span className="absolute top-2 right-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">
            AFTER · 2026-10-28
          </span>
          <label className="sr-only" htmlFor="swipe-range">
            Swipe comparison position
          </label>
          <input
            id="swipe-range"
            type="range"
            min={5}
            max={95}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            aria-valuenow={split}
            aria-valuemin={5}
            aria-valuemax={95}
          />
        </div>
      )}
    </div>
  );
}
