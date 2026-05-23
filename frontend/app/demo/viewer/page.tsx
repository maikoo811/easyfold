import { StructureViewer } from "@/components/structure-viewer";

export const metadata = {
  title: "Mol* viewer demo — EasyFold",
  description: "Demo route rendering a static 1TUP fixture with Mol* Viewer.",
};

export default function ViewerDemoPage() {
  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Mol* viewer demo
        </h1>
        <p className="text-sm text-muted-foreground">
          Static <code className="font-mono">1TUP</code> fixture, rendered with Mol* Viewer 5.x.
          Drag to rotate; scroll to zoom.
        </p>
      </header>
      <StructureViewer />
    </div>
  );
}
