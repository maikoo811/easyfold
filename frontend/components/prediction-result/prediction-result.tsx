"use client";

import { useCallback, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { ConfidenceCharts } from "@/components/confidence-charts";
import { InterpretationPanel } from "@/components/interpretation";
import { StructureViewer } from "@/components/structure-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ModelResult } from "@/lib/api";
import type { ConfidenceData } from "@/lib/confidence";
import { summarizePlddt } from "@/lib/plddt-stats";

interface PredictionResultProps {
  result: ModelResult;
}

const MODEL_LABEL: Record<ModelResult["model"], string> = {
  alphafold3: "AlphaFold 3",
  boltz2: "Boltz-2",
};

/**
 * Renders a completed prediction: structure viewer + confidence charts + LLM panel.
 *
 * Bridges `ModelResult` (unified backend shape) to the existing demo-page
 * components which still consume `ConfidenceData`. Falls back gracefully
 * for single-chain jobs where the model omitted the PAE matrix.
 */
export function PredictionResult({ result }: PredictionResultProps) {
  const confidence = toConfidenceData(result);
  const modelLabel = MODEL_LABEL[result.model];
  const plddtStats = summarizePlddt(result.plddt);
  const interpretSectionRef = useRef<HTMLDivElement>(null);

  // Shared state for the chart ↔ 3D hover link. The PlddtChart drives this on
  // mouse-move; the StructureViewer reads it to apply a transient Mol*
  // highlight on the matching residue. Lives at this level so a future PAE-
  // click feature can write into the same state.
  const [hoveredResidue, setHoveredResidue] = useState<number | null>(null);
  const handleHoverResidue = useCallback(
    (r: number | null) => setHoveredResidue(r),
    [],
  );

  const scrollToInterpret = () => {
    const node = interpretSectionRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    // Defer focus until the smooth scroll has had a frame to start; the
    // textarea inside InterpretationPanel has id="interpret-question".
    requestAnimationFrame(() => {
      const textarea = node.querySelector<HTMLTextAreaElement>("#interpret-question");
      textarea?.focus();
    });
  };

  const hoveredPlddt =
    hoveredResidue !== null && hoveredResidue >= 1 && hoveredResidue <= result.plddt.length
      ? result.plddt[hoveredResidue - 1]
      : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold">{result.name}</h1>
          <Badge variant="secondary">{modelLabel}</Badge>
          <Badge variant="outline">{confidence.length} residues</Badge>
          {result.ptm !== null && (
            <Badge variant="outline">pTM {result.ptm.toFixed(2)}</Badge>
          )}
          {result.iptm !== null && (
            <Badge variant="outline">ipTM {result.iptm.toFixed(2)}</Badge>
          )}
          <Button
            size="sm"
            onClick={scrollToInterpret}
            className="ml-auto gap-1.5"
          >
            <Sparkles className="size-3.5" />
            Ask Claude
          </Button>
        </div>

        {plddtStats && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Confidence:</span>
            <span className="font-mono text-foreground">
              mean pLDDT {plddtStats.mean.toFixed(1)}
            </span>
            <span
              className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-medium text-sky-900 dark:text-sky-200"
              title="Residues with pLDDT > 70 — confident or better"
            >
              ✓ {percent(plddtStats.highFraction)} high
            </span>
            {plddtStats.lowFraction > 0 && (
              <span
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-200"
                title="Residues with pLDDT < 50 — likely disordered or mispredicted"
              >
                ⚠ {percent(plddtStats.lowFraction)} low
              </span>
            )}
          </div>
        )}
      </header>

      <div className="space-y-2">
        {/* Reserve the badge row's height even when nothing is hovered, so the
            viewer below doesn't jump up by ~32 px when the cursor enters the
            chart. The placeholder uses visibility:hidden to keep layout stable. */}
        <div
          className={`flex items-center gap-2 text-xs font-mono ${
            hoveredResidue === null ? "invisible" : "text-foreground"
          }`}
          aria-live="polite"
        >
          <span className="rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-primary">
            Residue {hoveredResidue ?? "—"}
            {hoveredPlddt !== null && ` · pLDDT ${hoveredPlddt.toFixed(1)}`}
          </span>
        </div>
        <StructureViewer
          cif={result.cif}
          format="mmcif"
          colorByPlddt
          highlightedResidue={hoveredResidue}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Model confidence</h2>
        <ConfidenceCharts
          data={confidence}
          hoveredResidue={hoveredResidue}
          onHoverResidue={handleHoverResidue}
        />
        {/* When pae is omitted we still pass an empty matrix; ConfidenceCharts
            renders the pLDDT chart unconditionally and the PAE heatmap degrades
            to an empty grid. Single-chain jobs are the common case for this. */}
      </section>

      <div ref={interpretSectionRef}>
        <InterpretationPanel
          confidence={confidence}
          structureId={result.name}
          structureDescription={`${modelLabel} prediction for ${result.name} (${confidence.length} residues)`}
        />
      </div>
    </div>
  );
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function toConfidenceData(result: ModelResult): ConfidenceData {
  const length = result.plddt.length;
  return {
    name: result.name,
    length,
    plddt: result.plddt,
    pae: result.pae ?? emptyMatrix(length),
    ...(result.iptm !== null ? { iptm: result.iptm } : {}),
  };
}

function emptyMatrix(n: number): number[][] {
  const row = new Array(n).fill(0);
  return new Array(n).fill(null).map(() => [...row]);
}
