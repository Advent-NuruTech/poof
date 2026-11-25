"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function TemporarySignupPage() {
  const router = useRouter();
  const [invite, setInvite] = useState("");

  function continueToSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = invite.trim();
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(code)) return;
    router.push(`/signup?invite=${encodeURIComponent(code)}`);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="welcome-heading">
          <span className="eyebrow">TEMPORARY SIGNUP</span>
          <h1>Enter your administrator invitation code</h1>
          <p className="intro">
            You will continue to the existing signup form. The invitation must be valid and
            match your email address.
          </p>
        </div>

        <form className="auth-form" onSubmit={continueToSignup}>
          <label htmlFor="invite">Invitation code</label>
          <input
            id="invite"
            name="invite"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            minLength={16}
            maxLength={128}
            pattern="[A-Za-z0-9_-]{16,128}"
            value={invite}
            onChange={(event) => setInvite(event.target.value)}
            placeholder="Paste your invitation code"
            required
          />
          <button className="primary-button" type="submit">
            Continue to signup
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/signin">Sign in</Link>
        </p>
        <Link href="/" className="back-link">Back to home</Link>
      </section>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: #f5f8fd;
          color: #17243a;
        }
        .auth-card {
          width: 100%;
          max-width: 400px;
          padding: 32px;
          background: #fff;
          border: 1px solid #e1e8f2;
          border-radius: 12px;
          box-shadow: 0 12px 35px rgba(11, 61, 145, .07);
        }
        .welcome-heading { text-align: center; }
        .eyebrow {
          display: block;
          color: #0b3d91;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .12em;
        }
        h1 { margin: 12px 0; font-size: 21px; }
        .intro {
          margin: 0 0 25px;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }
        .auth-form { display: flex; flex-direction: column; gap: 10px; }
        .auth-form label { margin-top: 6px; font-size: 13px; font-weight: 650; }
        .auth-form input {
          width: 100%;
          min-height: 46px;
          padding: 11px 12px;
          color: #17243a;
          background: #fff;
          border: 1px solid #d5deeb;
          border-radius: 7px;
          font: inherit;
          font-size: 14px;
        }
        .auth-form input:focus {
          outline: 3px solid #dbeafe;
          border-color: #0b3d91;
        }
        .primary-button {
          min-height: 46px;
          margin-top: 8px;
          color: #fff;
          background: #0b3d91;
          border: 0;
          border-radius: 7px;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .primary-button:hover { background: #082f70; }
        .auth-switch {
          margin: 24px 0 14px;
          color: #64748b;
          font-size: 13px;
          text-align: center;
        }
        .auth-switch a, .back-link {
          color: #0b3d91;
          font-weight: 650;
          text-decoration: none;
        }
        .auth-switch a:hover, .back-link:hover { text-decoration: underline; }
        .back-link { display: block; font-size: 12px; text-align: center; }
        @media (max-width: 480px) { .auth-card { padding: 28px 22px; } }
      `}</style>
    </main>
  );
}
