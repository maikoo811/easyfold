import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-6 text-primary", className)}
    >
      <path d="M4 8c4 0 4 8 8 8s4-8 8-8" />
      <path d="M4 16c4 0 4-8 8-8s4 8 8 8" />
    </svg>
  );
}
