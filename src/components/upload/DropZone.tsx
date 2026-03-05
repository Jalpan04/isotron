"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

const ACCEPTED_EXTENSIONS = [
  ".onnx",
  ".tflite",
  ".h5",
  ".pb",
  ".pt",
  ".pth",
  ".safetensors",
  ".mlmodel",
  ".engine",
  ".gguf",
];

function getFormatFromName(name: string): string {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return ext.replace(".", "");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DropZoneProps {
  id: string;
  label: string;
  hint: string;
  onFileDrop: (file: { name: string; size: number; format: string; file: File }) => void;
  acceptedFile: { name: string; size: number; format: string } | null;
}

export function DropZone({ id, label, hint, onFileDrop, acceptedFile }: DropZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setError(`Unsupported format: ${ext}`);
        return;
      }

      onFileDrop({
        name: file.name,
        size: file.size,
        format: getFormatFromName(file.name),
        file,
      });
    },
    [onFileDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const zoneClass = acceptedFile
    ? "dropzone-accepted"
    : isDragActive
      ? "dropzone-active"
      : "dropzone-idle";

  return (
    <div
      id={id}
      {...getRootProps()}
      className={`${zoneClass} group relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-xl bg-surface-1 p-8 transition-all hover:bg-surface-2`}
    >
      <input {...getInputProps()} />

      {acceptedFile ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-diff-added/10">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              className="text-diff-added"
            >
              <path
                d="M9 12l2 2 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{acceptedFile.name}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {formatFileSize(acceptedFile.size)} &middot;{" "}
              <span className="uppercase text-diff-added">{acceptedFile.format}</span>
            </p>
          </div>
          <p className="text-[11px] text-text-secondary">Drop another file to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 transition-colors group-hover:border-text-secondary/40">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              className="text-text-secondary transition-colors group-hover:text-text-primary"
            >
              <path
                d="M12 16V8m0 0l-3 3m3-3l3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 16.7428C21.2215 15.734 22 14.2079 22 12.5C22 9.46243 19.5376 7 16.5 7C16.2815 7 16.0771 6.886 15.9661 6.69774C14.6621 4.48484 12.2544 3 9.5 3C5.35786 3 2 6.35786 2 10.5C2 12.5661 2.83545 14.4371 4.18695 15.7935"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{label}</p>
            <p className="mt-1 text-xs text-text-secondary">{hint}</p>
          </div>
          <p className="text-[11px] text-text-secondary">
            .onnx &middot; .tflite &middot; .pt &middot; .h5 &middot; .pb &middot; +5 more
          </p>
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-diff-removed/10 px-3 py-1.5">
          <p className="text-xs text-diff-removed">{error}</p>
        </div>
      )}
    </div>
  );
}
