"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiRequestError, createJob } from "@/lib/api";
import type { ModelName } from "@/lib/api";
import { type AssemblyState, assemblyHasModifications, toJobBody } from "@/lib/assembly";

interface PredictButtonProps {
  state: AssemblyState;
}

/**
 * Submit the current assembly to one of the deployed Modal Functions.
 *
 * **Boltz-2 disabled when modifications are present.** Boltz silently drops
 * PTMs at builder time (see `boltz_input/builder.py`); we make that
 * trade-off visible by disabling the button + tooltip rather than letting
 * the user discover it after a successful-but-incomplete prediction.
 */
export function PredictButton({ state }: PredictButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<ModelName | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasMods = assemblyHasModifications(state);
  const hasProteins = state.proteins.length > 0;

  const submit = async (model: ModelName) => {
    const result = toJobBody(state, model);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(model);
    setError(null);
    try {
      const job = await createJob(result.body);
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
        <Button onClick={() => submit("boltz2")} disabled={busy !== null || !hasProteins || hasMods}>
          {busy === "boltz2" ? <Loader2 className="size-4 animate-spin" /> : null}
          Predict with Boltz-2 <span className="text-xs opacity-70">(MIT)</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => submit("alphafold3")}
          disabled={busy !== null || !hasProteins}
        >
          {busy === "alphafold3" ? <Loader2 className="size-4 animate-spin" /> : null}
          AlphaFold 3 <span className="text-xs opacity-70">(non-commercial)</span>
        </Button>
      </div>

      {hasMods && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-medium text-foreground">Boltz-2 disabled.</span> It doesn&apos;t
            support modifications yet — use AlphaFold 3 (non-commercial license) for jobs with
            PTMs.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
