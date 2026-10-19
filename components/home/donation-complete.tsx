"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiResponse } from "@/lib/api-response";

type DonationResult = {
  status?: "pending" | "success" | "failed";
  name?: string;
  email?: string;
  amountSubunit?: number;
  currency?: string;
  failureMessage?: string;
  error?: string;
};

function money(amountSubunit?: number, currency?: string) {
  if (!Number.isFinite(amountSubunit) || !currency) return "";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amountSubunit) / 100);
}

export default function DonationComplete() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref") || "";
  const [result, setResult] = useState<DonationResult | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!reference) return;
    fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, { cache: "no-store" })
      .then((response) => readApiResponse<DonationResult>(response, "Payment verification"))
      .then((data) => { if (active) setResult(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "We could not verify this payment."); });
    return () => { active = false; };
  }, [reference, attempt]);

  const retry = () => {
    setError("");
    setResult(null);
    setAttempt((value) => value + 1);
  };
  const visibleError = error || (!reference ? "The payment reference is missing. Check your Paystack receipt or contact us for help." : "");
  const status = result?.status;
  const title = status === "success" ? "Donation confirmed" : status === "failed" ? "Payment was not completed" : "Payment is still processing";
  const icon = status === "success" ? "✓" : status === "failed" ? "×" : "…";
  return <main className="donation-result-page">
    <section className="donation-result-card" aria-live="polite">
      {!result && !visibleError ? <>
        <div className="donation-result-icon pending" aria-hidden="true">…</div>
        <h1>Confirming your payment</h1>
        <p>Please wait while we verify the transaction securely with Paystack.</p>
      </> : visibleError ? <>
        <div className="donation-result-icon failed" aria-hidden="true">!</div>
        <span className="donation-result-label">VERIFICATION DELAYED</span>
        <h1>We could not confirm the payment yet</h1>
        <p>{visibleError}</p>
        {reference && <button type="button" className="donation-result-primary" onClick={retry}>Try verification again</button>}
        <Link href="/contact" className="donation-result-secondary">Contact us</Link>
      </> : <>
        <div className={`donation-result-icon ${status}`} aria-hidden="true">{icon}</div>
        <span className="donation-result-label">{status === "success" ? "PAYMENT VERIFIED" : status === "failed" ? "PAYMENT UNSUCCESSFUL" : "PAYMENT PENDING"}</span>
        <h1>{title}</h1>
        {status === "success" ? <>
          <p>Thank you{result?.name ? `, ${result.name}` : ""}. Your gift of <strong>{money(result?.amountSubunit, result?.currency)}</strong> has been received.</p>
          <p className="donation-result-note">A receipt is being sent to <strong>{result?.email}</strong>.</p>
        </> : status === "failed" ? <p>{result?.failureMessage || "Paystack did not complete this transaction. You have not been recorded as a successful donor."}</p> : <p>Paystack has not finalized this transaction. If you completed payment, wait a moment and check again.</p>}
        <div className="donation-result-reference"><span>Reference</span><code>{reference}</code></div>
        {status === "pending" && <button type="button" className="donation-result-primary" onClick={retry}>Check again</button>}
        {status === "failed" && <Link href="/donate" className="donation-result-primary">Try another donation</Link>}
        <Link href="/" className="donation-result-secondary">Return home</Link>
      </>}
    </section>
  </main>;
}
