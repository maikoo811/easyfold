"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { LigandMode } from "@/lib/assembly";

interface AddLigandButtonProps {
  onAdd: (mode: LigandMode) => void;
}

/**
 * A small affordance that creates an empty ligand card the user can then
 * fill in (mode + value + copies). Splitting "create the card" from "fill
 * it in" lets the existing `LigandCard` handle all input validation in
 * one place and keeps this entry point dead-simple.
 */
export function AddLigandButton({ onAdd }: AddLigandButtonProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => onAdd("smiles")}>
        <Plus className="size-3" />
        Add ligand (SMILES)
      </Button>
      <span className="text-xs text-muted-foreground">or</span>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <Select
          className="w-32"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value === "ccd") {
              onAdd("ccd");
              e.target.value = "";
            }
          }}
          aria-label="Add ligand via CCD"
        >
          <option value="" disabled>
            Add by CCD…
          </option>
          <option value="ccd">CCD codes</option>
        </Select>
      </label>
    </div>
  );
}
