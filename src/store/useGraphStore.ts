import { create } from "zustand";
import type {
  ModelGraph,
  UnifiedGraph,
  DiffNode,
} from "@/lib/parsers/types";
import { parseFile } from "@/lib/parsers";

export type AppState = "upload" | "parsing" | "comparing" | "viewing";

interface FileInfo {
  name: string;
  size: number;
  format: string;
  file: File;
}

interface ParseError {
  source: "base" | "target";
  message: string;
}

interface ViewSettings {
  showAttributes: boolean;
  showNames: boolean;
  showWeights: boolean;
  horizontalLayout: boolean;
}

interface GraphStore {
  appState: AppState;

  baseFile: FileInfo | null;
  targetFile: FileInfo | null;

  baseGraph: ModelGraph | null;
  targetGraph: ModelGraph | null;
  unifiedGraph: UnifiedGraph | null;

  selectedNode: DiffNode | null;
  inspectorOpen: boolean;
  parseError: ParseError | null;

  viewSettings: ViewSettings;
  sidebarOpen: boolean;
  searchQuery: string;

  setAppState: (state: AppState) => void;
  setBaseFile: (file: FileInfo | null) => void;
  setTargetFile: (file: FileInfo | null) => void;
  setBaseGraph: (graph: ModelGraph | null) => void;
  setTargetGraph: (graph: ModelGraph | null) => void;
  setUnifiedGraph: (graph: UnifiedGraph | null) => void;
  setSelectedNode: (node: DiffNode | null) => void;
  setInspectorOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleViewSetting: (key: keyof ViewSettings) => void;

  parseAndCompare: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  appState: "upload" as AppState,
  baseFile: null as FileInfo | null,
  targetFile: null as FileInfo | null,
  baseGraph: null as ModelGraph | null,
  targetGraph: null as ModelGraph | null,
  unifiedGraph: null as UnifiedGraph | null,
  selectedNode: null as DiffNode | null,
  inspectorOpen: false,
  parseError: null as ParseError | null,
  viewSettings: {
    showAttributes: true,
    showNames: true,
    showWeights: false,
    horizontalLayout: false,
  },
  sidebarOpen: false,
  searchQuery: "",
};

export const useGraphStore = create<GraphStore>((set, get) => ({
  ...initialState,

  setAppState: (appState) => set({ appState }),
  setBaseFile: (baseFile) => set({ baseFile }),
  setTargetFile: (targetFile) => set({ targetFile }),
  setBaseGraph: (baseGraph) => set({ baseGraph }),
  setTargetGraph: (targetGraph) => set({ targetGraph }),
  setUnifiedGraph: (unifiedGraph) => set({ unifiedGraph }),
  setSelectedNode: (selectedNode) =>
    set({ selectedNode, inspectorOpen: selectedNode !== null }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleViewSetting: (key) =>
    set((state) => ({
      viewSettings: {
        ...state.viewSettings,
        [key]: !state.viewSettings[key],
      },
    })),

  parseAndCompare: async () => {
    const { baseFile, targetFile } = get();
    if (!baseFile || !targetFile) return;

    set({ appState: "parsing", parseError: null });

    try {
      const [baseGraph, targetGraph] = await Promise.all([
        parseFile(baseFile.file),
        parseFile(targetFile.file),
      ]);

      set({ baseGraph, targetGraph, appState: "comparing" });

      const { compareGraphs } = await import("@/lib/diff/compare-graphs");
      const unifiedGraph = compareGraphs(baseGraph, targetGraph);

      console.log("[isotron] Diff complete:", unifiedGraph.summary);

      set({ unifiedGraph, appState: "viewing" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[isotron] Parse error:", message);
      set({
        appState: "upload",
        parseError: { source: "base", message },
      });
    }
  },

  reset: () => set(initialState),
}));
