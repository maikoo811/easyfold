"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Loader2, Rocket, Star } from "lucide-react";

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

  const boltzDisabled = busy !== null || !hasProteins || hasMods;
  const af3Disabled = busy !== null || !hasProteins;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModelCard
          icon={<Rocket className="size-4" />}
          name="Boltz-2"
          badge="RECOMMENDED"
          accent="primary"
          license="MIT — Commercial OK"
          cost="~10 min first run · ~30 s after"
          price="~$0.30/run on Modal"
          disabled={boltzDisabled}
          busy={busy === "boltz2"}
          onClick={() => submit("boltz2")}
        />
        <ModelCard
          icon={<Star className="size-4" />}
          name="AlphaFold 3"
          accent="muted"
          license="CC-BY-NC-SA — Academic only"
          cost="2-3 day Google approval, then ~10 min"
          price="~$0.50–1/run on Modal"
          disabled={af3Disabled}
          busy={busy === "alphafold3"}
          onClick={() => submit("alphafold3")}
        />
      </div>

      {hasMods && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-medium text-foreground">Boltz-2 disabled.</span> It doesn&apos;t
            support modifications yet — use AlphaFold 3 for jobs with PTMs.
          </span>
        </div>
      )}

      {!hasProteins && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>Add at least one protein above to enable prediction.</span>
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

interface ModelCardProps {
  icon: React.ReactNode;
  name: string;
  badge?: string;
  /** "primary" = filled teal accent; "muted" = subtle outline. */
  accent: "primary" | "muted";
  license: string;
  cost: string;
  price: string;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}

function ModelCard({
  icon,
  name,
  badge,
  accent,
  license,
  cost,
  price,
  disabled,
  busy,
  onClick,
}: ModelCardProps) {
  const accentClasses =
    accent === "primary"
      ? "border-primary/60 bg-primary/5 hover:border-primary hover:bg-primary/10"
      : "border-border bg-background hover:border-foreground/30 hover:bg-muted/50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition ${accentClasses} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {name}
        </span>
        {badge && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <div>{license}</div>
        <div>{cost}</div>
        <div>{price}</div>
      </div>
      <div className="mt-auto flex items-center gap-2 text-xs font-medium text-foreground">
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {busy ? "Submitting..." : "Predict →"}
      </div>
    </button>
  );
}
