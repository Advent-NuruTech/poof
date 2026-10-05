"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { db } from "@/lib/firebase";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";

const emptyForm = { name: "", email: "", phone: "", message: "" };
type ContactPageProps = { mode?: "contact" | "prayer" | "meeting-link" };

export default function ContactPage({ mode = "contact" }: ContactPageProps) {
  const isPrayer = mode === "prayer";
  const isMeetingLink = mode === "meeting-link";
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const eyebrow = isMeetingLink ? "ZOOM LINK REQUEST" : isPrayer ? "PRAYER REQUEST" : "CONTACT";
  const heading = isMeetingLink ? "Join our next Zoom meeting" : isPrayer ? "Share a prayer request" : "Get in touch";
  const intro = isMeetingLink ? "Request the private link for an upcoming online meeting. Tell us a little about yourself and our team will be in touch." : isPrayer ? "Tell us how we can pray with you. Your request will be received privately by our team." : "Send us a message and our team will be in touch.";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await addDoc(collection(db, "contacts"), { category: mode, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), message: form.message.trim(), createdAt: serverTimestamp() });
      setForm(emptyForm); setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your request could not be sent. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="contact-page">
    <header className="contact-header"><Link href="/">← Home</Link><span>FAITH OF THE PIONEERS · {eyebrow}</span><h1>{heading}</h1><p>{intro}</p></header>
    <nav className="contact-mode-nav" aria-label="Contact options"><a className={!isPrayer && !isMeetingLink ? "active" : ""} href="/contact">Contact us</a><a className={isPrayer ? "active" : ""} href="/prayer-request">Prayer request</a><a className={isMeetingLink ? "active" : ""} href="/meeting-link-request">Zoom link</a></nav>
    <section className="contact-panel">
      {sent ? <div className="contact-success" role="status"><h2>{isMeetingLink ? "Request received" : isPrayer ? "Prayer request received" : "Message sent"}</h2><p>{isMeetingLink ? "Thank you. Our team will review your request and send the meeting details if approved." : isPrayer ? "Thank you for trusting us with your request. We'll be praying with you." : "Thank you for reaching out. We'll be in touch soon."}</p><button className="primary-button" onClick={() => setSent(false)}>Send another {isMeetingLink || isPrayer ? "request" : "message"}</button></div> : <form className="contact-form" onSubmit={(event) => void submit(event)}>
        <label>Your name<input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
        <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
        <label>Phone number <span>Optional</span><input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label>
        <label>{isMeetingLink ? "Tell us about yourself" : isPrayer ? "How can we pray for you?" : "Your message"}<textarea required rows={6} maxLength={4000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })}/></label>
        {error && <p className="notice error-notice" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? "Sending..." : isMeetingLink ? "Request meeting link" : isPrayer ? "Send prayer request" : "Submit message"}</button>
      </form>}
    </section>
    <MobileBottomNav current="contact"/>
  </main>;
}
