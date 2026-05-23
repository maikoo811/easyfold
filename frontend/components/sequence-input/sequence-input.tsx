"use client";

import { AlertCircle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FastaTab } from "./fasta-tab";
import { IdLookupTab } from "./id-lookup-tab";
import { SequenceResultCard } from "./sequence-result-card";
import { useSequenceLookup } from "./use-sequence-lookup";

export function SequenceInput() {
  const { state, lookupUniprot, lookupRcsb, submitFasta, reset } =
    useSequenceLookup();

  if (state.status === "success") {
    return <SequenceResultCard data={state.data} onReset={reset} />;
  }

  const isLoading = state.status === "loading";

  return (
    <div className="space-y-4">
      <Tabs defaultValue="uniprot">
        <TabsList>
          <TabsTrigger value="uniprot">Look up UniProt</TabsTrigger>
          <TabsTrigger value="rcsb">Look up PDB</TabsTrigger>
          <TabsTrigger value="fasta">Paste Sequence</TabsTrigger>
        </TabsList>

        <TabsContent value="uniprot" className="pt-4">
          <IdLookupTab
            label="Enter a UniProt accession"
            placeholder="e.g. P04637"
            exampleId="P04637"
            isLoading={isLoading}
            onSubmit={lookupUniprot}
          />
        </TabsContent>

        <TabsContent value="rcsb" className="pt-4">
          <IdLookupTab
            label="Enter a PDB ID"
            placeholder="e.g. 1TUP"
            exampleId="1TUP"
            isLoading={isLoading}
            onSubmit={lookupRcsb}
          />
        </TabsContent>

        <TabsContent value="fasta" className="pt-4">
          <FastaTab isLoading={isLoading} onSubmit={submitFasta} />
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
    </div>
  );
}
