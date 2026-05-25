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

/** Renders the running assembly: name input + protein cards + ligand cards + add-ligand affordance. */
export function AssemblyCard({ state, api }: AssemblyCardProps) {
  const displayName = state.jobName || defaultJobName(state.proteins);

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

      {state.proteins.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No entities yet. Add a protein from the input above to start building your prediction.
        </p>
      ) : (
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
      )}

      {state.proteins.length > 0 && (
        <div className="pt-1">
          <AddLigandButton onAdd={(mode) => api.addLigandStarter(mode)} />
        </div>
      )}
    </section>
  );
}
