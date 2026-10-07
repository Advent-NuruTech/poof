import Link from "next/link";

const CSS = `
.zm-footer{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  position:relative;overflow:hidden;
  background:
    radial-gradient(900px 300px at 50% 120%,rgba(208,2,27,.05),transparent 60%),
    linear-gradient(180deg,#fbfbf9 0%,#fff 100%);
  border-top:1px solid var(--line);
  color:var(--ink);
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.zm-footer *{box-sizing:border-box}
.zm-footer::before{
  content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:min(560px,70%);height:1px;
  background:linear-gradient(90deg,transparent,var(--red),transparent);opacity:.55;
}
.zm-footer-inner{
  position:relative;z-index:1;
  max-width:1120px;margin:0 auto;
  padding:56px 24px 40px;
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  gap:32px;
}

/* Eyebrow-ish copyright */
.zm-footer-copy{
  font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--muted);font-weight:600;margin:0;
  display:inline-flex;align-items:center;gap:10px;
}
.zm-footer-copy::before{
  content:"";display:inline-block;width:20px;height:1px;background:var(--red);
}

/* Link rail */
.zm-footer-links{
  display:flex;align-items:center;justify-content:center;
  gap:8px;flex-wrap:wrap;
}
.zm-footer-links a{
  font-size:12.5px;letter-spacing:.02em;
  color:var(--ink);text-decoration:none;
  padding:9px 16px;border-radius:999px;
  border:1px solid transparent;
  transition:background .2s,color .2s,border-color .2s,transform .15s;
  white-space:nowrap;
}
.zm-footer-links a:hover{
  border-color:var(--line-strong);
  background:var(--paper);
  transform:translateY(-1px);
}
.zm-footer-links a:focus-visible{
  outline:0;border-color:var(--ink);
  box-shadow:0 0 0 4px rgba(208,2,27,.10);
}

/* Powered by — fine print + typing animation, clickable to WhatsApp */
.zm-powered{
  justify-self:end;
  display:inline-flex;align-items:center;gap:6px;
  font-size:9px;
  letter-spacing:.14em;
  text-transform:uppercase;
  color:var(--muted-2);
  font-weight:500;
  border:1px solid var(--line);
  border-radius:999px;
  padding:6px 11px;
  background:var(--paper);
  text-decoration:none;
  cursor:pointer;
  transition:border-color .2s,color .2s,transform .15s,box-shadow .25s;
}
.zm-powered:hover{
  border-color:var(--line-strong);
  color:var(--muted);
  transform:translateY(-1px);
  box-shadow:0 10px 30px -14px rgba(10,10,10,.18);
}
.zm-powered:focus-visible{
  outline:0;border-color:var(--ink);
  box-shadow:0 0 0 4px rgba(208,2,27,.10);
}
.zm-powered-dot{
  width:5px;height:5px;border-radius:50%;background:var(--red);
  display:inline-block;flex:0 0 auto;
}

/* Typewriter — loops forever, types the FULL text, then deletes */
.zm-typer{
  display:inline-block;
  overflow:hidden;
  white-space:nowrap;
  vertical-align:bottom;
  /* 22 characters in "Powered by Advent Nurutech" */
  width:0;
  border-right:1px solid var(--muted-2);
  padding-right:1px;
  animation:
    zm-type 2.6s steps(22, end) 0.4s infinite,
    zm-blink 1s step-end infinite;
}

/* Type in, hold, delete out, pause — then repeat */
@keyframes zm-type{
  0%      { width:0; }
  45%     { width:22ch; }   /* fully typed */
  55%     { width:22ch; }   /* hold for a beat */
  100%    { width:0; }      /* delete back to nothing */
}
@keyframes zm-blink{
  0%,100%{ border-color:var(--muted-2); }
  50%    { border-color:transparent; }
}

@media (prefers-reduced-motion: reduce){
  .zm-typer{
    animation:none;
    width:auto;
    border-right:0;
  }
}

/* Divider row */
.zm-footer-bottom{
  position:relative;z-index:1;
  max-width:1120px;margin:0 auto;
  padding:0 24px 32px;
  display:flex;align-items:center;justify-content:space-between;
  gap:16px;flex-wrap:wrap;
  font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted-2);font-weight:500;
}
.zm-footer-dot{
  width:3px;height:3px;border-radius:50%;background:var(--muted-2);
  display:inline-block;margin:0 8px;vertical-align:middle;
}

@media (max-width:900px){
  .zm-footer-inner{
    grid-template-columns:1fr;
    justify-items:center;text-align:center;
    padding:44px 20px 28px;gap:22px;
  }
  .zm-footer-links{justify-content:center}
  .zm-powered{justify-self:center}
}
@media (max-width:720px){
  .zm-footer{padding-bottom:calc(24px + env(safe-area-inset-bottom))}
  .zm-footer-links{gap:4px}
  .zm-footer-links a{padding:8px 12px;font-size:12px}
  .zm-footer-bottom{justify-content:center;text-align:center}
}
`;

const ADVENT_WHATSAPP = "254142225233";
const ADVENT_MESSAGE =
  "Hi Advent Nurutech, I'm from POF website. I would like your services.";

/** Shared footer links and ministry attribution for public pages. */
export default function SiteFooter() {
  const whatsappHref = `https://wa.me/${ADVENT_WHATSAPP}?text=${encodeURIComponent(
    ADVENT_MESSAGE
  )}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <footer className="zm-footer" role="contentinfo">
        <div className="zm-footer-inner">
          <p className="zm-footer-copy">
            © 2026 Pioneers Of Our Faith
          </p>

          <nav className="zm-footer-links" aria-label="Footer navigation">
            <Link href="/doctrine/fundermentalprinciples">Fundamental Principles</Link>
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms-of-use">Terms of Use</Link>
            <Link href="/cookies-policy">Cookies Policy</Link>
            <Link href="/contact">Contact us</Link>
          </nav>

          <a
            className="zm-powered"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with Advent Nurutech on WhatsApp"
            title="Chat with Advent Nurutech on WhatsApp"
          >
            <span className="zm-powered-dot" aria-hidden="true" />
            <span className="zm-typer" aria-hidden="true">
              Powered by Advent Nurutech
            </span>
          </a>
        </div>

        <div className="zm-footer-bottom">
          <span>
            All rights reserved
            <span className="zm-footer-dot" aria-hidden="true" />
          
          </span>
          <span>Faith of the Pioneers</span>
        </div>
      </footer>
    </>
  );
}