import { ExampleCard } from "@/components/example-card";
import { Logo } from "@/components/logo";

import { EXAMPLES } from "./_data/examples";

export const metadata = {
  title: "EasyFold demo — pre-computed structures",
  description:
    "Browse three pre-computed protein structures with confidence charts and natural-language interpretation.",
};

export default function DemoLandingPage() {
  return (
    <div className="mx-auto max-w-[960px] space-y-8 px-6 py-16">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Logo className="size-7" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            EasyFold demo
          </h1>
        </div>
        <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
          Three pre-computed structures, each rendered with Mol* alongside
          AlphaFold-style confidence charts and on-demand natural-language
          interpretation. Confidence values are synthetic for now — they will be
          replaced with real AlphaFold output in the production deployment.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <ExampleCard
            key={ex.id}
            id={ex.id}
            pdbId={ex.pdbId}
            title={ex.title}
            blurb={ex.blurb}
          />
        ))}
      </section>
    </div>
  );
}
