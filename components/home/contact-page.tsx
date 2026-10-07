"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { db } from "@/lib/firebase";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";

const emptyForm = { name: "", email: "", phone: "", message: "" };
const ministryEmail = "birdmanjo@gmail.com";
type ContactPageProps = { mode?: "contact" | "prayer" | "meeting-link" };

const CSS = `
.zm-page{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  background:var(--paper);color:var(--ink);min-height:100vh;
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.zm-page *{box-sizing:border-box}
.zm-display{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;letter-spacing:-.045em;line-height:.95;color:var(--ink);
}
.zm-eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0}
.zm-eyebrow-line{display:inline-block;width:26px;height:1px;background:var(--red)}
.zm-dot{width:3px;height:3px;border-radius:50%;background:var(--muted-2);display:inline-block}

/* HERO */
.zm-hero{
  position:relative;padding:64px 24px 48px;text-align:center;overflow:hidden;
  background:
    radial-gradient(900px 340px at 50% -20%,rgba(208,2,27,.06),transparent 60%),
    radial-gradient(1200px 500px at 50% 0%,rgba(10,10,10,.05),transparent 65%),
    linear-gradient(180deg,#fbfbf9 0%,#fff 100%);
  border-bottom:1px solid var(--line);
}
.zm-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:
    linear-gradient(to right,rgba(10,10,10,.045) 1px,transparent 1px),
    linear-gradient(to bottom,rgba(10,10,10,.045) 1px,transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
}
.zm-hero::after{
  content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);
  width:min(560px,70%);height:1px;
  background:linear-gradient(90deg,transparent,var(--red),transparent);opacity:.55;
}
.zm-hero-inner{position:relative;max-width:1120px;margin:0 auto;z-index:1}
.zm-crumbs{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:22px}
.zm-crumbs a{color:var(--ink);text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s}
.zm-crumbs a:hover{border-color:var(--red)}
.zm-title{font-size:clamp(44px,7.5vw,100px);margin:14px 0 18px}
.zm-title em{font-style:normal;color:var(--red);font-weight:500}
.zm-lede{font-size:clamp(15px,1.3vw,17px);line-height:1.6;color:var(--muted);max-width:56ch;margin:0 auto 32px}
.zm-hero-meta{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:22px;font-size:12.5px;color:var(--muted);letter-spacing:.02em}
.zm-hero-meta strong{color:var(--ink);font-weight:600}

/* MODE NAV */
.zm-mode-wrap{
  position:sticky;top:0;z-index:50;
  padding:14px 24px;
  background:rgba(255,255,255,.82);
  backdrop-filter:blur(16px) saturate(140%);
  -webkit-backdrop-filter:blur(16px) saturate(140%);
  box-shadow:0 1px 0 rgba(10,10,10,.06),0 14px 40px -28px rgba(10,10,10,.35);
  border-bottom:1px solid var(--line);
}
.zm-mode-nav{
  max-width:1120px;margin:0 auto;
  display:flex;align-items:center;gap:8px;
  overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;
}
.zm-mode-nav::-webkit-scrollbar{display:none}
.zm-chip{
  flex:0 0 auto;
  border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);
  padding:9px 16px;border-radius:999px;font:inherit;font-size:12.5px;letter-spacing:.02em;
  cursor:pointer;white-space:nowrap;
  display:inline-flex;align-items:center;gap:8px;
  transition:background .2s,color .2s,border-color .2s,transform .15s;
  text-decoration:none;
}
.zm-chip:hover{border-color:var(--ink);transform:translateY(-1px)}
.zm-chip.is-active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.zm-chip.is-active::before{
  content:"";display:inline-block;width:6px;height:6px;background:var(--red);
  border-radius:50%;transform:translateY(-1px);
}

/* SECTION */
.zm-section{max-width:1120px;margin:0 auto;padding:56px 24px 40px}
.zm-results-count{
  max-width:1120px;margin:8px auto 0;padding:0 24px;
  font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600;
}
.zm-results-count::before{
  content:"";display:inline-block;width:20px;height:1px;background:var(--red);
  vertical-align:middle;margin-right:10px;transform:translateY(-1px);
}

/* FORM CARD */
.zm-form-card{
  max-width:720px;margin:0 auto;
  background:var(--paper);
  border:1px solid var(--line);
  border-radius:14px;
  padding:40px;
  box-shadow:0 1px 2px rgba(10,10,10,.04);
  transition:box-shadow .25s,border-color .25s;
}
.zm-form-card:hover{
  border-color:var(--line-strong);
  box-shadow:0 10px 30px -12px rgba(10,10,10,.18);
}

.zm-form{display:flex;flex-direction:column;gap:22px}
.zm-field{display:flex;flex-direction:column;gap:8px}
.zm-field label{
  font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;
  color:var(--muted);display:flex;align-items:center;gap:8px;
}
.zm-field label span{
  font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:500;
  color:var(--muted-2);border:1px solid var(--line);border-radius:999px;padding:2px 8px;
}
.zm-field input,
.zm-field textarea{
  font:inherit;font-size:15px;color:var(--ink);
  background:var(--paper);border:1px solid var(--line-strong);
  border-radius:10px;padding:14px 16px;
  outline:0;width:100%;
  transition:border-color .2s,box-shadow .2s;
}
.zm-field input::placeholder,
.zm-field textarea::placeholder{color:var(--muted-2)}
.zm-field input:focus,
.zm-field textarea:focus{
  border-color:var(--ink);
  box-shadow:0 0 0 4px rgba(208,2,27,.10);
}
.zm-field textarea{resize:vertical;min-height:140px;line-height:1.6}

.zm-submit{
  border:1px solid var(--ink);background:var(--ink);color:var(--paper);
  padding:16px 28px;border-radius:999px;font:inherit;font-size:13px;
  letter-spacing:.06em;text-transform:uppercase;font-weight:600;
  cursor:pointer;align-self:flex-start;
  display:inline-flex;align-items:center;gap:10px;
  transition:background .2s,color .2s,transform .15s,box-shadow .25s;
}
.zm-submit:hover:not(:disabled){
  transform:translateY(-2px);
  box-shadow:0 10px 30px -12px rgba(10,10,10,.35);
}
.zm-submit:disabled{opacity:.5;cursor:not-allowed}
.zm-submit::after{content:"→";font-size:16px;transition:transform .2s}
.zm-submit:hover:not(:disabled)::after{transform:translateX(4px)}

.zm-notice{
  font-size:13px;line-height:1.5;padding:14px 16px;border-radius:10px;
  border:1px solid var(--line);background:var(--paper-2);color:var(--ink);
  margin:0;
}
.zm-notice.is-error{
  border-color:rgba(208,2,27,.35);background:rgba(208,2,27,.05);color:var(--red);
}

/* SUCCESS */
.zm-success{
  max-width:720px;margin:0 auto;text-align:center;
  background:linear-gradient(180deg,#fbfbf9,#fff);
  border:1px dashed var(--line-strong);border-radius:16px;
  padding:64px 40px;
}
.zm-success-icon{
  width:56px;height:56px;border-radius:50%;
  border:1px solid var(--line-strong);background:var(--paper);
  display:inline-grid;place-items:center;margin-bottom:24px;
  position:relative;
}
.zm-success-icon::before{
  content:"";position:absolute;inset:-6px;border-radius:50%;
  border:1px solid var(--red);opacity:.35;
  animation:zm-pulse 2s ease-in-out infinite;
}
.zm-success-icon svg{width:24px;height:24px;color:var(--red)}
@keyframes zm-pulse{
  0%,100%{transform:scale(1);opacity:.35}
  50%{transform:scale(1.25);opacity:0}
}
.zm-success h2{
  font-family:"Helvetica Neue",Helvetica,Inter,sans-serif;
  font-weight:500;font-size:clamp(24px,2.6vw,34px);
  letter-spacing:-.03em;margin:0 0 14px;line-height:1.05;
}
.zm-success p{font-size:15px;line-height:1.6;color:var(--muted);margin:0 0 32px}

/* RESPONSIVE */
@media (max-width:720px){
  .zm-page{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
  .zm-hero{padding:44px 20px 32px}
  .zm-section{padding:36px 20px 24px}
  .zm-form-card{padding:28px 22px}
  .zm-success{padding:48px 24px}
}
`;

