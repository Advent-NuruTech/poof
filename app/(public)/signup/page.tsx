"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
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
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      const invite = new URLSearchParams(window.location.search).get("invite");
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: form.get("code"), email, password, ...(invite ? { invite } : {}) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not create your account.");
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await startAdminSession(credential.user);
      router.replace("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand">POOF</Link><span className="eyebrow">CREATE AN ACCOUNT</span><h1>Sign up</h1><p>Enter the signup code, or open an administrator invitation link.</p>
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" required minLength={6} maxLength={128}/></label>
      <label>Signup code<input name="code" type="password" autoComplete="off"/></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    <p className="auth-switch">Already have an account? <Link href="/signin">Sign in</Link></p>
  </section></main>;
}
