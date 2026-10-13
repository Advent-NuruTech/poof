import { createHash, createHmac } from "node:crypto";
import { applicationDefault, cert, getApp, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { AggregateField, FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { Resend } from "resend";
import { automaticPreviewText, extractFeaturedVideoUrl, inlineVideoLinks, personalizedGreeting, richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";
import { getPublicCatalog, type FeedVideo } from "@/lib/catalog-feed";

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

function getSplitServiceAccount(): ServiceAccount | undefined {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail && !privateKey) return undefined;

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !clientEmail?.trim() || !privateKey?.trim()) {
    throw new Error("Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY together.");
  }
  return { projectId, clientEmail: clientEmail.trim(), privateKey: privateKey.replace(/\\n/g, "\n") };
}

function getAdminApp() {
  if (getApps().length) return getApp();
  const splitServiceAccount = getSplitServiceAccount();
  const legacyServiceAccount = !splitServiceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : undefined;
  return initializeApp({
    credential: splitServiceAccount
      ? cert(splitServiceAccount)
      : legacyServiceAccount
        ? cert(legacyServiceAccount)
      : applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
      ?? legacyServiceAccount?.projectId
      ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function getMailDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getMailStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET must be configured to upload mailing images.");
  return getStorage(getAdminApp()).bucket(bucketName);
}

export async function getEmailsSentCount(db: Firestore) {
  const ref = db.collection("mailingStats").doc("summary");
  const current = await ref.get();
  if (current.exists) return Number(current.get("emailsSent") ?? 0);

  const previous = await db.collection("mailingHistory").aggregate({ sent: AggregateField.sum("sent") }).get();
  const initialCount = Number(previous.data().sent ?? 0);
  return db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref);
    if (latest.exists) return Number(latest.get("emailsSent") ?? 0);
    transaction.create(ref, { emailsSent: initialCount, initializedAt: FieldValue.serverTimestamp() });
    return initialCount;
  });
}

async function getFirebaseUserId(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY must be configured to verify administrator sessions.");

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const error = result && typeof result === "object" && "error" in result ? result.error : undefined;
    const message = error && typeof error === "object" && "message" in error ? error.message : undefined;
    if (response.status === 400 && ["INVALID_ID_TOKEN", "TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND"].includes(String(message))) {
      return null;
    }
    throw new Error(`Firebase ID-token verification failed (HTTP ${response.status}).`);
  }

  if (!result || typeof result !== "object" || !("users" in result) || !Array.isArray(result.users)) {
    throw new Error("Firebase ID-token verification returned an invalid response.");
  }
  const user = result.users[0];
  if (!user || typeof user !== "object" || !("localId" in user) || typeof user.localId !== "string" || !user.localId) {
    throw new Error("Firebase ID-token verification returned an invalid response.");
  }
  return user.localId;
}

export { FieldValue, Timestamp };

export async function requireMailAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const uid = await getFirebaseUserId(token);
  if (!uid) return null;
  const app = getAdminApp();
  const admin = await getFirestore(app).collection("admins").doc(uid).get();
  const data = admin.data();
  return data?.enabled === true && data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > Date.now()
    ? uid
    : null;
}

export type Campaign = {
  kind: "meeting" | "newsletter";
  subject: string;
  letterTitle: string;
  headline: string;
  preheader: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  videoUrl: string;
};

export type CampaignAudience = {
  mode: "all" | "selected" | "new";
  recipientIds: string[];
  since: string;
};

export function parseCampaignAudience(modeValue: unknown, recipientIdsValue: unknown, sinceValue: unknown): CampaignAudience | string {
  const mode = modeValue ?? "all";
  if (mode !== "all" && mode !== "selected" && mode !== "new") return "Choose a valid recipient group.";
  const recipientIds = recipientIdsValue ?? [];
  if (!Array.isArray(recipientIds) || recipientIds.length > 500 ||
      recipientIds.some((id) => typeof id !== "string" || !id || id.length > 150)) {
    return "Choose up to 500 valid email addresses.";
  }
  if (new Set(recipientIds).size !== recipientIds.length) return "Remove duplicate email addresses from the selection.";
  if (mode === "selected" && recipientIds.length === 0) return "Select at least one eligible email address.";
  if (mode !== "selected" && recipientIds.length > 0) return "Recipient selections are only valid for selected addresses.";
  const since = sinceValue ?? "";
  if (typeof since !== "string") return "Choose a valid date for new members.";
  if (mode === "new" && !Number.isFinite(Date.parse(since))) return "Choose a valid original email date for new members.";
  return { mode, recipientIds, since };
}

