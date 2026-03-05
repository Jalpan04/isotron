import type { ModelGraph, GraphNode, GraphEdge, TensorInfo } from "./types";

/**
 * Minimal TFLite FlatBuffer reader.
 *
 * TFLite uses FlatBuffers. Rather than importing the FlatBuffer compiler output
 * (heavy, requires codegen step), we read the binary structure manually.
 *
 * TFLite binary layout:
 *   [4 bytes] offset to root table
 *   [rest]    FlatBuffer data
 *
 * The file identifier is at bytes 4-7: "TFL3"
 */

const TFLITE_BUILTIN_OPS: Record<number, string> = {
  0: "ADD", 1: "AVERAGE_POOL_2D", 2: "CONCATENATION", 3: "CONV_2D",
  4: "DEPTHWISE_CONV_2D", 5: "DEPTH_TO_SPACE", 6: "DEQUANTIZE",
  7: "EMBEDDING_LOOKUP", 8: "FLOOR", 9: "FULLY_CONNECTED",
  10: "HASHTABLE_LOOKUP", 11: "L2_NORMALIZATION", 12: "L2_POOL_2D",
  13: "LOCAL_RESPONSE_NORMALIZATION", 14: "LOGISTIC", 15: "LSH_PROJECTION",
  16: "LSTM", 17: "MAX_POOL_2D", 18: "MUL", 19: "RELU",
  20: "RELU_N1_TO_1", 21: "RELU6", 22: "RESHAPE", 23: "RESIZE_BILINEAR",
  24: "RNN", 25: "SOFTMAX", 26: "SPACE_TO_DEPTH", 27: "SVDF",
  28: "TANH", 29: "CONCAT_EMBEDDINGS", 30: "SKIP_GRAM",
  31: "CALL", 32: "CUSTOM", 33: "EMBEDDING_LOOKUP_SPARSE",
  34: "PAD", 35: "UNIDIRECTIONAL_SEQUENCE_RNN", 36: "GATHER",
  37: "BATCH_TO_SPACE_ND", 38: "SPACE_TO_BATCH_ND", 39: "TRANSPOSE",
  40: "MEAN", 41: "SUB", 42: "DIV", 43: "SQUEEZE",
  44: "UNIDIRECTIONAL_SEQUENCE_LSTM", 45: "STRIDED_SLICE",
  46: "BIDIRECTIONAL_SEQUENCE_RNN", 47: "EXP", 48: "TOPK_V2",
  49: "SPLIT", 50: "LOG_SOFTMAX", 51: "DELEGATE", 52: "BIDIRECTIONAL_SEQUENCE_LSTM",
  53: "CAST", 54: "PRELU", 55: "MAXIMUM", 56: "ARG_MAX",
  57: "MINIMUM", 58: "LESS", 59: "NEG", 60: "PADV2",
  61: "GREATER", 62: "GREATER_EQUAL", 63: "LESS_EQUAL",
  64: "SELECT", 65: "SLICE", 66: "SIN", 67: "TRANSPOSE_CONV",
  68: "SPARSE_TO_DENSE", 69: "TILE", 70: "EXPAND_DIMS",
  71: "EQUAL", 72: "NOT_EQUAL", 73: "LOG", 74: "SUM",
  75: "SQRT", 76: "RSQRT", 77: "SHAPE", 78: "POW",
  79: "ARG_MIN", 80: "FAKE_QUANT", 81: "REDUCE_PROD",
  82: "REDUCE_MAX", 83: "PACK", 84: "LOGICAL_OR",
  85: "ONE_HOT", 86: "LOGICAL_AND", 87: "LOGICAL_NOT",
  88: "UNPACK", 89: "REDUCE_MIN", 90: "FLOOR_DIV",
  91: "REDUCE_ANY", 92: "SQUARE", 93: "ZEROS_LIKE",
  94: "FILL", 95: "FLOOR_MOD", 96: "RANGE", 97: "RESIZE_NEAREST_NEIGHBOR",
  98: "LEAKY_RELU", 99: "SQUARED_DIFFERENCE", 100: "MIRROR_PAD",
  101: "ABS", 102: "SPLIT_V", 103: "UNIQUE", 104: "CEIL",
  105: "REVERSE_V2", 106: "ADD_N", 107: "GATHER_ND",
  108: "COS", 109: "WHERE", 110: "RANK", 111: "ELU",
  112: "REVERSE_SEQUENCE", 113: "MATRIX_DIAG", 114: "QUANTIZE",
  115: "MATRIX_SET_DIAG", 116: "ROUND", 117: "HARD_SWISH",
  118: "IF", 119: "WHILE", 120: "NON_MAX_SUPPRESSION_V4",
  121: "NON_MAX_SUPPRESSION_V5", 122: "SCATTER_ND", 123: "SELECT_V2",
  124: "DENSIFY", 125: "SEGMENT_SUM", 126: "BATCH_MATMUL",
};

