import {
  ClipboardList,
  Layers,
  LayoutDashboard,
  Radar,
  Settings,
  TreePine,
  TriangleAlert,
  X,
} from "lucide-react";
import { DEMO_LABEL, useTheme } from "../lib/theme";

export type ViewId = "dashboard" | "detections" | "alerts" | "investigations" | "settings";

export const NAV_ITEMS: { id: ViewId; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "detections", label: "Detections", icon: Radar },
  { id: "alerts", label: "Alerts", icon: TriangleAlert, badge: 3 },
  { id: "investigations", label: "Investigations", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  view,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const { theme } = useTheme();

  const nav = (
    <>
      <nav aria-label="Primary" className="flex-1 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => {
            const active = view === id;
            return (
              <li key={id}>
                <button
                  onClick={() => {
                    onNavigate(id);
                    onMobileClose();
                  }}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={`relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-accent-soft text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
                      : "text-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {!collapsed && badge && (
                    <span className="ml-auto rounded-full bg-danger/15 px-1.5 text-[10px] font-semibold text-danger">
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed && (
        <div className="mx-3 mb-3 rounded-md border border-line bg-panel p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
            <Layers size={12} className="text-accent" aria-hidden />
            {theme === "dark" ? "Active imagery: Sentinel-2" : "Revisit window: 5 days"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {theme === "dark"
              ? "Latest pass passed QC — 3 tiles ingested."
              : "Next acquisition scheduled for Nov 3, 09:40 UTC."}
          </p>
        </div>
      )}

      {/* DEMO label must always be visible */}
      <p
        className={`mx-3 mb-3 flex items-center gap-1.5 self-start rounded-full border border-warn/30 bg-warn-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-warn ${
          collapsed ? "justify-center !mx-auto" : ""
        }`}
      >
        {DEMO_LABEL}
      </p>

      {!collapsed && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <span
            className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent"
            aria-hidden
          >
            RS
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-ink">R. Silva</p>
            <p className="truncate text-[10px] text-muted">Field lead · Ops access</p>
          </div>
        </div>
      )}
    </>
  );

  const header = (
    <div className={`flex h-14 items-center ${collapsed ? "justify-center" : "justify-between px-4"}`}>
      <button
        onClick={() => onNavigate("dashboard")}
        className="flex items-center gap-2.5"
        aria-label="PATCHLINE home"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-soft">
          <TreePine size={17} className="text-accent" aria-hidden />
        </span>
        {!collapsed && (
          <span className="text-left">
            <span className="block font-mono text-[13px] font-semibold tracking-widest text-ink">PATCHLINE</span>
            <span className="block text-[10px] text-muted">Forest Intelligence</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <button
          onClick={onMobileClose}
          aria-label="Close navigation"
          className="rounded p-1 text-muted hover:text-ink md:hidden"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={`relative hidden shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 md:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {header}
        {nav}
        <button
          onClick={onToggleCollapse}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-md border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:bg-raised hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </aside>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-[1100] md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <button
          className={`absolute inset-0 bg-black/50 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={onMobileClose}
          aria-label="Close navigation"
          tabIndex={mobileOpen ? 0 : -1}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-panel transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-hidden={!mobileOpen}
        >
          {header}
          {nav}
        </aside>
      </div>
    </>
  );
}
