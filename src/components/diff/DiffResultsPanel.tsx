"use client";

import { useGraphStore } from "@/store/useGraphStore";

const STATE_COLORS: Record<string, string> = {
  added: "text-diff-added",
  removed: "text-diff-removed",
  modified: "text-diff-modified",
  unchanged: "text-text-secondary",
};

const STATE_BG: Record<string, string> = {
  added: "bg-diff-added/10 border-diff-added/20",
  removed: "bg-diff-removed/10 border-diff-removed/20",
  modified: "bg-diff-modified/10 border-diff-modified/20",
  unchanged: "bg-surface-2 border-border-subtle",
};

const STATE_DOT: Record<string, string> = {
  added: "bg-diff-added",
  removed: "bg-diff-removed",
  modified: "bg-diff-modified",
  unchanged: "bg-diff-unchanged",
};

export function DiffResultsPanel() {
  const { unifiedGraph, setSelectedNode } = useGraphStore();

  if (!unifiedGraph) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-secondary">No diff data available</p>
      </div>
    );
  }

  const { summary, nodes } = unifiedGraph;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border-subtle bg-surface-1 px-5 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-diff-added" />
            <span className="text-xs text-text-secondary">Added</span>
            <span className="text-sm font-semibold text-diff-added">{summary.added}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-diff-removed" />
            <span className="text-xs text-text-secondary">Removed</span>
            <span className="text-sm font-semibold text-diff-removed">{summary.removed}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-diff-modified" />
            <span className="text-xs text-text-secondary">Modified</span>
            <span className="text-sm font-semibold text-diff-modified">{summary.modified}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-diff-unchanged" />
            <span className="text-xs text-text-secondary">Unchanged</span>
            <span className="text-sm font-semibold text-text-secondary">{summary.unchanged}</span>
          </div>
          <div className="ml-auto text-xs text-text-secondary">
            {summary.total} total nodes
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-2">
          {nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all hover:brightness-125 ${STATE_BG[node.diffState]}`}
            >
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATE_DOT[node.diffState]}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{node.name}</p>
                <p className={`text-xs ${STATE_COLORS[node.diffState]}`}>{node.type}</p>
              </div>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${STATE_COLORS[node.diffState]}`}>
                {node.diffState}
              </span>
              {node.changes && node.changes.length > 0 && (
                <span className="shrink-0 text-[10px] text-text-secondary">
                  {node.changes.length} change{node.changes.length > 1 ? "s" : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
