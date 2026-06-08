import type { DetectedField } from "./detect-fields";

/** One positioned text run in normalized [0,1] top-left coords. Structurally
 * compatible with @unisi/pdf's TextItem (extra props are ignored). */
export interface SnapTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapPage {
  pageIndex: number;
  items: SnapTextItem[];
}

type FieldType = DetectedField["type"];

interface Blank {
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Inferred field type, or null when only position is known. */
  type: FieldType | null;
  /** Source label text, used to disambiguate same-type blanks (Name vs Title). */
  label: string;
  used: boolean;
}

/** Default field heights (normalized) used when snapping. */
const FIELD_HEIGHT: Record<FieldType, number> = {
  signature: 0.035,
  initials: 0.03,
  date: 0.022,
  text: 0.022,
  number: 0.022,
  checkbox: 0.018,
};

/** Default widths (normalized) for blanks anchored to a bare "Label:". */
const LABEL_BLANK_WIDTH: Record<FieldType, number> = {
  signature: 0.18,
  initials: 0.14,
  date: 0.14,
  text: 0.2,
  number: 0.1,
  checkbox: 0.03,
};

/** Loose type inference from any nearby text (used for underline prefixes). */
function keywordType(label: string): FieldType | null {
  const s = label.toLowerCase();
  if (/\binitial/.test(s)) return "initials";
  if (/signature\b|\bsign here\b/.test(s)) return "signature";
  if (/\bdate\b/.test(s)) return "date";
  if (/name|title|print|company|witness|address|email|phone/.test(s)) return "text";
  if (/amount|number|\bno\.|qty|quantity|total/.test(s)) return "number";
  return null;
}

/**
 * Strict type for a BARE "Label:" anchor. Only recognizes text that is itself a
 * field label — this deliberately excludes section headers like "Signed:" (past
 * tense, not a field) so they don't become spurious signature targets.
 */
