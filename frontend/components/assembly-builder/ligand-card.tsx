"use client";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { LigandDraft, LigandMode } from "@/lib/assembly";

import { excelChainId } from "./chain-ids";

interface LigandCardProps {
  ligand: LigandDraft;
  startChainIndex: number;
  onCopiesChange: (copies: number) => void;
  onModeChange: (mode: LigandMode) => void;
  onSmilesChange: (smiles: string) => void;
  onCcdChange: (codes: string[]) => void;
  onRemove: () => void;
}

export function LigandCard({
  ligand,
  startChainIndex,
  onCopiesChange,
  onModeChange,
  onSmilesChange,
  onCcdChange,
  onRemove,
}: LigandCardProps) {
  const chainLabel =
    ligand.copies === 1
      ? `Chain ${excelChainId(startChainIndex)}`
      : `Chains ${excelChainId(startChainIndex)}–${excelChainId(startChainIndex + ligand.copies - 1)}`;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {chainLabel}
          </Badge>
          <span className="text-sm font-medium text-foreground">Ligand</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Remove ligand">
          <X className="size-3" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Format
          <Select
            className="w-28"
            value={ligand.mode}
            onChange={(e) => onModeChange(e.target.value as LigandMode)}
            aria-label="Ligand format"
          >
            <option value="smiles">SMILES</option>
            <option value="ccd">CCD codes</option>
          </Select>
        </label>

        {ligand.mode === "smiles" ? (
          <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
            SMILES
            <Input
              className="flex-1 font-mono text-xs"
              value={ligand.smiles}
              onChange={(e) => onSmilesChange(e.target.value)}
              placeholder="CCO"
              aria-label="SMILES string"
            />
          </label>
        ) : (
          <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
            CCD codes
            <Input
              className="flex-1 font-mono text-xs uppercase"
              value={ligand.ccd.join(", ")}
              onChange={(e) =>
                onCcdChange(
                  e.target.value
                    .split(",")
                    .map((c) => c.trim().toUpperCase())
                    .filter(Boolean),
                )
              }
              placeholder="HEM, NAG"
              aria-label="CCD codes (comma-separated)"
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Copies
          <Input
            type="number"
            min={1}
            className="w-16"
            value={ligand.copies}
            onChange={(e) => onCopiesChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            aria-label="Ligand copies"
          />
        </label>
      </div>
    </div>
  );
}
