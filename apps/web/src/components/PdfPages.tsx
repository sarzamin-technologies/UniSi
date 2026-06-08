"use client";
import { useEffect, useRef, useState } from "react";

export interface PageDims {
  widthPx: number;
  heightPx: number;
}

export interface PdfPagesProps {
  url: string;
  /** Target rendered width per page, in CSS pixels. */
  pageWidthPx?: number;
  onPagesReady?: (pages: PageDims[]) => void;
  /** Optional overlay rendered absolutely on top of each page. */
  overlay?: (pageIndex: number, dims: PageDims) => React.ReactNode;
  /** Click handler for placing fields — gets normalized [0,1] coords. */
  onPageClick?: (pageIndex: number, normalized: { x: number; y: number }) => void;
  /** When true, the pages show a crosshair cursor (field-placement armed). */
  placing?: boolean;
}

// Lazy-load pdfjs once per page session — multiple PdfPages instances share it.
type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import("pdfjs-dist");
      mod.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
      return mod;
    })();
  }
  return pdfjsPromise;
}

type PdfDoc = Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>;

/**
 * Renders a PDF as a stack of canvases. Decoupled into two stages:
 *   1. Top-level effect loads the document and computes per-page dims.
 *   2. Per-page child effect renders into its own canvas — runs AFTER React
 *      commits, so the ref is guaranteed populated.
 *
 * The previous single-effect version had a race where canvas refs were read
 * inside a microtask after a setState, before React had committed the DOM —
 * canvases stayed blank.
 */
export function PdfPages({
  url,
  pageWidthPx = 760,
  onPagesReady,
  overlay,
  onPageClick,
  placing = false,
}: PdfPagesProps) {
  const [pages, setPages] = useState<PageDims[]>([]);
  const docRef = useRef<PdfDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    docRef.current = null;
    setPages([]);

    (async () => {
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument(url).promise;
      if (cancelled) {
        doc.destroy().catch(() => {});
        return;
      }
      docRef.current = doc;
      const dims: PageDims[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = pageWidthPx / baseViewport.width;
        const v = page.getViewport({ scale });
        dims.push({ widthPx: v.width, heightPx: v.height });
      }
      if (cancelled) return;
      setPages(dims);
      onPagesReady?.(dims);
    })().catch((err) => console.error("PdfPages load:", err));

    return () => {
      cancelled = true;
      const doc = docRef.current;
      docRef.current = null;
      doc?.destroy().catch(() => {});
    };
  }, [url, pageWidthPx, onPagesReady]);

  function handleClick(pageIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!onPageClick) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPageClick(pageIndex, { x, y });
  }

  return (
    <div className="space-y-4 inline-block">
      {pages.map((dims, i) => (
        <div
          key={`${url}-${i}`}
          className={`relative shadow-sm bg-white ${placing ? "cursor-crosshair" : ""}`}
          style={{ width: dims.widthPx, height: dims.heightPx }}
          onClick={(e) => handleClick(i, e)}
        >
          <PdfPageCanvas
            doc={docRef}
            pageIndex={i}
            dims={dims}
            pageWidthPx={pageWidthPx}
          />
          {overlay && (
            <div className="absolute inset-0 pointer-events-none">{overlay(i, dims)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function PdfPageCanvas({
  doc,
  pageIndex,
  dims,
  pageWidthPx,
}: {
  doc: React.MutableRefObject<PdfDoc | null>;
  pageIndex: number;
  dims: PageDims;
  pageWidthPx: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    (async () => {
      const canvas = canvasRef.current;
      const pdfDoc = doc.current;
      if (!canvas || !pdfDoc) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(dims.widthPx * dpr);
      canvas.height = Math.floor(dims.heightPx * dpr);
      canvas.style.width = `${dims.widthPx}px`;
      canvas.style.height = `${dims.heightPx}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const page = await pdfDoc.getPage(pageIndex + 1);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pageWidthPx / baseViewport.width });
      const task = page.render({ canvasContext: ctx, viewport });
      renderTask = task as unknown as { cancel: () => void };
      try {
        await task.promise;
      } catch (err) {
        if (!cancelled) console.error("PdfPages render:", err);
      }
    })();
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // ignore
      }
    };
  }, [doc, pageIndex, dims.widthPx, dims.heightPx, pageWidthPx]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}
