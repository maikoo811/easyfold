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
 * On viewports >= 1024px (Tailwind's `lg`), steps 1 and 2 sit side-by-side
 * so the user can build the assembly while still seeing the input form. On
 * narrower screens everything stacks vertically. Step 3 is always full
 * width below.
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
      <div className="grid gap-8 lg:grid-cols-2">
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
      </div>

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
