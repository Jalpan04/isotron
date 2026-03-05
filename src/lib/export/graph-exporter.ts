import dagre from "@dagrejs/dagre";
import type { UnifiedGraph, DiffNode } from "@/lib/parsers/types";

export interface ExportViewSettings {
  showAttributes: boolean;
  showNames: boolean;
  showWeights: boolean;
  horizontalLayout: boolean;
}

const NODE_W = 160;
const IO_W = 110;
const IO_H = 40;
const PADDING = 60;
const ARROW_SIZE = 7;
const FONT = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

const OP_CATEGORY_MAP: Record<string, string> = {
  Conv: "convolution", QLinearConv: "convolution", ConvTranspose: "convolution",
  FusedConv: "convolution", DepthwiseConv: "convolution", CONV_2D: "convolution",
  DEPTHWISE_CONV_2D: "convolution", TRANSPOSE_CONV: "convolution",
  Relu: "activation", Relu6: "activation", LeakyRelu: "activation", Sigmoid: "activation",
  Tanh: "activation", Softmax: "activation", HardSwish: "activation", HardSigmoid: "activation",
  Elu: "activation", Selu: "activation", PRelu: "activation", Gelu: "activation",
  RELU: "activation", RELU6: "activation", LOGISTIC: "activation", TANH: "activation",
  SOFTMAX: "activation", LEAKY_RELU: "activation", HARD_SWISH: "activation",
  BatchNormalization: "normalization", InstanceNormalization: "normalization",
  LayerNormalization: "normalization", GroupNormalization: "normalization",
  MaxPool: "pooling", AveragePool: "pooling", GlobalAveragePool: "pooling",
  GlobalMaxPool: "pooling",
  Gemm: "linear", MatMul: "linear", QLinearMatMul: "linear",
  FULLY_CONNECTED: "linear",
  QuantizeLinear: "quantization", DequantizeLinear: "quantization",
  Flatten: "reshape", Reshape: "reshape", Squeeze: "reshape", Unsqueeze: "reshape",
  Transpose: "reshape", Concat: "reshape",
  Add: "arithmetic", Sub: "arithmetic", Mul: "arithmetic", Div: "arithmetic",
};

const CATEGORY_COLORS: Record<string, { fill: string; text: string; bgStroke: string }> = {
  convolution:   { fill: "#172554", text: "#93c5fd", bgStroke: "#1e3a8a" },
  activation:    { fill: "#312e81", text: "#a5b4fc", bgStroke: "#3730a3" },
  normalization: { fill: "#4c1d95", text: "#c4b5fd", bgStroke: "#5b21b6" },
  pooling:       { fill: "#164e63", text: "#67e8f9", bgStroke: "#155e75" },
  linear:        { fill: "#042f2e", text: "#5eead4", bgStroke: "#115e59" },
  quantization:  { fill: "#831843", text: "#fbcfe8", bgStroke: "#9d174d" },
  reshape:       { fill: "#1e293b", text: "#cbd5e1", bgStroke: "#334155" },
  arithmetic:    { fill: "#4c1d95", text: "#c4b5fd", bgStroke: "#5b21b6" },
  io:            { fill: "#18181b", text: "#d4d4d8", bgStroke: "#3f3f46" },
  other:         { fill: "#27272a", text: "#a1a1aa", bgStroke: "#3f3f46" },
};

const OP_ICON: Record<string, string> = {
  convolution: "C", activation: "A", normalization: "N", pooling: "P",
  linear: "L", quantization: "Q", reshape: "R", arithmetic: "+",
  io: "", other: "?",
};

const DIFF_COLORS: Record<string, string> = {
  added: "#22c55e",
  removed: "#ef4444",
  modified: "#eab308",
  unchanged: "",
};

function getCategory(opType: string): string {
  return OP_CATEGORY_MAP[opType] || "other";
}

function formatShape(shape: number[]): string {
  if (!shape || shape.length === 0) return "";
  return shape.map((d) => (d === -1 ? "?" : String(d))).join("\u00d7");
}

