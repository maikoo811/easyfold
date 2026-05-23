import { Logo } from "@/components/logo";
import { SequenceInput } from "@/components/sequence-input";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50/60 px-6 py-20 dark:bg-black">
      <main className="w-full max-w-[680px] space-y-12">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Logo className="size-7" />
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              EasyFold
            </h1>
          </div>
          <p className="max-w-prose text-base text-muted-foreground leading-relaxed">
            Predict protein structures with AlphaFold 3 or Boltz-2 — paste a
            sequence, or look it up by UniProt accession or PDB ID.
          </p>
        </header>
        <SequenceInput />
      </main>
    </div>
  );
}
