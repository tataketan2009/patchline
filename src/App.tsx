import { useEffect, useState } from "react";
import Sidebar, { type ViewId } from "./components/Sidebar";
import TopBar from "./components/TopBar";
import FloatingContact from "./components/FloatingContact";
import DashboardView from "./views/DashboardView";
import DetectionsView from "./views/DetectionsView";
import AlertsView from "./views/AlertsView";
import InvestigationsView from "./views/InvestigationsView";
import SettingsView from "./views/SettingsView";
import DetectionPage from "./views/DetectionPage";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import { DETECTIONS } from "./lib/data";
import { initRecurrenceScan } from "./lib/review";

initRecurrenceScan(DETECTIONS);

/** '#/detection/PL-2026-0841' → shareable detection pages without server config. */
function parseHash(): string | null {
  const m = window.location.hash.match(/^#\/detection\/([\w-]+)/);
  return m ? m[1] : null;
}

function Shell() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(() => parseHash());

  useEffect(() => {
    const onHash = () => setDetailId(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (v: ViewId) => {
    if (detailId) window.location.hash = "";
    setDetailId(null);
    setView(v);
  };

  return (
    <div className="flex h-full">
      <a
        href="#main-content"
        className="px-3 py-2 text-[13px] text-accent sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1500] focus:rounded-md focus:border focus:border-accent focus:bg-panel"
      >
        Skip to content
      </a>

      <Sidebar
        view={view}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar view={view} onMenu={() => setMobileOpen(true)} onNavigate={navigate} />
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" tabIndex={-1}>
          {detailId != null ? (
            <DetectionPage
              key={detailId}
              id={detailId}
              onBack={() => {
                window.location.hash = "";
                setDetailId(null);
              }}
            />
          ) : (
            <>
              {view === "dashboard" && <DashboardView onNavigate={navigate} />}
              {view === "detections" && <DetectionsView />}
              {view === "alerts" && <AlertsView />}
              {view === "investigations" && <InvestigationsView />}
              {view === "settings" && <SettingsView />}
            </>
          )}
        </main>
      </div>

      <FloatingContact />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ThemeProvider>
  );
}
