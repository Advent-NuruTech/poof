"use client";

import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminInvites() {
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInviteUrl("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const invitation = await addDoc(collection(db, "adminInvites"), {
        email: normalizedEmail,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000),
        used: false,
      });
      setInviteUrl(`${window.location.origin}/signup?invite=${encodeURIComponent(invitation.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create this invitation.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">ADMIN ACCESS</span><h2>Invite an administrator</h2></div><span className="secure-label">Expires in 2 hours</span></div>
    <form className="channel-form" onSubmit={(event) => void createInvite(event)}><input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="New administrator email" aria-label="New administrator email"/><button className="primary-button" disabled={busy}>{busy ? "Creating…" : "Create invite"}</button></form>
    {error && <p className="notice error-notice" role="alert">{error}</p>}
    {inviteUrl && <div className="channel-preview invite-preview"><div className="preview-copy"><strong>Invitation link created</strong><span>{email.trim().toLowerCase()} · expires in 2 hours</span><small>{inviteUrl}</small></div><button className="outline-button" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copy link</button></div>}
  </section>;
}
