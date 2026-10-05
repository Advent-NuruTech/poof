"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import type { FormEvent } from "react";
import { db } from "@/lib/firebase";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";

const emptyForm = { name: "", email: "", phone: "", message: "" };

export default function ContactPage() {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await addDoc(collection(db, "contacts"), {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
        message: form.message.trim(), createdAt: serverTimestamp(),
      });
      setForm(emptyForm); setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your message could not be sent. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="contact-page">
    <header className="contact-header"><a href="/">← Home</a><span>POOF · CONTACT</span><h1>Get in touch</h1><p>Send us a message and our team will be in touch.</p></header>
    <section className="contact-panel">
      {sent ? <div className="contact-success" role="status"><h2>Message sent</h2><p>Thank you for reaching out. We’ll be in touch soon.</p><button className="primary-button" onClick={() => setSent(false)}>Send another message</button></div> : <form className="contact-form" onSubmit={(event) => void submit(event)}>
        <label>Your name<input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
        <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
        <label>Phone number <span>Optional</span><input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label>
        <label>Your message<textarea required rows={6} maxLength={4000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })}/></label>
        {error && <p className="notice error-notice" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? "Sending…" : "Submit message"}</button>
      </form>}
    </section>
    <MobileBottomNav current="contact"/>
  </main>;
}
