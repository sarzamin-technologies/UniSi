import { PDFDocument } from "pdf-lib";

export async function getPageDimensions(
  pdfBytes: Uint8Array,
): Promise<Array<{ width: number; height: number }>> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize();
    return { width, height };
  });
}

export async function getPageCount(pdfBytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

export * from "./stamp";
export * from "./server-render";
export * from "./text-to-pdf";
export * from "./audit-trail";
export * from "./verify-audit-trail";
