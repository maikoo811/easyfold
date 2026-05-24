import { notFound } from "next/navigation";

import { ResultViewer } from "@/components/result-viewer";
import { StructureViewer } from "@/components/structure-viewer";

import { EXAMPLES, findExample } from "../../_data/examples";

export function generateStaticParams() {
  return EXAMPLES.map((e) => ({ id: e.id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const ex = findExample(id);
  return {
    title: ex ? `${ex.pdbId} — EasyFold demo` : "EasyFold demo",
    description: ex?.blurb,
  };
}

export default async function ExamplePage({ params }: PageProps) {
  const { id } = await params;
  const ex = findExample(id);
  if (!ex) notFound();

  return (
    <div className="mx-auto max-w-[960px] space-y-8 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {ex.pdbId} — {ex.title}
        </h1>
        <p className="text-sm text-muted-foreground">{ex.blurb}</p>
      </header>
      <StructureViewer url={ex.structureUrl} />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Model confidence</h2>
        <ResultViewer
          fixtureUrl={ex.fixtureUrl}
          structureId={ex.pdbId}
          structureDescription={ex.structureDescription}
        />
      </section>
    </div>
  );
}
