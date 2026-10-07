import Link from "next/link";
import AboutMostViewed from "@/components/home/about-most-viewed";

const CSS = `
.about-page{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  background:var(--paper);color:var(--ink);min-height:100vh;
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.about-page *{box-sizing:border-box}
.about-display{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;letter-spacing:-.045em;line-height:1.05;color:var(--ink);
}

/* ================= HERO ================= */
.about-hero{
  position:relative;padding:64px 24px 56px;text-align:center;overflow:hidden;
  background:
    radial-gradient(900px 340px at 50% -20%,rgba(208,2,27,.055),transparent 60%),
    radial-gradient(1200px 500px at 50% 0%,rgba(10,10,10,.045),transparent 65%),
    linear-gradient(180deg,#fbfbf9 0%,#fff 100%);
  border-bottom:1px solid var(--line);
}
.about-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:
    linear-gradient(to right,rgba(10,10,10,.045) 1px,transparent 1px),
    linear-gradient(to bottom,rgba(10,10,10,.045) 1px,transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
}
.about-hero::after{
  content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);
  width:min(560px,70%);height:1px;
  background:linear-gradient(90deg,transparent,var(--red),transparent);opacity:.55;
}
.about-hero-inner{position:relative;max-width:1120px;margin:0 auto;z-index:1}

.about-crumbs{
  display:inline-flex;align-items:center;gap:8px;
  font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--muted);margin-bottom:22px;
}
.about-crumbs a{color:var(--ink);text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s}
.about-crumbs a:hover{border-color:var(--red)}

.about-eyebrow{
  display:inline-flex;align-items:center;gap:10px;
  font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0;
}
.about-eyebrow-line{display:inline-block;width:26px;height:1px;background:var(--red)}

.about-title{
  font-size:clamp(42px,7vw,92px);
  margin:14px 0 18px;
}
.about-title em{font-style:normal;color:var(--red);font-weight:500}

.about-lede{
  font-size:clamp(15px,1.4vw,17.5px);line-height:1.65;color:var(--muted);
  max-width:62ch;margin:0 auto;
}

/* ================= BODY ================= */
.about-body{
  max-width:760px;margin:0 auto;
  padding:64px 24px 32px;
  font-size:16.5px;line-height:1.75;color:var(--ink);
}
.about-body p{margin:0 0 1.15em}
.about-body strong{font-weight:600;color:var(--ink)}
.about-body a{
  color:var(--red);text-decoration:underline;text-underline-offset:3px;
  font-weight:600;
}
.about-body a:hover{color:#a3000f}

.about-body h2{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;font-size:clamp(22px,2.4vw,30px);letter-spacing:-.03em;
  line-height:1.15;color:var(--ink);
  margin:56px 0 16px;
  padding-top:24px;
  border-top:1px solid var(--line);
  position:relative;
}
.about-body h2::before{
  content:"";position:absolute;top:-1px;left:0;
  width:44px;height:2px;background:var(--red);
}
.about-body h2:first-of-type{margin-top:0;padding-top:0;border-top:0}
.about-body h2:first-of-type::before{display:none}

.about-body h3{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;font-size:clamp(17px,1.5vw,20px);letter-spacing:-.02em;
  color:var(--ink);margin:32px 0 12px;
}

.about-body ul{
  list-style:none;padding:0;margin:16px 0 24px;
  display:flex;flex-direction:column;gap:10px;
}
.about-body ul li{
  position:relative;padding:14px 18px 14px 40px;
  border:1px solid var(--line);border-radius:12px;background:var(--paper);
  font-size:15px;line-height:1.55;
}
.about-body ul li::before{
  content:"";position:absolute;left:18px;top:22px;
  width:8px;height:8px;border-radius:50%;background:var(--red);
}
.about-body ul li strong{
  display:inline-block;min-width:96px;
  font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--muted);font-weight:600;vertical-align:1px;
  margin-right:6px;
}

.about-email{
  display:inline-block;
  font-size:15px;
  padding:10px 16px;border-radius:10px;
  border:1px solid var(--line-strong);background:var(--paper-2);
  margin:6px 0 12px;
}

.about-footer-link{
  margin-top:56px;padding-top:24px;border-top:1px solid var(--line);
}
.about-footer-link a{
  display:inline-flex;align-items:center;gap:8px;
  color:var(--ink);text-decoration:none;
  font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  padding-bottom:4px;border-bottom:1px solid var(--line-strong);
  transition:color .2s,border-color .2s;
}
.about-footer-link a:hover{color:var(--red);border-color:var(--red)}

/* ================= RESPONSIVE ================= */
@media (max-width:640px){
  .about-hero{padding:48px 20px 40px}
  .about-body{padding:44px 20px 24px;font-size:16px}
  .about-body h2{margin:44px 0 14px;padding-top:20px}
  .about-body ul li{padding:12px 16px 12px 36px;font-size:14.5px}
  .about-body ul li::before{left:16px;top:20px}
  .about-body ul li strong{display:block;margin:0 0 4px}
}
`;

