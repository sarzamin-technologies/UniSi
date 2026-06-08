/**
 * Server-side PDF rendering and text extraction.
 *
 * Used by AI features (field detection over rendered images, Q&A over
 * extracted text). Browser code should NOT import this — it pulls in
 * @napi-rs/canvas which has native bindings.
 */

import { createCanvas } from "@napi-rs/canvas";

export interface RenderedPage {
  pageIndex: number;
  widthPx: number;
  heightPx: number;
  png: Buffer;
}

export interface PageText {
  pageIndex: number;
  text: string;
}

/** A single positioned text run, in normalized [0,1] TOP-LEFT-origin coords. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageTextItems {
  pageIndex: number;
  /** Page width/height in PDF points (for reference). */
  widthPt: number;
  heightPt: number;
  items: TextItem[];
}

/** Lazy import of pdfjs (legacy build runs in Node without a worker thread). */
async function loadPdfjs() {
  const mod = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as typeof import("pdfjs-dist");
  return mod;
}

/**
 * pdfjs expects a CanvasFactory that creates Canvas elements. @napi-rs/canvas
 * is API-compatible enough that we just adapt the create/reset/destroy hooks.
 */
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(target: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number) {
    target.canvas.width = Math.ceil(width);
    target.canvas.height = Math.ceil(height);
  }
  destroy(target: { canvas: ReturnType<typeof createCanvas> | null }) {
    if (target.canvas) {
      target.canvas.width = 0;
      target.canvas.height = 0;
      target.canvas = null;
    }
  }
}

/**
 * Render every page of a PDF to a PNG buffer at the requested scale (1.0 = 72 DPI,
 * 2.0 = 144 DPI). Returns an array indexed by page.
 */
export async function renderPdfPagesToPng(
  pdfBytes: Uint8Array,
  opts: { scale?: number; maxPages?: number } = {},
): Promise<RenderedPage[]> {
  const pdfjs = await loadPdfjs();
  // pdfjs `new`s the CanvasFactory internally, so pass the class (not an
  // instance). Its TS types require DOM symbols we don't have here, hence
  // the cast — runtime shape matches what pdfjs expects in Node.
  const doc = await pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: false,
    CanvasFactory: NodeCanvasFactory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as any).promise;

  const scale = opts.scale ?? 1.5;
  const limit = Math.min(doc.numPages, opts.maxPages ?? doc.numPages);
  const out: RenderedPage[] = [];

  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({
      // The skia 2D context implements the parts of CanvasRenderingContext2D
      // pdfjs touches; the cast bypasses missing DOM lib types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: context as unknown as any,
      viewport,
    }).promise;
    out.push({
      pageIndex: i - 1,
      widthPx: canvas.width,
      heightPx: canvas.height,
      png: canvas.toBuffer("image/png"),
    });
  }

  return out;
}

/** Extract text per page as plain strings, sorted by reading order. */
export async function extractPdfText(pdfBytes: Uint8Array): Promise<PageText[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: pdfBytes, useSystemFonts: false }).promise;
  const out: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    out.push({ pageIndex: i - 1, text });
  }
  return out;
}

/**
 * Extract text with per-run geometry, normalized to [0,1] with the origin at
 * the TOP-LEFT of each page (matching how template fields are stored). Used to
 * snap AI-detected fields onto the real positions of labels and underline
 * blanks rather than trusting a vision model's coordinate guesses.
 */
export async function extractPdfTextItems(pdfBytes: Uint8Array): Promise<PageTextItems[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: pdfBytes, useSystemFonts: false }).promise;
  const out: PageTextItems[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const W = viewport.width;
    const H = viewport.height;
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const item of content.items) {
      if (!("str" in item) || item.str.length === 0) continue;
      // transform = [a, b, c, d, e, f]; (e, f) is the baseline origin in PDF
      // user space (origin BOTTOM-left). width/height are the run's extent.
      const e = item.transform[4];
      const f = item.transform[5];
      const w = item.width;
      const h = item.height || Math.abs(item.transform[3]) || 0;
      if (w <= 0 || h <= 0) continue;
      items.push({
        str: item.str,
        x: e / W,
        // Convert baseline (bottom-left origin) to a top-left box.
        y: (H - f - h) / H,
        w: w / W,
        h: h / H,
      });
    }
    out.push({ pageIndex: i - 1, widthPt: W, heightPt: H, items });
  }
  return out;
}
