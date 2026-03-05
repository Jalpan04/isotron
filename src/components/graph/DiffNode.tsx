"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiffState } from "@/lib/parsers/types";

/* -----------------------------------------------------------------------
   Op-category classification -- gives each node a distinct visual feel
   like Netron does, so not all blocks look the same.
   ----------------------------------------------------------------------- */

type OpCategory =
  | "convolution"
  | "activation"
  | "normalization"
  | "pooling"
  | "linear"
  | "quantization"
  | "reshape"
  | "arithmetic"
  | "io"
  | "other";

const OP_CATEGORY_MAP: Record<string, OpCategory> = {
  // Convolution
  Conv: "convolution", QLinearConv: "convolution", ConvTranspose: "convolution",
  FusedConv: "convolution", DepthwiseConv: "convolution", "CONV_2D": "convolution",
  "DEPTHWISE_CONV_2D": "convolution", "TRANSPOSE_CONV": "convolution",
  // Activation
  Relu: "activation", Relu6: "activation", LeakyRelu: "activation", Sigmoid: "activation",
  Tanh: "activation", Softmax: "activation", HardSwish: "activation", HardSigmoid: "activation",
  Elu: "activation", Selu: "activation", PRelu: "activation", Gelu: "activation",
  RELU: "activation", RELU6: "activation", LOGISTIC: "activation", TANH: "activation",
  SOFTMAX: "activation", LEAKY_RELU: "activation", HARD_SWISH: "activation",
  // Normalization
  BatchNormalization: "normalization", InstanceNormalization: "normalization",
  LayerNormalization: "normalization", GroupNormalization: "normalization",
  L2_NORMALIZATION: "normalization",
  // Pooling
  MaxPool: "pooling", AveragePool: "pooling", GlobalAveragePool: "pooling",
  GlobalMaxPool: "pooling", AdaptiveAvgPool2d: "pooling",
  AVERAGE_POOL_2D: "pooling", MAX_POOL_2D: "pooling", L2_POOL_2D: "pooling",
  // Linear
  Gemm: "linear", MatMul: "linear", QLinearMatMul: "linear",
  FULLY_CONNECTED: "linear", BATCH_MATMUL: "linear",
  // Quantization
  QuantizeLinear: "quantization", DequantizeLinear: "quantization",
  QUANTIZE: "quantization", DEQUANTIZE: "quantization",
  // Reshape
  Flatten: "reshape", Reshape: "reshape", Squeeze: "reshape", Unsqueeze: "reshape",
  Transpose: "reshape", Concat: "reshape", Split: "reshape", Pad: "reshape",
  RESHAPE: "reshape", SQUEEZE: "reshape", TRANSPOSE: "reshape",
  CONCATENATION: "reshape", SPLIT: "reshape", PAD: "reshape", EXPAND_DIMS: "reshape",
  // Arithmetic
  Add: "arithmetic", Sub: "arithmetic", Mul: "arithmetic", Div: "arithmetic",
  ADD: "arithmetic", SUB: "arithmetic", MUL: "arithmetic", DIV: "arithmetic",
};

function getOpCategory(opType: string): OpCategory {
  return OP_CATEGORY_MAP[opType] || "other";
}

/* -----------------------------------------------------------------------
   Category-based visual styling (Netron-inspired)
   Each category gets a unique icon glyph + background tint
   ----------------------------------------------------------------------- */

const CATEGORY_STYLE: Record<OpCategory, { icon: string; bg: string; text: string }> = {
  convolution:   { icon: "C",  bg: "bg-blue-950",       text: "text-blue-400" },
  activation:    { icon: "A",  bg: "bg-indigo-950",     text: "text-indigo-400" },
  normalization: { icon: "N",  bg: "bg-purple-950",     text: "text-purple-400" },
  pooling:       { icon: "P",  bg: "bg-cyan-950",       text: "text-cyan-400" },
  linear:        { icon: "L",  bg: "bg-teal-950",       text: "text-teal-400" },
  quantization:  { icon: "Q",  bg: "bg-pink-950",       text: "text-pink-400" },
  reshape:       { icon: "R",  bg: "bg-slate-800",      text: "text-slate-300" },
  arithmetic:    { icon: "+",  bg: "bg-violet-950",     text: "text-violet-400" },
  io:            { icon: "IO", bg: "bg-zinc-800",       text: "text-white" },
  other:         { icon: "?",  bg: "bg-zinc-800",       text: "text-white" },
};

/* -----------------------------------------------------------------------
   Diff state styling
   ----------------------------------------------------------------------- */

const STATE_BORDER: Record<DiffState, string> = {
  added: "border-diff-added/70",
  removed: "border-diff-removed/70",
  modified: "border-diff-modified/70",
  unchanged: "border-white/30",
};

const STATE_GLOW: Record<DiffState, string> = {
  added: "shadow-[0_0_12px_rgba(34,197,94,0.25)]",
  removed: "shadow-[0_0_12px_rgba(239,68,68,0.25)]",
  modified: "shadow-[0_0_12px_rgba(234,179,8,0.25)]",
  unchanged: "",
};

const STATE_BADGE_STYLE: Record<DiffState, string> = {
  added: "bg-diff-added/15 text-diff-added",
  removed: "bg-diff-removed/15 text-diff-removed",
  modified: "bg-diff-modified/15 text-diff-modified",
  unchanged: "",
};

