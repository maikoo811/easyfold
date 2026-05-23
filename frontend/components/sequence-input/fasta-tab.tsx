import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const PLACEHOLDER = `>sp|P04637|P53_HUMAN Cellular tumor antigen p53
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP
DEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYPQGLNGTVNLPGRNSFEV
RVCACPGRDRRTEEENLHKTTGIDSFLHPAT...`;

interface FastaTabProps {
  isLoading: boolean;
  onSubmit: (text: string) => void;
}

export function FastaTab({ isLoading, onSubmit }: FastaTabProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) onSubmit(value);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">
        Paste a FASTA sequence or raw amino acid letters
      </label>
      <Textarea
        placeholder={PLACEHOLDER}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isLoading}
        rows={6}
        className="font-mono text-xs"
      />
      <Button onClick={handleSubmit} disabled={isLoading || !value.trim()}>
        Parse sequence
      </Button>
    </div>
  );
}