function escapeXml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  subLabel: string;
  opType: string;
  isIO: boolean;
  diffState: string;
  category: string;
  attributes: [string, any][];
}

interface LayoutEdge {
  source: string;
  target: string;
  label: string;
}

function layoutForExport(graph: UnifiedGraph, viewSettings: ExportViewSettings): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
} {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ 
    rankdir: viewSettings.horizontalLayout ? "LR" : "TB", 
    nodesep: 40, 
    ranksep: 60, 
    marginx: PADDING, 
    marginy: PADDING 
  });

  // IO nodes
  const targetIds = new Set(graph.edges.map((e) => e.target));
  const sourceIds = new Set(graph.edges.map((e) => e.source));
  const roots = graph.nodes.filter((n) => !targetIds.has(n.id));
  const leaves = graph.nodes.filter((n) => !sourceIds.has(n.id));

  // Build root/leaf shape strings
  const rootShapes: Record<string, string> = {};
  for (const r of roots) {
    if (r.inputs.length > 0 && r.inputs[0].shape.length > 0) {
      rootShapes[r.id] = formatShape(r.inputs[0].shape);
    }
  }

  const leafShapes: Record<string, string> = {};
  for (const l of leaves) {
    if (l.outputs.length > 0 && l.outputs[0].shape.length > 0) {
      leafShapes[l.id] = formatShape(l.outputs[0].shape);
    }
  }

  const inShapeStr = Object.values(rootShapes)[0] || "";
  const outShapeStr = Object.values(leafShapes)[0] || "";

  // IO height is larger if there's a shape
  const inH = inShapeStr ? IO_H + 12 : IO_H;
  const outH = outShapeStr ? IO_H + 12 : IO_H;

  g.setNode("__input__", { width: IO_W, height: inH });
  g.setNode("__output__", { width: IO_W, height: outH });

  // Calculate Node dimensions based on settings
  const layoutNodes: LayoutNode[] = [];
  const nodeMapForEdges = new Map<string, DiffNode>();

  for (const n of graph.nodes) {
    nodeMapForEdges.set(n.id, n);
    
    // Calculate attributes to show
    const attrsToShow: [string, any][] = [];
    if (viewSettings.showAttributes && n.attributes) {
      const IMPORTANT_ATTRS = ["kernel_shape", "strides", "pads", "group", "epsilon", "axis", "keepdims"];
      const entries = Object.entries(n.attributes)
        .filter(([k]) => IMPORTANT_ATTRS.includes(k) && !k.startsWith("_"))
        .slice(0, 3); // Max 3 to not explode nodes
      attrsToShow.push(...entries);
    }

    // Base height 46. Add 14px for name. Add 14px per attribute. Plus 4px padding if attrs exist.
    let h = 46;
    if (viewSettings.showNames) h += 14;
    if (attrsToShow.length > 0) h += attrsToShow.length * 14 + 6;

    g.setNode(n.id, { width: NODE_W, height: h });

    layoutNodes.push({
      id: n.id,
      x: 0, // Assigned later
      y: 0,
      w: NODE_W,
      h: h,
      label: n.type,
      subLabel: n.id.split('_').slice(-1)[0] || "",
      opType: n.type,
      isIO: false,
      diffState: n.diffState,
      category: getCategory(n.type),
      attributes: attrsToShow,
    });
  }

  for (const r of roots) g.setEdge("__input__", r.id);
  for (const l of leaves) g.setEdge(l.id, "__output__");
  for (const e of graph.edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  // Apply layout directly to nodes
  const inputPos = g.node("__input__");
  layoutNodes.push({
    id: "__input__",
    x: inputPos.x - IO_W / 2,
    y: inputPos.y - inH / 2,
    w: IO_W,
    h: inH,
    label: "input",
    subLabel: inShapeStr,
    opType: "",
    isIO: true,
    diffState: "unchanged",
    category: "io",
    attributes: [],
  });

  for (const layoutNode of layoutNodes) {
    if (layoutNode.isIO) continue;
    const pos = g.node(layoutNode.id);
    layoutNode.x = pos.x - layoutNode.w / 2;
    layoutNode.y = pos.y - layoutNode.h / 2;
  }

  const outputPos = g.node("__output__");
  layoutNodes.push({
    id: "__output__",
    x: outputPos.x - IO_W / 2,
    y: outputPos.y - outH / 2,
    w: IO_W,
    h: outH,
    label: "output",
    subLabel: outShapeStr,
    opType: "",
    isIO: true,
    diffState: "unchanged",
    category: "io",
    attributes: [],
  });

  const layoutEdges: LayoutEdge[] = [];

  for (const r of roots) layoutEdges.push({ source: "__input__", target: r.id, label: "" });
  for (const e of graph.edges) layoutEdges.push({ source: e.source, target: e.target, label: "" });
  for (const l of leaves) layoutEdges.push({ source: l.id, target: "__output__", label: "" });

  const gInfo = g.graph() as { width: number; height: number };
  return { nodes: layoutNodes, edges: layoutEdges, width: gInfo.width, height: gInfo.height };
}

