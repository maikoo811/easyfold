import { useId, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface IdLookupTabProps {
  label: string;
  placeholder: string;
  exampleId: string;
  submitLabel: string;
  validate?: (raw: string) => string | null;
  isLoading: boolean;
  onSubmit: (id: string) => void;
}

export function IdLookupTab({
  label,
  placeholder,
  exampleId,
  submitLabel,
  validate,
  isLoading,
  onSubmit,
}: IdLookupTabProps) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    const validationError = validate?.(trimmed) ?? null;
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (error) setError(null);
  };

  const handleTryExample = () => {
    setValue(exampleId);
    setError(null);
    onSubmit(exampleId);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-invalid={error !== null}
          className="font-mono"
        />
        <Button onClick={handleSubmit} disabled={isLoading || !value.trim()}>
          {isLoading ? <Loader2 className="animate-spin" /> : submitLabel}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        onClick={handleTryExample}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <span>Try</span>
        <span className="font-mono text-foreground">{exampleId}</span>
      </button>
    </div>
  );
}
