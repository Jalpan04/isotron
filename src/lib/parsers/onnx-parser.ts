import protobuf from "protobufjs";
import type { ModelGraph, GraphNode, GraphEdge, TensorInfo } from "./types";
import onnxProtoJson from "./onnx-proto.json";

const ONNX_DTYPE_MAP: Record<number, string> = {
  0: "undefined",
  1: "float32",
  2: "uint8",
  3: "int8",
  4: "uint16",
  5: "int16",
  6: "int32",
  7: "int64",
  8: "string",
  9: "bool",
  10: "float16",
  11: "float64",
  12: "uint32",
  13: "uint64",
  14: "complex64",  
  15: "complex128",
  16: "bfloat16",
};

interface OnnxDimension {
  dimValue?: number | Long;
  dimParam?: string;
}

interface Long {
  low: number;
  high: number;
  toNumber(): number;
}

function longToNumber(val: number | Long | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "object" && "toNumber" in val) return val.toNumber();
  return Number(val);
}

function extractShape(dims: OnnxDimension[]): number[] {
  if (!dims) return [];
  return dims.map((d) => {
    if (d.dimValue !== undefined && d.dimValue !== null) {
      return longToNumber(d.dimValue);
    }
    return -1; // dynamic dimension
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractAttributes(attrs: any[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!attrs) return result;

  for (const attr of attrs) {
    const name = attr.name as string;
    switch (attr.type) {
      case 1: // FLOAT
        result[name] = attr.f;
        break;
      case 2: // INT
        result[name] = longToNumber(attr.i);
        break;
      case 3: // STRING
        result[name] = new TextDecoder().decode(attr.s);
        break;
      case 6: // FLOATS
        result[name] = attr.floats || [];
        break;
      case 7: // INTS
        result[name] = (attr.ints || []).map(longToNumber);
        break;
      default:
        result[name] = `<${attr.type}>`;
    }
  }
  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface ValueInfoMap {
  [tensorName: string]: TensorInfo;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildValueInfoMap(valueInfos: any[]): ValueInfoMap {
  const map: ValueInfoMap = {};
  if (!valueInfos) return map;

  for (const vi of valueInfos) {
    const name = vi.name as string;
    let shape: number[] = [];
    let dtype = "unknown";

    if (vi.type?.tensorType) {
      const tt = vi.type.tensorType;
      dtype = ONNX_DTYPE_MAP[tt.elemType] || `dtype_${tt.elemType}`;
      if (tt.shape?.dim) {
        shape = extractShape(tt.shape.dim);
      }
    }

    map[name] = { name, shape, dtype };
  }
  return map;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function parseOnnx(buffer: ArrayBuffer): Promise<ModelGraph> {
  const root = protobuf.Root.fromJSON(onnxProtoJson);
  const ModelProto = root.lookupType("onnx.ModelProto");

  const uint8 = new Uint8Array(buffer);
  const model = ModelProto.decode(uint8) as unknown as Record<string, unknown>;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const graph = model.graph as any;
  if (!graph) {
    throw new Error("ONNX model has no graph");
  }

  // Build tensor info lookup from graph inputs, outputs, and value_info
  const viMap = {
    ...buildValueInfoMap(graph.input || []),
    ...buildValueInfoMap(graph.output || []),
    ...buildValueInfoMap(graph.valueInfo || []),
  };

  const rawNodes = (graph.node || []) as any[];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Map from output tensor name -> producing node id
  const outputToNodeId: Record<string, string> = {};

  for (let i = 0; i < rawNodes.length; i++) {
    const raw = rawNodes[i];
    const outputs = raw.output || [];
    const nodeId = raw.name ? raw.name : (outputs.length > 0 ? `node_${outputs[0]}` : `node_${i}`);
    const inputs: TensorInfo[] = (raw.input || []).map((name: string) => {
      return viMap[name] || { name, shape: [], dtype: "unknown" };
    });
    const parsedOutputs: TensorInfo[] = outputs.map((name: string) => {
      return viMap[name] || { name, shape: [], dtype: "unknown" };
    });

    nodes.push({
      id: nodeId,
      name: raw.name || nodeId,
      type: raw.opType || "Unknown",
      inputs,
      outputs: parsedOutputs,
      attributes: extractAttributes(raw.attribute),
    });

    // Register this node's outputs
    for (const outName of raw.output || []) {
      outputToNodeId[outName] = nodeId;
    }
  }

  // Build edges by matching input tensor names to producing nodes
  let edgeIdx = 0;
  for (const node of nodes) {
    for (const input of node.inputs) {
      const sourceNodeId = outputToNodeId[input.name];
      if (sourceNodeId && sourceNodeId !== node.id) {
        edges.push({
          id: `e_${edgeIdx++}`,
          source: sourceNodeId,
          target: node.id,
          sourceHandle: input.name,
          targetHandle: input.name,
        });
      }
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return {
    format: "onnx",
    name: graph.name || "onnx_model",
    nodes,
    edges,
  };
}
