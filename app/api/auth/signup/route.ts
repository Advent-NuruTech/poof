import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const expectedCode = process.env.SIGN_UP_CODE;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!expectedCode || !apiKey) {
    return NextResponse.json({ error: "Signup is not configured on the server." }, { status: 503 });
  }

  let body: { code?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { code, email, password } = body;
  if (typeof code !== "string" || typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Enter the signup code, email, and password." }, { status: 400 });
  }
  if (code !== expectedCode) return NextResponse.json({ error: "The signup code is incorrect." }, { status: 403 });
  if (email.length > 254 || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 6 characters." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
      cache: "no-store",
    });
    if (!response.ok) {
      const result = await response.json() as { error?: { message?: string } };
      const message = result.error?.message === "EMAIL_EXISTS" ? "An account with this email already exists." :
        result.error?.message === "INVALID_EMAIL" ? "Enter a valid email address." : "Could not create the account. Check the details and try again.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not reach the authentication service." }, { status: 502 });
  }
}
