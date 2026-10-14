/**
 * Minimal, dependency-free PDF writer.
 *
 * Produces a genuine, text-based (vector) PDF with embedded page layout using
 * the standard Helvetica fonts. It is intentionally small and only supports the
 * primitives needed by the fundamental-principles document: titles, headings,
 * body paragraphs, numbered markers, rules, spacing, headers, and footers.
 *
 * The output is a real downloadable PDF file (not a print or a scanned image).
 */

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = 70;

/** Helvetica AFM advance widths (1/1000 em) for ASCII 32..126. */
const HELVETICA_WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

export type Rgb = [number, number, number];

export const PDF_COLORS = {
  ink: [18, 21, 26] as Rgb,
  muted: [110, 117, 125] as Rgb,
  accent: [197, 28, 49] as Rgb,
  rule: [223, 226, 223] as Rgb,
  paper: [255, 255, 255] as Rgb,
};

type FontName = "F1" | "F2";

interface RunOptions {
  font?: FontName;
  size?: number;
  color?: Rgb;
  align?: "left" | "right" | "center";
  lineHeight?: number;
  indent?: number;
}

function toAscii(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function measure(text: string, size: number): number {
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    total += code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : 500;
  }
  return (total / 1000) * size;
}

function colorCommand(color: Rgb): string {
  const [r, g, b] = color.map((channel) => (channel / 255).toFixed(4));
  return `${r} ${g} ${b} rg`;
}

function num(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export class PdfBuilder {
  private readonly pages: string[][] = [[]];
  private y = PAGE_HEIGHT - MARGIN;

  constructor(
    private readonly footerLeft = "",
    private readonly header = "",
  ) {}

  private get current(): string[] {
    return this.pages[this.pages.length - 1];
  }

  private newPage(): void {
    this.pages.push([]);
    this.y = PAGE_HEIGHT - MARGIN - 10;
  }

  private ensure(height: number): void {
    if (this.y - height < BOTTOM_LIMIT) this.newPage();
  }

  private draw(text: string, x: number, y: number, options: RunOptions = {}): void {
    const font = options.font ?? "F1";
    const size = options.size ?? 10.5;
    const color = options.color ?? PDF_COLORS.ink;
    const content = escapeText(toAscii(text));
    this.current.push(
      `BT ${colorCommand(color)} /${font} ${num(size)} Tf ${num(x)} ${num(y)} Td (${content}) Tj ET`,
    );
  }

  private wrap(text: string, size: number, width: number): string[] {
    const words = toAscii(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size) <= width || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  private write(text: string, options: RunOptions = {}): void {
    const size = options.size ?? 10.5;
    const lineHeight = options.lineHeight ?? size * 1.5;
    const indent = options.indent ?? 0;
    const width = CONTENT_WIDTH - indent;
    const lines = this.wrap(text, size, width);
    for (const line of lines) {
      this.ensure(lineHeight);
      let x = MARGIN + indent;
      if (options.align === "center") x = MARGIN + indent + (width - measure(line, size)) / 2;
      if (options.align === "right") x = MARGIN + indent + width - measure(line, size);
      this.draw(line, x, this.y, options);
      this.y -= lineHeight;
    }
  }

  spacer(height: number): this {
    this.ensure(height);
    this.y -= height;
    return this;
  }

  rule(color: Rgb = PDF_COLORS.rule, thickness = 0.8): this {
    this.ensure(14);
    this.y -= 6;
    this.current.push(
      `${colorCommand(color)} ${num(thickness)} w ${num(MARGIN)} ${num(this.y)} m ${num(PAGE_WIDTH - MARGIN)} ${num(this.y)} l S`,
    );
    this.y -= 8;
    return this;
  }

  eyebrow(text: string): this {
    this.write(text.toUpperCase(), { font: "F2", size: 9, color: PDF_COLORS.accent, lineHeight: 14 });
    return this;
  }

  title(text: string): this {
    this.ensure(40);
    this.write(text, { font: "F2", size: 26, color: PDF_COLORS.ink, lineHeight: 31 });
    return this;
  }

  subtitle(text: string): this {
    this.write(text, { size: 11, color: PDF_COLORS.muted, lineHeight: 17 });
    return this;
  }

  heading(text: string): this {
    this.ensure(30);
    this.y -= 4;
    this.write(text, { font: "F2", size: 13, color: PDF_COLORS.ink, lineHeight: 18 });
    this.y -= 2;
    return this;
  }

  paragraph(text: string, options: RunOptions = {}): this {
    this.write(text, options);
    return this;
  }

  /** A proposition rendered as a hanging-indent marker plus its body. */
  proposition(numeral: string, paragraphs: string[]): this {
    const markerWidth = 34;
    this.ensure(18);
    const markerY = this.y;
    this.y -= 2;
    this.draw(`${numeral}.`, MARGIN, markerY, {
      font: "F2",
      size: 10.5,
      color: PDF_COLORS.accent,
    });
    for (const paragraph of paragraphs) {
      this.write(paragraph, { indent: markerWidth });
      this.y -= 4;
    }
    this.y -= 5;
    return this;
  }

  build(): Uint8Array {
    this.decoratePages();
    return new TextEncoder().encode(this.assemble());
  }

  private decoratePages(): void {
    const total = this.pages.length;
    this.pages.forEach((commands, index) => {
      if (index > 0 && this.header) {
        commands.push(
          `BT ${colorCommand(PDF_COLORS.muted)} /F1 8 Tf ${num(MARGIN)} ${num(PAGE_HEIGHT - MARGIN + 4)} Td (${escapeText(toAscii(this.header))}) Tj ET`,
        );
      }
      commands.push(
        `${colorCommand(PDF_COLORS.rule)} 0.8 w ${num(MARGIN)} 52 m ${num(PAGE_WIDTH - MARGIN)} 52 l S`,
      );
      if (this.footerLeft) {
        commands.push(
          `BT ${colorCommand(PDF_COLORS.muted)} /F1 8 Tf ${num(MARGIN)} 40 Td (${escapeText(toAscii(this.footerLeft))}) Tj ET`,
        );
      }
      const pageLabel = `Page ${index + 1} of ${total}`;
      const labelWidth = measure(pageLabel, 8);
      commands.push(
        `BT ${colorCommand(PDF_COLORS.muted)} /F1 8 Tf ${num(PAGE_WIDTH - MARGIN - labelWidth)} 40 Td (${escapeText(pageLabel)}) Tj ET`,
      );
    });
  }

  private assemble(): string {
    const objects: { id: number; body: string }[] = [
      { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
      { id: 3, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
      { id: 4, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>" },
    ];

    const pageIds: number[] = [];
    let nextId = 5;
    for (const commands of this.pages) {
      const pageId = nextId;
      const contentId = nextId + 1;
      nextId += 2;
      pageIds.push(pageId);
      const content = commands.join("\n");
      objects.push({
        id: pageId,
        body:
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      });
      objects.push({
        id: contentId,
        body: `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      });
    }

    objects.push({
      id: 2,
      body: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    });
    objects.sort((a, b) => a.id - b.id);

    let output = "%PDF-1.4\n";
    const offsets: Record<number, number> = {};
    for (const object of objects) {
      offsets[object.id] = output.length;
      output += `${object.id} 0 obj\n${object.body}\nendobj\n`;
    }

    const xrefStart = output.length;
    const size = objects.length + 1;
    output += `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (const object of objects) {
      output += `${String(offsets[object.id]).padStart(10, "0")} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return output;
  }
}
