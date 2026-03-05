"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { DiffNode, IONode } from "@/components/graph/DiffNode";
import { layoutGraph } from "@/lib/layout/dagre-layout";
import { useGraphStore } from "@/store/useGraphStore";
import type { DiffState, DiffNode as DiffNodeType, UnifiedGraph } from "@/lib/parsers/types";

const nodeTypes = { diff: DiffNode, io: IONode };

const EDGE_COLORS: Record<DiffState, string> = {
  added: "#22c55e",
  removed: "#ef4444",
  modified: "#eab308",
  unchanged: "#ffffff",
};

function formatShape(shape: number[]): string {
  if (!shape || shape.length === 0) return "";
  return shape.map((d) => (d === -1 ? "?" : String(d))).join("\u00d7");
}

function getNodeShapes(node: DiffNodeType): { inputShapes: string; outputShapes: string } {
  const inputShapes = node.inputs
    .filter((t) => t.shape.length > 0)
    .map((t) => formatShape(t.shape))
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .join(", ");

  const outputShapes = node.outputs
    .filter((t) => t.shape.length > 0)
    .map((t) => formatShape(t.shape))
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .join(", ");

  return { inputShapes, outputShapes };
}

interface BuildOptions {
  showAttributes: boolean;
  showNames: boolean;
  horizontal: boolean;
  searchQuery: string;
}

