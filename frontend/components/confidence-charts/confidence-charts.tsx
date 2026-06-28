"use client";

import type { ConfidenceData } from "@/lib/confidence";

import { PaeHeatmap } from "./pae-heatmap";
import { PlddtChart } from "./plddt-chart";

interface ConfidenceChartsProps {
  data: ConfidenceData;
  hoveredResidue?: number | null;
  onHoverResidue?: (residue: number | null) => void;
}

export function ConfidenceCharts({
  data,
  hoveredResidue = null,
  onHoverResidue,
}: ConfidenceChartsProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 text-xs text-muted-foreground">
          Per-residue pLDDT · {data.length} residues
        </div>
        <PlddtChart
          data={data.plddt}
          hoveredResidue={hoveredResidue}
          onHoverResidue={onHoverResidue}
        />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <PaeHeatmap pae={data.pae} />
      </div>
    </div>
  );
}
