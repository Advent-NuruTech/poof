import Link from "next/link";
import {
  FUNDAMENTAL_PRINCIPLES_DOC_1872,
  type FundamentalPrinciplesDoc,
} from "@/lib/fundamental-principles";
import { FUNDAMENTAL_PRINCIPLES_DOC_1889 } from "@/lib/fundamental-principles-1889";

const DOCS: FundamentalPrinciplesDoc[] = [
  FUNDAMENTAL_PRINCIPLES_DOC_1872,
  FUNDAMENTAL_PRINCIPLES_DOC_1889,
];

const CSS = `
.fp-body{max-width:760px;margin:40px auto 0}
.fp-doc+.fp-doc{margin-top:72px;padding-top:40px;border-top:2px solid var(--line)}
.fp-doc-head{display:flex;align-items:flex-start;gap:20px}
.fp-year{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:76px;padding:8px 14px;border-radius:10px;background:var(--red);color:#fff;font-family:"Times New Roman",Georgia,serif;font-size:20px;font-weight:700;letter-spacing:.5px;box-shadow:0 12px 26px -16px rgba(197,28,49,.85)}
.fp-doc-titles{flex:1 1 auto;min-width:0}
.fp-doc-titles h2{font-size:clamp(20px,3vw,26px);letter-spacing:-.6px;margin:2px 0 4px}
.fp-doc-titles p{margin:0;font-size:13.5px;line-height:1.6;color:var(--muted)}
.fp-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:20px}
.fp-download{display:inline-flex;align-items:center;gap:10px;background:var(--red);color:#fff;border-radius:999px;padding:13px 22px;font-size:14px;font-weight:700;letter-spacing:.2px;box-shadow:0 12px 26px -14px rgba(197,28,49,.75);transition:transform .15s ease,background .2s ease}
.fp-download:hover{background:#a5162a;transform:translateY(-1px)}
.fp-download svg{width:16px;height:16px;flex:none}
.fp-note{font-size:12px;color:var(--muted);max-width:330px;line-height:1.5}
.fp-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.fp-preamble{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--red);border-radius:12px;padding:22px 24px;margin-top:26px}
.fp-preamble p{margin:0 0 12px;font-size:14.5px;line-height:1.75;color:#3a4048}
.fp-preamble p:last-child{margin-bottom:0}
.fp-section-title{font-size:clamp(22px,3.5vw,30px);letter-spacing:-.8px;margin:42px 0 6px}
.fp-list{list-style:none;margin:14px 0 0;padding:0}
.fp-item{display:grid;grid-template-columns:56px minmax(0,1fr);gap:18px;padding:22px 0;border-top:1px solid var(--line)}
.fp-numeral{font-family:"Times New Roman",Georgia,serif;font-size:18px;font-weight:700;color:var(--red);letter-spacing:.5px;padding-top:2px}
.fp-text p{margin:0 0 10px;font-size:14.5px;line-height:1.78;color:#2b3038}
.fp-text p:last-child{margin-bottom:0}
.fp-closing{margin:34px 0 0;padding:20px 24px;border-left:3px solid var(--red);background:var(--surface);border-radius:0 12px 12px 0}
.fp-closing p{margin:0 0 8px;font-family:"Times New Roman",Georgia,serif;font-size:16px;font-style:italic;line-height:1.6;color:#2b3038}
.fp-closing cite{font-size:12px;font-style:normal;font-weight:700;letter-spacing:.4px;color:var(--red)}
.fp-foot{margin:34px 0 0;padding-top:20px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);line-height:1.6}
@media(max-width:600px){
  .fp-doc-head{flex-direction:column;gap:12px}
  .fp-item{grid-template-columns:1fr;gap:6px}
  .fp-numeral{padding-top:0}
  .fp-preamble{padding:18px 18px}
}
`;

function DocSection({ doc }: { doc: FundamentalPrinciplesDoc }) {
  const pdfHref = `/api/doctrine/fundamental-principles/pdf?year=${doc.year}`;
  const downloadName = `fundamental-principles-${doc.year}.pdf`;

  return (
    <article className="fp-doc" aria-label={`Fundamental Principles ${doc.year}`}>
      <div className="fp-doc-head">
        <span className="fp-year" aria-hidden="true">{doc.year}</span>
        <div className="fp-doc-titles">
          <h2>{doc.title}</h2>
          <p>{doc.subtitle}</p>
        </div>
      </div>

      <div className="fp-actions">
        <a className="fp-download" href={pdfHref} download={downloadName}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m6 11 6 6 6-6" />
            <path d="M5 21h14" />
          </svg>
          Download PDF
        </a>
        <span className="fp-note">
          A clean, text-based PDF you can save and read anywhere — no printing or scanning needed.
        </span>
      </div>

      <div className="fp-preamble">
        {doc.preamble.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {doc.leadIn ? <p><em>{doc.leadIn}</em></p> : null}
      </div>

      <h3 className="fp-section-title">The Propositions</h3>

      <ol className="fp-list">
        {doc.propositions.map((principle) => (
          <li className="fp-item" key={principle.numeral}>
            <span className="fp-numeral" aria-hidden="true">{principle.numeral}</span>
            <div className="fp-text">
              <span className="fp-sr">Proposition {principle.numeral}. </span>
              {principle.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {doc.closing ? (
        <blockquote className="fp-closing">
          <p>{doc.closing.text}</p>
          <cite>{doc.closing.cite}</cite>
        </blockquote>
      ) : null}

      <p className="fp-foot">{doc.source}</p>
    </article>
  );
}

export default function FundamentalPrinciplesPage() {
  return (
    <main className="doctrine-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="doctrine-header">
        <Link href="/">← Back to home</Link>
        <span>OUR FAITH</span>
        <h1>Fundamental Principles</h1>
        <p>
          The declarations of the fundamental principles taught and practiced by the
          Seventh-day Adventists, presented here in their original 1872 form and as
          revised in 1889 for the SDA Year Books.
        </p>
      </header>

      <section className="fp-body" aria-label="Fundamental Principles">
        {DOCS.map((doc) => (
          <DocSection key={doc.year} doc={doc} />
        ))}
      </section>
    </main>
  );
}