export async function getCampaignRecipients(db: Firestore, campaign: Campaign, audience: CampaignAudience) {
  const isMeeting = campaign.kind === "meeting";
  const collection = db.collection(isMeeting ? "onlineMeetingMembers" : "newsletterSubscribers");
  const eligibleStatus = isMeeting ? "verified" : "active";
  if (audience.mode === "selected") {
    const recipients = [];
    for (let start = 0; start < audience.recipientIds.length; start += 100) {
      const refs = audience.recipientIds.slice(start, start + 100).map((id) => collection.doc(id));
      const snapshots = await db.getAll(...refs);
      recipients.push(...snapshots
        .filter((item) => item.exists && item.get("status") === eligibleStatus)
        .map((item) => ({ id: item.id, email: String(item.get("email") ?? ""), name: String(item.get("name") ?? "") }))
        .filter((item) => item.email));
    }
    return recipients;
  }
  const query = audience.mode === "new"
    ? collection.where("createdAt", ">", Timestamp.fromDate(new Date(audience.since)))
    : collection.where("status", "==", eligibleStatus);
  const snapshot = await query.limit(10000).get();
  return snapshot.docs
    .filter((item) => item.get("status") === eligibleStatus)
    .map((item) => ({ id: item.id, email: String(item.get("email") ?? ""), name: String(item.get("name") ?? "") }))
    .filter((item) => item.email);
}

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
  const richTags = /<\/?(?:a|b|blockquote|br|div|em|font|h[1-4]|i|img|li|ol|p|span|strong|u|ul)\b/i;
  const html = !richTags.test(value)
    ? value.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 20px;line-height:1.75;color:#46504d;font-size:18px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("")
    : sanitizeRichText(value);
  return inlineVideoLinks(html)
    .replace(/<p>/g, '<p style="margin:0 0 20px;line-height:1.75;color:#46504d;font-size:18px">')
    .replace(/<img\b([^>]*)>/gi, '<img$1 style="display:block;width:100%;max-width:640px;height:auto;margin:24px auto;border:0;border-radius:8px">');
}