/* -----------------------------------------------------------------------
   Node data interface
   ----------------------------------------------------------------------- */

interface DiffNodeData {
  label: string;
  opType: string;
  diffState: DiffState;
  changeCount: number;
  isSelected: boolean;
  inputShapes: string;
  outputShapes: string;
  showAttributes: boolean;
  showNames: boolean;
  attributes?: Record<string, any>;
  searchMatch: boolean;
  horizontal?: boolean;
}

/* -----------------------------------------------------------------------
   Component
   ----------------------------------------------------------------------- */

function DiffNodeComponent({ data, selected }: NodeProps & { data: DiffNodeData }) {
  const { label, opType, diffState, changeCount, showAttributes, showNames, attributes, searchMatch, horizontal } = data;
  const isActive = selected || data.isSelected;
  const category = getOpCategory(opType);
  const catStyle = CATEGORY_STYLE[category];

  // Pick key attributes to display (like Netron shows kernel_shape, pads, strides)
  const attrEntries = showAttributes
    ? Object.entries(attributes || {}).filter(
        ([k]) => ["kernel_shape", "pads", "strides", "dilations", "group", "axis", "activation", "epsilon", "momentum"].includes(k)
      ).slice(0, 3)
    : [];

  const targetPos = horizontal ? Position.Left : Position.Top;
  const sourcePos = horizontal ? Position.Right : Position.Bottom;
  const targetClass = horizontal ? "!-left-1" : "!-top-1";
  const sourceClass = horizontal ? "!-right-1" : "!-bottom-1";

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          relative rounded-lg border px-3.5 py-2
          transition-all duration-150
          ${catStyle.bg}
          ${STATE_BORDER[diffState]}
          ${isActive ? STATE_GLOW[diffState] : ""}
          ${isActive ? "brightness-125" : ""}
          ${searchMatch ? "ring-2 ring-white/50" : ""}
        `}
        style={{ minWidth: category === "activation" ? 100 : 160 }}
      >
        <Handle
          type="target"
          position={targetPos}
          className={`${targetClass} !h-1.5 !w-1.5 !rounded-full !border-0 !bg-white/20`}
        />

        <div className="flex items-center gap-2.5">
          {/* Category icon badge */}
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${catStyle.text} bg-white/[0.04]`}
          >
            {catStyle.icon}
          </span>

          <div className="min-w-0 flex-1">
            {/* Op type as primary text (like Netron) */}
            <p className="truncate text-[11px] font-semibold text-white leading-tight">
              {opType}
            </p>
            {/* Node name as secondary */}
            {showNames && label !== opType && (
              <p className="truncate text-[9px] text-white/70 leading-tight mt-0.5">
                {label}
              </p>
            )}
          </div>

          {/* Diff state badge */}
          {diffState !== "unchanged" && (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${STATE_BADGE_STYLE[diffState]}`}
            >
              {diffState === "added" ? "+" : diffState === "removed" ? "-" : "~"}
            </span>
          )}
        </div>

        {/* Key attributes (like Netron shows kernel, pads) */}
        {attrEntries.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {attrEntries.map(([key, val]) => (
              <p key={key} className="truncate text-[9px] font-mono text-white/70">
                {key} = {Array.isArray(val) ? val.join(", ") : String(val)}
              </p>
            ))}
          </div>
        )}

        {/* Change count */}
        {changeCount > 0 && (
          <div className="mt-1 text-[9px] text-diff-modified/70">
            {changeCount} change{changeCount > 1 ? "s" : ""}
          </div>
        )}

        <Handle
          type="source"
          position={sourcePos}
          className={`${sourceClass} !h-1.5 !w-1.5 !rounded-full !border-0 !bg-white/20`}
        />
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
   I/O Indicator node (for graph input / output tensors)
   ----------------------------------------------------------------------- */

interface IONodeData {
  label: string;
  shape: string;
  kind: "input" | "output";
  horizontal?: boolean;
}

function IONodeComponent({ data }: NodeProps & { data: IONodeData }) {
  const isInput = data.kind === "input";
  const targetPos = data.horizontal ? Position.Left : Position.Top;
  const sourcePos = data.horizontal ? Position.Right : Position.Bottom;
  const targetClass = data.horizontal ? "!-left-1" : "!-top-1";
  const sourceClass = data.horizontal ? "!-right-1" : "!-bottom-1";

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5"
        style={{ minWidth: 80 }}
      >
        {!isInput && (
          <Handle
            type="target"
            position={targetPos}
            className={`${targetClass} !h-1.5 !w-1.5 !rounded-full !border-0 !bg-white/20`}
          />
        )}

        <div className="text-center">
          <p className="text-[10px] font-medium text-white">{data.label}</p>
          {data.shape && (
            <p className="text-[9px] font-mono text-white/70">{data.shape}</p>
          )}
        </div>

        {isInput && (
          <Handle
            type="source"
            position={sourcePos}
            className={`${sourceClass} !h-1.5 !w-1.5 !rounded-full !border-0 !bg-white/20`}
          />
        )}
      </div>
    </div>
  );
}

export const DiffNode = memo(DiffNodeComponent);
export const IONode = memo(IONodeComponent);
