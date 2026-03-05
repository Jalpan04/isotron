"use client";

import { Header } from "@/components/layout/Header";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { SidebarMenu } from "@/components/layout/SidebarMenu";
import { useGraphStore } from "@/store/useGraphStore";

export function AppShell() {
  const { appState } = useGraphStore();

  return (
    <div id="app-shell" className="flex h-screen flex-col bg-surface-0 bg-grid">
      <Header />
      <SidebarMenu />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden">
          {appState === "upload" && <UploadPanel />}

          {appState === "parsing" && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-ping rounded-full bg-text-secondary/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-text-primary" />
              </div>
              <p className="text-sm text-text-secondary">Parsing model files...</p>
            </div>
          )}

          {appState === "comparing" && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-ping rounded-full bg-diff-modified/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-diff-modified" />
              </div>
              <p className="text-sm text-text-secondary">
                Comparing graph topologies...
              </p>
            </div>
          )}

          {appState === "viewing" && <GraphCanvas />}
        </main>

        {appState === "viewing" && <InspectorPanel />}
      </div>
    </div>
  );
}