export default function ContactPage({ mode = "contact" }: ContactPageProps) {
  const isPrayer = mode === "prayer";
  const isMeetingLink = mode === "meeting-link";
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const eyebrow = isMeetingLink
    ? "Zoom Link Request"
    : isPrayer
    ? "Prayer Request"
    : "Contact";

  const heading = isMeetingLink ? (
    <>
      Join our next <em>Zoom</em> meeting
    </>
  ) : isPrayer ? (
    <>
      Share a <em>prayer</em> request
    </>
  ) : (
    <>
      Get in <em>touch</em>
    </>
  );

  const intro = isMeetingLink
    ? "Request the private link for an upcoming online meeting. Tell us a little about yourself and our team will be in touch."
    : isPrayer
    ? "Tell us how we can pray with you. Your request will be received privately by our team."
    : "Send us a message and our team will be in touch.";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const name = form.name.trim();
      const email = form.email.trim();
      const phone = form.phone.trim();
      const message = form.message.trim();
      await addDoc(collection(db, "contacts"), {
        category: mode,
        name,
        email,
        phone,
        message,
        createdAt: serverTimestamp(),
      });
      if (isMeetingLink) {
        const subject = "Zoom meeting link request - Faith of the Pioneers";
        const body = `Hello,\n\nI am from Faith of the Pioneers and would like to request the next Zoom meeting link.\n\nName: ${name}\nEmail: ${email}\nWhatsApp number: ${phone}\nMessage: ${message}`;
        window.location.href = `mailto:${ministryEmail}?subject=${encodeURIComponent(
          subject
        )}&body=${encodeURIComponent(body)}`;
        return;
      }
      setForm(emptyForm);
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your request could not be sent. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const successTitle = isMeetingLink
    ? "Request received"
    : isPrayer
    ? "Prayer request received"
    : "Message sent";

  const successBody = isMeetingLink
    ? "Thank you for reaching out. We'll send you the next Zoom meeting link soon."
    : isPrayer
    ? "Thank you for trusting us with your request. We'll be praying with you."
    : "Thank you for reaching out. We'll be in touch soon.";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="zm-page">
        {/* HERO */}
        <header className="zm-hero">
          <div className="zm-hero-inner">
            <nav className="zm-crumbs">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span>{eyebrow}</span>
            </nav>

            <p className="zm-eyebrow">
              <span className="zm-eyebrow-line" />
              Faith of the Pioneers
            </p>

            <h1 className="zm-title zm-display">{heading}</h1>

            <p className="zm-lede">{intro}</p>

            <div className="zm-hero-meta">
              <span>
                <strong>Private</strong> &amp; confidential
              </span>
              <span className="zm-dot" />
              <span>
                <strong>24h</strong> response
              </span>
            </div>
          </div>
        </header>

        {/* MODE NAV */}
        <div className="zm-mode-wrap">
          <nav className="zm-mode-nav" aria-label="Contact options">
            <Link
              href="/contact"
              className={`zm-chip${!isPrayer && !isMeetingLink ? " is-active" : ""}`}
            >
              Contact us
            </Link>
            <Link
              href="/prayer-request"
              className={`zm-chip${isPrayer ? " is-active" : ""}`}
            >
              Prayer request
            </Link>
            <Link
              href="/meeting-link-request"
              className={`zm-chip${isMeetingLink ? " is-active" : ""}`}
            >
              Zoom link
            </Link>
          </nav>
        </div>

        {/* RESULTS LABEL */}
        <p className="zm-results-count" role="status">
          {isMeetingLink
            ? "Zoom link request"
            : isPrayer
            ? "Prayer request"
            : "Send a message"}
        </p>

        {/* FORM / SUCCESS */}
        <section className="zm-section">
          {sent ? (
            <div className="zm-success" role="status">
              <div className="zm-success-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="zm-display">{successTitle}</h2>
              <p>{successBody}</p>
              <button
                type="button"
                className="zm-submit"
                onClick={() => setSent(false)}
              >
                Send another {isPrayer ? "request" : "message"}
              </button>
            </div>
          ) : (
            <div className="zm-form-card">
              <form className="zm-form" onSubmit={(event) => void submit(event)}>
                <div className="zm-field">
                  <label htmlFor="contact-name">Your name</label>
                  <input
                    id="contact-name"
                    required
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </div>

                <div className="zm-field">
                  <label htmlFor="contact-email">Email address</label>
                  <input
                    id="contact-email"
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                </div>

                <div className="zm-field">
                  <label htmlFor="contact-phone">
                    {isMeetingLink ? "WhatsApp number" : "Phone number"}
                    {!isMeetingLink && <span>Optional</span>}
                  </label>
                  <input
                    id="contact-phone"
                    required={isMeetingLink}
                    type="tel"
                    maxLength={40}
                    autoComplete="tel"
                    placeholder="+1 555 000 0000"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                  />
                </div>

                <div className="zm-field">
                  <label htmlFor="contact-message">
                    {isMeetingLink
                      ? "Tell us about yourself"
                      : isPrayer
                      ? "How can we pray for you?"
                      : "Your message"}
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={6}
                    maxLength={4000}
                    placeholder={
                      isMeetingLink
                        ? "Share a short introduction and why you'd like to join."
                        : isPrayer
                        ? "Share as much or as little as you'd like."
                        : "How can we help?"
                    }
                    value={form.message}
                    onChange={(event) =>
                      setForm({ ...form, message: event.target.value })
                    }
                  />
                </div>

                {error && (
                  <p className="zm-notice is-error" role="alert">
                    {error}
                  </p>
                )}

                <button className="zm-submit" disabled={busy} type="submit">
                  {busy
                    ? "Sending..."
                    : isMeetingLink
                    ? "Request meeting link"
                    : isPrayer
                    ? "Send prayer request"
                    : "Submit message"}
                </button>
              </form>
            </div>
          )}
        </section>

        <MobileBottomNav current="contact" />
      </main>
    </>
  );
}