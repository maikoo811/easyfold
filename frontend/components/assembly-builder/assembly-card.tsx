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
        <EmptyAssemblyState />
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

/** Small visual cue for the empty-state Assembly card. A schematic shows
 * "what an assembly is" (one or more proteins, optionally with ligands /
 * modifications) so first-time users have a mental model before they start
 * filling things in. */
function EmptyAssemblyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <AssemblySchematic className="size-16 text-muted-foreground/60" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No entities yet</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          An assembly is one or more proteins, optionally with copies,
          modifications, or ligands. Add one from the input above — or use the{" "}
          <span className="font-medium text-foreground">Try:</span> chips for a
          one-click example.
        </p>
      </div>
    </div>
  );
}

function AssemblySchematic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Protein backbone — a wavy line as a stand-in for a chain */}
      <path d="M8 36 Q16 24, 24 36 T40 36 T56 36" />
      {/* Ligand — a small circle attached below */}
      <circle cx="32" cy="50" r="3.5" />
      <path d="M32 40 L32 46" strokeDasharray="2 2" />
      {/* Modification — a diamond pinned on the backbone */}
      <path d="M44 20 L48 16 L52 20 L48 24 Z" />
      <path d="M48 24 L48 32" strokeDasharray="2 2" />
    </svg>
  );
}
