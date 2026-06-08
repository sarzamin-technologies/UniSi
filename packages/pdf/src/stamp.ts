import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Field rectangle in normalized [0, 1] top-left origin coordinates.
 * Conversion to pdf-lib's bottom-left points happens at the boundary in
 * stampFields — never persist non-normalized coordinates. (PLAN.md risk #2.)
 */
export interface NormalizedRect {
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StampInput extends NormalizedRect {
  type: "text" | "signature" | "initials" | "date" | "checkbox" | "number" | "email" | "phone";
  /** For text/date/etc — the typed value. */
  text?: string;
  /** For signature/initials — PNG bytes. */
  imagePng?: Uint8Array;
  /** For checkbox — true if checked. */
  checked?: boolean;
}

/** Stamp the given inputs onto the PDF and return the new bytes. */
export async function stampFields(pdfBytes: Uint8Array, inputs: StampInput[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  // Pre-embed any signature PNGs to avoid duplicate embeds.
  const imageCache = new Map<Uint8Array, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const f of inputs) {
    if (f.imagePng && !imageCache.has(f.imagePng)) {
      const img = await doc.embedPng(f.imagePng);
      imageCache.set(f.imagePng, img);
    }
  }

  for (const f of inputs) {
    const page = pages[f.pageIndex];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();

    // Convert normalized top-left → pdf-lib bottom-left points.
    const x = f.x * pw;
    const w = f.w * pw;
    const h = f.h * ph;
    // y in normalized top-left is the *top* of the field; pdf-lib's y is the *bottom*.
    const yBottom = ph - (f.y + f.h) * ph;

    if (f.type === "checkbox") {
      if (f.checked) {
        // Draw an X across the box.
        page.drawLine({
          start: { x, y: yBottom },
          end: { x: x + w, y: yBottom + h },
          thickness: Math.max(1, h * 0.08),
          color: rgb(0, 0, 0),
        });
        page.drawLine({
          start: { x, y: yBottom + h },
          end: { x: x + w, y: yBottom },
          thickness: Math.max(1, h * 0.08),
          color: rgb(0, 0, 0),
        });
      }
      continue;
    }

    if ((f.type === "signature" || f.type === "initials") && f.imagePng) {
      const img = imageCache.get(f.imagePng);
      if (img) {
        // Fit image within box preserving aspect ratio.
        const ratio = img.width / img.height;
        let drawW = w;
        let drawH = w / ratio;
        if (drawH > h) {
          drawH = h;
          drawW = h * ratio;
        }
        page.drawImage(img, {
          x: x + (w - drawW) / 2,
          y: yBottom + (h - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
      continue;
    }

    if (f.text) {
      // Auto-fit font size to box height, with a sensible cap.
      const fontSize = Math.min(h * 0.7, 14);
      const textWidth = helv.widthOfTextAtSize(f.text, fontSize);
      const drawX = x + Math.max(2, (w - textWidth) / 2);
      const drawY = yBottom + (h - fontSize) / 2 + fontSize * 0.18;
      page.drawText(f.text, {
        x: drawX,
        y: drawY,
        size: fontSize,
        font: helv,
        color: rgb(0, 0, 0),
        maxWidth: w - 2,
      });
    }
  }

  return doc.save();
}
