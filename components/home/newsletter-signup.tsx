"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type SubscribeResponse = {
status?: string;
error?: string;
welcomeEmailSent?: boolean;
welcomeEmailError?: string;
};

const GENERIC_ERROR =
"We could not save your subscription. Please try again.";

export default function NewsletterSignup() {
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [busy, setBusy] = useState(false);
const [message, setMessage] = useState("");
const [failed, setFailed] = useState(false);

async function submit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();


if (busy) return;

setBusy(true);
setMessage("");
setFailed(false);

try {
  const response = await fetch("/api/mailing/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: name.trim(), email: email.trim() }),
  });

  let result: SubscribeResponse;

  try {
    result = (await response.json()) as SubscribeResponse;
  } catch {
    throw new Error(GENERIC_ERROR);
  }

  if (!response.ok) {
    throw new Error(
      response.status >= 500
        ? GENERIC_ERROR
        : result.error || GENERIC_ERROR
    );
  }

  if (result.status === "already-subscribed") {
    setMessage("This email is already subscribed.");
  } else if (result.welcomeEmailSent) {
    setMessage("You're subscribed! A welcome email with our three latest videos is on its way.");
  } else {
    setFailed(true);
    setMessage(result.welcomeEmailError || "You're subscribed! Watch your inbox for a welcome email.");
  }

  setEmail("");
  setName("");
} catch (error) {
  setFailed(true);
  setMessage(
    error instanceof Error && error.message === GENERIC_ERROR
      ? GENERIC_ERROR
      : error instanceof Error && error.message
        ? error.message
        : GENERIC_ERROR
  );
} finally {
  setBusy(false);
}

}

return (
<section    className="newsletter-signup"    aria-labelledby="newsletter-title"  >
<div className="newsletter-content">
<span className="about-card-eyebrow">
SUBSCRIBE TO OUR NEWSLETTER
</span>


    <h2 id="newsletter-title">
      Faith and encouragement, in your inbox.
    </h2>

    <p className="newsletter-description">
      Subscribe for thoughtful updates, new studies, and online
      fellowship news.
    </p>
  </div>

  <form className="newsletter-form" onSubmit={submit}>
    <label htmlFor="newsletter-name">First name (optional)</label>
    <input
      className="newsletter-name-input"
      id="newsletter-name"
      name="given-name"
      type="text"
      maxLength={120}
      autoComplete="given-name"
      value={name}
      onChange={(event) => setName(event.target.value)}
      placeholder="Name"
      disabled={busy}
    />
    <label htmlFor="newsletter-email">Email address</label>

    <div className="newsletter-input-group">
      <input
        id="newsletter-email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        disabled={busy}
      />

      <button type="submit" disabled={busy}>
        {busy ? "Subscribing…" : "Subscribe"}
      </button>
    </div>

    <small className="newsletter-privacy">
      Unsubscribe at any time using the link in each newsletter.
    </small>

    {message && (
      <p
        className={`newsletter-message ${
          failed ? "error" : "success"
        }`}
        role={failed ? "alert" : "status"}
      >
        {message}
      </p>
    )}
  </form>

  <style jsx>{`
    .newsletter-signup {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: center;
      gap: 32px;
      padding: 40px;
      color: #ffffff;
      background-color: #0b3d91;
      background-image: none;
      border: 1px solid #1d4ed8;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
    }

    .newsletter-content {
      min-width: 0;
    }

    .about-card-eyebrow {
      display: inline-block;
      margin-bottom: 14px;
      color: #bfdbfe;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: 1.6;
    }

    .newsletter-content h2 {
      margin: 0 0 14px;
      color: #ffffff;
      font-size: clamp(1.65rem, 3vw, 2.35rem);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.2;
    }

    .newsletter-description {
      max-width: 440px;
      margin: 0;
      color: #dbeafe;
      font-size: 1rem;
      line-height: 1.75;
    }

    .newsletter-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .newsletter-form label {
      color: #ffffff;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .newsletter-input-group {
      display: flex;
      align-items: stretch;
      gap: 8px;
      min-width: 0;
    }

    .newsletter-input-group input {
      flex: 1;
      width: 100%;
      min-width: 0;
      min-height: 48px;
      padding: 12px 14px;
      color: #0f172a;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      outline: none;
      font: inherit;
      font-size: 0.95rem;
      transition: border-color 160ms ease,
        box-shadow 160ms ease;
    }

    .newsletter-name-input {
      width: 100%;
      min-height: 48px;
      padding: 12px 14px;
      color: #0f172a;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      outline: none;
      font: inherit;
      font-size: 0.95rem;
    }

    .newsletter-input-group input::placeholder {
      color: #64748b;
    }

    .newsletter-input-group input:focus-visible {
      border-color: #93c5fd;
      box-shadow: 0 0 0 3px rgba(191, 219, 254, 0.35);
    }

    .newsletter-name-input:focus-visible {
      border-color: #93c5fd;
      box-shadow: 0 0 0 3px rgba(191, 219, 254, 0.35);
    }

    .newsletter-input-group button {
      flex-shrink: 0;
      min-height: 48px;
      padding: 12px 20px;
      color: #0b3d91;
      background: #ffffff;
      border: 1px solid #ffffff;
      border-radius: 8px;
      font: inherit;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 160ms ease,
        transform 160ms ease;
    }

    .newsletter-input-group button:hover:not(:disabled) {
      background: #dbeafe;
    }

    .newsletter-input-group button:active:not(:disabled) {
      transform: translateY(1px);
    }

    .newsletter-input-group button:focus-visible {
      outline: 3px solid #bfdbfe;
      outline-offset: 3px;
    }

    .newsletter-input-group button:disabled,
    .newsletter-input-group input:disabled,
    .newsletter-name-input:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .newsletter-privacy {
      color: #dbeafe;
      font-size: 0.8rem;
      line-height: 1.6;
    }

    .newsletter-message {
      margin: 4px 0 0;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 0.9rem;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .newsletter-message.success {
      color: #ffffff;
      background: #164e63;
      border: 1px solid #67e8f9;
    }

    .newsletter-message.error {
      color: #ffffff;
      background: #7f1d1d;
      border: 1px solid #fca5a5;
    }

    @media (max-width: 700px) {
      .newsletter-signup {
        grid-template-columns: minmax(0, 1fr);
        gap: 24px;
        padding: 28px 22px;
        border-radius: 12px;
      }

      .newsletter-content h2 {
        font-size: clamp(1.6rem, 6vw, 2rem);
      }

      .newsletter-input-group {
        flex-direction: column;
      }

      .newsletter-input-group input,
      .newsletter-input-group button {
        width: 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .newsletter-input-group input,
      .newsletter-input-group button {
        transition: none;
      }
    }
  `}</style>
</section>


);
}
