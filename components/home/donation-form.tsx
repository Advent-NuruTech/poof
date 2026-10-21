"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { readApiResponse } from "@/lib/api-response";

type InitializationResponse = {
  authorizationUrl?: string;
  reference?: string;
  error?: string;
};

export default function DonationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, amount, currency: "USD", website }),
        cache: "no-store",
      });
      const result = await readApiResponse<InitializationResponse>(response, "Donation checkout");
      if (!result.authorizationUrl) throw new Error("Paystack did not return a checkout link.");
      const checkout = new URL(result.authorizationUrl);
      if (checkout.protocol !== "https:" || !(checkout.hostname === "checkout.paystack.com" || checkout.hostname.endsWith(".paystack.com"))) {
        throw new Error("Paystack returned an invalid checkout link.");
      }
      window.location.assign(checkout.toString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Secure checkout could not be started.");
      setBusy(false);
    }
  }

  return <section className="donation-form-card" aria-labelledby="donation-form-title">
    <div className="donation-form-heading">
      <span>SECURE DONATION</span>
      <h2 id="donation-form-title">Donation details</h2>
      <p>All fields are required.</p>
    </div>
    <form onSubmit={submit}>
      <label>
        <span>Full name</span>
        <input type="text" name="name" autoComplete="name" minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" required disabled={busy}/>
      </label>
      <label>
        <span>Email for receipt</span>
        <input type="email" name="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required disabled={busy}/>
      </label>
      <label>
        <span>Donation amount (USD)</span>
        <div className="donation-amount-field">
          <b>USD</b>
          <input type="text" name="amount" inputMode="decimal" autoComplete="off" maxLength={18} pattern="[0-9]+([.][0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Enter amount" aria-describedby="donation-amount-help" required disabled={busy}/>
        </div>
        <small id="donation-amount-help">Paystack charges your card in KES at the current donation rate </small>
      </label>
      <label className="donation-honeypot" aria-hidden="true">
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)}/>
      </label>
      {error && <p className="donation-error" role="alert">{error}</p>}
      <button className="donation-submit" type="submit" disabled={busy}>
        {busy ? <><span className="donation-spinner" aria-hidden="true"/>Opening secure checkout…</> : <>Continue to secure payment <span aria-hidden="true">→</span></>}
      </button>
    </form>
    <div className="donation-payment-methods" aria-label="Available payment methods">
      <span><svg viewBox="0 0 32 24" aria-hidden="true"><rect x="1" y="2" width="30" height="20" rx="3" fill="#2675d9"/><path fill="#fff" d="M1 7h30v3H1z"/><circle cx="20" cy="16" r="4.5" fill="#eb4335"/><circle cx="25" cy="16" r="4.5" fill="#fbbc04" fillOpacity=".95"/></svg>Card</span>
      <span><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M17.1 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.1.8 1.1 1.7 2.3 2.9 2.2 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.7-1-2.7-3.7ZM14.9 6.1c.6-.8 1-1.9.9-3-.9 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.9-1.3Z"/></svg>Apple Pay</span>
      <span><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5.1 5.1 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.4-4.7 3.4-8Z"/><path fill="#34a853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2V17A11 11 0 0 0 12 23Z"/><path fill="#fbbc05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.4V7H2.2a11 11 0 0 0 0 10l3.6-2.8Z"/><path fill="#ea4335" d="M12 5.3c1.6 0 3.1.6 4.2 1.7l3.1-3.1A10.6 10.6 0 0 0 12 1a11 11 0 0 0-9.8 6l3.6 2.8c.9-2.6 3.3-4.5 6.2-4.5Z"/></svg>G Pay</span>
    </div>
    <div className="donation-security-note">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
      <p>Cards and eligible Apple Pay or Google Pay wallets are processed securely by Paystack in KES. Your card issuer may apply its own conversion. We never store card details. See our <Link href="/privacy-policy">privacy policy</Link>.</p>
    </div>
  </section>;
}
