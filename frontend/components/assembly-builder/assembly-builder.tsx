"use client";

import { SequenceInput } from "@/components/sequence-input";

import { AssemblyCard } from "./assembly-card";
import { PredictButton } from "./predict-button";
import { useAssemblyBuilder } from "./use-assembly-builder";

/**
 * Top-level home-page component.
 *
 * Layout (top → bottom):
 *   1. Existing 3-tab SequenceInput (paste / UniProt / PDB) — adds proteins
 *      to the assembly via `onAdd`.
 *   2. Assembly card listing all entities with chain ID preview + per-entity
 *      controls (copies, modifications, delete) + "Add ligand".
 *   3. Predict buttons (Boltz / AF3) with model-capability tooltips.
 *
 * State lives in `useAssemblyBuilder` — a pure useReducer that owns the
 * full draft and exposes typed action callbacks. The submit step
 * (`predict-button.tsx`) converts the draft to API JSON via
 * `lib/assembly.ts::toJobBody`.
 */
export function AssemblyBuilder() {
  const api = useAssemblyBuilder();

  return (
    <div className="space-y-6">
      <SequenceInput onAdd={api.addProtein} />
      <AssemblyCard state={api.state} api={api} />
      <PredictButton state={api.state} />
    </div>
  );
}