const TFLITE_TENSOR_TYPES: Record<number, string> = {
  0: "float32", 1: "float16", 2: "int32", 3: "uint8",
  4: "int64", 5: "string", 6: "bool", 7: "int16",
  8: "complex64", 9: "int8", 10: "float64", 11: "complex128",
  12: "uint64", 13: "resource", 14: "variant", 15: "uint32",
  16: "uint16", 17: "bfloat16",
};

class FlatBufferReader {
  private view: DataView;
  private bytes: Uint8Array;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  readInt32(offset: number): number {
    return this.view.getInt32(offset, true);
  }

  readUint16(offset: number): number {
    return this.view.getUint16(offset, true);
  }

  readUint32(offset: number): number {
    return this.view.getUint32(offset, true);
  }

  readInt8(offset: number): number {
    return this.view.getInt8(offset);
  }

  /** Read an indirect offset (table pointer) */
  indirect(offset: number): number {
    return offset + this.readInt32(offset);
  }

  /** Get vtable for a table at the given position */
  vtable(tablePos: number): number {
    return tablePos - this.readInt32(tablePos);
  }

  /** Read a field from a table. Returns 0 if not present. */
  fieldOffset(tablePos: number, fieldIndex: number): number {
    const vtablePos = this.vtable(tablePos);
    const vtableSize = this.readUint16(vtablePos);
    const byteOffset = 4 + fieldIndex * 2;
    if (byteOffset >= vtableSize) return 0;
    return this.readUint16(vtablePos + byteOffset);
  }

  /** Read a scalar field from a table */
  readField<T>(tablePos: number, fieldIndex: number, reader: (offset: number) => T, defaultVal: T): T {
    const offset = this.fieldOffset(tablePos, fieldIndex);
    if (offset === 0) return defaultVal;
    return reader(tablePos + offset);
  }

  /** Read a vector (offset to vector, then length + data) */
  vectorOffset(tablePos: number, fieldIndex: number): number {
    const offset = this.fieldOffset(tablePos, fieldIndex);
    if (offset === 0) return 0;
    const vecStart = tablePos + offset;
    return this.indirect(vecStart);
  }

  vectorLength(vecOffset: number): number {
    if (vecOffset === 0) return 0;
    return this.readInt32(vecOffset);
  }

  /** Read a string at the given offset */
  readString(offset: number): string {
    const strOffset = this.indirect(offset);
    const length = this.readInt32(strOffset);
    const start = strOffset + 4;
    return new TextDecoder().decode(this.bytes.slice(start, start + length));
  }

  readStringField(tablePos: number, fieldIndex: number): string {
    const offset = this.fieldOffset(tablePos, fieldIndex);
    if (offset === 0) return "";
    return this.readString(tablePos + offset);
  }

  /** Get the root table position */
  rootTable(): number {
    return this.indirect(0);
  }

  /** Read an element from a vector of tables */
  vectorTableAt(vecOffset: number, index: number): number {
    const dataStart = vecOffset + 4;
    const elemOffset = dataStart + index * 4;
    return this.indirect(elemOffset);
  }

  /** Read an element from a vector of scalars */
  vectorScalarAt(vecOffset: number, index: number, size: number): number {
    const dataStart = vecOffset + 4;
    return dataStart + index * size;
  }
}