function buildFlowData(
  unifiedGraph: UnifiedGraph,
  selectedNodeId: string | null,
  opts: BuildOptions
) {
  const rawNodes: Node[] = [];
  const rawEdges: Edge[] = [];
  const searchLower = opts.searchQuery.toLowerCase();

  // Add an "input" IO node at the top
  rawNodes.push({
    id: "__input__",
    type: "io",
    position: { x: 0, y: 0 },
    data: { label: "input", shape: "1\u00d73\u00d7224\u00d7224", kind: "input", horizontal: opts.horizontal },
    selectable: false,
  });

  // Find root/leaf nodes
  const targetIds = new Set(unifiedGraph.edges.map((e) => e.target));
  const sourceIds = new Set(unifiedGraph.edges.map((e) => e.source));
  const rootNodes = unifiedGraph.nodes.filter((n) => !targetIds.has(n.id));
  const leafNodes = unifiedGraph.nodes.filter((n) => !sourceIds.has(n.id));

  for (const root of rootNodes) {
    rawEdges.push({
      id: `e_input_${root.id}`,
      source: "__input__",
      target: root.id,
      style: { stroke: "#ffffff", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#ffffff" },
    });
  }

  // Add diff nodes
  for (const node of unifiedGraph.nodes) {
    const { inputShapes, outputShapes } = getNodeShapes(node);
    const searchMatch =
      searchLower.length > 0 &&
      (node.name.toLowerCase().includes(searchLower) ||
        node.type.toLowerCase().includes(searchLower));

    rawNodes.push({
      id: node.id,
      type: "diff",
      position: { x: 0, y: 0 },
      data: {
        label: node.name,
        opType: node.type,
        diffState: node.diffState,
        changeCount: node.changes?.length || 0,
        isSelected: node.id === selectedNodeId,
        inputShapes,
        outputShapes,
        showAttributes: opts.showAttributes,
        showNames: opts.showNames,
        attributes: node.attributes || {},
        searchMatch,
        horizontal: opts.horizontal,
      },
    });
  }

  // Add "output" IO node at the bottom
  rawNodes.push({
    id: "__output__",
    type: "io",
    position: { x: 0, y: 0 },
    data: { label: "output", shape: "1\u00d710", kind: "output", horizontal: opts.horizontal },
    selectable: false,
  });

  for (const leaf of leafNodes) {
    rawEdges.push({
      id: `e_output_${leaf.id}`,
      source: leaf.id,
      target: "__output__",
      style: { stroke: "#ffffff", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#ffffff" },
    });
  }

  // Add diff edges with arrow markers and labels
  for (const edge of unifiedGraph.edges) {
    const targetNode = unifiedGraph.nodes.find((n) => n.id === edge.target);
    const sourceNode = unifiedGraph.nodes.find((n) => n.id === edge.source);
    
    // Pick the most significant diff state from either endpoint
    const srcState = sourceNode?.diffState || "unchanged";
    const tgtState = targetNode?.diffState || "unchanged";
    const priority = ["added", "removed", "modified", "unchanged"];
    const edgeState = priority.find((s) => s === srcState || s === tgtState) || "unchanged";

    const color = EDGE_COLORS[edgeState as keyof typeof EDGE_COLORS];

    let edgeLabel = "";
    if (sourceNode && sourceNode.outputs.length > 0 && sourceNode.outputs[0].shape.length > 0) {
      edgeLabel = formatShape(sourceNode.outputs[0].shape);
    }

    rawEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: false,
      label: edgeLabel || undefined,
      labelStyle: { fill: "#ffffff", fontSize: 9, fontFamily: "JetBrains Mono, monospace" },
      labelBgStyle: { fill: "#09090b", fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 3,
      style: {
        stroke: color,
        strokeWidth: 2,
        opacity: 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color },
    });
  }

  return layoutGraph(rawNodes, rawEdges, opts.horizontal ? "LR" : "TB");
}

export function GraphCanvas() {
  const { unifiedGraph, selectedNode, setSelectedNode, viewSettings, searchQuery } =
    useGraphStore();

  const [uniNodes, setUniNodes] = useState<Node[]>([]);
  const [uniEdges, setUniEdges] = useState<Edge[]>([]);

  useMemo(() => {
    if (!unifiedGraph) return;
    const { nodes: uN, edges: uE } = buildFlowData(unifiedGraph, selectedNode?.id || null, {
      showAttributes: viewSettings.showAttributes,
      showNames: viewSettings.showNames,
      horizontal: viewSettings.horizontalLayout,
      searchQuery,
    });
    setUniNodes(uN);
    setUniEdges(uE);
  }, [unifiedGraph, selectedNode?.id, viewSettings, searchQuery]);

  const onUniNodesChange: OnNodesChange = useCallback((c) => setUniNodes((nds) => applyNodeChanges(c, nds)), []);
  const onUniEdgesChange: OnEdgesChange = useCallback((c) => setUniEdges((eds) => applyEdgeChanges(c, eds)), []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!unifiedGraph || node.id.startsWith("__")) return;
      const diffNode = unifiedGraph.nodes.find((n) => n.id === node.id);
      if (diffNode) setSelectedNode(diffNode);
    },
    [unifiedGraph, setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  if (!unifiedGraph) return null;

  const { summary } = unifiedGraph;

  return (
    <div className="relative h-full w-full flex">
      {/* Floating diff summary bar */}
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-white/[0.06] bg-surface-1/90 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-5 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-diff-added" />
            <span className="text-text-secondary">Added</span>
            <span className="font-semibold text-diff-added">{summary.added}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-diff-removed" />
            <span className="text-text-secondary">Removed</span>
            <span className="font-semibold text-diff-removed">{summary.removed}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-diff-modified" />
            <span className="text-text-secondary">Modified</span>
            <span className="font-semibold text-diff-modified">{summary.modified}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-diff-unchanged" />
            <span className="text-text-secondary">Unchanged</span>
            <span className="font-semibold text-text-secondary">{summary.unchanged}</span>
          </span>
          <span className="ml-1 border-l border-white/10 pl-3 text-text-secondary">
            {summary.total} nodes
          </span>
        </div>
      </div>

      <div className="h-full w-full">
        <ReactFlow
          nodes={uniNodes}
          edges={uniEdges}
          onNodesChange={onUniNodesChange}
          onEdgesChange={onUniEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          minZoom={0.05}
          maxZoom={4}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-[#09090b]"
        >
          <Background color="#3f3f46" variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls position="bottom-left" className="!rounded-lg !border !border-white/[0.06] !bg-black !shadow-none [&>button]:!border-white/[0.06] [&>button]:!bg-black [&>button]:!text-text-secondary [&>button:hover]:!bg-white/[0.04] [&>button:hover]:!text-white [&>button>svg]:!fill-current" />
          <MiniMap
            nodeColor={(pos) => 
              (pos.data as any).diffState === "added" ? "#22c55e" :
              (pos.data as any).diffState === "removed" ? "#ef4444" :
              (pos.data as any).diffState === "modified" ? "#eab308" :
              "#18181b"
            }
            maskColor="#00000080"
            className="!bg-surface-1 !border-white/[0.06] rounded-md overflow-hidden"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
