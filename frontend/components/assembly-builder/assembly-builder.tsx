"use client";

import { SequenceInput } from "@/components/sequence-input";

import { AssemblyCard } from "./assembly-card";
import { PredictButton } from "./predict-button";
import { QuickStartChips } from "./quick-start-chips";
import { useAssemblyBuilder } from "./use-assembly-builder";

/**
 * Top-level home-page component.
 *
 * The page is laid out as three numbered steps so a first-time visitor can
 * see the flow at a glance: pick a protein → build the assembly → predict.
 *
 *   1. SequenceInput (3 tabs: paste / UniProt / PDB) + QuickStartChips
 *   2. AssemblyCard (entities, per-entity copies / modifications / ligands)
 *   3. PredictButton (Boltz / AF3 cards with cost + license trade-offs)
 *
 * Layout is always vertical: a numbered 3-step wizard reads top-to-bottom,
 * and Step 2 starts empty (a thin "Nothing here yet" hint), so a 2-column
 * side-by-side would just waste horizontal space and break the implied
 * reading order. The eye should follow 1 → 2 → 3 down the page.
 *
 * State lives in {@link useAssemblyBuilder} — a pure useReducer that owns
 * the full draft and exposes typed action callbacks. The submit step
 * (`predict-button.tsx`) converts the draft to API JSON via
 * `lib/assembly.ts::toJobBody`.
 */
export function AssemblyBuilder() {
  const api = useAssemblyBuilder();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <StepHeader number={1} title="Choose your protein" />
        <SequenceInput onAdd={api.addProtein} />
        <QuickStartChips onAdd={api.addProtein} />
      </section>

      <section className="space-y-3">
        <StepHeader
          number={2}
          title="Build your assembly"
          subtitle="Optionally set copies, add modifications or ligands"
        />
        <AssemblyCard state={api.state} api={api} />
      </section>

      <section className="space-y-3">
        <StepHeader number={3} title="Predict" />
        <PredictButton state={api.state} />
      </section>
    </div>
  );
}

interface StepHeaderProps {
  number: number;
  title: string;
  subtitle?: string;
}

function StepHeader({ number, title, subtitle }: StepHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      >
        {number}
      </span>
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