export function parseTflite(buffer: ArrayBuffer): ModelGraph {
  const reader = new FlatBufferReader(buffer);

  // Verify file identifier "TFL3" at bytes 4-7
  const id = new TextDecoder().decode(new Uint8Array(buffer, 4, 4));
  if (id !== "TFL3") {
    throw new Error(`Not a valid TFLite file (identifier: "${id}")`);
  }

  const modelTable = reader.rootTable();

  // Model fields:
  //   0: version (uint32)
  //   1: operator_codes (vector of OperatorCode tables)
  //   2: subgraphs (vector of SubGraph tables)
  //   3: description (string)

  const description = reader.readStringField(modelTable, 3);

  // Read operator codes
  const opCodesVec = reader.vectorOffset(modelTable, 1);
  const opCodesLen = reader.vectorLength(opCodesVec);
  const opCodes: string[] = [];
  for (let i = 0; i < opCodesLen; i++) {
    const opCodeTable = reader.vectorTableAt(opCodesVec, i);
    // OperatorCode fields: 0: deprecated_builtin_code(int8), 1: custom_code(string), 4: builtin_code(int32)
    let builtinCode = reader.readField(opCodeTable, 4, (o) => reader.readInt32(o), -1);
    if (builtinCode === -1) {
      // fallback to deprecated field
      builtinCode = reader.readField(opCodeTable, 0, (o) => reader.readInt8(o), 0);
    }
    const customCode = reader.readStringField(opCodeTable, 1);
    opCodes.push(customCode || TFLITE_BUILTIN_OPS[builtinCode] || `OP_${builtinCode}`);
  }

  // Read first subgraph
  const subgraphsVec = reader.vectorOffset(modelTable, 2);
  const subgraphsLen = reader.vectorLength(subgraphsVec);
  if (subgraphsLen === 0) {
    return { format: "tflite", name: description || "tflite_model", nodes: [], edges: [] };
  }

  const subgraphTable = reader.vectorTableAt(subgraphsVec, 0);

  // SubGraph fields: 0: tensors, 1: inputs, 2: outputs, 3: operators, 4: name
  const subgraphName = reader.readStringField(subgraphTable, 4);

  // Read tensors
  const tensorsVec = reader.vectorOffset(subgraphTable, 0);
  const tensorsLen = reader.vectorLength(tensorsVec);

  interface TfliteTensor {
    name: string;
    shape: number[];
    dtype: string;
  }
  const tensors: TfliteTensor[] = [];

  for (let i = 0; i < tensorsLen; i++) {
    const tensorTable = reader.vectorTableAt(tensorsVec, i);
    // Tensor fields: 0: shape(vector<int>), 1: type(int8), 2: buffer(uint32), 3: name(string)
    const name = reader.readStringField(tensorTable, 3);
    const dtype = reader.readField(tensorTable, 1, (o) => reader.readInt8(o), 0);

    const shapeVec = reader.vectorOffset(tensorTable, 0);
    const shapeLen = reader.vectorLength(shapeVec);
    const shape: number[] = [];
    for (let j = 0; j < shapeLen; j++) {
      const pos = reader.vectorScalarAt(shapeVec, j, 4);
      shape.push(reader.readInt32(pos));
    }

    tensors.push({
      name: name || `tensor_${i}`,
      shape,
      dtype: TFLITE_TENSOR_TYPES[dtype] || `type_${dtype}`,
    });
  }

  // Read operators
  const operatorsVec = reader.vectorOffset(subgraphTable, 3);
  const operatorsLen = reader.vectorLength(operatorsVec);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const outputToNodeId: Record<number, string> = {};
  let edgeIdx = 0;

  for (let i = 0; i < operatorsLen; i++) {
    const opTable = reader.vectorTableAt(operatorsVec, i);
    // Operator fields: 0: opcode_index(uint32), 1: inputs(vector<int>), 2: outputs(vector<int>)
    const opcodeIndex = reader.readField(opTable, 0, (o) => reader.readUint32(o), 0);
    const opType = opCodes[opcodeIndex] || `OP_${opcodeIndex}`;

    const inputsVec = reader.vectorOffset(opTable, 1);
    const inputsLen = reader.vectorLength(inputsVec);
    const inputTensorIndices: number[] = [];
    const nodeInputs: TensorInfo[] = [];
    for (let j = 0; j < inputsLen; j++) {
      const pos = reader.vectorScalarAt(inputsVec, j, 4);
      const tensorIdx = reader.readInt32(pos);
      inputTensorIndices.push(tensorIdx);
      if (tensorIdx >= 0 && tensorIdx < tensors.length) {
        const t = tensors[tensorIdx];
        nodeInputs.push({ name: t.name, shape: t.shape, dtype: t.dtype });
      }
    }

    const outputsVec = reader.vectorOffset(opTable, 2);
    const outputsLen = reader.vectorLength(outputsVec);
    const nodeOutputs: TensorInfo[] = [];
    for (let j = 0; j < outputsLen; j++) {
      const pos = reader.vectorScalarAt(outputsVec, j, 4);
      const tensorIdx = reader.readInt32(pos);
      if (tensorIdx >= 0 && tensorIdx < tensors.length) {
        const t = tensors[tensorIdx];
        nodeOutputs.push({ name: t.name, shape: t.shape, dtype: t.dtype });
        outputToNodeId[tensorIdx] = `op_${i}`;
      }
    }

    nodes.push({
      id: `op_${i}`,
      name: `${opType}_${i}`,
      type: opType,
      inputs: nodeInputs,
      outputs: nodeOutputs,
      attributes: {},
    });

    // Build edges from input tensor indices
    for (const tensorIdx of inputTensorIndices) {
      if (tensorIdx >= 0 && outputToNodeId[tensorIdx] && outputToNodeId[tensorIdx] !== `op_${i}`) {
        edges.push({
          id: `e_${edgeIdx++}`,
          source: outputToNodeId[tensorIdx],
          target: `op_${i}`,
        });
      }
    }
  }

  return {
    format: "tflite",
    name: subgraphName || description || "tflite_model",
    nodes,
    edges,
  };
}
