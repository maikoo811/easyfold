"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

interface MolstarStructureComponent {
  components: unknown;
}

interface MolstarPlugin {
  dataTransaction: (fn: () => Promise<void>) => Promise<void>;
  managers?: {
    structure?: {
      hierarchy?: {
        current?: { structures?: MolstarStructureComponent[] };
      };
      component?: {
        updateRepresentationsTheme: (
          components: unknown,
          params: { color?: string },
        ) => Promise<void>;
      };
    };
  };
}

interface MolstarViewer {
  dispose: () => void;
  loadStructureFromUrl: (url: string, format: string) => Promise<void>;
  /** Full Mol* PluginContext, exposed by the UMD bundle's Viewer wrapper. We
   * use it for theme application — see {@link applyPlddtTheme}. */
  plugin?: MolstarPlugin;
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

    // The `viewportShow*` props on Viewer.create cover the standard set of
    // floating buttons (expand / reset / screenshot / selection mode / …),
    // but a handful of other icons (snapshot / illumination / stereo) hang
    // off separate plugin modules and ignore those flags. They show up as
    // the small inert sun / glasses icons in the top-right of the canvas.
    // Embedded usage doesn't want any of them, so we nuke the whole
    // `.msp-viewport-controls` container as a backstop. The override stylesheet
    // is injected once per page and stays cheap (one CSS rule).
    if (!document.querySelector(`style[data-molstar-overrides]`)) {
      const style = document.createElement("style");
      style.dataset.molstarOverrides = "true";
      style.textContent =
        ".msp-plugin .msp-viewport-controls { display: none !important; }";
      document.head.appendChild(style);
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

/** Apply Mol*'s built-in `plddt-confidence` color theme to all loaded
 * structures. Uses the standard AlphaFold blue → cyan → yellow → orange
 * gradient based on the B-factor field (where AF3 / Boltz-2 store pLDDT).
 *
 * Fail-open: if the plugin's theme API isn't shaped as expected (rare —
 * Mol* could move things in a future minor) we swallow the error and leave
 * the structure with its default coloring. The viewer still renders fine.
 */
async function applyPlddtTheme(viewer: MolstarViewer): Promise<void> {
  const plugin = viewer.plugin;
  const structures = plugin?.managers?.structure?.hierarchy?.current?.structures;
  const component = plugin?.managers?.structure?.component;
  if (!plugin || !structures || !component) return;
  try {
    await plugin.dataTransaction(async () => {
      for (const structure of structures) {
        await component.updateRepresentationsTheme(structure.components, {
          color: "plddt-confidence",
        });
      }
    });
  } catch {
    // Theme application is best-effort; the viewer remains functional without it.
  }
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
  /** When true, apply the `plddt-confidence` theme after loading — colors the
   * structure by AlphaFold-style confidence (blue = very high, orange = very low).
   * Requires the structure file to carry pLDDT values in the B-factor field
   * (the convention used by AF3 and Boltz-2 outputs). */
  colorByPlddt?: boolean;
}

export function StructureViewer({
  url,
  cif,
  format = "mmcif",
  height = 520,
  colorByPlddt = false,
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
        if (cancelled) return;
        if (colorByPlddt) {
          await applyPlddtTheme(viewer);
        }
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
  }, [url, cif, format, colorByPlddt]);

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
