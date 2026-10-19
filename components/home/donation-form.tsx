"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { readApiResponse } from "@/lib/api-response";

type InitializationResponse = {
  authorizationUrl?: string;
  reference?: string;
  error?: string;
};

export default function DonationForm({ currency }: { currency: string }) {
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
        body: JSON.stringify({ name, email, amount, website }),
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
        <span>Amount</span>
        <div className="donation-amount-field">
          <b>{currency}</b>
          <input type="text" name="amount" inputMode="decimal" autoComplete="off" maxLength={12} pattern="[0-9]+([.][0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Enter amount" aria-describedby="donation-amount-help" required disabled={busy}/>
        </div>
        <small id="donation-amount-help">Enter any amount from the supported minimum. No amount is preselected.</small>
      </label>
      <label className="donation-honeypot" aria-hidden="true">
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)}/>
      </label>
      {error && <p className="donation-error" role="alert">{error}</p>}
      <button className="donation-submit" type="submit" disabled={busy}>
        {busy ? <><span className="donation-spinner" aria-hidden="true"/>Opening secure checkout…</> : <>Continue to Paystack <span aria-hidden="true">→</span></>}
      </button>
    </form>
    <div className="donation-security-note">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
      <p>Payments are processed by Paystack. We store your name, email, amount, reference, and payment status—not your card details. See our <Link href="/privacy-policy">privacy policy</Link>.</p>
    </div>
  </section>;
}
