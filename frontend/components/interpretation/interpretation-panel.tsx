"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ConfidenceData } from "@/lib/confidence";
import {
  InterpretError,
  MODEL,
  interpret,
  type InterpretationResult,
} from "@/lib/llm";

interface InterpretationPanelProps {
  confidence: ConfidenceData;
  structureId: string;
  structureDescription: string;
}

type Status = "idle" | "loading" | "ready" | "error";

const PLACEHOLDER_QUESTION =
  "Is the structured core stable enough to trust for docking against a small molecule?";

export function InterpretationPanel({
  confidence,
  structureId,
  structureDescription,
}: InterpretationPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit =
    apiKey.trim().length > 0 && question.trim().length > 0 && status !== "loading";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus("loading");
    setErrorMessage(null);
    try {
      const r = await interpret({
        apiKey: apiKey.trim(),
        question: question.trim(),
        confidence,
        structureId,
        structureDescription,
      });
      setResult(r);
      setStatus("ready");
    } catch (err) {
      const message =
        err instanceof InterpretError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <header className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-primary" />
          Interpret these metrics
        </h3>
        <p className="text-xs text-muted-foreground">
          Ask a question about the structure and Claude will explain what the
          confidence numbers mean for your case, plus suggest next steps.
        </p>
      </header>

      <p className="rounded-md border border-border bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        Your API key is sent directly from your browser to{" "}
        <code className="font-mono">api.anthropic.com</code>. EasyFold&apos;s
        backend never sees it, and it isn&apos;t stored anywhere — refreshing the
        page clears it.
      </p>

      <div className="space-y-2">
        <label
          htmlFor="anthropic-api-key"
          className="block text-xs font-medium text-foreground"
        >
          Anthropic API key
        </label>
        <Input
          id="anthropic-api-key"
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={status === "loading"}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="interpret-question"
          className="block text-xs font-medium text-foreground"
        >
          Your question
        </label>
        <Textarea
          id="interpret-question"
          rows={3}
          placeholder={PLACEHOLDER_QUESTION}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={status === "loading"}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          Model: <code className="font-mono">{MODEL}</code>
        </span>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {status === "loading" ? (
            <>
              <Loader2 className="animate-spin" />
              Interpreting…
            </>
          ) : (
            "Interpret"
          )}
        </Button>
      </div>

      {status === "error" && errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {status === "ready" && result && (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <p className="text-sm leading-relaxed text-foreground">
            {result.interpretation}
          </p>
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-foreground">Next steps</h4>
            <ul className="space-y-1.5 text-sm text-foreground">
              {result.actions.map((action, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">→</span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
