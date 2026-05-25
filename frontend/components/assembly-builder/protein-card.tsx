"use client";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ModificationDraft, ProteinDraft } from "@/lib/assembly";

import { chainIdRange } from "./chain-ids";
import { ModificationsEditor } from "./modifications-editor";

const SOURCE_LABEL: Record<ProteinDraft["source"], string> = {
  uniprot: "UniProt",
  rcsb: "PDB",
  fasta: "Pasted",
};

interface ProteinCardProps {
  protein: ProteinDraft;
  /** 1-indexed starting chain ID for this protein (e.g. 1 → "A", 3 → "C"). */
  startChainIndex: number;
  onCopiesChange: (copies: number) => void;
  onRemove: () => void;
  onAddModification: () => void;
  onUpdateModification: (modId: string, patch: Partial<ModificationDraft>) => void;
  onRemoveModification: (modId: string) => void;
}

export function ProteinCard({
  protein,
  startChainIndex,
  onCopiesChange,
  onRemove,
  onAddModification,
  onUpdateModification,
  onRemoveModification,
}: ProteinCardProps) {
  const chainLabel = chainIdRange(startChainIndex, protein.copies);
  const sourceTag = protein.sourceId
    ? `${SOURCE_LABEL[protein.source]} · ${protein.sourceId}`
    : SOURCE_LABEL[protein.source];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {protein.copies === 1 ? `Chain ${chainLabel}` : `Chains ${chainLabel}`}
            </Badge>
            <span className="font-mono text-sm font-medium text-foreground">{protein.name}</span>
            <Badge variant="outline" className="text-xs">
              {sourceTag}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {protein.sequence.length} aa
            </Badge>
          </div>
          {(protein.description || protein.organism) && (
            <p className="truncate text-xs text-muted-foreground">
              {protein.description}
              {protein.description && protein.organism ? " · " : ""}
              {protein.organism && <span className="italic">{protein.organism}</span>}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Remove protein">
          <X className="size-3" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Copies
          <Input
            type="number"
            min={1}
            className="w-16"
            value={protein.copies}
            onChange={(e) => onCopiesChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            aria-label={`Copies of ${protein.name}`}
          />
        </label>
      </div>

      <ModificationsEditor
        proteinName={protein.name}
        sequenceLength={protein.sequence.length}
        modifications={protein.modifications}
        onAdd={onAddModification}
        onUpdate={onUpdateModification}
        onRemove={onRemoveModification}
      />
    </div>
  );
}
