import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Markdown renderer for AI-drafted templates.
 *
 * Block-level: # ## ### headings, paragraphs, blank-line separation,
 *              `-` / `*` bullets, `1.` numbered lists, `>` blockquotes,
 *              `---` horizontal rule, fenced code blocks (```...```).
 * Inline:      **bold**, *italic*, ***bold italic***, `inline code`,
 *              [link text](https://url).
 *
 * Field placeholders (block-level, on their own line — labeled blank +
 * a corresponding template Field at the rendered coordinate):
 *
 *   [SIGNATURE: Role]
 *   [INITIALS: Role]
 *   [DATE: Role]
 *   [TEXT: "Field label", Role]
 *   [NUMBER: "Field label", Role]
 *   [EMAIL: "Field label", Role]
 *   [PHONE: "Field label", Role]
 *   [CHECKBOX: "Field label", Role]
 *
 * `{{LABEL}}`-style curly placeholders the AI sometimes still emits get
 * normalised to bracket form so they never leak as literal text.
 */

export type PlaceholderKind =
  | "signature"
  | "initials"
  | "date"
  | "text"
  | "number"
  | "email"
  | "phone"
  | "checkbox";

export interface RenderedPlaceholder {
  kind: PlaceholderKind;
  role: string;
  label?: string;
  pageIndex: number;
  /** Normalized [0, 1] top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderResult {
  bytes: Uint8Array;
  placeholders: RenderedPlaceholder[];
  pageCount: number;
}

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN_X = 64;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const LINE_HEIGHT = 1.35;

const SIZE_BODY = 11;
const SIZE_H1 = 20;
const SIZE_H2 = 16;
const SIZE_H3 = 13;
const SIZE_CODE = 10;

const TYPE_TO_KIND: Record<string, PlaceholderKind> = {
  SIGNATURE: "signature",
  INITIALS: "initials",
  DATE: "date",
  TEXT: "text",
  NUMBER: "number",
  EMAIL: "email",
  PHONE: "phone",
  CHECKBOX: "checkbox",
};

const FIELD_BOX: Record<PlaceholderKind, { w: number; h: number }> = {
  signature: { w: 220, h: 36 },
  initials: { w: 80, h: 36 },
  date: { w: 110, h: 18 },
  text: { w: 220, h: 18 },
  number: { w: 120, h: 18 },
  email: { w: 220, h: 18 },
  phone: { w: 140, h: 18 },
  checkbox: { w: 14, h: 14 },
};

const DEFAULT_ROLE = "Signer";

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  code: PDFFont;
}

interface BaseStyle {
  bold?: boolean;
  italic?: boolean;
}

interface Cursor {
  page: PDFPage;
  y: number;
  pageIndex: number;
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  link?: string;
}

const PLACEHOLDER_RE =
  /\[(SIGNATURE|INITIALS|DATE|TEXT|NUMBER|EMAIL|PHONE|CHECKBOX):\s*([^\]]+)\]/g;

export async function markdownToPdf(input: { title?: string; body: string }): Promise<RenderResult> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    code: await doc.embedFont(StandardFonts.Courier),
  };

  const placeholders: RenderedPlaceholder[] = [];
  const cursor = newPage(doc);

  if (input.title) {
    drawRichWrapped(cursor, input.title, { bold: true }, fonts, SIZE_H1);
    cursor.y -= 12;
  }

  // Normalise stray {{LABEL}} curly placeholders to bracket form first.
  const normalisedBody = input.body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, label: string) => {
    const cleaned = label.replace(/_/g, " ").trim();
    return `[TEXT: "${cleaned}", ${DEFAULT_ROLE}]`;
  });

  for (const block of splitBlocks(normalisedBody)) {
    renderBlock(doc, cursor, block, fonts, placeholders);
  }

  return {
    bytes: await doc.save(),
    placeholders,
    pageCount: doc.getPageCount(),
  };
}

function splitBlocks(body: string): string[] {
  // Preserve fenced code blocks as one block. Other blocks split on blank lines.
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let buf: string[] = [];
  let inFence = false;

  function flush() {
    if (buf.length === 0) return;
    blocks.push(buf.join("\n").trim());
    buf = [];
  }

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (inFence) {
        buf.push(line);
        flush();
        inFence = false;
      } else {
        flush();
        inFence = true;
        buf.push(line);
      }
      continue;
    }
    if (inFence) {
      buf.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks.filter((b) => b.length > 0);
}

function renderBlock(
  doc: PDFDocument,
  cursor: Cursor,
  block: string,
  fonts: Fonts,
  placeholders: RenderedPlaceholder[],
): void {
  if (block.length === 0) return;

  if (block.startsWith("### ")) {
    ensureRoom(doc, cursor, SIZE_H3 * LINE_HEIGHT);
    drawRichWrapped(cursor, block.slice(4), { bold: true }, fonts, SIZE_H3);
    cursor.y -= 6;
    return;
  }
  if (block.startsWith("## ")) {
    ensureRoom(doc, cursor, SIZE_H2 * LINE_HEIGHT);
    drawRichWrapped(cursor, block.slice(3), { bold: true }, fonts, SIZE_H2);
    cursor.y -= 8;
    return;
  }
  if (block.startsWith("# ")) {
    ensureRoom(doc, cursor, SIZE_H1 * LINE_HEIGHT);
    drawRichWrapped(cursor, block.slice(2), { bold: true }, fonts, SIZE_H1);
    cursor.y -= 10;
    return;
  }

  if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(block.trim())) {
    ensureRoom(doc, cursor, 16);
    cursor.y -= 8;
    cursor.page.drawLine({
      start: { x: MARGIN_X, y: cursor.y },
      end: { x: PAGE_W - MARGIN_X, y: cursor.y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    cursor.y -= 8;
    return;
  }

  if (block.startsWith("```")) {
    drawCodeBlock(doc, cursor, block, fonts);
    cursor.y -= 8;
    return;
  }

  if (isTableBlock(block)) {
    drawTable(doc, cursor, block, fonts, placeholders);
    return;
  }

  if (block.split(/\n+/).every((l) => l.trim().startsWith(">"))) {
    drawBlockquote(doc, cursor, block, fonts);
    cursor.y -= 6;
    return;
  }

  if (block.split(/\n+/).every((l) => /^[-*]\s+/.test(l.trim()))) {
    for (const line of block.split(/\n+/)) {
      const text = line.replace(/^[-*]\s+/, "");
      ensureRoom(doc, cursor, SIZE_BODY * LINE_HEIGHT);
      drawRichWrapped(cursor, text, {}, fonts, SIZE_BODY, MARGIN_X + 14, "•");
    }
    cursor.y -= 4;
    return;
  }

  if (block.split(/\n+/).every((l) => /^\d+\.\s+/.test(l.trim()))) {
    let n = 0;
    for (const line of block.split(/\n+/)) {
      n += 1;
      const text = line.replace(/^\d+\.\s+/, "");
      ensureRoom(doc, cursor, SIZE_BODY * LINE_HEIGHT);
      drawRichWrapped(cursor, text, {}, fonts, SIZE_BODY, MARGIN_X + 18, `${n}.`);
    }
    cursor.y -= 4;
    return;
  }

  drawParagraph(doc, cursor, block, fonts, placeholders);
  cursor.y -= 8;
}

function newPage(doc: PDFDocument): Cursor {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  return { page, y: PAGE_H - MARGIN_TOP, pageIndex: doc.getPageCount() - 1 };
}

function ensureRoom(doc: PDFDocument, cursor: Cursor, needed: number): void {
  if (cursor.y - needed < MARGIN_BOTTOM) {
    Object.assign(cursor, newPage(doc));
  }
}

// ---------- Inline parsing ----------

function parseInline(s: string): Run[] {
  const runs: Run[] = [];
  let buf = "";
  let bold = false;
  let italic = false;
  let code = false;
  let i = 0;

  function flush() {
    if (buf.length > 0) {
      runs.push({ text: buf, bold, italic, code });
      buf = "";
    }
  }

  while (i < s.length) {
    if (s[i] === "`") {
      flush();
      code = !code;
      i += 1;
      continue;
    }
    if (code) {
      buf += s[i];
      i += 1;
      continue;
    }
    if (s[i] === "[") {
      const m = /^\[([^\]\n]+)\]\(([^)\n]+)\)/.exec(s.slice(i));
      if (m) {
        flush();
        runs.push({ text: m[1]!, bold, italic, code: false, link: m[2] });
        i += m[0].length;
        continue;
      }
    }
    if (s.startsWith("***", i)) {
      flush();
      bold = !bold;
      italic = !italic;
      i += 3;
      continue;
    }
    if (s.startsWith("**", i)) {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if (s[i] === "*") {
      flush();
      italic = !italic;
      i += 1;
      continue;
    }
    buf += s[i];
    i += 1;
  }
  flush();
  return runs;
}

function fontFor(run: Run, base: BaseStyle, fonts: Fonts): PDFFont {
  if (run.code) return fonts.code;
  const bold = run.bold || Boolean(base.bold);
  const italic = run.italic || Boolean(base.italic);
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

interface SizedWord {
  text: string;
  run: Run;
  width: number;
  isWhitespace: boolean;
}

function wrapRuns(
  runs: Run[],
  base: BaseStyle,
  fonts: Fonts,
  size: number,
  maxWidth: number,
): Run[][] {
  const words: SizedWord[] = [];
  for (const run of runs) {
    const parts = run.text.split(/(\s+)/);
    for (const p of parts) {
      if (p.length === 0) continue;
      const f = fontFor(run, base, fonts);
      words.push({
        text: p,
        run,
        width: f.widthOfTextAtSize(p, size),
        isWhitespace: /^\s+$/.test(p),
      });
    }
  }

  const lines: SizedWord[][] = [];
  let line: SizedWord[] = [];
  let lineW = 0;
  for (const w of words) {
    if (lineW + w.width > maxWidth && line.length > 0) {
      while (line.length > 0 && line[line.length - 1]!.isWhitespace) {
        const popped = line.pop()!;
        lineW -= popped.width;
      }
      lines.push(line);
      line = [];
      lineW = 0;
      if (w.isWhitespace) continue;
    }
    line.push(w);
    lineW += w.width;
  }
  if (line.length > 0) lines.push(line);

  return lines.map((ws) => {
    const out: Run[] = [];
    for (const w of ws) {
      const last = out[out.length - 1];
      if (last && sameStyle(last, w.run)) {
        last.text += w.text;
      } else {
        out.push({ ...w.run, text: w.text });
      }
    }
    return out;
  });
}

function sameStyle(a: Run, b: Run): boolean {
  return (
    a.bold === b.bold && a.italic === b.italic && a.code === b.code && a.link === b.link
  );
}

function drawRichWrapped(
  cursor: Cursor,
  text: string,
  base: BaseStyle,
  fonts: Fonts,
  size: number,
  leftX = MARGIN_X,
  bullet?: string,
): void {
  const rightLimit = PAGE_W - MARGIN_X;
  const usableW = rightLimit - leftX;
  const lines = wrapRuns(parseInline(text), base, fonts, size, usableW);
  let firstLine = true;
  for (const line of lines) {
    if (cursor.y < MARGIN_BOTTOM + size) return;
    if (firstLine && bullet) {
      cursor.page.drawText(bullet, {
        x: leftX - 14,
        y: cursor.y - size,
        size,
        font: fonts.regular,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    drawLine(cursor, line, base, fonts, size, leftX);
    firstLine = false;
  }
}

function drawLine(
  cursor: Cursor,
  runs: Run[],
  base: BaseStyle,
  fonts: Fonts,
  size: number,
  leftX: number,
): void {
  let x = leftX;
  for (const run of runs) {
    const font = fontFor(run, base, fonts);
    const color = run.link ? rgb(0.13, 0.34, 0.84) : rgb(0, 0, 0);
    cursor.page.drawText(run.text, {
      x,
      y: cursor.y - size,
      size,
      font,
      color,
    });
    const w = font.widthOfTextAtSize(run.text, size);
    if (run.link) {
      cursor.page.drawLine({
        start: { x, y: cursor.y - size - 1 },
        end: { x: x + w, y: cursor.y - size - 1 },
        thickness: 0.4,
        color,
      });
    }
    x += w;
  }
  cursor.y -= size * LINE_HEIGHT;
}

// ---------- Block primitives ----------

function drawCodeBlock(doc: PDFDocument, cursor: Cursor, block: string, fonts: Fonts): void {
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trimStart().startsWith("```")) lines.shift();
  if (lines[lines.length - 1]?.trimStart().startsWith("```")) lines.pop();
  const padding = 8;
  const lineH = SIZE_CODE * LINE_HEIGHT;
  const blockH = lines.length * lineH + padding * 2;

  ensureRoom(doc, cursor, blockH + 4);
  const top = cursor.y;
  cursor.page.drawRectangle({
    x: MARGIN_X,
    y: top - blockH,
    width: PAGE_W - 2 * MARGIN_X,
    height: blockH,
    color: rgb(0.96, 0.96, 0.97),
    borderColor: rgb(0.85, 0.85, 0.87),
    borderWidth: 0.5,
  });
  cursor.y -= padding;
  for (const line of lines) {
    cursor.page.drawText(line, {
      x: MARGIN_X + padding,
      y: cursor.y - SIZE_CODE,
      size: SIZE_CODE,
      font: fonts.code,
      color: rgb(0.15, 0.15, 0.18),
    });
    cursor.y -= lineH;
  }
  cursor.y -= padding;
}

function drawBlockquote(doc: PDFDocument, cursor: Cursor, block: string, fonts: Fonts): void {
  const text = block
    .split(/\n+/)
    .map((l) => l.trim().replace(/^>\s?/, ""))
    .join(" ");
  ensureRoom(doc, cursor, SIZE_BODY * LINE_HEIGHT * 2);
  const top = cursor.y;
  drawRichWrapped(cursor, text, { italic: true }, fonts, SIZE_BODY, MARGIN_X + 14);
  cursor.page.drawLine({
    start: { x: MARGIN_X + 4, y: cursor.y + 4 },
    end: { x: MARGIN_X + 4, y: top - 2 },
    thickness: 2,
    color: rgb(0.78, 0.78, 0.82),
  });
}

// ---------- Placeholder paragraph drawing ----------

interface ParsedPlaceholder {
  kind: PlaceholderKind;
  label?: string;
  role: string;
}

function parseTokenPayload(type: string, payload: string): ParsedPlaceholder | null {
  const kind = TYPE_TO_KIND[type];
  if (!kind) return null;
  const trimmed = payload.trim();
  const quoted = trimmed.match(/^["'](.+)["']\s*,\s*(.+)$/);
  if (quoted) return { kind, label: quoted[1]!.trim(), role: quoted[2]!.trim() };
  if (kind === "signature" || kind === "initials" || kind === "date") {
    return { kind, role: trimmed };
  }
  const lastComma = trimmed.lastIndexOf(",");
  if (lastComma === -1) return { kind, role: DEFAULT_ROLE, label: trimmed };
  return {
    kind,
    label: trimmed.slice(0, lastComma).trim().replace(/^["']|["']$/g, ""),
    role: trimmed.slice(lastComma + 1).trim(),
  };
}

function drawParagraph(
  doc: PDFDocument,
  cursor: Cursor,
  block: string,
  fonts: Fonts,
  placeholders: RenderedPlaceholder[],
): void {
  const tokens: Array<
    | { kind: "text"; text: string }
    | { kind: "field"; field: ParsedPlaceholder }
  > = [];
  let lastIndex = 0;
  for (const match of block.matchAll(PLACEHOLDER_RE)) {
    if (match.index! > lastIndex) {
      tokens.push({ kind: "text", text: block.slice(lastIndex, match.index!) });
    }
    const parsed = parseTokenPayload(match[1]!, match[2]!);
    if (parsed) tokens.push({ kind: "field", field: parsed });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < block.length) {
    tokens.push({ kind: "text", text: block.slice(lastIndex) });
  }

  const proseOnly = tokens
    .filter((t): t is { kind: "text"; text: string } => t.kind === "text")
    .map((t) => t.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (proseOnly) {
    drawRichWrapped(cursor, proseOnly, {}, fonts, SIZE_BODY);
  }

  for (const t of tokens) {
    if (t.kind !== "field") continue;
    drawFieldPlaceholder(doc, cursor, t.field, placeholders);
  }
}

function drawFieldPlaceholder(
  doc: PDFDocument,
  cursor: Cursor,
  field: ParsedPlaceholder,
  placeholders: RenderedPlaceholder[],
): void {
  // No printed caption — the blank is left unlabeled in the document. The
  // field's label lives only in the editor/template metadata; if the author
  // wants a visible label in the document, they add it to the source text.
  ensureRoom(doc, cursor, 40);
  const { w, h } = FIELD_BOX[field.kind];

  const x = MARGIN_X;
  const yTop = cursor.y;

  if (field.kind === "checkbox") {
    cursor.page.drawRectangle({
      x,
      y: cursor.y - h,
      width: w,
      height: h,
      borderColor: rgb(0.4, 0.4, 0.4),
      borderWidth: 0.7,
    });
  } else {
    cursor.page.drawLine({
      start: { x, y: cursor.y - h },
      end: { x: x + w, y: cursor.y - h },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  placeholders.push({
    kind: field.kind,
    role: field.role,
    label: field.label,
    pageIndex: cursor.pageIndex,
    x: x / PAGE_W,
    y: (PAGE_H - yTop) / PAGE_H,
    w: w / PAGE_W,
    h: h / PAGE_H,
  });

  cursor.y -= h + 12;
}

// ---------- Table rendering ----------

function isSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  return t
    .replace(/^\||\|$/g, "")
    .split("|")
    .every((c) => /^[\s\-:]+$/.test(c) && c.trim().length > 0);
}

function isTableBlock(block: string): boolean {
  const lines = block.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;
  return lines.some(isSeparatorRow);
}

function parseTableData(block: string): { headers: string[]; rows: string[][] } {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  function cells(line: string): string[] {
    return line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  }

  const headers = cells(lines[0]!);
  // lines[1] is the separator row (|---|---|), skip it
  const rows = lines.slice(2).map(cells);
  return { headers, rows };
}

// A cell token is either a plain text segment or a parsed field placeholder.
type CellToken =
  | { kind: "text"; text: string }
  | { kind: "field"; parsed: ParsedPlaceholder };

// Split cell raw text (after <br>→\n normalisation) into a sequence of
// text/field tokens. Each token fits on one logical sub-line segment.
function tokeniseCellLine(line: string): CellToken[] {
  const out: CellToken[] = [];
  let lastIdx = 0;
  const re = /\[(SIGNATURE|INITIALS|DATE|TEXT|NUMBER|EMAIL|PHONE|CHECKBOX):\s*([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > lastIdx) {
      const t = line.slice(lastIdx, m.index).trim();
      if (t) out.push({ kind: "text", text: t });
    }
    const parsed = parseTokenPayload(m[1]!, m[2]!);
    if (parsed) out.push({ kind: "field", parsed });
    lastIdx = m.index + m[0].length;
  }
  const tail = line.slice(lastIdx).trim();
  if (tail) out.push({ kind: "text", text: tail });
  return out;
}

// Height (in raw points) that a single CellToken will consume.
function tokenHeight(tok: CellToken, base: BaseStyle, fonts: Fonts, textW: number): number {
  if (tok.kind === "field") return SIZE_BODY * LINE_HEIGHT * 1.8; // label + blank
  const lines = wrapRuns(parseInline(tok.text), base, fonts, SIZE_BODY, textW);
  return (lines.length || 1) * SIZE_BODY * LINE_HEIGHT;
}

function drawTable(
  doc: PDFDocument,
  cursor: Cursor,
  block: string,
  fonts: Fonts,
  placeholders: RenderedPlaceholder[],
): void {
  const { headers, rows } = parseTableData(block);
  const numCols = headers.length;
  if (numCols === 0) return;

  const availW = PAGE_W - 2 * MARGIN_X;
  const colW = availW / numCols;
  const cellPadX = 6;
  const cellPadY = 5;
  const textW = Math.max(colW - 2 * cellPadX, 20);
  const borderColor = rgb(0.76, 0.76, 0.8);

  // Expand a raw cell string into sub-line tokens, honouring <br> and \n.
  function cellTokens(raw: string, base: BaseStyle): CellToken[] {
    const subLines = raw.replace(/<br\s*\/?>/gi, "\n").split("\n");
    const out: CellToken[] = [];
    for (const sl of subLines) {
      const toks = tokeniseCellLine(sl);
      if (toks.length) out.push(...toks);
    }
    return out;
  }

  function calcRowHeight(cells: string[], isHeader: boolean): number {
    const base: BaseStyle = { bold: isHeader };
    let maxH = SIZE_BODY * LINE_HEIGHT; // at least one line
    for (let i = 0; i < numCols; i++) {
      const toks = cellTokens(cells[i] ?? "", base);
      const h = toks.reduce((s, t) => s + tokenHeight(t, base, fonts, textW), 0);
      if (h > maxH) maxH = h;
    }
    return maxH + 2 * cellPadY;
  }

  function drawRow(cells: string[], rowIndex: number): void {
    const isHeader = rowIndex === -1;
    const base: BaseStyle = { bold: isHeader };
    const rowH = calcRowHeight(cells, isHeader);

    ensureRoom(doc, cursor, rowH);
    const rowTop = cursor.y;

    const bg = isHeader
      ? rgb(0.18, 0.18, 0.2)
      : rowIndex % 2 === 0
        ? rgb(1, 1, 1)
        : rgb(0.965, 0.965, 0.975);

    cursor.page.drawRectangle({
      x: MARGIN_X,
      y: rowTop - rowH,
      width: availW,
      height: rowH,
      color: bg,
      borderColor,
      borderWidth: 0.5,
    });

    for (let i = 0; i < numCols; i++) {
      const cellLeft = MARGIN_X + i * colW;
      const blankX = cellLeft + cellPadX;

      if (i > 0) {
        cursor.page.drawLine({
          start: { x: cellLeft, y: rowTop },
          end: { x: cellLeft, y: rowTop - rowH },
          thickness: 0.5,
          color: borderColor,
        });
      }

      const toks = cellTokens(cells[i] ?? "", base);
      let textY = rowTop - cellPadY;

      for (const tok of toks) {
        if (tok.kind === "field" && !isHeader) {
          const { parsed } = tok;
          const labelSize = SIZE_BODY * 0.82;
          const labelY = textY - labelSize;
          const blankY = labelY - 4;

          if (parsed.label) {
            cursor.page.drawText(parsed.label, {
              x: blankX,
              y: labelY,
              size: labelSize,
              font: fonts.italic,
              color: rgb(0.45, 0.45, 0.5),
            });
          }
          cursor.page.drawLine({
            start: { x: blankX, y: blankY },
            end: { x: blankX + textW, y: blankY },
            thickness: 0.5,
            color: rgb(0.55, 0.55, 0.6),
          });

          placeholders.push({
            kind: parsed.kind,
            role: parsed.role,
            label: parsed.label,
            pageIndex: cursor.pageIndex,
            x: blankX / PAGE_W,
            y: (PAGE_H - textY) / PAGE_H,
            w: textW / PAGE_W,
            h: (SIZE_BODY * LINE_HEIGHT * 1.8) / PAGE_H,
          });

          textY -= SIZE_BODY * LINE_HEIGHT * 1.8;
        } else if (tok.kind === "text") {
          const wrappedLines = wrapRuns(parseInline(tok.text), base, fonts, SIZE_BODY, textW);
          for (const line of wrappedLines) {
            let x = blankX;
            for (const run of line) {
              const font = fontFor(run, base, fonts);
              cursor.page.drawText(run.text, {
                x,
                y: textY - SIZE_BODY,
                size: SIZE_BODY,
                font,
                color: isHeader ? rgb(1, 1, 1) : rgb(0.08, 0.08, 0.1),
              });
              x += font.widthOfTextAtSize(run.text, SIZE_BODY);
            }
            textY -= SIZE_BODY * LINE_HEIGHT;
          }
        }
      }
    }

    cursor.y -= rowH;
  }

  drawRow(headers, -1);
  rows.forEach((row, i) => drawRow(row, i));
  cursor.y -= 8;
}
