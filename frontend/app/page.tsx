import { SequenceInput } from "@/components/sequence-input";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            EasyFold
          </h1>
          <p className="text-sm text-muted-foreground">
            Start by providing a protein sequence — paste it directly, or look
            it up by UniProt accession or PDB ID.
          </p>
        </div>
        <SequenceInput />
      </main>
    </div>
  );
}
