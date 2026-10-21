"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { readApiResponse } from "@/lib/api-response";

type DonationStatus = "pending" | "success" | "failed";
type Donation = {
  reference: string;
  name: string;
  email: string;
  amountSubunit: number;
  currency: string;
  originalAmountSubunit: number;
  originalCurrency: string;
  conversionRate: number | null;
  chargeAmountSubunit: number;
  chargeCurrency: string;
  status: DonationStatus;
  providerStatus: string;
  failureMessage: string;
  receiptStatus: string;
  receiptError: string;
  channel: string;
  createdAt: string | null;
  paidAt: string | null;
  updatedAt: string | null;
};
type DonationData = {
  donations: Donation[];
  summary: {
    successfulCount: number;
    failedCount: number;
    pendingCount: number;
    totals: Array<{ currency: string; successfulCount: number; successfulAmountSubunit: number }>;
  };
  error?: string;
};
type Filter = "all" | DonationStatus;

const initialData: DonationData = {
  donations: [],
  summary: { successfulCount: 0, failedCount: 0, pendingCount: 0, totals: [{ currency: "USD", successfulCount: 0, successfulAmountSubunit: 0 }, { currency: "KES", successfulCount: 0, successfulAmountSubunit: 0 }] },
};

function money(amountSubunit: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountSubunit / 100);
  } catch {
    return `${currency} ${(amountSubunit / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  }
}

function exactTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

function statusLabel(status: DonationStatus) {
  return status === "success" ? "Successful" : status === "failed" ? "Failed" : "Pending";
}

export default function DonationsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/donations", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      setData(await readApiResponse<DonationData>(response, "Donation records"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load donations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (current) => {
    setUser(current);
    setAuthReady(true);
    if (current) void load(current);
    else setLoading(false);
  }), [load]);

  async function reconcile() {
    if (!user || reconciling) return;
    setReconciling(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/donations", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const result = await readApiResponse<{ checked?: number; receiptRetries?: number; updated?: number; unavailable?: number; error?: string }>(response, "Donation status refresh");
      const checked = result.checked ?? 0;
      const receiptRetries = result.receiptRetries ?? 0;
      setNotice(checked || receiptRetries
        ? `Checked ${checked} pending ${checked === 1 ? "donation" : "donations"}${receiptRetries ? ` and retried ${receiptRetries} ${receiptRetries === 1 ? "receipt" : "receipts"}` : ""}.`
        : "There were no pending donations or receipts to retry.");
      await load(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not refresh donation statuses.");
    } finally {
      setReconciling(false);
    }
  }

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.donations.filter((donation) => {
      if (filter !== "all" && donation.status !== filter) return false;
      if (!query) return true;
      return [donation.name, donation.email, donation.reference, donation.providerStatus, donation.channel]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [data.donations, filter, search]);

  const filterCounts: Record<Filter, number> = {
    all: data.summary.successfulCount + data.summary.failedCount + data.summary.pendingCount,
    success: data.summary.successfulCount,
    failed: data.summary.failedCount,
    pending: data.summary.pendingCount,
  };

  return <main className="donations-admin-page">
    <div className="admin-content">
      <header className="donations-admin-heading">
        <div><span className="eyebrow">PAYMENTS</span><h1>Donations</h1><p>Verified Paystack donations, unsuccessful attempts, donor details, and receipt delivery status.</p></div>
        <button type="button" className="donations-refresh" disabled={!user || reconciling} onClick={() => void reconcile()}>{reconciling ? "Checking Paystack…" : "Refresh payment statuses"}</button>
      </header>

      <section className="donation-admin-stats" aria-label="Donation summary">
        <article className="is-total"><span>SUCCESSFUL TOTAL</span><strong>{data.summary.totals.map((total) => money(total.successfulAmountSubunit, total.currency)).join(" + ")}</strong><small>{data.summary.successfulCount.toLocaleString()} confirmed {data.summary.successfulCount === 1 ? "donation" : "donations"}</small></article>
        <article><span>SUCCESSFUL</span><strong>{data.summary.successfulCount.toLocaleString()}</strong><small>Verified by Paystack</small></article>
        <article><span>FAILED</span><strong>{data.summary.failedCount.toLocaleString()}</strong><small>Failed or abandoned</small></article>
        <article><span>PENDING</span><strong>{data.summary.pendingCount.toLocaleString()}</strong><small>Awaiting final status</small></article>
      </section>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice" role="status">{notice}</p>}

      <section className="donation-admin-ledger" aria-labelledby="donation-ledger-title">
        <div className="donation-ledger-toolbar">
          <div><span className="eyebrow">LEDGER</span><h2 id="donation-ledger-title">Donation activity</h2></div>
          <label className="donation-search"><span className="sr-only">Search donations</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or reference"/></label>
        </div>
        <div className="donation-filter-tabs" role="group" aria-label="Filter donations">
          {(["all", "success", "failed", "pending"] as Filter[]).map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All" : statusLabel(item)} <span>{filterCounts[item]}</span></button>)}
        </div>

        {!authReady || loading ? <div className="donation-ledger-state">Loading donation records…</div> : !user ? <div className="donation-ledger-state">Your administrator session is not available. Sign in again.</div> : !visible.length ? <div className="donation-ledger-state">No donations match this view.</div> : <div className="donation-table-wrap">
          <table className="donation-table">
            <thead><tr><th>Donor</th><th>Amount</th><th>Status</th><th>Date & time</th><th>Receipt</th><th>Reference</th></tr></thead>
            <tbody>{visible.map((donation) => <tr key={donation.reference}>
              <td data-label="Donor"><strong>{donation.name}</strong><a href={`mailto:${encodeURIComponent(donation.email)}`}>{donation.email}</a></td>
              <td data-label="Amount"><strong>{money(donation.originalAmountSubunit, donation.originalCurrency)}</strong>{donation.chargeCurrency !== donation.originalCurrency && <small>Charged {money(donation.chargeAmountSubunit, donation.chargeCurrency)}{donation.conversionRate ? ` · 1 USD = ${donation.conversionRate.toLocaleString(undefined, { maximumFractionDigits: 6 })} KES` : ""}</small>}{donation.channel && <small>{donation.channel}</small>}</td>
              <td data-label="Status"><span className={`donation-status ${donation.status}`}>{statusLabel(donation.status)}</span><small>{donation.providerStatus.replaceAll("_", " ")}</small>{donation.failureMessage && <em title={donation.failureMessage}>{donation.failureMessage}</em>}</td>
              <td data-label="Date & time"><time dateTime={donation.paidAt || donation.createdAt || undefined}>{exactTime(donation.paidAt || donation.createdAt)}</time><small>{donation.status === "success" ? "Payment time" : "Attempt time"}</small></td>
              <td data-label="Receipt"><span className={`receipt-status ${donation.receiptStatus}`} title={donation.receiptError || undefined}>{donation.status === "success" ? donation.receiptStatus.replaceAll("_", " ") : "Not applicable"}</span>{donation.receiptError && <small>{donation.receiptError}</small>}</td>
              <td data-label="Reference"><code title={donation.reference}>{donation.reference}</code></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <p className="donation-ledger-footnote">Showing the latest 250 attempts. Successful totals include the complete donation history.</p>
      </section>
    </div>
  </main>;
}
