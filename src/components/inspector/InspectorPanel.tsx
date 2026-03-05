"use client";

import { useGraphStore } from "@/store/useGraphStore";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export function InspectorPanel() {
  const { selectedNode, inspectorOpen, setInspectorOpen, unifiedGraph } =
    useGraphStore();

  if (!inspectorOpen) return null;

  const showGraphProps = !selectedNode && unifiedGraph;

  return (
    <div
      id="inspector-panel"
      className="flex h-full w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-surface-1"
    >
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
          {selectedNode ? "Node Properties" : "Graph Properties"}
        </span>
        <Button
          id="btn-close-inspector"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-text-secondary hover:text-text-primary"
          onClick={() => setInspectorOpen(false)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedNode ? (
          /* ---- Node Properties ---- */
          <div>
            {/* Name row */}
            <PropertyRow label="name" value={selectedNode.name} />
            <PropertyRow label="type" value={selectedNode.type} />
            <PropertyRow label="state">
              <DiffBadge state={selectedNode.diffState} />
            </PropertyRow>

            {/* INPUTS */}
            <SectionTitle title="INPUTS" />
            {selectedNode.inputs.length > 0 ? (
              selectedNode.inputs.map((input, i) => (
                <div key={i} className="border-b border-white/[0.04]">
                  <div className="flex items-start gap-2 px-4 py-2">
                    <span className="mt-0.5 text-[11px] text-blue-400 shrink-0 w-14 text-right">
                      {input.name || `input_${i}`}
                    </span>
                    <div className="flex-1">
                      <PropertySubRow label="name" value={input.name || `input_${i}`} />
                      <PropertySubRow
                        label="tensor"
                        value={`${input.dtype}[${input.shape.join(",")}]`}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptySection text="No inputs" />
            )}

            {/* OUTPUTS */}
            <SectionTitle title="OUTPUTS" />
            {selectedNode.outputs.length > 0 ? (
              selectedNode.outputs.map((output, i) => (
                <div key={i} className="border-b border-white/[0.04]">
                  <div className="flex items-start gap-2 px-4 py-2">
                    <span className="mt-0.5 text-[11px] text-blue-400 shrink-0 w-14 text-right">
                      {output.name || `output_${i}`}
                    </span>
                    <div className="flex-1">
                      <PropertySubRow label="name" value={output.name || `output_${i}`} />
                      <PropertySubRow
                        label="tensor"
                        value={`${output.dtype}[${output.shape.join(",")}]`}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptySection text="No outputs" />
            )}

            {/* ATTRIBUTES */}
            {Object.keys(selectedNode.attributes).length > 0 && (
              <>
                <SectionTitle title="ATTRIBUTES" />
                {Object.entries(selectedNode.attributes).map(([key, val]) => (
                  <PropertyRow
                    key={key}
                    label={key}
                    value={Array.isArray(val) ? val.join(", ") : String(val)}
                  />
                ))}
              </>
            )}

            {/* CHANGES (diff-specific) */}
            {selectedNode.changes && selectedNode.changes.length > 0 && (
              <>
                <SectionTitle title="CHANGES" highlight />
                {selectedNode.changes.map((change, i) => (
                  <div key={i} className="border-b border-white/[0.04] px-4 py-2">
                    <p className="text-[11px] font-medium text-text-primary">
                      {change.property}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span className="rounded bg-diff-removed/10 px-1.5 py-0.5 font-mono text-diff-removed line-through">
                        {String(change.oldValue)}
                      </span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="rounded bg-diff-added/10 px-1.5 py-0.5 font-mono text-diff-added">
                        {String(change.newValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : showGraphProps ? (
          /* ---- Graph Properties (Netron-style) ---- */
          <div>
            <PropertyRow label="name" value={unifiedGraph.summary.total > 0 ? "model_diff" : "—"} />
            <PropertyRow label="nodes" value={String(unifiedGraph.summary.total)} />
            <PropertyRow label="edges" value={String(unifiedGraph.edges.length)} />

            <SectionTitle title="DIFF SUMMARY" />
            <PropertyRow label="added" value={String(unifiedGraph.summary.added)}>
              <span className="text-diff-added font-semibold">{unifiedGraph.summary.added}</span>
            </PropertyRow>
            <PropertyRow label="removed">
              <span className="text-diff-removed font-semibold">{unifiedGraph.summary.removed}</span>
            </PropertyRow>
            <PropertyRow label="modified">
              <span className="text-diff-modified font-semibold">{unifiedGraph.summary.modified}</span>
            </PropertyRow>
            <PropertyRow label="unchanged">
              <span className="text-text-secondary">{unifiedGraph.summary.unchanged}</span>
            </PropertyRow>

            <SectionTitle title="INPUTS" />
            <div className="border-b border-white/[0.04]">
              <div className="flex items-start gap-2 px-4 py-2">
                <span className="mt-0.5 text-[11px] text-blue-400 shrink-0 w-14 text-right">input</span>
                <div className="flex-1">
                  <PropertySubRow label="name" value="input" bold />
                  <PropertySubRow label="tensor" value="float32[1,3,224,224]" />
                </div>
              </div>
            </div>

            <SectionTitle title="OUTPUTS" />
            <div className="border-b border-white/[0.04]">
              <div className="flex items-start gap-2 px-4 py-2">
                <span className="mt-0.5 text-[11px] text-blue-400 shrink-0 w-14 text-right">output</span>
                <div className="flex-1">
                  <PropertySubRow label="name" value="output" bold />
                  <PropertySubRow label="tensor" value="float32[1,10]" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ---- Empty state ---- */
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              className="mb-3 text-text-secondary/30"
            >
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M21 21l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-xs text-text-secondary">
              Click a node to inspect its properties
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Helper components ---- */

function SectionTitle({ title, highlight }: { title: string; highlight?: boolean }) {
  return (
    <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2">
      <span
        className={`text-[11px] font-semibold tracking-wide ${
          highlight ? "text-diff-modified" : "text-text-primary"
        }`}
      >
        {title}
      </span>
    </div>
  );
}

function PropertyRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-2">
      <span className="shrink-0 w-20 text-right text-[11px] text-text-secondary">{label}</span>
      <div className="flex-1 min-w-0">
        {children || (
          <span className="text-[11px] font-medium text-text-primary truncate block">{value}</span>
        )}
      </div>
    </div>
  );
}

function PropertySubRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-text-secondary">{label}:</span>
      <span className={`font-mono ${bold ? "font-bold text-text-primary" : "text-text-secondary"}`}>
        {value}
      </span>
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="px-4 py-2 border-b border-white/[0.04]">
      <span className="text-[11px] text-text-secondary/50">{text}</span>
    </div>
  );
}

function DiffBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    added: "bg-diff-added/15 text-diff-added",
    removed: "bg-diff-removed/15 text-diff-removed",
    modified: "bg-diff-modified/15 text-diff-modified",
    unchanged: "bg-white/[0.04] text-text-secondary",
  };

  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        colors[state] || colors.unchanged
      }`}
    >
      {state}
    </span>
  );
}
