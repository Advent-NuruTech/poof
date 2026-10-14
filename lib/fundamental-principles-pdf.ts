import {
  FUNDAMENTAL_PRINCIPLES_DOC_1872,
  type FundamentalPrinciplesDoc,
} from "./fundamental-principles";
import { FUNDAMENTAL_PRINCIPLES_DOC_1889 } from "./fundamental-principles-1889";
import { PdfBuilder } from "./pdf";

/** Every published edition of the Fundamental Principles, in order. */
export const FUNDAMENTAL_PRINCIPLES_DOCS: FundamentalPrinciplesDoc[] = [
  FUNDAMENTAL_PRINCIPLES_DOC_1872,
  FUNDAMENTAL_PRINCIPLES_DOC_1889,
];

/** Resolves an edition by year, defaulting to the 1872 declaration. */
export function getFundamentalPrinciplesDoc(
  year?: string | null,
): FundamentalPrinciplesDoc | undefined {
  if (!year) return FUNDAMENTAL_PRINCIPLES_DOC_1872;
  return FUNDAMENTAL_PRINCIPLES_DOCS.find((doc) => doc.year === year);
}

/** Builds the styled, text-based PDF for a Fundamental Principles edition. */
export function buildFundamentalPrinciplesPdf(
  doc: FundamentalPrinciplesDoc = FUNDAMENTAL_PRINCIPLES_DOC_1872,
): Uint8Array {
  const pdf = new PdfBuilder(
    "faithofthepioneers.org",
    `${doc.title} (${doc.year}) - Pioneers Of Our Faith`,
  );

  pdf.eyebrow(`Our Faith · ${doc.year}`);
  pdf.title(doc.title);
  pdf.subtitle(doc.subtitle);
  pdf.rule();

  for (const paragraph of doc.preamble) {
    pdf.paragraph(paragraph, { size: 10.5, lineHeight: 15.5 });
    pdf.spacer(6);
  }

  if (doc.leadIn) {
    pdf.paragraph(doc.leadIn, { font: "F2", size: 10.5, lineHeight: 15.5 });
  }

  pdf.spacer(6);
  pdf.heading("The Propositions");
  pdf.spacer(4);

  for (const proposition of doc.propositions) {
    pdf.proposition(proposition.numeral, proposition.paragraphs);
  }

  if (doc.closing) {
    pdf.spacer(8);
    pdf.paragraph(doc.closing.text, { size: 10.5, lineHeight: 15.5 });
    pdf.paragraph(doc.closing.cite, { size: 10 });
  }

  return pdf.build();
}
