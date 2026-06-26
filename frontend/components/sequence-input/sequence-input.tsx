"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ClipboardPaste, Dna, Search } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FetchedSequence } from "@/lib/api";
import { validatePdb, validateUniprot } from "@/lib/identifiers";

import { FastaTab } from "./fasta-tab";
import { IdLookupTab } from "./id-lookup-tab";
import { useSequenceLookup } from "./use-sequence-lookup";

interface SequenceInputProps {
  /** Called when a sequence has been successfully fetched / pasted. */
  onAdd: (sequence: FetchedSequence) => void;
}

const TOAST_MS = 2200;

/**
 * Three-tab sequence input (paste / UniProt / PDB).
 *
 * Submitting "adds" the sequence to the caller's assembly via `onAdd` and
 * shows a brief inline confirmation; the input then resets to receive the
 * next entity. The `SequenceResultCard` of pre-3.4 days is gone — the
 * assembly card owns the display + the predict button.
 */
export function SequenceInput({ onAdd }: SequenceInputProps) {
  const { state, lookupUniprot, lookupRcsb, submitFasta, reset } =
    useSequenceLookup();
  const [recentAdd, setRecentAdd] = useState<string | null>(null);
  const lastHandledRef = useRef<FetchedSequence | null>(null);

  useEffect(() => {
    if (state.status !== "success") return;
    if (lastHandledRef.current === state.data) return;
    lastHandledRef.current = state.data;
    onAdd(state.data);
    setRecentAdd(state.data.id);
    reset();
    const timeout = setTimeout(() => setRecentAdd(null), TOAST_MS);
    return () => clearTimeout(timeout);
  }, [state, onAdd, reset]);

  const isLoading = state.status === "loading";

  return (
    <div className="space-y-4">
      <Tabs defaultValue="fasta">
        <TabsList className="w-full">
          <TabsTrigger value="fasta" className="gap-1.5">
            <ClipboardPaste className="size-3.5" aria-hidden />
            Paste sequence
          </TabsTrigger>
          <TabsTrigger value="uniprot" className="gap-1.5">
            <Search className="size-3.5" aria-hidden />
            UniProt
          </TabsTrigger>
          <TabsTrigger value="rcsb" className="gap-1.5">
            <Dna className="size-3.5" aria-hidden />
            PDB
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fasta" className="pt-4">
          <FastaTab isLoading={isLoading} onSubmit={submitFasta} />
        </TabsContent>

        <TabsContent value="uniprot" className="pt-4">
          <IdLookupTab
            label="UniProt accession"
            placeholder="P04637"
            exampleId="P04637"
            submitLabel="Add"
            validate={validateUniprot}
            isLoading={isLoading}
            onSubmit={lookupUniprot}
          />
        </TabsContent>

        <TabsContent value="rcsb" className="pt-4">
          <IdLookupTab
            label="PDB ID"
            placeholder="1TUP"
            exampleId="1TUP"
            submitLabel="Add"
            validate={validatePdb}
            isLoading={isLoading}
            onSubmit={lookupRcsb}
          />
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      {recentAdd && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">
          <Check className="size-4 shrink-0" />
          <span>
            Added <span className="font-mono">{recentAdd}</span> to assembly
          </span>
        </div>
      )}
    </div>
  );
}
