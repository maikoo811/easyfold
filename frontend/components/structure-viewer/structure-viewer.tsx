"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

interface MolstarViewer {
  dispose: () => void;
  loadStructureFromUrl: (url: string, format: string) => Promise<void>;
}

interface MolstarLayoutOptions {
  layoutIsExpanded?: boolean;
  layoutShowControls?: boolean;
  layoutShowRemoteState?: boolean;
  layoutShowSequence?: boolean;
  layoutShowLog?: boolean;
  layoutShowLeftPanel?: boolean;
  // Viewport overlay icons (right edge of the canvas). Setting any of these to
  // false hides the corresponding icon — and crucially also removes the user's
  // ability to open the panel it triggers (Screenshot / Structure Tools / etc).
  viewportShowAnimation?: boolean;
  viewportShowControls?: boolean;
  viewportShowExpand?: boolean;
  viewportShowReset?: boolean;
  viewportShowScreenshotControls?: boolean;
  viewportShowSelectionMode?: boolean;
  viewportShowSettings?: boolean;
  viewportShowToggleFullscreen?: boolean;
  viewportShowTrajectoryControls?: boolean;
}

interface MolstarGlobal {
  Viewer: {
    create: (
      host: HTMLElement,
      options?: MolstarLayoutOptions,
    ) => Promise<MolstarViewer>;
  };
}

/** Pass these to `Viewer.create` to suppress Mol*'s side panels and chrome —
 * we want a clean contained viewer; the user gets confidence charts + the
 * LLM interpretation panel below it instead.
 *
 * The `layoutShow*` group hides the side panels themselves; the
 * `viewportShow*` group hides the floating icons on the right edge of the
 * canvas (Screenshot, Settings, Structure Tools, Animation, etc.) — without
 * these, the user could still click the icons to re-open the panels we hid.
 * Bottom-of-canvas residue info (`PRO 47 / pLDDT 46.32`) stays — that's a
 * useful hover readout, not chrome. */
const VIEWER_OPTIONS: MolstarLayoutOptions = {
  layoutIsExpanded: false,
  layoutShowControls: false,
  layoutShowRemoteState: false,
  layoutShowSequence: false,
  layoutShowLog: false,
  layoutShowLeftPanel: false,
  viewportShowAnimation: false,
  viewportShowControls: false,
  viewportShowExpand: false,
  viewportShowReset: false,
  viewportShowScreenshotControls: false,
  viewportShowSelectionMode: false,
  viewportShowSettings: false,
  viewportShowToggleFullscreen: false,
  viewportShowTrajectoryControls: false,
};

declare global {
  interface Window {
    molstar?: MolstarGlobal;
  }
}

const SCRIPT_SRC = "/molstar/molstar.js";
const STYLE_HREF = "/molstar/molstar.css";

let scriptPromise: Promise<MolstarGlobal> | null = null;

function loadMolstar(): Promise<MolstarGlobal> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolveLoad, rejectLoad) => {
    if (window.molstar) {
      resolveLoad(window.molstar);
      return;
    }

    if (!document.querySelector(`link[data-molstar]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_HREF;
      link.dataset.molstar = "true";
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[data-molstar]`);
    const handleLoad = () => {
      if (window.molstar) resolveLoad(window.molstar);
      else rejectLoad(new Error("Mol* loaded but `window.molstar` is undefined"));
    };
    const handleError = () => rejectLoad(new Error("Failed to load Mol* script"));

    if (existing) {
      existing.addEventListener("load", handleLoad);
      existing.addEventListener("error", handleError);
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.dataset.molstar = "true";
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface StructureViewerProps {
  /** URL of the structure file. Defaults to the bundled 1TUP fixture when neither `url` nor `cif` is provided. */
  url?: string;
  /** mmCIF text content. When provided, takes precedence over `url` — we wrap it in a Blob URL. */
  cif?: string;
  /** Source file format. mmCIF is preferred. */
  format?: "mmcif" | "pdb";
  /** Container height in CSS pixels. */
  height?: number;
}

export function StructureViewer({
  url,
  cif,
  format = "mmcif",
  height = 520,
}: StructureViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let viewer: MolstarViewer | null = null;
    let blobUrl: string | null = null;

    // Mol*'s bundled UMD only loads from URLs, not from strings. For an in-memory
    // mmCIF (live prediction result) we wrap it in a Blob URL and revoke on unmount.
    let targetUrl: string;
    if (cif) {
      const blob = new Blob([cif], { type: "chemical/x-mmcif" });
      blobUrl = URL.createObjectURL(blob);
      targetUrl = blobUrl;
    } else {
      targetUrl = url ?? "/fixtures/1tup.cif";
    }

    (async () => {
      try {
        const molstar = await loadMolstar();
        if (cancelled) return;
        viewer = await molstar.Viewer.create(host, VIEWER_OPTIONS);
        if (cancelled) {
          viewer.dispose();
          return;
        }
        await viewer.loadStructureFromUrl(targetUrl, format);
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load structure");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      viewer?.dispose();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url, cif, format]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border bg-card"
      style={{ height }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Loading structure…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>Failed to load structure: {error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
