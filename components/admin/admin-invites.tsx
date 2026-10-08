
"use client";

import { useState, type FormEvent } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminInvites() {
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInviteUrl("");
    setCopied(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const invitation = await addDoc(collection(db, "adminInvites"), {
        email: normalizedEmail,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(
          Date.now() + 2 * 60 * 60 * 1000
        ),
        used: false,
      });

      setInviteUrl(
        `${window.location.origin}/signup?invite=${encodeURIComponent(
          invitation.id
        )}`
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create this invitation."
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError("Could not copy the invitation link.");
    }
  }

  return (
    <section className="admin-panel">
      <div className="section-heading">
        <div className="heading-content">
          <span className="eyebrow">ADMIN ACCESS</span>

          <div className="title-row">
            <div className="title-icon" aria-hidden="true">
              +
            </div>

            <div>
              <h2>Invite an administrator</h2>
              <p>
                Create a secure invitation for someone who needs administrator
                access.
              </p>
            </div>
          </div>
        </div>

        <div className="secure-label">
          <span className="status-dot" />
          Expires in 2 hours
        </div>
      </div>

      <form
        className="channel-form"
        onSubmit={(event) => void createInvite(event)}
      >
        <div className="input-group">
          <label htmlFor="admin-email">Administrator email</label>

          <div className="input-wrapper">
            <span className="input-icon" aria-hidden="true">
              @
            </span>

            <input
              id="admin-email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
            />
          </div>
        </div>

        <button
          type="submit"
          className="primary-button"
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              Creating invite…
            </>
          ) : (
            <>
              Create invitation
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="notice error-notice" role="alert">
          <span className="notice-icon" aria-hidden="true">
            !
          </span>

          <div>
            <strong>Something went wrong</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {inviteUrl && (
        <div className="channel-preview invite-preview">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>

          <div className="preview-copy">
            <div className="preview-header">
              <strong>Invitation ready</strong>
              <span className="expiry-badge">2 HOURS</span>
            </div>

            <span className="invite-email">
              {email.trim().toLowerCase()}
            </span>

            <div className="invite-url">
              <span>{inviteUrl}</span>
            </div>

            <small>
              Share this link with the administrator. It will expire
              automatically after 2 hours.
            </small>
          </div>

          <button
            type="button"
            className="outline-button"
            onClick={() => void copyInvite()}
          >
            {copied ? (
              <>
                <span aria-hidden="true">✓</span>
                Copied
              </>
            ) : (
              <>
                <span aria-hidden="true">□</span>
                Copy link
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}