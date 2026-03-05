"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useGraphStore } from "@/store/useGraphStore";

function MenuItem({
  label,
  shortcut,
  onClick,
  active,
  isToggle,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  isToggle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-4 py-1.5 text-left text-[13px] text-text-primary hover:bg-white/[0.06] transition-colors"
    >
      <span className="flex items-center gap-2">
        {isToggle !== undefined && (
          <span className={`inline-block w-3 text-center text-[11px] ${active ? "text-diff-added" : "text-text-secondary/40"}`}>
            {active ? "\u2713" : ""}
          </span>
        )}
        <span>{label}</span>
      </span>
      {shortcut && (
        <span className="ml-8 text-[11px] text-text-secondary/60">{shortcut}</span>
      )}
    </button>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[11px] font-medium text-text-secondary/50">
      {label}
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-white/[0.06]" />;
}

export function SidebarMenu() {
  const {
    sidebarOpen,
    setSidebarOpen,
    viewSettings,
    toggleViewSetting,
    appState,
    searchQuery,
    setSearchQuery,
  } = useGraphStore();

  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isViewing = appState === "viewing";

  // Close sidebar on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    }
    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [sidebarOpen, setSidebarOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "d") { e.preventDefault(); toggleViewSetting("showAttributes"); }
      if (ctrl && e.key === "i") { e.preventDefault(); toggleViewSetting("showWeights"); }
      if (ctrl && e.key === "u") { e.preventDefault(); toggleViewSetting("showNames"); }
      if (ctrl && e.key === "k") { e.preventDefault(); toggleViewSetting("horizontalLayout"); }
      if (ctrl && e.key === "f") { e.preventDefault(); setShowSearch(true); setSidebarOpen(false); setTimeout(() => searchRef.current?.focus(), 50); }
      if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); setSidebarOpen(false); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [toggleViewSetting, setSearchQuery, setSidebarOpen]);

  const handleExportPNG = useCallback(() => {
    const { unifiedGraph, viewSettings } = useGraphStore.getState();
    if (!unifiedGraph) return;
    setSidebarOpen(false);
    import("@/lib/export/graph-exporter").then(({ exportAsPNG }) => exportAsPNG(unifiedGraph, viewSettings));
  }, [setSidebarOpen]);

  const handleExportSVG = useCallback(() => {
    const { unifiedGraph, viewSettings } = useGraphStore.getState();
    if (!unifiedGraph) return;
    setSidebarOpen(false);
    import("@/lib/export/graph-exporter").then(({ exportAsSVG }) => exportAsSVG(unifiedGraph, viewSettings));
  }, [setSidebarOpen]);

  return (
    <>
      {/* Hamburger button */}
      <button
        id="btn-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.06] bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar panel */}
      <div
        ref={panelRef}
        className={`fixed left-0 top-0 z-50 flex h-full w-56 flex-col border-r border-white/[0.06] bg-surface-1 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-3">
          <span className="text-xs font-semibold text-text-primary tracking-wide">ISOTRON</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {/* File */}
          <SectionHeader label="File" />
          <MenuItem
            label="Open..."
            shortcut="Ctrl+O"
            onClick={() => { setSidebarOpen(false); useGraphStore.getState().reset(); }}
          />
          {isViewing && (
            <>
              <MenuItem label="Export as PNG" shortcut="Ctrl+Shift+E" onClick={handleExportPNG} />
              <MenuItem label="Export as SVG" shortcut="Ctrl+Alt+E" onClick={handleExportSVG} />
            </>
          )}

          <Divider />

          {/* Edit */}
          <SectionHeader label="Edit" />
          <MenuItem
            label="Find..."
            shortcut="Ctrl+F"
            onClick={() => {
              setSidebarOpen(false);
              setShowSearch(true);
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
          />

          <Divider />

          {/* View */}
          <SectionHeader label="View" />
          <MenuItem
            label={viewSettings.showAttributes ? "Hide Attributes" : "Show Attributes"}
            shortcut="Ctrl+D"
            onClick={() => toggleViewSetting("showAttributes")}
            active={viewSettings.showAttributes}
            isToggle
          />
          <MenuItem
            label={viewSettings.showWeights ? "Hide Weights" : "Show Weights"}
            shortcut="Ctrl+I"
            onClick={() => toggleViewSetting("showWeights")}
            active={viewSettings.showWeights}
            isToggle
          />
          <MenuItem
            label={viewSettings.showNames ? "Hide Names" : "Show Names"}
            shortcut="Ctrl+U"
            onClick={() => toggleViewSetting("showNames")}
            active={viewSettings.showNames}
            isToggle
          />
          <MenuItem
            label={viewSettings.horizontalLayout ? "Show Vertical" : "Show Horizontal"}
            shortcut="Ctrl+K"
            onClick={() => toggleViewSetting("horizontalLayout")}
            active={viewSettings.horizontalLayout}
            isToggle
          />

          <Divider />

          <MenuItem
            label="Zoom In"
            shortcut="Shift+Up"
            onClick={() => document.querySelector<HTMLButtonElement>(".react-flow__controls-zoomin")?.click()}
          />
          <MenuItem
            label="Zoom Out"
            shortcut="Shift+Down"
            onClick={() => document.querySelector<HTMLButtonElement>(".react-flow__controls-zoomout")?.click()}
          />
          <MenuItem
            label="Actual Size"
            shortcut="Shift+Backspace"
            onClick={() => document.querySelector<HTMLButtonElement>(".react-flow__controls-fitview")?.click()}
          />

          <Divider />

          {/* Help */}
          <SectionHeader label="Help" />
          <MenuItem
            label="Properties..."
            shortcut="Ctrl+Enter"
            onClick={() => {
              setSidebarOpen(false);
              useGraphStore.getState().setInspectorOpen(true);
            }}
          />
          <MenuItem
            label="About Isotron"
            onClick={() => {
              setSidebarOpen(false);
              alert("Isotron v0.1.0\nNeural Network Diff Visualizer");
            }}
          />
        </div>
      </div>

      {/* Floating search bar */}
      {showSearch && isViewing && (
        <div className="fixed left-1/2 top-14 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-1/95 px-3 py-2 shadow-xl backdrop-blur-md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-text-secondary">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Find node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/40 outline-none"
            />
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(""); }}
              className="flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:text-text-primary"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
