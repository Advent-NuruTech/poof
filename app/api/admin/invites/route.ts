import { getMailDb, requireMailAdmin, sendAdminInvitationEmail, Timestamp } from "@/lib/mailing-server";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function siteBaseUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configuredUrl) return configuredUrl;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

async function removeUnsentInvitation(invitation: FirebaseFirestore.DocumentReference) {
  try {
    await invitation.delete();
    return true;
  } catch (reason) {
    console.error("Unsent administrator invitation could not be removed", {
      invitationId: invitation.id,
      error: reason,
    });
    return false;
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });

  try {
    const adminId = await requireMailAdmin(request);
    if (!adminId) return Response.json({ error: "Sign in with an active administrator account to create invitations." }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json() as unknown;
    } catch {
      return Response.json({ error: "Enter a valid administrator email address." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Enter a valid administrator email address." }, { status: 400 });
    }

    const emailValue = (body as { email?: unknown }).email;
    const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid administrator email address." }, { status: 400 });
    }

    const invitation = getMailDb().collection("adminInvites").doc();
    const expiresAt = Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000);
    await invitation.create({
      email,
      createdAt: Timestamp.now(),
      expiresAt,
      used: false,
    });

    let delivery: Awaited<ReturnType<typeof sendAdminInvitationEmail>>;
    try {
      delivery = await sendAdminInvitationEmail(
        { id: invitation.id, email },
        siteBaseUrl(request),
      );
    } catch (reason) {
      console.error("Administrator invitation email could not be sent", {
        invitationId: invitation.id,
        error: reason,
      });
      if (!await removeUnsentInvitation(invitation)) {
        return Response.json({
          error: "The email could not be sent and the unused invitation could not be removed. Contact an administrator before retrying.",
        }, { status: 500 });
      }
      return Response.json({ error: "The invitation email could not be sent. Check the email configuration and try again." }, { status: 502 });
    }

    if (delivery.sent !== 1 || delivery.failures.length > 0) {
      console.error("Administrator invitation email delivery failed", {
        invitationId: invitation.id,
        error: delivery.failures[0]?.error ?? "Resend did not confirm delivery.",
      });
      if (!await removeUnsentInvitation(invitation)) {
        return Response.json({
          error: "The email could not be sent and the unused invitation could not be removed. Contact an administrator before retrying.",
        }, { status: 500 });
      }
      return Response.json({ error: "The invitation email could not be sent. Please try again." }, { status: 502 });
    }

    const inviteUrl = `${siteBaseUrl(request)}/signup?invite=${encodeURIComponent(invitation.id)}`;
    return Response.json({ inviteUrl, expiresAt: expiresAt.toDate().toISOString() }, { status: 201 });
  } catch (reason) {
    console.error("Administrator invitation creation failed", reason);
    return Response.json({ error: "Could not create this invitation. Please try again." }, { status: 500 });
  }
}
