import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Database, Moon, Send, Sun } from "lucide-react";
import { FAQ } from "../lib/data";
import { useTheme } from "../lib/theme";
import { Panel } from "../components/ui";

function ThemeCard({ mode, icon: Icon, description }: { mode: "dark" | "light"; icon: typeof Moon; description: string }) {
  const { theme, setTheme } = useTheme();
  const active = theme === mode;
  return (
    <button
      onClick={() => setTheme(mode)}
      role="radio"
      aria-checked={active}
      className={`flex flex-1 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        active ? "border-accent bg-accent-soft" : "border-line hover:bg-raised"
      }`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-md ${active ? "bg-accent/15 text-accent" : "bg-raised text-muted"}`}>
        <Icon size={16} aria-hidden />
      </span>
      <span>
        <span className="block text-[13px] font-medium capitalize text-ink">{mode}</span>
        <span className="block text-[11px] text-muted">{description}</span>
      </span>
    </button>
  );
}

function FaqItem({ q, a, id }: { q: string; a: string; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      <h3>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-ink transition-colors hover:bg-raised"
        >
          <span className="flex-1">{q}</span>
          <ChevronRight
            size={14}
            className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            aria-hidden
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3 text-[12px] leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsView() {
  const [sent, setSent] = useState(false);

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 flex flex-col gap-3 lg:col-span-7">
        <Panel title="Appearance" meta={<span className="font-mono text-[10px] text-muted">persisted locally</span>}>
          <div className="flex gap-3 p-4" role="radiogroup" aria-label="Color theme">
            <ThemeCard mode="dark" icon={Moon} description="Default operations theme — #101311 canvas" />
            <ThemeCard mode="light" icon={Sun} description="Warm neutral daylight theme — #f1efe8 canvas" />
          </div>
        </Panel>

        <Panel title="Data source">
          <div className="flex items-start gap-3 p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-warn-soft text-warn">
              <Database size={15} aria-hidden />
            </span>
            <div>
              <p className="text-[13px] text-ink">This deployment runs on a labelled demo dataset.</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Map detections, alerts, imagery chips and statistics are synthetic. In production these panels bind to the
                ingest pipeline and enforcement services; no backend credentials are required to review the interface.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Live fire data — NASA FIRMS">
          <div className="p-4">
            <p className="text-[12px] leading-relaxed text-muted">
              Live VIIRS/NOAA-20 hotspots for the sanctuary box, updated within ~3 h of the satellite pass. Paste your
              free MAP_KEY (firms.modaps.eosdis.nasa.gov → api/map_key). Works when hosted on Render or offline;
              locally <code className="font-mono text-ink">npm run dev</code> routes through the dev proxy.
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const key = (form.elements.namedItem("mapkey") as HTMLInputElement).value.trim();
                localStorage.setItem("firms-map-key", key);
                form.reset();
                window.dispatchEvent(new Event("firms-key-changed"));
              }}
            >
              <input
                name="mapkey"
                autoComplete="off"
                placeholder="FIRMS MAP_KEY"
                aria-label="FIRMS MAP_KEY"
                className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[12px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-white transition-transform hover:bg-accent/90 active:scale-[0.97]"
              >
                Save key
              </button>
            </form>
          </div>
        </Panel>

        <Panel title="Frequently asked questions">
          <div>
            {FAQ.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} id={`faq-${i}`} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="col-span-12 lg:col-span-5">
        <Panel title="Contact monitoring operations">
          <div className="p-4">
            <p className="text-[12px] leading-relaxed text-muted">
              Field teams can raise an immediate line to the monitoring operations desk for verification support,
              escalated alerts, or imagery requests outside the standard revisit window.
            </p>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">Message</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Example: requesting commercial pass over NW block…"
                  className="w-full resize-none rounded-md border border-line bg-canvas p-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white transition-transform hover:bg-accent/90 active:scale-[0.98]"
              >
                <Send size={13} aria-hidden />
                Submit request
              </button>
              {sent && (
                <p role="status" className="rounded-md border border-line bg-canvas px-3 py-2 text-[12px] text-accent">
                  Given the demo dataset, your request was logged locally — in production this routes to the ops desk.
                </p>
              )}
            </form>
          </div>
        </Panel>
      </div>
    </div>
  );
}
