const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "test-models");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// ---- Minimal ONNX files (valid protobuf structure) ----
// ONNX uses protobuf. We'll write minimal valid protobuf bytes
// that represent a simple ModelProto with a graph containing a few nodes.

function writeVarint(value) {
  const bytes = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return Buffer.from(bytes);
}

function writeString(fieldNumber, str) {
  const tag = writeVarint((fieldNumber << 3) | 2);
  const strBuf = Buffer.from(str, "utf8");
  const len = writeVarint(strBuf.length);
  return Buffer.concat([tag, len, strBuf]);
}

function writeEmbedded(fieldNumber, data) {
  const tag = writeVarint((fieldNumber << 3) | 2);
  const len = writeVarint(data.length);
  return Buffer.concat([tag, len, data]);
}

function writeVarintField(fieldNumber, value) {
  const tag = writeVarint((fieldNumber << 3) | 0);
  const val = writeVarint(value);
  return Buffer.concat([tag, val]);
}

// Build a minimal ONNX NodeProto
function buildOnnxNode(name, opType, inputs, outputs) {
  let buf = Buffer.alloc(0);
  for (const inp of inputs) buf = Buffer.concat([buf, writeString(1, inp)]);
  for (const out of outputs) buf = Buffer.concat([buf, writeString(2, out)]);
  buf = Buffer.concat([buf, writeString(3, name)]);
  buf = Buffer.concat([buf, writeString(4, opType)]);
  return buf;
}

// Build a simple ONNX model: input -> Conv -> Relu -> Conv -> Relu -> output
function buildBaseOnnxModel() {
  const nodes = [
    buildOnnxNode("conv1", "Conv", ["input"], ["conv1_out"]),
    buildOnnxNode("bn1", "BatchNormalization", ["conv1_out"], ["bn1_out"]),
    buildOnnxNode("relu1", "Relu", ["bn1_out"], ["relu1_out"]),
    buildOnnxNode("conv2", "Conv", ["relu1_out"], ["conv2_out"]),
    buildOnnxNode("bn2", "BatchNormalization", ["conv2_out"], ["bn2_out"]),
    buildOnnxNode("relu2", "Relu", ["bn2_out"], ["relu2_out"]),
    buildOnnxNode("conv3", "Conv", ["relu2_out"], ["conv3_out"]),
    buildOnnxNode("relu3", "Relu", ["conv3_out"], ["relu3_out"]),
    buildOnnxNode("pool", "GlobalAveragePool", ["relu3_out"], ["pool_out"]),
    buildOnnxNode("fc", "Gemm", ["pool_out"], ["output"]),
  ];

  let graphData = writeString(2, "main_graph");
  for (const node of nodes) {
    graphData = Buffer.concat([graphData, writeEmbedded(1, node)]);
  }

  let model = writeVarintField(1, 7); // ir_version = 7
  model = Buffer.concat([model, writeEmbedded(7, graphData)]); // graph
  model = Buffer.concat([model, writeVarintField(4, 8)]); // opset version

  // ONNX magic: no magic bytes needed, it's just protobuf
  return model;
}

// Build an "optimized" ONNX model with quantization nodes, fused layers
function buildTargetOnnxModel() {
  const nodes = [
    buildOnnxNode("quantize_input", "QuantizeLinear", ["input"], ["input_q"]),
    buildOnnxNode("conv1", "QLinearConv", ["input_q"], ["conv1_out"]),
    // bn1 is fused into conv1 (removed)
    buildOnnxNode("relu1", "Relu", ["conv1_out"], ["relu1_out"]),
    buildOnnxNode("conv2", "QLinearConv", ["relu1_out"], ["conv2_out"]),
    // bn2 is fused into conv2 (removed)
    buildOnnxNode("relu2", "Relu", ["conv2_out"], ["relu2_out"]),
    buildOnnxNode("conv3", "QLinearConv", ["relu2_out"], ["conv3_out"]),
    buildOnnxNode("relu3", "Relu", ["conv3_out"], ["relu3_out"]),
    buildOnnxNode("pool", "GlobalAveragePool", ["relu3_out"], ["pool_out"]),
    buildOnnxNode("fc", "QLinearMatMul", ["pool_out"], ["fc_out"]),
    buildOnnxNode("dequantize_output", "DequantizeLinear", ["fc_out"], ["output"]),
  ];

  let graphData = writeString(2, "main_graph");
  for (const node of nodes) {
    graphData = Buffer.concat([graphData, writeEmbedded(1, node)]);
  }

  let model = writeVarintField(1, 7);
  model = Buffer.concat([model, writeEmbedded(7, graphData)]);
  model = Buffer.concat([model, writeVarintField(4, 13)]);

  return model;
}

// Write the models
fs.writeFileSync(path.join(dir, "base_resnet.onnx"), buildBaseOnnxModel());
fs.writeFileSync(path.join(dir, "target_resnet_quantized.onnx"), buildTargetOnnxModel());

// Create simple TFLite test files (minimal valid FlatBuffer structure)
// TFLite files start with bytes matching the FlatBuffer file identifier "TFL3"
function buildTfliteFile(modelName) {
  // Minimal FlatBuffer: just enough to be recognized as TFLite
  // FlatBuffer layout: [root_table_offset(4)] [data...] [file_identifier(4)] [size(4)]
  const identifier = Buffer.from("TFL3", "ascii");
  const name = Buffer.from(modelName, "utf8");

  // Create a minimal buffer with the identifier embedded
  const buf = Buffer.alloc(256);
  buf.writeUInt32LE(8, 0); // root table offset
  identifier.copy(buf, 4); // file identifier at offset 4
  name.copy(buf, 16); // model name
  buf.writeUInt32LE(256, buf.length - 4); // file size

  return buf;
}

fs.writeFileSync(path.join(dir, "base_mobilenet.tflite"), buildTfliteFile("mobilenet_v2_base"));
fs.writeFileSync(path.join(dir, "target_mobilenet_quant.tflite"), buildTfliteFile("mobilenet_v2_int8"));

// Also create .pt and .h5 dummy files for format testing
fs.writeFileSync(path.join(dir, "test_model.pt"), Buffer.from("PK\x03\x04dummy_pytorch_model"));
fs.writeFileSync(path.join(dir, "test_model.h5"), Buffer.from("\x89HDF\r\n\x1a\ndummy_h5"));

console.log("Test models created in test-models/:");
console.log("  base_resnet.onnx             - Base model (Conv, BatchNorm, Relu, Gemm)");
console.log("  target_resnet_quantized.onnx  - Quantized model (QLinearConv, QuantizeLinear, DequantizeLinear)");
console.log("  base_mobilenet.tflite         - Base TFLite model");
console.log("  target_mobilenet_quant.tflite - Quantized TFLite model");
console.log("  test_model.pt                 - Dummy PyTorch file (format test only)");
console.log("  test_model.h5                 - Dummy HDF5 file (format test only)");
