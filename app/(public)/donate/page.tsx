import type { Metadata } from "next";
import Link from "next/link";
import DonationForm from "@/components/home/donation-form";

export const metadata: Metadata = {
  title: "Donate | Faith of the Pioneers",
  description: "Support the work of Faith of the Pioneers through a secure Paystack donation.",
};

export default function DonatePage() {
  const currency = process.env.PAYSTACK_CURRENCY?.trim().toUpperCase() || "NGN";
  return <main className="donation-page">
    <section className="donation-intro" aria-labelledby="donation-title">
      <Link href="/" className="donation-back">← Back to home</Link>
      <span className="donation-eyebrow">SUPPORT THE WORK</span>
      <h1 id="donation-title">Give securely.</h1>
      <p>Your support helps Faith of the Pioneers continue its ministry, teaching, and fellowship. Choose the amount you would like to give.</p>
      <div className="donation-assurance" aria-label="Payment assurances">
        <div><span aria-hidden="true">✓</span><strong>Secure checkout</strong><small>Payment is completed on Paystack.</small></div>
        <div><span aria-hidden="true">✓</span><strong>Email receipt</strong><small>Sent after payment is verified.</small></div>
        <div><span aria-hidden="true">✓</span><strong>No card data stored</strong><small>This website never handles your card details.</small></div>
      </div>
    </section>
    <DonationForm currency={currency} />
  </main>;
}
