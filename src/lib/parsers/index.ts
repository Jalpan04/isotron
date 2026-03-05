import type { ModelGraph } from "./types";
import { parseOnnx } from "./onnx-parser";
import { parseTflite } from "./tflite-parser";

type SupportedFormat = "onnx" | "tflite";

const FORMAT_MAP: Record<string, SupportedFormat> = {
  ".onnx": "onnx",
  ".tflite": "tflite",
};

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

export async function parseFile(file: File): Promise<ModelGraph> {
  const ext = getExtension(file.name);
  const format = FORMAT_MAP[ext];

  if (!format) {
    throw new Error(
      `Unsupported format: "${ext}". Currently supported: ${Object.keys(FORMAT_MAP).join(", ")}`
    );
  }

  const buffer = await file.arrayBuffer();

  switch (format) {
    case "onnx":
      return parseOnnx(buffer);
    case "tflite":
      return parseTflite(buffer);
    default:
      throw new Error(`Parser not implemented for format: ${format}`);
  }
}
