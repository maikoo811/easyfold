"use client";

import { AlertCircle, Loader2 } from "lucide-react";

import type { JobStatusName, ModelName } from "@/lib/api";

interface StatusBannerProps {
  status: JobStatusName | "error";
  model: ModelName;
  error?: string | null;
}

const MODEL_LABEL: Record<ModelName, string> = {
  alphafold3: "AlphaFold 3",
  boltz2: "Boltz-2",
};

const STATUS_COPY: Record<JobStatusName, { title: string; detail: string }> = {
  pending: {
    title: "Submitting to Modal…",
    detail: "Your job has been spawned and is waiting for a GPU container.",
  },
  running: {
    title: "Running on Modal",
    detail:
      "Fetching MSAs and running inference on an H100. Typical wall time is 3-15 minutes; the first run of a model is slower because weights are downloading into your cache Volume.",
  },
  succeeded: { title: "Done", detail: "Rendering result…" },
  failed: { title: "Job failed", detail: "" },
};

export function StatusBanner({ status, model, error }: StatusBannerProps) {
  if (status === "error" || status === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <div className="font-medium">
            {status === "error" ? "Polling failed" : "Prediction failed"}
          </div>
          {error && <div className="break-words font-mono text-xs">{error}</div>}
        </div>
      </div>
    );
  }

  const copy = STATUS_COPY[status];
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">
          {copy.title} <span className="text-muted-foreground">· {MODEL_LABEL[model]}</span>
        </div>
        <p className="text-xs text-muted-foreground">{copy.detail}</p>
      </div>
    </div>
  );
}
