import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const IO_NODE_WIDTH = 120;
const IO_NODE_HEIGHT = 40;

export function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 70,
    marginx: 50,
    marginy: 50,
  });

  for (const node of nodes) {
    const isIO = node.type === "io";
    g.setNode(node.id, {
      width: isIO ? IO_NODE_WIDTH : NODE_WIDTH,
      height: isIO ? IO_NODE_HEIGHT : NODE_HEIGHT,
    });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    const isIO = node.type === "io";
    const w = isIO ? IO_NODE_WIDTH : NODE_WIDTH;
    const h = isIO ? IO_NODE_HEIGHT : NODE_HEIGHT;
    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });

  return { nodes: layoutNodes, edges };
}