export function renderCampaign(
  campaign: Campaign,
  unsubscribeUrl = "",
  brandLogoUrl = "",
  options: { includeFeaturedVideo?: boolean; textSuffix?: string; recipientName?: string } = {},
) {
  const buttonUrl = safeUrl(campaign.buttonUrl);
  const inlineVideoUrl = safeUrl(extractFeaturedVideoUrl(campaign.body));
  const videoUrl = options.includeFeaturedVideo === false ? "" : safeUrl(inlineVideoUrl || campaign.videoUrl);
  const logoUrl = safeUrl(brandLogoUrl);
  const youtubeId = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1];
  const preview = inlineVideoUrl ? "" : youtubeId
    ? `<a href="${escapeHtml(videoUrl)}" style="display:block;margin:26px 0;text-decoration:none"><img src="https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg" alt="Watch the featured video" width="560" style="display:block;width:100%;max-width:560px;border:0;border-radius:12px"><span style="display:block;padding:12px;color:#c51c31;font-weight:700">▶ Watch the video</span></a>`
    : videoUrl ? `<a href="${escapeHtml(videoUrl)}" style="display:block;margin:26px 0;padding:42px 20px;border-radius:12px;background:#172126;color:#fff;text-align:center;text-decoration:none"><span style="display:inline-block;padding:12px 17px;border:1px solid #ffffff80;border-radius:50%;font-size:20px">▶</span><strong style="display:block;margin-top:13px">Watch the featured video</strong></a>` : "";
  const greeting = `<p style="margin:0 0 16px;color:#46504d;font-size:17px;line-height:1.5">${escapeHtml(personalizedGreeting(options.recipientName))}</p>`;
  const button = buttonUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#172126;color:#fff;padding:14px 24px;border-radius:28px;text-decoration:none;font-weight:700">${escapeHtml(campaign.buttonLabel || "Learn more")}</a></p>`
    : "";
  const unsubscribe = unsubscribeUrl
    ? `<p style="margin:30px 0 0;padding-top:20px;border-top:1px solid #e5e8e6;color:#68736e;font-size:13px;line-height:1.6">You received this newsletter because you subscribed to Faith of the Pioneers. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#263e69;font-weight:700">Unsubscribe from emails</a></p>`
    : "";
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Faith of the Pioneers" width="84" height="84" style="display:block;width:84px;height:84px;object-fit:contain;margin:0 auto 12px;border:0">`
    : "";
  const letterTitle = escapeHtml(campaign.letterTitle || (campaign.kind === "meeting" ? "Online meeting reminder" : "A letter for your journey"));
  const siteUrl = logoUrl ? new URL(logoUrl).origin : "";
  const footerSite = siteUrl ? `<a href="${escapeHtml(siteUrl)}" style="color:#263e69;text-decoration:underline">Visit Faith of the Pioneers</a>` : "Faith of the Pioneers";
  return {
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:600px){.email-outer{padding:0!important}.email-card{border-radius:0!important}.email-content{padding:24px 20px!important}.email-brand{padding:25px 18px!important}.email-headline{font-size:29px!important}.email-body{font-size:18px!important}}</style></head><body style="margin:0;background:#f1f3f2;font-family:Arial,Helvetica,sans-serif;color:#172126"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(campaign.preheader || automaticPreviewText(campaign.body))}</div><table role="presentation" class="email-outer" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f3f2;padding:24px 14px"><tr><td align="center"><table role="presentation" class="email-card" width="720" cellspacing="0" cellpadding="0" style="width:100%;max-width:720px;background:#fff;border:1px solid #e5e8e6;border-radius:12px;overflow:hidden"><tr><td class="email-brand" align="center" style="padding:28px 24px;background:#082d63;background-image:linear-gradient(145deg,#0c3978,#061e49);color:#fff">${logo}<div style="font-size:12px;letter-spacing:3px;font-weight:700;color:#f3d875">FAITH OF THE PIONEERS</div><div style="height:1px;width:64px;background:#d8b84d;margin:15px auto 11px"></div><div style="font-size:17px;line-height:1.4;font-style:italic;color:#fff">${letterTitle}</div></td></tr><tr><td class="email-content" style="padding:36px 48px 40px"><div style="height:3px;width:42px;background:#c51c31;margin:0 0 20px"></div>${greeting}<h1 class="email-headline" style="font-size:34px;line-height:1.18;letter-spacing:-.5px;margin:0 0 24px;color:#172126">${escapeHtml(campaign.headline)}</h1><div class="email-body">${bodyHtml(campaign.body)}</div>${preview}${button}${unsubscribe}</td></tr><tr><td style="padding:22px 28px;background:#f7f8f6;border-top:1px solid #e8ebe8;color:#68736e;font-size:13px;line-height:1.7;text-align:center"><strong style="color:#243b64;letter-spacing:1.5px">FAITH OF THE PIONEERS</strong><br>Online fellowship, Bible study, and worship<br>${footerSite}<br><span style="font-size:11px;color:#84908a">© Faith of the Pioneers</span></td></tr></table></td></tr></table></body></html>`,
    text: [personalizedGreeting(options.recipientName), letterTitle, campaign.headline, richTextToPlainText(campaign.body), inlineVideoUrl ? "" : videoUrl ? `Watch: ${videoUrl}` : "", buttonUrl ? `${campaign.buttonLabel || "Learn more"}: ${buttonUrl}` : "", options.textSuffix, unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "", siteUrl ? `Visit Faith of the Pioneers: ${siteUrl}` : ""].filter(Boolean).join("\n\n"),
  };
}

export function unsubscribeLink(subscriberId: string, baseUrl: string) {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("NEWSLETTER_UNSUBSCRIBE_SECRET is not configured.");
  const signature = createSignature(subscriberId, secret);
  return `${baseUrl}/unsubscribe?id=${encodeURIComponent(subscriberId)}&sig=${signature}`;
}

function oneClickUnsubscribeLink(subscriberId: string, baseUrl: string) {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("NEWSLETTER_UNSUBSCRIBE_SECRET is not configured.");
  const signature = createSignature(subscriberId, secret);
  return `${baseUrl}/api/mailing/unsubscribe?id=${encodeURIComponent(subscriberId)}&sig=${signature}`;
}

