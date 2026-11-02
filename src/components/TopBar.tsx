import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Database, Menu, Moon, Search, Sun } from "lucide-react";
import { ALERTS, REGION, SEVERITY_COLOR } from "../lib/data";
import { useTheme } from "../lib/theme";
import type { ViewId } from "./Sidebar";

const PAGE_TITLES: Record<ViewId, string> = {
  dashboard: "Monitoring overview",
  detections: "Detections",
  alerts: "Priority alerts",
  investigations: "Investigations",
  settings: "Settings",
};

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return ref;
}

export default function TopBar({
  view,
  onMenu,
  onNavigate,
}: {
  view: ViewId;
  onMenu: () => void;
  onNavigate: (v: ViewId) => void;
}) {
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [notifsOpen, setNotifsOpen] = useState(false);

  const notifRef = useOutsideClose(() => setNotifsOpen(false));

  const results =
    query.trim().length >= 2
      ? ALERTS.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()) || a.region.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
      : [];

  const unread = ALERTS.filter((a) => !a.read).length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="rounded-md p-2 text-muted transition-colors hover:bg-raised hover:text-ink md:hidden"
      >
        <Menu size={17} aria-hidden />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-[13px] font-semibold text-ink">{PAGE_TITLES[view]}</h1>
        <p className="hidden truncate text-[11px] text-muted sm:block">
          {REGION.name} · {REGION.subregion} · last sync {REGION.lastUpdated}
        </p>
      </div>

      {/* Global search */}
      <div className="relative ml-auto hidden sm:block">
        <div className="flex w-52 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5 transition-colors focus-within:border-accent lg:w-64">
          <Search size={13} className="shrink-0 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search…"
            aria-label="Global search"
            className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        {results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full right-0 z-[900] mt-1 w-72 overflow-hidden rounded-md border border-line bg-panel p-1 shadow-xl"
            role="listbox"
            aria-label="Search results"
          >
            <li className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Alert matches</li>
            {results.map((r) => (
              <li key={r.id}>
                <button
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setQuery("");
                    onNavigate("alerts");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-ink transition-colors hover:bg-raised"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SEVERITY_COLOR[r.severity] }}
                    aria-hidden
                  />
                  <span className="truncate">{r.title}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </div>

      {/* Demo data chip */}
      <span className="hidden items-center gap-1.5 rounded-full border border-warn/30 bg-warn-soft px-2 py-1 text-[10px] font-semibold tracking-wide text-warn md:inline-flex">
        <Database size={11} aria-hidden />
        Demo data
      </span>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => setNotifsOpen((o) => !o)}
          aria-label={`Notifications, ${unread} unread`}
          aria-expanded={notifsOpen}
          className="relative rounded-md p-2 text-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger ring-2 ring-panel" aria-hidden />
          )}
        </button>
        <AnimatePresence>
          {notifsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              className="glass absolute top-full right-0 z-[1000] mt-1.5 w-80 rounded-md p-2"
            >
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Recent alerts
              </p>
              <ul className="space-y-0.5">
                {ALERTS.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        setNotifsOpen(false);
                        onNavigate("alerts");
                      }}
                      className="flex w-full gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-raised"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLOR[a.severity] }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className={`block truncate text-[12px] ${a.read ? "text-muted" : "text-ink"}`}>
                          {a.title}
                        </span>
                        <span className="block text-[10px] text-muted">
                          {a.region} · {a.time}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setNotifsOpen(false);
                  onNavigate("alerts");
                }}
                className="mt-1 w-full rounded px-2 py-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent-soft"
              >
                View all alerts
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Theme switch — persisted through ThemeProvider */}
      <div className="flex items-center overflow-hidden rounded-md border border-line" role="group" aria-label="Theme">
        <button
          onClick={() => theme !== "dark" && toggle()}
          aria-pressed={theme === "dark"}
          aria-label="Dark theme"
          className={`p-2 transition-colors ${theme === "dark" ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
        >
          <Moon size={14} aria-hidden />
        </button>
        <button
          onClick={() => theme !== "light" && toggle()}
          aria-pressed={theme === "light"}
          aria-label="Light theme"
          className={`p-2 transition-colors ${theme === "light" ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
        >
          <Sun size={14} aria-hidden />
        </button>
      </div>

      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent"
        aria-hidden
      >
        RS
      </span>
    </header>
  );
}
