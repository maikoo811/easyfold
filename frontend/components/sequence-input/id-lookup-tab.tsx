import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface IdLookupTabProps {
  label: string;
  placeholder: string;
  exampleId: string;
  isLoading: boolean;
  onSubmit: (id: string) => void;
}

export function IdLookupTab({
  label,
  placeholder,
  exampleId,
  isLoading,
  onSubmit,
}: IdLookupTabProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="font-mono"
        />
        <Button onClick={handleSubmit} disabled={isLoading || !value.trim()}>
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            "Fetch"
          )}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setValue(exampleId);
          onSubmit(exampleId);
        }}
        disabled={isLoading}
        className="text-muted-foreground"
      >
        Try {exampleId}
      </Button>
    </div>
  );
}
