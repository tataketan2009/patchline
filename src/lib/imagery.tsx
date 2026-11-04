import { useState, type CSSProperties } from "react";
import { ArrowLeftRight, Columns2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Procedural "satellite" scenes (SVG turbulence — no pixels, no)      */
/* fetches. Looks like 10 m canopy imagery while staying clearly       */
/* labelled demo everywhere it is shown.                               */
/* ------------------------------------------------------------------ */

/** FNV-1-ish hash so each detection gets its own deterministic scene. */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 97;
}

function uri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function grainFilter(s: number, before: boolean): string {
  // Canopy-green noise palette; the "after" date runs slightly drier/hazier.
  const g = before ? [0.1, 0.22, 0.06, 0.03] : [0.09, 0.2, 0.07, 0.02];
  const warmth = before ? 0.0 : 0.015;
  return `
    <filter id="g" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed="${s}" stitchTiles="stitch"/>
      <feColorMatrix values="${g[0]} 0.22 ${g[2]} 0 ${g[3]}
        ${g[1]} 0.5 0.22 0 ${g[2] + g[1] * 0.1}
        ${g[2] + 0.02} 0.22 ${g[2] + 0.05} 0 ${g[3] + warmth}
        0 0 0 0 1"/>
    </filter>`;
}

function macroFilter(s: number): string {
  return `
      <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="3" seed="${s + 11}"/>
      <feColorMatrix values="0.16 0 0 0 0
        0.3 0 0 0 0.02
        0.14 0 0 0 0
        0 0 0 0 0.4"/>`;
}

/** Same lake in both dates so the before/after reads as one location. */
const lake = `
  <filter id="w"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4"/></filter>
  <g filter="url(#w)">
    <path d="M28,208 C80,192 138,204 196,238 L30,248 Z" fill="#46586b" opacity="0.9"/>
    <path d="M30,214 C82,198 132,208 186,236" stroke="#5d768c" stroke-width="1.4" fill="none" opacity="0.5"/>
  </g>`;

const clearing = (s: number) => `
  <filter id="cl"><feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="${s + 29}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="16"/></filter>
  <g filter="url(#cl)">
    <path d="M188,74 L262,56 L312,102 L296,164 L228,192 L180,146 Z" fill="#6f6144" opacity="0.95"/>
    <path d="M204,92 L268,76 L296,112 L270,168 L216,172 Z" fill="#8a7350" opacity="0.55"/>
    <path d="M188,74 L262,56 L312,102 L296,164 L228,192 L180,146 Z" fill="none" stroke="#4d4432" stroke-width="2.5" opacity="0.8"/>
    <circle cx="214" cy="120" r="2.6" fill="#57503c"/><circle cx="248" cy="102" r="2.2" fill="#57503c"/>
    <circle cx="266" cy="140" r="2.8" fill="#524a38"/><circle cx="228" cy="156" r="2" fill="#57503c"/>
    <path d="M330,30 C276,66 224,96 148,150" stroke="#8d7c58" stroke-width="3.5" fill="none" opacity="0.55"/>
  </g>`;

/** Full scene: canopy grain + macro terrain + hillshade + vignette. */
export function forestScene(before: boolean, seed = 7): string {
  const s = seed % 97;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="300" viewBox="0 0 440 300">
  <defs>
    ${grainFilter(s, before)}
    <filter id="m">${macroFilter(s)}</filter>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="75%">
      <stop offset="62%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.3"/>
    </radialGradient>
  </defs>
  <rect width="440" height="300" fill="#22301f"/>
  <rect width="440" height="300" filter="url(#g)"/>
  <rect width="440" height="300" filter="url(#m)" opacity="0.6"/>
  ${lake}
  ${before ? "" : clearing(s)}
  <rect width="440" height="300" fill="url(#shade)"/>
  <rect width="440" height="300" fill="url(#vig)"/>
</svg>`;
  return uri(svg);
}

export function ImageryChip({
  before,
  height,
  seed = 7,
}: {
  before: boolean;
  height?: string;
  seed?: number;
}) {
  return (
    <div
      className={`w-full rounded-md border border-line-strong ${height ?? "h-24"}`}
      style={
        {
          backgroundColor: "var(--pl-raised)",
          backgroundImage: forestScene(before, seed),
          backgroundSize: "cover",
          backgroundPosition: "center",
        } as CSSProperties
      }
    />
  );
}

/** Side-by-side vs draggable swipe comparison of the two demo scenes. */
export default function ImageryCompare({
  size = "sm",
  seed = 7,
}: {
  size?: "sm" | "lg";
  seed?: number;
}) {
  const [mode, setMode] = useState<"swipe" | "split">("swipe");
  const [split, setSplit] = useState(48);
  const h = size === "lg" ? "h-64 sm:h-72" : "h-40";
  const beforeImg = forestScene(true, seed);
  const afterImg = forestScene(false, seed);
  const layer = (img: string) =>
    ({ backgroundColor: "var(--pl-raised)", backgroundImage: img, backgroundSize: "cover", backgroundPosition: "center" }) as CSSProperties;

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
        <span className="ml-auto text-right font-mono text-[10px] leading-tight text-muted">
          DEMO IMAGERY — synthetic render,
          <br />
          not satellite pixels
        </span>
      </div>

      {mode === "split" ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Before", img: beforeImg, date: "2026-06-12" },
            { label: "After", img: afterImg, date: "2026-10-28" },
          ].map((c) => (
            <div key={c.label}>
              <div
                className={`w-full rounded-md border border-line-strong ${h}`}
                style={layer(c.img)}
              />
              <p className="mt-1 font-mono text-[10px] text-muted">
                {c.label} · {c.date}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`relative w-full overflow-hidden rounded-md border border-line-strong ${h}`}
          style={layer(afterImg)}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{ right: `${100 - split}%`, ...layer(beforeImg) }}
          />
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