function createSignature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function deliverCampaign(
  campaign: Campaign,
  recipients: Array<{ id: string; email: string; name?: string }>,
  baseUrl: string,
  idempotencyPrefix: string,
  options: { includeFeaturedVideo?: boolean; textSuffix?: string } = {},
) {
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
      const oneClickUnsubscribe = campaign.kind === "newsletter" ? oneClickUnsubscribeLink(recipient.id, baseUrl) : "";
      const content = renderCampaign(campaign, unsubscribe, `${baseUrl.replace(/\/$/, "")}/images/logo.jpeg`, {
        ...options,
        recipientName: recipient.name,
      });
      try {
        const { error } = await resend.emails.send({
          from,
          to: recipient.email,
          subject: campaign.subject,
          html: content.html,
          text: content.text,
          ...(oneClickUnsubscribe ? { headers: { "List-Unsubscribe": `<${oneClickUnsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
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

function welcomeVideoMarkup(videos: FeedVideo[]) {
  return videos.map((video) => {
    if (!/^[\w-]{11}$/.test(video.id)) return "";
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`;
    return `<p><a href="${watchUrl}"><img src="${thumbnailUrl}" alt="Watch ${escapeHtml(video.title)}"></a><br><strong>${escapeHtml(video.title || "Watch the latest video")}</strong></p>`;
  }).filter(Boolean).join("");
}

async function latestWelcomeVideos() {
  const feed = await getPublicCatalog();
  return feed.videos
    .filter((video) => video.availability !== "unavailable" && video.website?.hidden !== true && /^[\w-]{11}$/.test(video.id))
    .sort((first, second) => Date.parse(second.publishedAt) - Date.parse(first.publishedAt))
    .slice(0, 3);
}

function welcomeVideoSection(videos: FeedVideo[]) {
  return videos.length
    ? `<p>Here are three of our latest videos to enjoy:</p>${welcomeVideoMarkup(videos)}`
    : `<p>We share Bible studies, encouragement, and fellowship through our latest videos and updates. Visit our website to explore what is new.</p>`;
}

function welcomeVideoText(videos: FeedVideo[]) {
  return videos.map((video) => `Latest video: ${video.title} — https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`).join("\n");
}

export async function sendNewsletterWelcome(subscriber: { id: string; email: string; name?: string }, baseUrl: string) {
  const videos = await latestWelcomeVideos();
  const videoSection = videos.length
    ? welcomeVideoSection(videos)
    : `<p>We share Bible studies, encouragement, and fellowship through our latest videos and updates. Visit our website to explore what is new.</p>`;
  const campaign: Campaign = {
    kind: "newsletter",
    subject: "Welcome to Faith of the Pioneers",
    letterTitle: "A warm welcome",
    headline: "You're on the list!",
    preheader: "Thank you for subscribing. Here are three recent videos to get you started.",
    body: `<p>Thank you for subscribing to Faith of the Pioneers. We are glad to have you with us.</p>${videoSection}<p>We hope these messages encourage your faith and make you feel at home in our community.</p>`,
    buttonLabel: "Explore the website",
    buttonUrl: baseUrl,
    videoUrl: "",
  };
  const videoText = welcomeVideoText(videos);
  return deliverCampaign(
    campaign,
    [subscriber],
    baseUrl,
    `newsletter-welcome:${subscriber.id}:${Date.now()}`,
    { includeFeaturedVideo: false, textSuffix: videoText },
  );
}

export async function sendMeetingRequestWelcome(requester: { id: string; email: string; name: string }, baseUrl: string) {
  const videos = await latestWelcomeVideos();
  const campaign: Campaign = {
    kind: "meeting",
    subject: "Thank you for requesting a meeting link",
    letterTitle: "Online meeting link request",
    headline: "Thank you for reaching out",
    preheader: "We will send the meeting link soon. Please check your email regularly.",
    body: `<p>Thank you for requesting the online meeting link. We will send the link to this email address soon. Please wait patiently and check your email regularly.</p>${welcomeVideoSection(videos)}<p>We look forward to welcoming you to our online fellowship.</p>`,
    buttonLabel: "Visit our website",
    buttonUrl: baseUrl,
    videoUrl: "",
  };
  return deliverCampaign(
    campaign,
    [requester],
    baseUrl,
    `meeting-request-welcome:${requester.id}:${Date.now()}`,
    { includeFeaturedVideo: false, textSuffix: welcomeVideoText(videos) },
  );
}