export default function AboutPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="about-page">
        {/* HERO */}
        <header className="about-hero">
          <div className="about-hero-inner">
            <nav className="about-crumbs">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span>About</span>
            </nav>

            <p className="about-eyebrow">
              <span className="about-eyebrow-line" />
              About Us
            </p>

            <h1 className="about-title about-display">
              About the <em>Ministry</em>
            </h1>

            <p className="about-lede">
              Faith of the Pioneers is an online fellowship devoted to studying Scripture and
              recovering the simple, Bible-centered faith of the early Adventist pioneers.
            </p>
          </div>
        </header>

        {/* BODY */}
        <section className="about-body">
          <h2>Faith of the Pioneers</h2>
          <p>
            <strong>Faith of the Pioneers</strong> is an online fellowship devoted to studying
            Scripture, sharing personal testimonies, and recovering the simple, Bible-centered
            faith of the early Adventist pioneers. Through live Zoom meetings and recorded
            messages, we seek to prepare hearts for the soon return of Jesus Christ.
          </p>

          <h2>Who We Are</h2>
          <p>
            Faith of the Pioneers began as a gathering place for believers who want to walk in the
            footsteps of the Advent movement&apos;s pioneers. Our focus is deep Bible study,
            especially the books of <strong>Daniel and Revelation</strong>, along with practical
            Christian living, health principles, marriage and family, and personal testimonies of
            God&apos;s leading.
          </p>

          <h2>Join Us Weekly</h2>
          <p>
            Believers from many countries meet every week to search the Scriptures, encourage one
            another, and hold fast to the truths that defined the pioneer era. Whoever hungers for
            present truth and sincere fellowship is welcome.
          </p>

          <h3>Meeting times (online via Zoom)</h3>
          <ul>
            <li>
              <strong>Sundays</strong>
              7:00 PM Norway time (10:00 AM California)
            </li>
            <li>
              <strong>Tuesdays</strong>
              7:00 PM Norway time (10:00 AM California)
            </li>
          </ul>

          <h2>How to Join</h2>
          <p>
            To protect our meetings and keep our fellowship peaceful, we share the meeting link
            privately. <strong>To join our online meetings, please request the link:</strong>
          </p>
          <p style={{ marginTop: 16 }}>
            <Link href="/meeting-link-request">Request the next Zoom meeting link</Link>
          </p>
          <p>
            <a href="mailto:birdmanjo@gmail.com" className="about-email">birdmanjo@gmail.com</a>
          </p>
          <p>
            Tell us your name and country, and our team will review your request.
          </p>

          <div className="about-footer-link">
            <Link href="/">← Back to home</Link>
          </div>
        </section>

        <AboutMostViewed />
      </main>
    </>
  );
}