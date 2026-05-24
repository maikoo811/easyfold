"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Logo } from "@/components/logo";
import { PredictionResult, StatusBanner } from "@/components/prediction-result";
import { getJob, type JobStatus, type ModelName } from "@/lib/api";

const POLL_INTERVAL_MS = 3_000;

type ViewState =
  | { kind: "polling"; status: JobStatus }
  | { kind: "done"; status: JobStatus }
  | { kind: "error"; message: string };

interface PredictClientProps {
  jobId: string;
}

export function PredictClient({ jobId }: PredictClientProps) {
  const search = useSearchParams();
  const model = (search.get("model") as ModelName | null) ?? "boltz2";

  const [view, setView] = useState<ViewState>({
    kind: "polling",
    status: {
      job_id: jobId,
      model,
      status: "pending",
      result: null,
      error: null,
    },
  });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const next = await getJob(jobId, controller.signal);
        if (cancelled) return;
        if (next.status === "succeeded" || next.status === "failed") {
          setView({ kind: "done", status: next });
        } else {
          setView({ kind: "polling", status: next });
          timeout = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setView({
          kind: "error",
          message: err instanceof Error ? err.message : "Polling failed",
        });
      }
    };

    tick();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeout) clearTimeout(timeout);
    };
  }, [jobId]);

  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-6 py-12">
      <header className="flex items-center gap-3">
        <Logo className="size-6" />
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          EasyFold
        </h1>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {jobId}
        </span>
      </header>

      {view.kind === "polling" && (
        <StatusBanner status={view.status.status} model={model} />
      )}

      {view.kind === "done" && view.status.status === "failed" && (
        <StatusBanner status="failed" model={model} error={view.status.error} />
      )}

      {view.kind === "done" && view.status.status === "succeeded" && view.status.result && (
        <PredictionResult result={view.status.result} />
      )}

      {view.kind === "error" && (
        <StatusBanner status="error" model={model} error={view.message} />
      )}
    </div>
  );
}
