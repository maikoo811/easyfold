import { plddtBand, type ConfidenceData } from "@/lib/confidence";

export interface InterpretationRequest {
  apiKey: string;
  question: string;
  confidence: ConfidenceData;
  structureId: string;
  structureDescription: string;
}

export interface InterpretationResult {
  interpretation: string;
  actions: string[];
}

export type InterpretErrorKind =
  | "authentication"
  | "rate_limit"
  | "api"
  | "format"
  | "network"
  | "unknown";

export class InterpretError extends Error {
  constructor(
    public readonly kind: InterpretErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "InterpretError";
  }
}

export const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1024;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `You are interpreting AlphaFold confidence metrics for a working biologist.
Given (1) the user's question and (2) summary statistics for a predicted structure, you write a short paragraph (3-6 sentences) that:
- references the actual numbers the user is looking at,
- explains what those numbers mean in the context of their question,
- avoids generic disclaimers and never explains pLDDT/PAE/ipTM definitions unless asked.

Then suggest 1-3 next actions the user could take in their lab or analysis workflow. Actions should be concrete and tied to the metrics you cited.

Respond in this exact format with no preamble:

INTERPRETATION:
<paragraph>

ACTIONS:
- <action 1>
- <action 2>
- <action 3>  (optional)`;

export function summarizeConfidence(c: ConfidenceData): string {
  const n = c.length;

  const bands = { "very-high": 0, high: 0, low: 0, "very-low": 0 };
  let pSum = 0;
  let pMin = Infinity;
  let pMax = -Infinity;
  for (const v of c.plddt) {
    pSum += v;
    if (v < pMin) pMin = v;
    if (v > pMax) pMax = v;
    bands[plddtBand(v)] += 1;
  }
  const pMean = pSum / n;
  const pct = (k: number) => ((k / n) * 100).toFixed(0);

  let paeSum = 0;
  let paeMax = -Infinity;
  let paeLow5 = 0;
  const totalCells = n * n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = c.pae[i][j];
      paeSum += v;
      if (v > paeMax) paeMax = v;
      if (v < 5) paeLow5 += 1;
    }
  }
  const paeMean = paeSum / totalCells;
  const paeLow5Pct = ((paeLow5 / totalCells) * 100).toFixed(0);

  const lines = [
    `Length: ${n} residues`,
    `pLDDT: mean ${pMean.toFixed(1)}, min ${pMin.toFixed(1)}, max ${pMax.toFixed(1)}`,
    `pLDDT bands: ${pct(bands["very-high"])}% very-high (>=90), ${pct(bands.high)}% high (70-89), ${pct(bands.low)}% low (50-69), ${pct(bands["very-low"])}% very-low (<50)`,
    `PAE: mean ${paeMean.toFixed(1)} A, max ${paeMax.toFixed(1)} A, ${paeLow5Pct}% of cell pairs below 5 A`,
  ];
  if (typeof c.iptm === "number") {
    lines.push(`ipTM: ${c.iptm.toFixed(2)}`);
  }
  return lines.join("\n");
}

export function buildUserMessage(req: InterpretationRequest): string {
  return [
    `Structure: ${req.structureId} - ${req.structureDescription}`,
    "",
    "Confidence summary:",
    summarizeConfidence(req.confidence),
    "",
    `Question: ${req.question}`,
  ].join("\n");
}

export function parseResponse(text: string): InterpretationResult {
  const interpMarker = "INTERPRETATION:";
  const actionsMarker = "ACTIONS:";
  const iIdx = text.indexOf(interpMarker);
  const aIdx = text.indexOf(actionsMarker);
  if (iIdx === -1 || aIdx === -1 || aIdx < iIdx) {
    throw new InterpretError("format", "Claude's response was not in the expected format.");
  }
  const interpretation = text.slice(iIdx + interpMarker.length, aIdx).trim();
  const actionsRaw = text.slice(aIdx + actionsMarker.length).trim();
  const actions = actionsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line.length > 0);
  if (!interpretation || actions.length === 0) {
    throw new InterpretError("format", "Claude's response was missing required sections.");
  }
  return { interpretation, actions };
}

interface AnthropicErrorBody {
  error?: { type?: string; message?: string };
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  content: AnthropicContentBlock[];
}

/**
 * Call Claude with the user's API key + question + summarized confidence metrics.
 *
 * Uses `fetch` directly rather than `@anthropic-ai/sdk` — the SDK's top-level
 * client transitively imports `node:fs/promises` (via the Managed Agents beta
 * resources) which Turbopack cannot bundle for the browser, and dynamic import
 * doesn't help because the chunking step still resolves the whole module graph.
 * For a single Messages-API endpoint the raw POST is ~30 lines and adds 0 KB
 * to the bundle.
 *
 * The `anthropic-dangerous-direct-browser-access: true` header tells the API
 * we know we're sending a key from a browser context (BYOK is the consenting use).
 *
 * Errors are normalized to {@link InterpretError} so the UI doesn't need to know
 * about HTTP status codes or Anthropic's error-type strings.
 */
export async function interpret(
  req: InterpretationRequest,
): Promise<InterpretationResult> {
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": req.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(req) }],
      }),
    });
  } catch (err) {
    throw new InterpretError(
      "network",
      `Network error reaching Anthropic: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    let body: AnthropicErrorBody = {};
    try {
      body = (await response.json()) as AnthropicErrorBody;
    } catch {
      // body wasn't JSON
    }
    const apiMessage = body.error?.message ?? `HTTP ${response.status}`;
    if (response.status === 401) {
      throw new InterpretError("authentication", "That API key was rejected. Check it and try again.");
    }
    if (response.status === 429) {
      throw new InterpretError("rate_limit", "Rate limited by Anthropic. Wait a moment and retry.");
    }
    throw new InterpretError(
      "api",
      `Claude API error (${response.status}): ${apiMessage}`,
    );
  }

  let payload: AnthropicMessageResponse;
  try {
    payload = (await response.json()) as AnthropicMessageResponse;
  } catch (err) {
    throw new InterpretError(
      "format",
      `Claude returned non-JSON body: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = (payload.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");

  return parseResponse(text);
}
