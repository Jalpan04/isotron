"use client";

import { DropZone } from "@/components/upload/DropZone";
import { Button } from "@/components/ui/button";
import { useGraphStore } from "@/store/useGraphStore";

export function UploadPanel() {
  const { baseFile, targetFile, setBaseFile, setTargetFile, parseAndCompare, parseError } =
    useGraphStore();

  const canCompare = baseFile !== null && targetFile !== null;

  const handleCompare = () => {
    if (!canCompare) return;
    parseAndCompare();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="mb-12 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          Compare Neural Network Graphs
        </h2>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          Drop your base and target model files to visualize structural
          differences. All parsing happens locally in your browser.
        </p>
      </div>

      <div className="flex w-full max-w-3xl items-stretch gap-6">
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-text-secondary" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-secondary">
              Base Model
            </span>
          </div>
          <DropZone
            id="dropzone-base"
            label="Drop Base Model"
            hint="The original, unoptimized model"
            onFileDrop={setBaseFile}
            acceptedFile={baseFile}
          />
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="text-text-secondary"
            >
              <path
                d="M5 12h14m0 0l-4-4m4 4l-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="mt-2 text-[10px] uppercase tracking-widest text-text-secondary">
            vs
          </span>
        </div>

        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-text-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-secondary">
              Target Model
            </span>
          </div>
          <DropZone
            id="dropzone-target"
            label="Drop Target Model"
            hint="The optimized or converted model"
            onFileDrop={setTargetFile}
            acceptedFile={targetFile}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button
          id="btn-compare"
          size="lg"
          disabled={!canCompare}
          onClick={handleCompare}
          className="h-11 min-w-[200px] bg-text-primary text-sm font-semibold tracking-wide text-surface-0 transition-all hover:bg-brand disabled:opacity-30"
        >
          {canCompare ? "Compare Models" : "Upload Both Models to Compare"}
        </Button>
        {canCompare && !parseError && (
          <p className="animate-pulse text-[11px] text-text-secondary">
            Ready to compare
          </p>
        )}
        {parseError && (
          <p className="text-[11px] text-diff-removed">
            Parse error: {parseError.message}
          </p>
        )}
      </div>

      <div className="mt-16 flex items-center gap-6 text-[11px] text-text-secondary">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="11"
              width="18"
              height="11"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7 11V7a5 5 0 0110 0v4"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          Client-side only
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M12 6v6l4 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Instant parsing
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          10+ formats
        </span>
      </div>
    </div>
  );
}
