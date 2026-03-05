"use client";

import { useGraphStore } from "@/store/useGraphStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { appState, reset, unifiedGraph } =
    useGraphStore();

  return (
    <header
      id="isotron-header"
      className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-text-primary"
          >
            <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="9" x2="6" y2="15" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="9" x2="18" y2="15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <h1 className="text-sm font-semibold tracking-wider text-text-primary uppercase">
            Isotron
          </h1>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal text-text-secondary">
          v0.1.0
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {unifiedGraph && (
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-diff-added" />
              {unifiedGraph.summary.added}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-diff-removed" />
              {unifiedGraph.summary.removed}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-diff-modified" />
              {unifiedGraph.summary.modified}
            </span>
            <span className="flex items-center gap-1 text-text-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-diff-unchanged" />
              {unifiedGraph.summary.unchanged}
            </span>
          </div>
        )}
        {appState !== "upload" && (
          <Button
            id="btn-new-comparison"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-text-secondary hover:text-text-primary"
            onClick={reset}
          >
            New Comparison
          </Button>
        )}
      </div>
    </header>
  );
}
