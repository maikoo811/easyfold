import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface ExampleCardProps {
  id: string;
  pdbId: string;
  title: string;
  tag: string;
  blurb: string;
}

export function ExampleCard({ id, pdbId, title, tag, blurb }: ExampleCardProps) {
  return (
    <Link
      href={`/demo/viewer/${id}`}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <span className="font-mono">{pdbId}</span>
          <span className="px-1.5">·</span>
          <span>{tag}</span>
        </span>
        <ArrowRight className="size-4 transition-colors group-hover:text-primary" />
      </div>
      <h3 className="text-base font-semibold leading-snug text-foreground">
        {title}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{blurb}</p>
    </Link>
  );
}
