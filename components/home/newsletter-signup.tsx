"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/mailing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "We could not save your subscription. Please try again.");
      setMessage(result.status === "already-subscribed" ? "This email is already subscribed." : "You're subscribed. Watch your inbox for our next newsletter.");
      setEmail("");
    } catch (reason) {
      setFailed(true);
      setMessage(reason instanceof Error ? reason.message : "We could not save your subscription. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="newsletter-signup" aria-labelledby="newsletter-title">
    <div><span className="about-card-eyebrow">A NOTE FROM OUR FELLOWSHIP</span><h2 id="newsletter-title">Faith and encouragement, in your inbox.</h2><p>Subscribe for thoughtful updates, new studies, and online fellowship news.</p></div>
    <form onSubmit={(event) => void submit(event)}>
      <label htmlFor="newsletter-email">Email address</label>
      <div><input id="newsletter-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/><button type="submit" disabled={busy}>{busy ? "Subscribing…" : "Subscribe"}</button></div>
      <small>Unsubscribe at any time using the link in each newsletter.</small>
      {message && <p className={failed ? "newsletter-message error" : "newsletter-message"} role={failed ? "alert" : "status"}>{message}</p>}
    </form>
  </section>;
}
