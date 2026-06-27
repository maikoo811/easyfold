import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

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
      className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {tag}
        </span>
        <ArrowRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <h3 className="text-base font-semibold leading-snug text-foreground">
        {title}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{blurb}</p>
      <Badge variant="outline" className="self-start font-mono text-[10px]">
        {pdbId}
      </Badge>
    </Link>
  );
}
