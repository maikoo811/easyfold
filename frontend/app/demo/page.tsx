import { ExampleCard } from "@/components/example-card";
import { Logo } from "@/components/logo";

import { EXAMPLES } from "./_data/examples";

export const metadata = {
  title: "EasyFold demo — pre-computed structures",
  description:
    "Try EasyFold without installing anything: three pre-computed protein structures with confidence colors and an AI explanation.",
};

export default function DemoLandingPage() {
  return (
    <div className="mx-auto max-w-[960px] space-y-10 px-6 py-16">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Logo className="size-7" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Demo
          </h1>
        </div>
        <p className="max-w-prose text-base leading-relaxed text-foreground">
          Try EasyFold without installing anything. Pick a structure to see the
          3D model, confidence colors, and an AI explanation.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pick a structure
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <ExampleCard
              key={ex.id}
              id={ex.id}
              pdbId={ex.pdbId}
              title={ex.title}
              tag={ex.tag}
              blurb={ex.blurb}
            />
          ))}
        </div>
      </section>

      <p className="max-w-prose text-xs italic leading-relaxed text-muted-foreground">
        Demo confidence values are synthetic so the page works without a GPU.
        Your own deploy uses real AlphaFold 3 / Boltz-2 output.
      </p>
    </div>
  );
}
