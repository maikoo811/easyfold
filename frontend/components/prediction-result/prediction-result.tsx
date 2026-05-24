"use client";

import { ConfidenceCharts } from "@/components/confidence-charts";
import { InterpretationPanel } from "@/components/interpretation";
import { StructureViewer } from "@/components/structure-viewer";
import { Badge } from "@/components/ui/badge";
import type { ModelResult } from "@/lib/api";
import type { ConfidenceData } from "@/lib/confidence";

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
  const hasPae = result.pae !== null && result.pae.length > 0;
  const modelLabel = MODEL_LABEL[result.model];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-xl font-semibold">{result.name}</h1>
        <Badge variant="secondary">{modelLabel}</Badge>
        <Badge variant="outline">{confidence.length} residues</Badge>
        {result.ptm !== null && (
          <Badge variant="outline">pTM {result.ptm.toFixed(2)}</Badge>
        )}
        {result.iptm !== null && (
          <Badge variant="outline">ipTM {result.iptm.toFixed(2)}</Badge>
        )}
      </header>

      <StructureViewer cif={result.cif} format="mmcif" />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Model confidence</h2>
        {hasPae ? (
          <ConfidenceCharts data={confidence} />
        ) : (
          <ConfidenceCharts data={confidence} />
        )}
        {/* When pae is omitted we still pass an empty matrix; ConfidenceCharts
            renders the pLDDT chart unconditionally and the PAE heatmap degrades
            to an empty grid. Single-chain jobs are the common case for this. */}
      </section>

      <InterpretationPanel
        confidence={confidence}
        structureId={result.name}
        structureDescription={`${modelLabel} prediction for ${result.name} (${confidence.length} residues)`}
      />
    </div>
  );
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
