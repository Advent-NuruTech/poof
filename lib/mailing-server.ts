import { createHash, createHmac } from "node:crypto";
import { applicationDefault, cert, getApp, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { Resend } from "resend";

function parseServiceAccount(value: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON. Store the JSON as one environment-variable value and preserve escaped \\n characters in private_key.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be a service-account JSON object.");
  }
  const account = parsed as Record<string, unknown>;
  const projectId = account.project_id ?? account.projectId;
  const clientEmail = account.client_email ?? account.clientEmail;
  const privateKey = account.private_key ?? account.privateKey;
  if (typeof projectId !== "string" || typeof clientEmail !== "string" || typeof privateKey !== "string") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.");
  }
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

function getAdminApp() {
  if (getApps().length) return getApp();
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    credential: serviceAccount
      ? cert(parseServiceAccount(serviceAccount))
      : applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function getMailDb(): Firestore {
  return getFirestore(getAdminApp());
}
export { FieldValue, Timestamp };

export async function requireMailAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const app = getAdminApp();
  const identity = await getAuth(app).verifyIdToken(token).catch(() => null);
  if (!identity) return null;
  const admin = await getFirestore(app).collection("admins").doc(identity.uid).get();
  const data = admin.data();
  return data?.enabled === true && data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > Date.now()
    ? identity.uid
    : null;
}

export type Campaign = {
  kind: "meeting" | "newsletter";
  subject: string;
  headline: string;
  preheader: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  videoUrl: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] ?? char));

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function bodyHtml(value: string) {
  return value.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 18px;line-height:1.75;color:#4b5563">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

export function renderCampaign(campaign: Campaign, unsubscribeUrl = "") {
  const buttonUrl = safeUrl(campaign.buttonUrl);
  const videoUrl = safeUrl(campaign.videoUrl);
  const youtubeId = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1];
  const preview = youtubeId
    ? `<a href="${escapeHtml(videoUrl)}" style="display:block;margin:26px 0;text-decoration:none"><img src="https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg" alt="Watch the featured video" width="560" style="display:block;width:100%;max-width:560px;border:0;border-radius:12px"><span style="display:block;padding:12px;color:#c51c31;font-weight:700">▶ Watch the video</span></a>`
    : videoUrl ? `<a href="${escapeHtml(videoUrl)}" style="display:block;margin:26px 0;padding:42px 20px;border-radius:12px;background:#172126;color:#fff;text-align:center;text-decoration:none"><span style="display:inline-block;padding:12px 17px;border:1px solid #ffffff80;border-radius:50%;font-size:20px">▶</span><strong style="display:block;margin-top:13px">Watch the featured video</strong></a>` : "";
  const button = buttonUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#172126;color:#fff;padding:14px 24px;border-radius:28px;text-decoration:none;font-weight:700">${escapeHtml(campaign.buttonLabel || "Learn more")}</a></p>`
    : "";
  const unsubscribe = unsubscribeUrl
    ? `<p style="margin:24px 0 0;color:#788078;font-size:12px">You received this newsletter because you subscribed to Faith of the Pioneers. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#788078">Unsubscribe</a></p>`
    : "";
  return {
    html: `<!doctype html><html><body style="margin:0;background:#f4f5f2;font-family:Arial,Helvetica,sans-serif;color:#172126"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(campaign.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f2;padding:32px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:25px 34px;background:#172126;color:#fff"><div style="font-size:11px;letter-spacing:2px;color:#e9d891">FAITH OF THE PIONEERS</div><div style="font-size:12px;margin-top:7px;color:#d8dddb">A letter for your journey</div></td></tr><tr><td style="padding:34px"><div style="height:3px;width:40px;background:#c51c31;margin-bottom:20px"></div><h1 style="font-size:30px;line-height:1.15;letter-spacing:-.6px;margin:0 0 22px;color:#172126">${escapeHtml(campaign.headline)}</h1>${bodyHtml(campaign.body)}${preview}${button}${unsubscribe}</td></tr><tr><td style="padding:18px 34px;background:#f8f9f6;color:#788078;font-size:12px">Faith of the Pioneers · Online fellowship, study, and worship</td></tr></table></td></tr></table></body></html>`,
    text: [campaign.headline, campaign.body, videoUrl ? `Watch: ${videoUrl}` : "", buttonUrl ? `${campaign.buttonLabel || "Learn more"}: ${buttonUrl}` : "", unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : ""].filter(Boolean).join("\n\n"),
  };
}

export function unsubscribeLink(subscriberId: string, baseUrl: string) {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("NEWSLETTER_UNSUBSCRIBE_SECRET is not configured.");
  const signature = createSignature(subscriberId, secret);
  return `${baseUrl}/api/mailing/unsubscribe?id=${encodeURIComponent(subscriberId)}&sig=${signature}`;
}

function createSignature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function deliverCampaign(campaign: Campaign, recipients: Array<{ id: string; email: string }>, baseUrl: string, idempotencyPrefix: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Configure RESEND_API_KEY and RESEND_FROM_EMAIL to send email.");
  if (campaign.kind === "newsletter" && !process.env.NEWSLETTER_UNSUBSCRIBE_SECRET) {
    throw new Error("Configure NEWSLETTER_UNSUBSCRIBE_SECRET before sending newsletters.");
  }
  const resend = new Resend(apiKey);
  let sent = 0;
  const failures: Array<{ email: string; error: string; retryable: boolean }> = [];
  for (let start = 0; start < recipients.length; start += 5) {
    const group = recipients.slice(start, start + 5);
    const results = await Promise.all(group.map(async (recipient) => {
      const unsubscribe = campaign.kind === "newsletter" ? unsubscribeLink(recipient.id, baseUrl) : "";
      const content = renderCampaign(campaign, unsubscribe);
      try {
        const { error } = await resend.emails.send({
          from,
          to: recipient.email,
          subject: campaign.subject,
          html: content.html,
          text: content.text,
          ...(unsubscribe ? { headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
        }, {
          idempotencyKey: createHash("sha256").update(`${idempotencyPrefix}:${recipient.id}`).digest("hex"),
        });
        return error
          ? { email: recipient.email, error: error.message, retryable: error.statusCode === null || error.statusCode === 429 || error.statusCode >= 500 }
          : { email: recipient.email, error: "", retryable: false };
      } catch (reason) {
        return { email: recipient.email, error: reason instanceof Error ? reason.message : "Resend could not send this email.", retryable: true };
      }
    }));
    for (const result of results) {
      if (result.error) failures.push(result);
      else sent += 1;
    }
  }
  return { sent, failures };
}
