import type { Metadata } from "next";
import { Suspense } from "react";
import DonationComplete from "@/components/home/donation-complete";

export const metadata: Metadata = {
  title: "Donation status | Faith of the Pioneers",
  robots: { index: false, follow: false },
};

export default function DonationCompletePage() {
  return <Suspense fallback={<main className="donation-result-page"><section className="donation-result-card"><div className="donation-result-icon pending" aria-hidden="true">…</div><h1>Confirming your payment</h1><p>Please wait while we verify the transaction securely with Paystack.</p></section></main>}>
    <DonationComplete />
  </Suspense>;
}
