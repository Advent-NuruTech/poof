"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in";
import { startAdminSession } from "@/lib/admin-session";
import { getRedirectResult } from "firebase/auth";

export default function SigninPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootstrapCode, setBootstrapCode] = useState("");

  useEffect(() => {
    getRedirectResult(auth).then(async (credential) => {
      if (!credential) return;
      const invite = new URLSearchParams(window.location.search).get("invite") ?? sessionStorage.getItem("adminInvite") ?? undefined;
      const code = sessionStorage.getItem("adminBootstrapCode") ?? "";
      await startAdminSession(credential.user, { bootstrapCode: code, ...(invite ? { invite } : {}) });
      sessionStorage.removeItem("adminBootstrapCode");
      sessionStorage.removeItem("adminInvite");
      router.replace("/admin");
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Google sign-in failed."));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const credential = await signInWithEmailAndPassword(auth, String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
      const invite = new URLSearchParams(window.location.search).get("invite") ?? sessionStorage.getItem("adminInvite") ?? undefined;
      await startAdminSession(credential.user, { bootstrapCode, ...(invite ? { invite } : {}) });
      sessionStorage.removeItem("adminInvite");
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
      <label>First admin setup code<input value={bootstrapCode} onChange={(event) => setBootstrapCode(event.target.value)} type="password" autoComplete="off"/><small>Only needed once to set up the first administrator.</small></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <div className="auth-divider">or</div>
    <button className="outline-button auth-google" onClick={() => { setError(""); sessionStorage.setItem("adminBootstrapCode", bootstrapCode); const invite = new URLSearchParams(window.location.search).get("invite"); if (invite) sessionStorage.setItem("adminInvite", invite); void signInWithGoogle().then(async (credential) => { if (credential && "user" in credential) { const sessionInvite = new URLSearchParams(window.location.search).get("invite") ?? sessionStorage.getItem("adminInvite") ?? undefined; await startAdminSession(credential.user, { bootstrapCode, ...(sessionInvite ? { invite: sessionInvite } : {}) }); sessionStorage.removeItem("adminBootstrapCode"); sessionStorage.removeItem("adminInvite"); router.replace("/admin"); } }).catch((reason) => setError(reason instanceof Error ? reason.message : "Google sign-in failed.")); }}>Continue with Google</button>
    <p className="auth-switch">Need an account? <Link href="/signup">Sign up with a code</Link></p>
  </section></main>;
}
