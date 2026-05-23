import { useCallback, useReducer, useRef } from "react";

import { ApiRequestError, fetchRcsb, fetchUniprot } from "@/lib/api";
import type { FetchedSequence } from "@/lib/api";
import { parseFasta, validateSequence } from "@/lib/fasta";

export type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: FetchedSequence };

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; data: FetchedSequence }
  | { type: "FETCH_ERROR"; message: string }
  | { type: "RESET" };

function reducer(_state: LookupState, action: Action): LookupState {
  switch (action.type) {
    case "FETCH_START":
      return { status: "loading" };
    case "FETCH_SUCCESS":
      return { status: "success", data: action.data };
    case "FETCH_ERROR":
      return { status: "error", message: action.message };
    case "RESET":
      return { status: "idle" };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.status === 404) return "Not found. Check the ID and try again.";
    return err.detail;
  }
  if (err instanceof TypeError) return "Network error. Is the backend running?";
  return "Something went wrong. Please try again.";
}

export function useSequenceLookup() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const lookupUniprot = useCallback(async (accession: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "FETCH_START" });
    try {
      const data = await fetchUniprot(accession, controller.signal);
      dispatch({ type: "FETCH_SUCCESS", data });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({ type: "FETCH_ERROR", message: errorMessage(err) });
    }
  }, []);

  const lookupRcsb = useCallback(async (pdbId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "FETCH_START" });
    try {
      const data = await fetchRcsb(pdbId, controller.signal);
      dispatch({ type: "FETCH_SUCCESS", data });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({ type: "FETCH_ERROR", message: errorMessage(err) });
    }
  }, []);

  const submitFasta = useCallback((text: string) => {
    const parsed = parseFasta(text);
    if (!parsed) {
      dispatch({ type: "FETCH_ERROR", message: "Please enter a sequence." });
      return;
    }

    const error = validateSequence(parsed.sequence);
    if (error) {
      dispatch({ type: "FETCH_ERROR", message: error });
      return;
    }

    const data: FetchedSequence = {
      id: parsed.header ?? "manual-input",
      source: "fasta",
      sequence: parsed.sequence,
      organism: null,
      length: parsed.sequence.length,
      description: parsed.header,
    };
    dispatch({ type: "FETCH_SUCCESS", data });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "RESET" });
  }, []);

  return { state, lookupUniprot, lookupRcsb, submitFasta, reset } as const;
}