function buildSVG(graph: UnifiedGraph, viewSettings: ExportViewSettings): string {
  const { nodes, edges, width, height } = layoutForExport(graph, viewSettings);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  
  // NOTE: No background rect, we want transparency! PNG export will maintain transparent alpha.

  // Define Arrow markers for each state to match UI
  lines.push(`<defs>`);
  const defineMarker = (id: string, color: string) => {
    lines.push(`<marker id="${id}" markerWidth="${ARROW_SIZE}" markerHeight="${ARROW_SIZE}" refX="${ARROW_SIZE}" refY="${ARROW_SIZE / 2}" orient="auto">`);
    lines.push(`  <polygon points="0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}" fill="${color}"/>`);
    lines.push(`</marker>`);
  };
  defineMarker("arrow-added", DIFF_COLORS.added);
  defineMarker("arrow-removed", DIFF_COLORS.removed);
  defineMarker("arrow-modified", DIFF_COLORS.modified);
  defineMarker("arrow-unchanged", "#ffffff");
  lines.push(`</defs>`);

  // Draw Edges
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    // Line routing
    let x1, y1, x2, y2, cy1, cx1;
    if (viewSettings.horizontalLayout) {
      x1 = src.x + src.w;
      y1 = src.y + src.h / 2;
      x2 = tgt.x;
      y2 = tgt.y + tgt.h / 2;
      cx1 = x1 + (x2 - x1) / 2;
      cy1 = y1;
    } else {
      x1 = src.x + src.w / 2;
      y1 = src.y + src.h;
      x2 = tgt.x + tgt.w / 2;
      y2 = tgt.y;
      cx1 = x1;
      cy1 = y1 + (y2 - y1) / 2;
    }

    // UI picks highest priority state for edges
    const srcState = src.diffState;
    const tgtState = tgt.diffState;
    const priority = ["added", "removed", "modified", "unchanged"];
    const edgeState = priority.find(s => s === srcState || s === tgtState) || "unchanged";

    const strokeColor = DIFF_COLORS[edgeState] || "#ffffff";
    const strokeW = 2.0;
    const markerId = `arrow-${edgeState}`;
    
    // User wants dashed lines for non-unchanged edges
    const dash = "";

    // Quadratic curve control points to make nice paths
    const path = viewSettings.horizontalLayout 
      ? `M ${x1} ${y1} C ${cx1} ${y1}, ${cx1} ${y2}, ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy1}, ${x2} ${y2}`;

    lines.push(`<path d="${path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}" ${dash} marker-end="url(#${markerId})"/>`);
  }

  // Draw Nodes
  for (const node of nodes) {
    const colors = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.other;
    const isIO = node.isIO;
    const rx = isIO ? node.h / 2 : 6;

    const diffBorder = DIFF_COLORS[node.diffState];
    const borderW = diffBorder ? 2 : 1; // Not excessively glowing, just 2px
    const borderCol = diffBorder || colors.bgStroke;

    const fillCol = isIO ? "#18181b" : colors.fill;
    
    // Background Rect
    lines.push(`<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${rx}" fill="${fillCol}" stroke="${borderCol}" stroke-width="${borderW}"/>`);

    if (isIO) {
      // IO nodes
      if (node.subLabel) {
        // Render name and shape
        lines.push(`<text x="${node.x + node.w/2}" y="${node.y + 16}" font-family="${FONT}" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(node.label)}</text>`);
        lines.push(`<text x="${node.x + node.w/2}" y="${node.y + 30}" font-family="${MONO}" font-size="9" font-style="italic" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(node.subLabel)}</text>`);
      } else {
        lines.push(`<text x="${node.x + node.w/2}" y="${node.y + node.h/2 + 1}" font-family="${FONT}" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(node.label)}</text>`);
      }
    } else {
      // Standard Node
      const icon = OP_ICON[node.category] || "?";
      const iconX = node.x + 14;
      const textX = node.x + 32;
      
      // Icon square
      lines.push(`<rect x="${iconX - 6}" y="${node.y + 11}" width="16" height="16" rx="4" fill="${colors.text}" opacity="0.2"/>`);
      lines.push(`<text x="${iconX + 2}" y="${node.y + 19}" font-family="${MONO}" font-size="10" font-weight="bold" fill="${colors.text}" text-anchor="middle" dominant-baseline="middle">${icon}</text>`);
      
      // Type Name
      lines.push(`<text x="${textX}" y="${node.y + 19}" font-family="${FONT}" font-size="13" font-weight="600" fill="#ffffff" dominant-baseline="middle">${escapeXml(node.label)}</text>`);
      
      let currentY = node.y + 34;

      // Subtext (Node name) if requested
      if (viewSettings.showNames && node.subLabel) {
        lines.push(`<text x="${textX}" y="${currentY}" font-family="${MONO}" font-size="9" font-style="italic" fill="#ffffff" dominant-baseline="middle">${escapeXml(node.subLabel)}</text>`);
        currentY += 14;
      }

      // Attributes
      if (viewSettings.showAttributes && node.attributes.length > 0) {
        for (const [k, v] of node.attributes) {
          const valStr = Array.isArray(v) ? v.join(", ") : String(v);
          lines.push(`<text x="${textX}" y="${currentY}" font-family="${MONO}" font-size="9" fill="#ffffff" dominant-baseline="middle">${escapeXml(k)} = ${escapeXml(valStr)}</text>`);
          currentY += 14;
        }
      }

      // Diff Badge Top Right
      if (node.diffState !== "unchanged") {
        const badgeColor = DIFF_COLORS[node.diffState];
        const badgeSymbol = node.diffState === "added" ? "+" : node.diffState === "removed" ? "-" : "~";
        const bx = node.x + node.w;
        const by = node.y;
        lines.push(`<circle cx="${bx}" cy="${by}" r="8" fill="${badgeColor}"/>`);
        lines.push(`<text x="${bx}" y="${by + 1}" font-family="${MONO}" font-size="11" font-weight="bold" fill="#09090b" text-anchor="middle" dominant-baseline="middle">${badgeSymbol}</text>`);
      }
    }
  }

  lines.push(`</svg>`);
  return lines.join("\n");
}

export function exportAsSVG(graph: UnifiedGraph, viewSettings: ExportViewSettings): void {
  const svgStr = buildSVG(graph, viewSettings);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "isotron-graph.svg";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsPNG(graph: UnifiedGraph, viewSettings: ExportViewSettings, scale = 2): void {
  const svgStr = buildSVG(graph, viewSettings);

  // Parse dimensions from SVG
  const wMatch = svgStr.match(/width="(\d+)"/);
  const hMatch = svgStr.match(/height="(\d+)"/);
  const w = wMatch ? parseInt(wMatch[1]) : 800;
  const h = hMatch ? parseInt(hMatch[1]) : 600;

  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear canvas for transparency
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "isotron-graph.png";
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };

  img.src = url;
}
