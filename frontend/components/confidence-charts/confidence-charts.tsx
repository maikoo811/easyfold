"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import type { ConfidenceData } from "@/lib/confidence";

import { PaeHeatmap } from "./pae-heatmap";
import { PlddtChart } from "./plddt-chart";

interface ConfidenceChartsProps {
  /** URL of a JSON file matching the {@link ConfidenceData} shape. */
  fixtureUrl: string;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ConfidenceData };

export function ConfidenceCharts({ fixtureUrl }: ConfidenceChartsProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(fixtureUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ConfidenceData = await res.json();
        if (!cancelled) setState({ status: "ready", data });
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load confidence data",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fixtureUrl]);

  if (state.status === "loading") {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Loading confidence metrics…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>Failed to load confidence data: {state.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 text-xs text-muted-foreground">
          Per-residue pLDDT · {state.data.length} residues
        </div>
        <PlddtChart data={state.data.plddt} />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <PaeHeatmap pae={state.data.pae} />
      </div>
    </div>
  );
}
