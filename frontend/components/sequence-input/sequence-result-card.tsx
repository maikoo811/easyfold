import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FetchedSequence } from "@/lib/api";

interface SequenceResultCardProps {
  data: FetchedSequence;
  onReset: () => void;
}

const SOURCE_LABELS: Record<FetchedSequence["source"], string> = {
  uniprot: "UniProt",
  rcsb: "PDB",
  fasta: "Pasted",
};

function formatSequence(seq: string, lineLength = 60): string {
  const lines: string[] = [];
  for (let i = 0; i < seq.length; i += lineLength) {
    lines.push(seq.slice(i, i + lineLength));
  }
  return lines.join("\n");
}

export function SequenceResultCard({
  data,
  onReset,
}: SequenceResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data.sequence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="font-mono">{data.id}</CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {SOURCE_LABELS[data.source]}
          </span>
        </div>
        {data.description && (
          <CardDescription>{data.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-sm text-muted-foreground">
          {data.organism && <span>{data.organism}</span>}
          <span>{data.length} residues</span>
        </div>
        <div className="relative">
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
            {formatSequence(data.sequence)}
          </pre>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute right-2 top-2"
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-3" />
          Start over
        </Button>
      </CardFooter>
    </Card>
  );
}
