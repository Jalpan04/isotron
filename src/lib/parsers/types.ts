export interface TensorInfo {
  name: string;
  shape: number[];
  dtype: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  inputs: TensorInfo[];
  outputs: TensorInfo[];
  attributes: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ModelGraph {
  format: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type DiffState = "added" | "removed" | "modified" | "unchanged";

export interface PropertyChange {
  property: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DiffNode extends GraphNode {
  diffState: DiffState;
  matchedNodeId?: string;
  changes?: PropertyChange[];
}

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

export interface UnifiedGraph {
  nodes: DiffNode[];
  edges: GraphEdge[];
  summary: DiffSummary;
}
