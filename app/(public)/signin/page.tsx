"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in";

export default function SigninPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await signInWithEmailAndPassword(auth, String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
      router.replace("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand">POOF</Link><span className="eyebrow">WELCOME BACK</span><h1>Sign in</h1><p>Sign in to your account to continue.</p>
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <label>Email<input name="email" type="email" autoComplete="email" required/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required/></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <div className="auth-divider">or</div>
    <button className="outline-button auth-google" onClick={() => { setError(""); void signInWithGoogle().then(() => router.replace("/admin")).catch((reason) => setError(reason instanceof Error ? reason.message : "Google sign-in failed.")); }}>Continue with Google</button>
    <p className="auth-switch">Need an account? <Link href="/signup">Sign up with a code</Link></p>
  </section></main>;
}
