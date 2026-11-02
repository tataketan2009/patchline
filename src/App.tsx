import { useState } from "react";
import Sidebar, { type ViewId } from "./components/Sidebar";
import TopBar from "./components/TopBar";
import FloatingContact from "./components/FloatingContact";
import DashboardView from "./views/DashboardView";
import DetectionsView from "./views/DetectionsView";
import AlertsView from "./views/AlertsView";
import InvestigationsView from "./views/InvestigationsView";
import SettingsView from "./views/SettingsView";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";

function Shell() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full">
      <a
        href="#main-content"
        className="sr-only px-3 py-2 text-[13px] text-accent focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1500] focus:rounded-md focus:border focus:border-accent focus:bg-panel"
      >
        Skip to content
      </a>

      <Sidebar
        view={view}
        onNavigate={setView}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar view={view} onMenu={() => setMobileOpen(true)} onNavigate={setView} />
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" tabIndex={-1}>
          {view === "dashboard" && <DashboardView onNavigate={setView} />}
          {view === "detections" && <DetectionsView />}
          {view === "alerts" && <AlertsView />}
          {view === "investigations" && <InvestigationsView />}
          {view === "settings" && <SettingsView />}
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
