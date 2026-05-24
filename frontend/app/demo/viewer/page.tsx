import { ConfidenceCharts } from "@/components/confidence-charts";
import { StructureViewer } from "@/components/structure-viewer";

export const metadata = {
  title: "Mol* viewer demo — EasyFold",
  description: "Demo route rendering a static 1TUP fixture with Mol* Viewer plus synthetic confidence charts.",
};

export default function ViewerDemoPage() {
  return (
    <div className="mx-auto max-w-[960px] space-y-8 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Mol* viewer demo
        </h1>
        <p className="text-sm text-muted-foreground">
          Static <code className="font-mono">1TUP</code> fixture, rendered with Mol* Viewer 5.x.
          Drag to rotate; scroll to zoom. The confidence charts below use synthetic data and
          will be replaced with real AlphaFold output during Task 3.x.
        </p>
      </header>
      <StructureViewer />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Model confidence</h2>
        <ConfidenceCharts fixtureUrl="/fixtures/1tup_confidence.json" />
      </section>
    </div>
  );
}
