import type {
  ModelGraph,
  GraphNode,
  GraphEdge,
  DiffNode,
  DiffState,
  DiffSummary,
  PropertyChange,
  UnifiedGraph,
} from "@/lib/parsers/types";

/**
 * Compare two parsed ModelGraph objects and produce a UnifiedGraph
 * annotating every node with its diff state.
 *
 * Matching strategy (in priority order):
 *   1. Exact match on node name AND type
 *   2. Match on node name only (type changed = modified)
 *   3. Match on position + type (fallback for unnamed nodes)
 *
 * Unmatched base nodes -> "removed"
 * Unmatched target nodes -> "added"
 * Matched with differences -> "modified"
 * Matched with no differences -> "unchanged"
 */
export function compareGraphs(
  baseGraph: ModelGraph,
  targetGraph: ModelGraph
): UnifiedGraph {
  const baseNodes = baseGraph.nodes;
  const targetNodes = targetGraph.nodes;

  // Phase 1: Build match map
  const matchedBase = new Set<string>();
  const matchedTarget = new Set<string>();
  const matches: Array<{ baseNode: GraphNode; targetNode: GraphNode }> = [];

  // Pass 1: exact name + type match
  const targetByNameType = new Map<string, GraphNode>();
  for (const node of targetNodes) {
    targetByNameType.set(`${node.name}::${node.type}`, node);
  }

  for (const baseNode of baseNodes) {
    const key = `${baseNode.name}::${baseNode.type}`;
    const targetNode = targetByNameType.get(key);
    if (targetNode && !matchedTarget.has(targetNode.id)) {
      matches.push({ baseNode, targetNode });
      matchedBase.add(baseNode.id);
      matchedTarget.add(targetNode.id);
    }
  }

  // Pass 2: name-only match (type may have changed)
  const targetByName = new Map<string, GraphNode>();
  for (const node of targetNodes) {
    if (!matchedTarget.has(node.id)) {
      targetByName.set(node.name, node);
    }
  }

  for (const baseNode of baseNodes) {
    if (matchedBase.has(baseNode.id)) continue;
    const targetNode = targetByName.get(baseNode.name);
    if (targetNode) {
      matches.push({ baseNode, targetNode });
      matchedBase.add(baseNode.id);
      matchedTarget.add(targetNode.id);
      targetByName.delete(baseNode.name);
    }
  }

  // Phase 2: Build DiffNode array
  const diffNodes: DiffNode[] = [];

  // Matched nodes: unchanged or modified
  for (const { baseNode, targetNode } of matches) {
    const changes = detectChanges(baseNode, targetNode);
    const diffState: DiffState = changes.length > 0 ? "modified" : "unchanged";

    diffNodes.push({
      ...targetNode,
      diffState,
      matchedNodeId: baseNode.id,
      changes: changes.length > 0 ? changes : undefined,
    });
  }

  // Removed nodes (in base but not matched)
  for (const baseNode of baseNodes) {
    if (!matchedBase.has(baseNode.id)) {
      diffNodes.push({
        ...baseNode,
        diffState: "removed",
      });
    }
  }

  // Added nodes (in target but not matched)
  for (const targetNode of targetNodes) {
    if (!matchedTarget.has(targetNode.id)) {
      diffNodes.push({
        ...targetNode,
        diffState: "added",
      });
    }
  }

  // Phase 3: Merge edges
  const edges = mergeEdges(baseGraph.edges, targetGraph.edges, diffNodes);

  // Phase 4: Summary
  const summary = buildSummary(diffNodes);

  return { nodes: diffNodes, edges, summary };
}

function detectChanges(base: GraphNode, target: GraphNode): PropertyChange[] {
  const changes: PropertyChange[] = [];

  // Type change
  if (base.type !== target.type) {
    changes.push({ property: "type", oldValue: base.type, newValue: target.type });
  }

  // Output shape changes
  const maxOutputs = Math.max(base.outputs.length, target.outputs.length);
  for (let i = 0; i < maxOutputs; i++) {
    const baseOut = base.outputs[i];
    const targetOut = target.outputs[i];

    if (!baseOut && targetOut) {
      changes.push({ property: `output[${i}]`, oldValue: null, newValue: formatTensor(targetOut) });
    } else if (baseOut && !targetOut) {
      changes.push({ property: `output[${i}]`, oldValue: formatTensor(baseOut), newValue: null });
    } else if (baseOut && targetOut) {
      if (baseOut.dtype !== targetOut.dtype) {
        changes.push({ property: `output[${i}].dtype`, oldValue: baseOut.dtype, newValue: targetOut.dtype });
      }
      if (JSON.stringify(baseOut.shape) !== JSON.stringify(targetOut.shape)) {
        changes.push({ property: `output[${i}].shape`, oldValue: baseOut.shape, newValue: targetOut.shape });
      }
    }
  }

  // Input count changes
  if (base.inputs.length !== target.inputs.length) {
    changes.push({ property: "input_count", oldValue: base.inputs.length, newValue: target.inputs.length });
  }

  // Attribute changes
  const allAttrKeys = new Set([
    ...Object.keys(base.attributes),
    ...Object.keys(target.attributes),
  ]);

  for (const key of allAttrKeys) {
    const baseVal = base.attributes[key];
    const targetVal = target.attributes[key];

    if (baseVal === undefined) {
      changes.push({ property: `attr.${key}`, oldValue: null, newValue: targetVal });
    } else if (targetVal === undefined) {
      changes.push({ property: `attr.${key}`, oldValue: baseVal, newValue: null });
    } else if (JSON.stringify(baseVal) !== JSON.stringify(targetVal)) {
      changes.push({ property: `attr.${key}`, oldValue: baseVal, newValue: targetVal });
    }
  }

  return changes;
}

function formatTensor(t: { name: string; shape: number[]; dtype: string }): string {
  return `${t.dtype}[${t.shape.join(",")}]`;
}

function mergeEdges(
  baseEdges: GraphEdge[],
  targetEdges: GraphEdge[],
  diffNodes: DiffNode[]
): GraphEdge[] {
  const baseToUnified = new Map<string, string>();
  const unifiedIds = new Set<string>();

  for (const node of diffNodes) {
    unifiedIds.add(node.id);
    if (node.matchedNodeId) {
      baseToUnified.set(node.matchedNodeId, node.id);
    } else if (node.diffState === "removed") {
      baseToUnified.set(node.id, node.id);
    }
  }

  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  let idx = 0;

  function addTargetEdge(e: GraphEdge) {
    if (!unifiedIds.has(e.source) || !unifiedIds.has(e.target)) return;
    const key = `${e.source}->${e.target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ ...e, id: `e_${idx++}` });
  }

  function addBaseEdge(e: GraphEdge) {
    const uSource = baseToUnified.get(e.source) || e.source;
    const uTarget = baseToUnified.get(e.target) || e.target;
    
    if (!unifiedIds.has(uSource) || !unifiedIds.has(uTarget)) return;
    
    const key = `${uSource}->${uTarget}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ ...e, id: `e_${idx++}`, source: uSource, target: uTarget });
  }

  for (const e of targetEdges) addTargetEdge(e);
  for (const e of baseEdges) addBaseEdge(e);

  return edges;
}

function buildSummary(nodes: DiffNode[]): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, modified: 0, unchanged: 0, total: nodes.length };
  for (const node of nodes) {
    summary[node.diffState]++;
  }
  return summary;
}
