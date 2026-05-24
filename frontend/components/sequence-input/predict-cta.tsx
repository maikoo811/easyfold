"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createJob, ApiRequestError } from "@/lib/api";
import type { FetchedSequence, ModelName } from "@/lib/api";

interface PredictCtaProps {
  sequence: FetchedSequence;
}

/**
 * Two-button affordance for kicking off a real prediction from a fetched sequence.
 *
 * Boltz-2 is the recommended default — MIT-licensed, weights auto-download, no
 * Google approval gate. AlphaFold 3 requires the user to have requested + uploaded
 * Google-approved weights to their own Modal Volume (see `modal/README.md`).
 *
 * On submit: POSTs a single-protein PredictionJob, then navigates to
 * `/predict/[jobId]?model=…` where the polling loop and result rendering live.
 */
export function PredictCta({ sequence }: PredictCtaProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<ModelName | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (model: ModelName) => {
    setBusy(model);
    setError(null);
    try {
      const job = await createJob({
        model,
        job: {
          name: sequence.id,
          proteins: [{ sequence: sequence.sequence }],
        },
      });
      router.push(`/predict/${encodeURIComponent(job.job_id)}?model=${model}`);
    } catch (err) {
      const detail =
        err instanceof ApiRequestError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Failed to submit job";
      setError(detail);
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => submit("boltz2")}
          disabled={busy !== null}
        >
          {busy === "boltz2" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Predict with Boltz-2 <span className="text-xs opacity-70">(MIT)</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => submit("alphafold3")}
          disabled={busy !== null}
        >
          {busy === "alphafold3" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          AlphaFold 3 <span className="text-xs opacity-70">(non-commercial)</span>
        </Button>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
