import { Suspense } from "react";

import { PredictClient } from "./predict-client";

// `/predict/[jobId]` runs entirely against the live backend (POST /api/v1/jobs
// then GET /api/v1/jobs/{id}). The jobId is unknown until the user submits, so
// it cannot be pre-rendered.
//
// For the production build (default) we render a single placeholder param at
// build time and rely on Next 16's `dynamicParams = true` (the default) to
// serve every other id as a dynamic client-side route. The placeholder is
// effectively unused — a real user always lands here from `/predict/[fresh-id]`.
//
// For the static-export demo build (`BUILD_TARGET=demo pnpm build:demo`),
// `output: "export"` only emits the placeholder page; the demo doesn't have a
// backend to talk to anyway. Users who somehow hit `/predict/...` on the demo
// see the placeholder's pending state and a network error after the first poll.
const PLACEHOLDER_JOB_ID = "static-build-placeholder";

export function generateStaticParams(): { jobId: string }[] {
  return [{ jobId: PLACEHOLDER_JOB_ID }];
}

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function PredictPage({ params }: PageProps) {
  const { jobId } = await params;
  // useSearchParams in PredictClient triggers CSR bailout during pre-render;
  // Suspense satisfies Next.js's requirement for a fallback during that phase.
  return (
    <Suspense fallback={null}>
      <PredictClient jobId={jobId} />
    </Suspense>
  );
}
