"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ModificationDraft } from "@/lib/assembly";

import {
  PTM_OTHER_SENTINEL,
  PTM_PRESETS,
  isPresetCode,
} from "./ptm-types";

interface ModificationsEditorProps {
  proteinName: string;
  sequenceLength: number;
  modifications: ModificationDraft[];
  onAdd: () => void;
  onUpdate: (modId: string, patch: Partial<ModificationDraft>) => void;
  onRemove: (modId: string) => void;
}

export function ModificationsEditor({
  sequenceLength,
  modifications,
  onAdd,
  onUpdate,
  onRemove,
}: ModificationsEditorProps) {
  return (
    <div className="space-y-2">
      {modifications.length > 0 && (
        <ul className="space-y-2">
          {modifications.map((mod) => {
            const usingOther = !isPresetCode(mod.ptmType);
            const selectValue = usingOther ? PTM_OTHER_SENTINEL : mod.ptmType;
            return (
              <li
                key={mod.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-2"
              >
                <Select
                  className="min-w-[170px] flex-1"
                  value={selectValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === PTM_OTHER_SENTINEL) {
                      onUpdate(mod.id, { ptmType: usingOther ? mod.ptmType : "" });
                    } else {
                      onUpdate(mod.id, { ptmType: next });
                    }
                  }}
                  aria-label="Modification type"
                >
                  {PTM_PRESETS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label} ({p.code})
                    </option>
                  ))}
                  <option value={PTM_OTHER_SENTINEL}>Other…</option>
                </Select>

                {usingOther && (
                  <Input
                    className="w-36"
                    value={mod.ptmType}
                    onChange={(e) => onUpdate(mod.id, { ptmType: e.target.value })}
                    placeholder="CCD code"
                    aria-label="Custom PTM code"
                  />
                )}

                <span className="text-xs text-muted-foreground">at residue</span>
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  max={sequenceLength}
                  value={mod.ptmPosition}
                  onChange={(e) =>
                    onUpdate(mod.id, {
                      ptmPosition: clamp(parseInt(e.target.value, 10) || 1, 1, sequenceLength),
                    })
                  }
                  aria-label="Modification position"
                />

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRemove(mod.id)}
                  aria-label="Remove modification"
                >
                  <X className="size-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="ghost" size="sm" onClick={onAdd}>
        <Plus className="size-3" />
        Add modification
      </Button>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
