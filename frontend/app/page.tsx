import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AssemblyBuilder } from "@/components/assembly-builder";
import { Logo } from "@/components/logo";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50/60 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-[720px] space-y-12">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <Logo className="size-7" />
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              EasyFold
            </h1>
          </div>
          <p className="max-w-prose text-lg leading-snug text-foreground">
            Predict protein structures, then ask Claude what they mean.
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            AlphaFold 3 / Boltz-2 on your own GPU. No code required.{" "}
            <Link
              href="/demo"
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              See the demo first
              <ArrowRight className="size-3.5" />
            </Link>
          </p>
        </header>
        <AssemblyBuilder />
      </main>
    </div>
  );
}
