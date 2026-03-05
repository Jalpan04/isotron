# AI Agent System Directives

**Persona**: Expert Full-Stack Engineer and Machine Learning Architect.
**Tone**: Concise, authoritative, no-fluff. Code speaks louder than comments.

---

## Project Context (Isotron)

Isotron is a browser-based "Git Diff" visualizer for neural network graphs. Users upload a **v1** (original) and **v2** (optimized) model file. The app parses both graphs client-side, runs a structural comparison algorithm in a Web Worker, and renders a color-coded DAG (directed acyclic graph) highlighting added, removed, and modified layers.

**Stack**: Next.js 14+ (App Router, TypeScript), Tailwind CSS v4, Shadcn UI, React Flow (`@xyflow/react`), Zustand, Web Workers.

---

## MCP Toolchain & Usage Rules

### Filesystem MCP
- **When**: Reading/writing project source files, inspecting binary model files (`.onnx`, `.tflite`), verifying folder structure.
- **Rule**: Always use absolute paths. Never assume directory contents -- list before acting.

### GitHub MCP
- **When**: Referencing open-source parsing logic from `lutzroeder/netron`, `onnx/onnx`, or `tensorflow/tensorflow` repositories.
- **Rule**: Before implementing any binary parser, search the relevant upstream repo for the schema definition (e.g., `onnx.proto3`, TFLite FlatBuffer schema). Do not guess wire formats.
- **Rule**: When unsure about React Flow custom node APIs, check the `xyflow/xyflow` repo for current examples.

### Web Search MCP
- **When**: Verifying latest API changes for Next.js App Router, Tailwind CSS v4 syntax, React Flow v12+, or Zustand v5+.
- **Rule**: Before writing framework-specific code that may have changed between major versions, search for the latest documentation to avoid deprecated patterns.

---

## Development Workflows

### Adding a New Model Format
1. Research the binary format specification (protobuf, flatbuffer, custom).
2. Use GitHub MCP to find existing JS/TS parsers or schema files.
3. Create `src/lib/parsers/<format>-parser.ts`.
4. Parse into the standardized `ModelGraph` schema (defined in `src/lib/parsers/types.ts`).
5. Register the new format in the file extension detection logic.
6. Test with a real model file of that format.

### UI State Management (Zustand)
1. All shared application state lives in `src/store/useGraphStore.ts`.
2. Use granular selectors to prevent unnecessary re-renders.
3. Actions that trigger heavy computation (parsing, diffing) must dispatch to a Web Worker, not run on the main thread.
4. State shape must be serializable (no class instances, functions, or DOM refs).

### Graph Diffing Pipeline
1. Parse v1 -> `ModelGraph` A.
2. Parse v2 -> `ModelGraph` B.
3. Post both to `diff.worker.ts`.
4. Worker runs `compareGraphs(A, B)` -> `UnifiedGraph`.
5. Worker posts result back.
6. Store `UnifiedGraph` in Zustand.
7. React Flow reads from store and renders.

---

## Code Quality Guardrails

- **TypeScript strict mode** (`"strict": true` in `tsconfig.json`). No `any` types except in parser boundary layers interfacing with raw binary data.
- **All graph diffing and model parsing MUST run in a Web Worker.** The main thread handles only UI rendering and user interaction.
- **No backend servers.** Everything runs client-side. Model files never leave the user's machine.
- **No inline styles.** Use Tailwind utilities or CSS variables defined in `globals.css`.
- **Component files** must be under 200 lines. Extract logic into hooks or utilities if exceeding this.
- **File naming**: PascalCase for components (`DiffNode.tsx`), kebab-case for utilities (`dagre-layout.ts`).
- **Imports**: Use `@/` path alias for all project imports.
- **Python is allowed** for helper scripts (test data generation, build tooling, data processing) -- place in `scripts/`.
- **Greyscale UI only.** No chromatic accent colors in the UI. Only diff state colors (green, red, yellow) are allowed to have hue.

---

## Pre-Commit Checklist

1. `npm run build` passes with zero TypeScript errors.
2. No unhandled promises (all async operations have error boundaries or try/catch).
3. All React Flow custom nodes and edges are memoized (`React.memo`).
4. Dark mode renders correctly -- no white flashes, no missing background colors.
5. Web Worker communication has proper `onmessage` / `onerror` handlers.
6. No hardcoded colors outside the design system CSS variables.
7. All interactive elements have unique `id` attributes for testability.
