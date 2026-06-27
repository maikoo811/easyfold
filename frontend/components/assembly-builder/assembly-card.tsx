"use client";

import { Input } from "@/components/ui/input";
import type { AssemblyState } from "@/lib/assembly";
import { defaultJobName } from "@/lib/assembly";

import { AddLigandButton } from "./add-ligand-button";
import { LigandCard } from "./ligand-card";
import { ProteinCard } from "./protein-card";
import type { AssemblyBuilderApi } from "./use-assembly-builder";

interface AssemblyCardProps {
  state: AssemblyState;
  api: AssemblyBuilderApi;
}

/** Renders the running assembly: name input + protein cards + ligand cards + add-ligand affordance.
 *
 * When the assembly is empty we deliberately hide both the bordered card
 * frame and the Job-name input — neither carries meaning until there's
 * something to name, and the previous full-card-with-SVG empty state was
 * eating ~500 px of vertical real estate to communicate "nothing here yet".
 * The compact empty hint is enough — Step 1 above already explains how to
 * add a protein and the Try-chips give a one-click example. */
export function AssemblyCard({ state, api }: AssemblyCardProps) {
  const displayName = state.jobName || defaultJobName(state.proteins);
  const isEmpty = state.proteins.length === 0;

  if (isEmpty) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Nothing here yet. Add a protein with Step 1 — your assembly will appear
        here.
      </p>
    );
  }

  // Compute starting chain index for each entity in render order. React 19's
  // strict-immutability rule forbids reassigning a counter inside a .map
  // callback; build the prefix-sum arrays via reduce instead.
  const { proteinChainStarts, ligandChainStarts } = (() => {
    const proteins: number[] = [];
    let cursor = 1;
    for (const p of state.proteins) {
      proteins.push(cursor);
      cursor += p.copies;
    }
    const ligands: number[] = [];
    for (const l of state.ligands) {
      ligands.push(cursor);
      cursor += l.copies;
    }
    return { proteinChainStarts: proteins, ligandChainStarts: ligands };
  })();

  return (
    <section className="space-y-3 rounded-2xl border bg-card/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium text-foreground">Assembly</h2>
        <Input
          className="h-7 max-w-xs flex-1 text-sm"
          value={state.jobName}
          placeholder={displayName || "Job name"}
          onChange={(e) => api.setJobName(e.target.value)}
          aria-label="Job name"
        />
      </div>

      <ul className="space-y-3">
        {state.proteins.map((protein, idx) => (
          <li key={protein.id}>
            <ProteinCard
              protein={protein}
              startChainIndex={proteinChainStarts[idx]}
              onCopiesChange={(copies) => api.setProteinCopies(protein.id, copies)}
              onRemove={() => api.removeProtein(protein.id)}
              onAddModification={() => api.addModification(protein.id)}
              onUpdateModification={(modId, patch) =>
                api.updateModification(protein.id, modId, patch)
              }
              onRemoveModification={(modId) => api.removeModification(protein.id, modId)}
            />
          </li>
        ))}
        {state.ligands.map((ligand, idx) => (
          <li key={ligand.id}>
            <LigandCard
              ligand={ligand}
              startChainIndex={ligandChainStarts[idx]}
              onCopiesChange={(copies) => api.setLigandCopies(ligand.id, copies)}
              onModeChange={(mode) => api.setLigandMode(ligand.id, mode)}
              onSmilesChange={(smiles) => api.setLigandSmiles(ligand.id, smiles)}
              onCcdChange={(codes) => api.setLigandCcd(ligand.id, codes)}
              onRemove={() => api.removeLigand(ligand.id)}
            />
          </li>
        ))}
      </ul>

      <div className="pt-1">
        <AddLigandButton onAdd={(mode) => api.addLigandStarter(mode)} />
      </div>
    </section>
  );
}
