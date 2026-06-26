"use client";

import { useEffect, useRef } from "react";

import { useSequenceLookup } from "@/components/sequence-input/use-sequence-lookup";
import type { FetchedSequence } from "@/lib/api";

interface Example {
  label: string;
  source: "uniprot" | "rcsb";
  id: string;
}

/**
 * The same three structures used in the HF Spaces demo. Keeping the set
 * identical means a returning visitor who tried the demo can immediately
 * see the live-prediction version of something familiar.
 */
const EXAMPLES: Example[] = [
  { label: "p53 (P04637)", source: "uniprot", id: "P04637" },
  { label: "Crambin (1CRN)", source: "rcsb", id: "1CRN" },
  { label: "SARS-CoV-2 protease (6LU7)", source: "rcsb", id: "6LU7" },
];

interface QuickStartChipsProps {
  /** Same callback as `SequenceInput.onAdd` — wired to `api.addProtein`. */
  onAdd: (sequence: FetchedSequence) => void;
}

/**
 * One-click chips that fetch a well-known protein (UniProt or PDB) and add
 * it to the assembly. Bypasses the SequenceInput tabs entirely so a
 * first-time visitor can go from page-load to "I see something in the
 * Assembly card" in one click.
 *
 * Uses its own {@link useSequenceLookup} instance — independent of the
 * SequenceInput's hook — so the two flows don't fight over input state.
 */
export function QuickStartChips({ onAdd }: QuickStartChipsProps) {
  const { state, lookupUniprot, lookupRcsb, reset } = useSequenceLookup();
  const lastHandledRef = useRef<FetchedSequence | null>(null);

  useEffect(() => {
    if (state.status !== "success") return;
    if (lastHandledRef.current === state.data) return;
    lastHandledRef.current = state.data;
    onAdd(state.data);
    reset();
  }, [state, onAdd, reset]);

  const isLoading = state.status === "loading";

  const handleClick = (ex: Example) => {
    if (isLoading) return;
    if (ex.source === "uniprot") {
      lookupUniprot(ex.id);
    } else {
      lookupRcsb(ex.id);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Try:</span>
      {EXAMPLES.map((ex) => (
        <button
          key={ex.id}
          type="button"
          onClick={() => handleClick(ex)}
          disabled={isLoading}
          className="rounded-full border border-border bg-background px-2.5 py-1 font-medium text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-50"
        >
          {ex.label}
        </button>
      ))}
      {state.status === "error" && (
        <span className="text-destructive">Couldn&apos;t load: {state.message}</span>
      )}
    </div>
  );
}
