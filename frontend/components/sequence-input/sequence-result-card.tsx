import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FetchedSequence } from "@/lib/api";

import { PredictCta } from "./predict-cta";

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
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-mono">{data.id}</CardTitle>
          <Badge variant="outline">{SOURCE_LABELS[data.source]}</Badge>
          <Badge variant="secondary">{data.length} amino acids</Badge>
        </div>
        {(data.organism || data.description) && (
          <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm">
            {data.organism && (
              <p className="italic text-muted-foreground">{data.organism}</p>
            )}
            {data.description && (
              <p className="text-foreground">{data.description}</p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative">
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
            {formatSequence(data.sequence)}
          </pre>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute right-2 top-2"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy sequence"}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <PredictCta sequence={data} />
        <Button variant="ghost" size="sm" onClick={onReset} className="self-start">
          <RotateCcw className="size-3" />
          Start over
        </Button>
      </CardFooter>
    </Card>
  );
}
