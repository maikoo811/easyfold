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
import { type PlddtStats, summarizePlddt } from "@/lib/plddt-stats";

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
          {/* ipTM is the *interface* predicted TM-score — only meaningful for
              multi-chain complexes. Boltz returns 0.0 (not null) for
              single-chain jobs where no interface exists, so a literal
              "ipTM 0.00" badge reads as "the prediction failed" to anyone
              who actually knows what ipTM means. Hide it in that case. */}
          {result.iptm !== null && result.iptm > 0 && (
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

        {plddtStats && <PlddtSummary stats={plddtStats} />}
      </header>

      {/* Badge overlays the viewer canvas (top-left) when the chart is being
          hovered — keeps the badge visually attached to the thing it's
          describing, and means we don't have to reserve a 32 px empty row
          above the viewer to avoid layout shift. `pointer-events-none` lets
          mouse interaction pass through to the underlying Mol* canvas. */}
      <div className="relative">
        <StructureViewer
          cif={result.cif}
          format="mmcif"
          colorByPlddt
          highlightedResidue={hoveredResidue}
        />
        {hoveredResidue !== null && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute left-3 top-3 z-10"
          >
            <span className="rounded-md border border-primary/40 bg-background/90 px-2 py-1 font-mono text-xs text-primary shadow-sm backdrop-blur">
              Residue {hoveredResidue}
              {hoveredPlddt !== null && ` · pLDDT ${hoveredPlddt.toFixed(1)}`}
            </span>
          </div>
        )}
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

/** AF3 4-band pLDDT summary: median + stacked-bar visualisation + per-band
 * percentages. Lives here (not as a standalone component file) because it's
 * only used in the result header and the surface is small.
 *
 * Why median + bands (not mean + "✓ high / ⚠ low"):
 *   - The mean hides bimodal distributions; a structure with a fully-folded
 *     core (90+) and totally-disordered tails (30-) reports the same mean as
 *     a uniformly mediocre structure (60).
 *   - The previous "high (>70)" / "low (<50)" labels merged AF3's "very high"
 *     and "confident" bands into one bucket called "high", which a researcher
 *     used to the AF3 website would read as ≥90 only.
 *
 * Color hex codes match Mol*'s plddt-confidence theme (which we apply to the
 * 3D structure) so the legend on the badge ↔ the colors in the viewer agree.
 */
function PlddtSummary({ stats }: { stats: PlddtStats }) {
  const bands = [
    {
      key: "very-high",
      label: "≥90",
      legend: "very high",
      fraction: stats.veryHighFraction,
      barClass: "bg-[#0053D6]",
      dotClass: "bg-[#0053D6]",
    },
    {
      key: "confident",
      label: "70-89",
      legend: "confident",
      fraction: stats.confidentFraction,
      barClass: "bg-[#65CBF3]",
      dotClass: "bg-[#65CBF3]",
    },
    {
      key: "low",
      label: "50-69",
      legend: "low",
      fraction: stats.lowFraction,
      barClass: "bg-[#FFDB13]",
      dotClass: "bg-[#FFDB13]",
    },
    {
      key: "very-low",
      label: "<50",
      legend: "very low",
      fraction: stats.veryLowFraction,
      barClass: "bg-[#FF7D45]",
      dotClass: "bg-[#FF7D45]",
    },
  ] as const;

  const ariaLabel = `Per-residue pLDDT distribution: ${bands
    .map((b) => `${percent(b.fraction)} ${b.legend} (${b.label})`)
    .join(", ")}`;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted-foreground">Confidence:</span>
        <span className="font-mono text-foreground">
          median pLDDT {Math.round(stats.median)}
        </span>
        <span className="text-muted-foreground">
          (mean {stats.mean.toFixed(1)})
        </span>
      </div>
      <div
        className="flex h-2 w-full max-w-sm overflow-hidden rounded-sm border border-border/40"
        role="img"
        aria-label={ariaLabel}
      >
        {bands.map((b) => (
          <div
            key={b.key}
            className={b.barClass}
            style={{ width: `${b.fraction * 100}%` }}
            title={`${b.legend} (pLDDT ${b.label}): ${percent(b.fraction)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
        {bands.map((b, i) => (
          <span key={b.key} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-border" aria-hidden>·</span>}
            <span
              aria-hidden
              className={`inline-block size-2 rounded-[1px] ${b.dotClass}`}
            />
            <span>
              {percent(b.fraction)} {b.label}
            </span>
          </span>
        ))}
      </div>
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
