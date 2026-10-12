"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { auth } from "@/lib/firebase";
import { startAdminSession } from "@/lib/admin-session";

export default function SignupPage() {
const router = useRouter();
const [busy, setBusy] = useState(false);
const [error, setError] = useState("");

async function submit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();
if (busy) return;

setBusy(true);
setError("");

const form = new FormData(event.currentTarget);
const email = String(form.get("email") ?? "").trim();
const password = String(form.get("password") ?? "");
const code = String(form.get("code") ?? "");

try {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, email, password }),
  });

  const result = await response.json() as { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Could not create your account.");
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  await startAdminSession(credential.user);
  router.replace("/admin");
  router.refresh();
} catch (reason) {
  setError(
    reason instanceof Error
      ? reason.message
      : "Could not create your account. Please try again.",
  );
} finally {
  setBusy(false);
}


}

return ( <main className="auth-page"> <section className="auth-card"> <Link href="/" className="brand" aria-label="POOF home"> <Image
         src="/images/logo.jpeg"
         alt="Pioneers of Our Faith logo"
         width={100}
         height={100}
         priority
       /> </Link>


    <div className="welcome-heading">
      <span className="eyebrow">CREATE AN ACCOUNT</span>
      <p className="intro">Enter your signup code to create your account.</p>
    </div>

    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <label htmlFor="code">Signup code</label>
      <input
        id="code"
        name="code"
        type="password"
        autoComplete="off"
        placeholder="Enter your signup code"
        required
        disabled={busy}
      />

      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        maxLength={254}
        disabled={busy}
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 6 characters"
        required
        minLength={6}
        maxLength={128}
        disabled={busy}
      />

      {error && <p className="auth-error" role="alert">{error}</p>}

      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "Creating account..." : "Create account"}
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
    .brand {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin: 0 auto 18px;
    }
    .brand :global(img) {
      display: block;
      width: 76px;
      height: 76px;
      margin: 0 auto;
      object-fit: contain;
    }
    .welcome-heading { text-align: center; }
    .eyebrow {
      display: block;
      color: #0b3d91;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .12em;
    }
    .intro {
      margin: 12px 0 25px;
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
    .primary-button:hover:not(:disabled) { background: #082f70; }
    .primary-button:disabled { opacity: .7; cursor: wait; }
    .auth-error { margin: 4px 0; color: #b42318; font-size: 13px; line-height: 1.5; }
    .auth-switch { margin: 24px 0 14px; color: #64748b; font-size: 13px; text-align: center; }
    .auth-switch a, .back-link { color: #0b3d91; font-weight: 650; text-decoration: none; }
    .auth-switch a:hover, .back-link:hover { text-decoration: underline; }
    .back-link { display: block; font-size: 12px; text-align: center; }
    @media (max-width: 480px) { .auth-card { padding: 28px 22px; } }
  `}</style>
</main>


);
}