function labelBlankType(raw: string): FieldType | null {
  const s = raw
    .toLowerCase()
    .replace(/[:：*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (["signature", "sign", "sign here", "signed by"].includes(s)) return "signature";
  if (["initials", "initial"].includes(s)) return "initials";
  if (["date", "date signed", "dated"].includes(s)) return "date";
  if (
    [
      "name",
      "printed name",
      "print name",
      "full name",
      "title",
      "name / title",
      "name/title",
      "title / name",
      "email",
      "e-mail",
      "company",
      "organization",
      "organisation",
      "witness",
      "by",
    ].includes(s)
  )
    return "text";
  if (["amount", "number", "quantity"].includes(s)) return "number";
  return null;
}

/** Distinctive token for matching a field's label to a blank's label. */
function labelKey(s?: string): string | null {
  if (!s) return null;
  const t = s.toLowerCase();
  for (const k of [
    "signature",
    "initial",
    "date",
    "name",
    "title",
    "email",
    "phone",
    "company",
    "address",
    "witness",
    "amount",
  ]) {
    if (t.includes(k)) return k;
  }
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rowsOverlap(a: { y: number; h: number }, b: { y: number; h: number }): boolean {
  const ac = a.y + a.h / 2;
  const bc = b.y + b.h / 2;
  return Math.abs(ac - bc) < Math.max(a.h, b.h) * 0.8;
}

/**
 * Find blanks to snap fields onto:
 *   1. Underline runs (3+ underscores) — the explicit blank in "Signature: ___".
 *   2. Bare "Label:" anchors (e.g. "Date:") — a field-label line with nothing
 *      filled in; the field goes to the right of the colon.
 */
function findBlanks(page: SnapPage): Blank[] {
  const blanks: Blank[] = [];
  for (const it of page.items) {
    let hadUnderscore = false;
    const re = /_{3,}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(it.str)) !== null) {
      hadUnderscore = true;
      const start = m.index;
      const len = m[0].length;
      const total = it.str.length || 1;
      const x = it.x + it.w * (start / total);
      const w = it.w * (len / total);
      const prefix = it.str.slice(0, start);

      let type = keywordType(prefix);
      let label = prefix.trim();
      if (!type) {
        const left = page.items
          .filter((o) => o !== it && o.x + o.w <= x + 0.01 && rowsOverlap(o, it))
          .sort((a, b) => x - (b.x + b.w) - (x - (a.x + a.w)));
        for (const o of left) {
          const t = keywordType(o.str);
          if (t) {
            type = t;
            label = o.str.trim();
            break;
          }
        }
      }
      blanks.push({ pageIndex: page.pageIndex, x, y: it.y, w, h: it.h, type, label, used: false });
    }

    // Bare "Label:" — only when the whole item is a recognized field label.
    if (!hadUnderscore) {
      const trimmed = it.str.trim();
      if (/[:：]\s*$/.test(trimmed) && trimmed.length <= 24) {
        const type = labelBlankType(trimmed);
        if (type) {
          blanks.push({
            pageIndex: page.pageIndex,
            x: it.x + it.w + 0.006,
            y: it.y,
            w: LABEL_BLANK_WIDTH[type],
            h: it.h,
            type,
            label: trimmed,
            used: false,
          });
        }
      }
    }
  }
  return blanks;
}

/** Geometric cost: horizontal error weighted 2x so columns are respected. */
function geomCost(
  f: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const fcx = f.x + f.w / 2;
  const fcy = f.y + f.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  return 2 * Math.abs(fcx - bcx) + Math.abs(fcy - bcy);
}

/** Total score combines distance with a strong pull toward a matching label. */
function pairScore(field: DetectedField, blank: Blank): number {
  let score = geomCost(field, blank);
  const fk = labelKey(field.label);
  const bk = labelKey(blank.label);
  if (fk && bk) score += fk === bk ? -1 : 0.6;
  return score;
}

function snapTo(field: DetectedField, blank: Blank): DetectedField {
  const h = FIELD_HEIGHT[field.type] ?? 0.025;
  const bottom = blank.y + blank.h;
  const x = clamp(blank.x, 0, 1);
  const w = clamp(Math.max(blank.w, 0.06), 0.02, 1 - x);
  // Anchor the field's BOTTOM to the line so it sits on the blank.
  const y = clamp(bottom - h, 0, 1 - h);
  return { ...field, x, y, w, h };
}

/**
 * Reposition AI-detected fields onto the document's real labels/underlines.
 *
 * Vision is reliable about WHAT a field is and WHO it belongs to, but its
 * coordinates drift. We keep its type/role/label and snap each field onto the
 * best-matching blank, resolving ties by column and by the field's own label
 * (so "Name" and "Title" don't swap). Fields with no plausible blank keep their
 * detected position.
 */
export function snapDetectedFields(fields: DetectedField[], pages: SnapPage[]): DetectedField[] {
  const blanksByPage = new Map<number, Blank[]>();
  for (const p of pages) blanksByPage.set(p.pageIndex, findBlanks(p));

  const out = [...fields];
  const assigned = new Set<number>();

  // Pass 1 requires an exact type match; pass 2 falls back to untyped blanks.
  for (const requireTypeMatch of [true, false]) {
    const pairs: { fi: number; blank: Blank; score: number }[] = [];
    out.forEach((field, fi) => {
      if (assigned.has(fi)) return;
      const blanks = blanksByPage.get(field.pageIndex);
      if (!blanks) return;
      for (const blank of blanks) {
        if (blank.used) continue;
        const typeOk = requireTypeMatch ? blank.type === field.type : blank.type === null;
        if (!typeOk) continue;
        // Reject far / wrong-column blanks before the label bonus skews things.
        if (geomCost(field, blank) > 0.6) continue;
        pairs.push({ fi, blank, score: pairScore(field, blank) });
      }
    });
    pairs.sort((a, b) => a.score - b.score);
    for (const { fi, blank } of pairs) {
      if (blank.used || assigned.has(fi)) continue;
      out[fi] = snapTo(out[fi]!, blank);
      blank.used = true;
      assigned.add(fi);
    }
  }

  return out;
}
