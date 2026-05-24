import type { JobCreateBody, JobStatus } from "./jobs";
import type { FetchedSequence } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiRequestError";
  }
}

interface FetchOpts {
  signal?: AbortSignal;
  method?: "GET" | "POST";
  body?: unknown;
}

async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? "GET",
    signal: opts.signal,
  };
  if (opts.body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_BASE}${path}`, init);

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body: { detail?: string } = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // response body wasn't JSON
    }
    throw new ApiRequestError(res.status, detail);
  }

  return (await res.json()) as T;
}

export function fetchUniprot(
  accession: string,
  signal?: AbortSignal,
): Promise<FetchedSequence> {
  return apiFetch<FetchedSequence>(
    `/api/v1/sequences/uniprot/${encodeURIComponent(accession)}`,
    { signal },
  );
}

export function fetchRcsb(
  pdbId: string,
  signal?: AbortSignal,
): Promise<FetchedSequence> {
  return apiFetch<FetchedSequence>(
    `/api/v1/sequences/rcsb/${encodeURIComponent(pdbId)}`,
    { signal },
  );
}

export function createJob(
  body: JobCreateBody,
  signal?: AbortSignal,
): Promise<JobStatus> {
  return apiFetch<JobStatus>(`/api/v1/jobs`, { method: "POST", body, signal });
}

export function getJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobStatus> {
  return apiFetch<JobStatus>(`/api/v1/jobs/${encodeURIComponent(jobId)}`, { signal });
}
