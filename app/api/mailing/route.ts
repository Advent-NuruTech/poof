import { createHash, randomUUID } from "node:crypto";
import {
  FieldValue, getCampaignRecipients, getEmailsSentCount, getMailDb, parseCampaignAudience, requireMailAdmin, Timestamp,
  type Campaign, type CampaignAudience, deliverCampaign,
} from "@/lib/mailing-server";
import { extractFeaturedVideoUrl, richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";

export const maxDuration = 300;

type ScheduleInput = Campaign & {
  action?: string;
  repeat?: "once" | "daily" | "weekly" | "monthly";
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
  label?: string;
  email?: string;
  name?: string;
  historyId?: string;
  audienceMode?: CampaignAudience["mode"];
  recipientIds?: string[];
  audienceSince?: string;
};

const validUrl = (value: string) => {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
};

function parseCampaign(body: ScheduleInput): Campaign | string {
  if (body.kind !== "meeting" && body.kind !== "newsletter") return "Choose a mailing list.";
  const fields = ["subject", "headline", "preheader", "body", "buttonLabel", "buttonUrl", "videoUrl"] as const;
  for (const field of fields) {
    if (typeof body[field] !== "string") return "Complete every message field.";
  }
  if (body.letterTitle !== undefined && typeof body.letterTitle !== "string") return "Enter a valid email header.";
  const campaign = Object.fromEntries(fields.map((field) => [field, body[field]!.trim()])) as Omit<Campaign, "kind">;
  const result: Campaign = {
    ...campaign,
    kind: body.kind,
    letterTitle: (body.letterTitle?.trim() || (body.kind === "meeting" ? "Online meeting reminder" : "A letter for your journey")),
    preheader: campaign.preheader,
    body: sanitizeRichText(campaign.body),
    videoUrl: campaign.videoUrl || extractFeaturedVideoUrl(campaign.body),
  };
  if (!result.subject || result.subject.length > 180 || !result.headline || result.headline.length > 180 ||
      !result.letterTitle || result.letterTitle.length > 140 || result.body.length > 60000) {
    return "Add a subject and headline, and keep the message within 12,000 characters.";
  }
  if (!validUrl(result.buttonUrl) || !validUrl(result.videoUrl)) return "Links must use HTTPS.";
  if (result.preheader.length > 180 || richTextToPlainText(result.body).length > 12000) {
    return "Keep the inbox preview within 180 characters and the message within 12,000 characters.";
  }
  if (result.kind === "meeting" && !result.buttonUrl) return "Add the meeting link before sending.";
  if (result.kind === "newsletter" && !richTextToPlainText(result.body)) return "Write the newsletter message before sending.";
  return result;
}

function isFirestoreReadLimit(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  const message = error instanceof Error ? error.message : "";
  return code === 8 || code === 429 || code === "resource-exhausted" ||
    /RESOURCE_EXHAUSTED|quota exceeded/i.test(message);
}

async function recordDelivery(
  request: Request,
  mailDb: FirebaseFirestore.Firestore,
  adminId: string,
  campaign: Campaign,
  audience: CampaignAudience,
  parentHistoryId?: string,
) {
  const recipients = await getCampaignRecipients(mailDb, campaign, audience);
  if (!recipients.length) return Response.json({ error: "No eligible recipients match this selection." }, { status: 400 });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `https://${process.env.VERCEL_URL ?? new URL(request.url).host}`;
  await getEmailsSentCount(mailDb);
  const result = await deliverCampaign(campaign, recipients, baseUrl, randomUUID());
  const historyRef = mailDb.collection("mailingHistory").doc();
  const batch = mailDb.batch();
  batch.set(historyRef, {
    kind: campaign.kind,
    subject: campaign.subject,
    headline: campaign.headline,
    campaign,
    audienceMode: audience.mode,
    requested: recipients.length,
    sent: result.sent,
    failed: result.failures.length,
    failures: result.failures.slice(0, 100),
    ...(parentHistoryId ? { parentHistoryId } : {}),
    sentAt: FieldValue.serverTimestamp(),
    sentBy: adminId,
  });
  batch.set(mailDb.collection("mailingStats").doc("summary"), {
    emailsSent: FieldValue.increment(result.sent),
  }, { merge: true });
  await batch.commit();
  return Response.json({ sent: result.sent, failed: result.failures.length, failures: result.failures.slice(0, 20) });
}

export async function GET(request: Request) {
  try {
    if (!await requireMailAdmin(request)) return Response.json({ error: "Administrator access is required." }, { status: 401 });
    const mailDb = getMailDb();
    const [emailsSent, members, subscribers, schedules, history, verifiedMembers, pendingMembers, activeSubscribers, unsubscribed, totalMembers, totalSubscribers] = await Promise.all([
      getEmailsSentCount(mailDb),
      mailDb.collection("onlineMeetingMembers").orderBy("createdAt", "desc").limit(500).get(),
      mailDb.collection("newsletterSubscribers").orderBy("createdAt", "desc").limit(500).get(),
      mailDb.collection("mailingSchedules").orderBy("createdAt", "desc").limit(100).get(),
      mailDb.collection("mailingHistory").orderBy("sentAt", "desc").limit(50).get(),
      mailDb.collection("onlineMeetingMembers").where("status", "==", "verified").count().get(),
      mailDb.collection("onlineMeetingMembers").where("status", "==", "pending").count().get(),
      mailDb.collection("newsletterSubscribers").where("status", "==", "active").count().get(),
      mailDb.collection("newsletterSubscribers").where("status", "==", "unsubscribed").count().get(),
      mailDb.collection("onlineMeetingMembers").count().get(),
      mailDb.collection("newsletterSubscribers").count().get(),
    ]);
    const serialize = (snapshot: FirebaseFirestore.QuerySnapshot) =>
      snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    return Response.json({
      members: serialize(members),
      subscribers: serialize(subscribers),
      schedules: serialize(schedules),
      history: serialize(history),
      counts: {
        verified: verifiedMembers.data().count,
        pending: pendingMembers.data().count,
        active: activeSubscribers.data().count,
        unsubscribed: unsubscribed.data().count,
        totalMembers: totalMembers.data().count,
        totalSubscribers: totalSubscribers.data().count,
        emailsSent,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Mailing admin list failed", error);
    const rateLimited = isFirestoreReadLimit(error);
    return Response.json({
      error: rateLimited
        ? "Firestore is temporarily rate-limited (read quota exceeded). Check the Firebase usage and billing limits, then try again."
        : "Could not load mailing lists and history.",
    }, { status: rateLimited ? 429 : 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await requireMailAdmin(request);
    if (!adminId) return Response.json({ error: "Administrator access is required." }, { status: 401 });
    const mailDb = getMailDb();
    let body: ScheduleInput;
    try { body = await request.json() as ScheduleInput; }
    catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid request body." }, { status: 400 });
    if (body.action === "add-member") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
      if (body.name !== undefined && typeof body.name !== "string") return Response.json({ error: "Enter a valid first name." }, { status: 400 });
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length > 120) return Response.json({ error: "Keep the first name under 120 characters." }, { status: 400 });
      const id = createHash("sha256").update(email).digest("hex");
      const member = mailDb.collection("onlineMeetingMembers").doc(id);
      const result = await mailDb.runTransaction(async (transaction) => {
        const prior = await transaction.get(member);
        const alreadyVerified = prior.exists && prior.get("status") === "verified";
        transaction.set(member, {
          email,
          ...(name ? { name } : prior.exists && prior.get("name") ? { name: prior.get("name") } : {}),
          status: "verified", source: "admin",
          ...(prior.exists ? { createdAt: prior.get("createdAt") } : { createdAt: FieldValue.serverTimestamp() }),
          verifiedAt: FieldValue.serverTimestamp(),
        });
        return alreadyVerified ? "already-verified" : "verified";
      });
      return Response.json({ status: result }, { status: result === "verified" ? 201 : 200 });
    }
    if (body.action === "history-send") {
      if (typeof body.historyId !== "string" || !body.historyId || body.historyId.length > 150) {
        return Response.json({ error: "Choose a valid email from history." }, { status: 400 });
      }
      const history = await mailDb.collection("mailingHistory").doc(body.historyId).get();
      const savedCampaign = history.get("campaign");
      if (!history.exists || !savedCampaign || typeof savedCampaign !== "object") {
        return Response.json({ error: "This older email has no saved message to resend. Edit it in the composer instead." }, { status: 409 });
      }
      const campaign = parseCampaign({ ...(savedCampaign as ScheduleInput), kind: history.get("kind") as Campaign["kind"] });
      if (typeof campaign === "string") return Response.json({ error: "The saved email cannot be resent because its content is invalid." }, { status: 409 });
      const mode = body.audienceMode === "new" ? "new" : body.audienceMode === "all" || body.audienceMode === undefined ? "all" : "";
      if (!mode) return Response.json({ error: "Choose all eligible members or new members." }, { status: 400 });
      const sentAt = history.get("sentAt");
      if (mode === "new" && !(sentAt instanceof Timestamp)) {
        return Response.json({ error: "This email's send date is unavailable, so new members cannot be identified." }, { status: 409 });
      }
      const audience: CampaignAudience = {
        mode,
        recipientIds: [],
        since: mode === "new" ? (sentAt as Timestamp).toDate().toISOString() : "",
      };
      return await recordDelivery(request, mailDb, adminId, campaign, audience, body.historyId);
    }
    const campaign = parseCampaign(body);
    if (typeof campaign === "string") return Response.json({ error: campaign }, { status: 400 });

    if (body.action === "send") {
      const audience = parseCampaignAudience(body.audienceMode, body.recipientIds, body.audienceSince);
      if (typeof audience === "string") return Response.json({ error: audience }, { status: 400 });
      return await recordDelivery(request, mailDb, adminId, campaign, audience);
    }

    if (body.action === "schedule") {
      const audience = parseCampaignAudience(body.audienceMode, body.recipientIds, body.audienceSince);
      if (typeof audience === "string") return Response.json({ error: audience }, { status: 400 });
      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        return Response.json({ error: "Configure RESEND_API_KEY and RESEND_FROM_EMAIL before scheduling email." }, { status: 503 });
      }
      if (campaign.kind === "newsletter" && !process.env.NEWSLETTER_UNSUBSCRIBE_SECRET) {
        return Response.json({ error: "Configure NEWSLETTER_UNSUBSCRIBE_SECRET before scheduling newsletters." }, { status: 503 });
      }
      if (!body.startsAt || !Number.isFinite(Date.parse(body.startsAt))) return Response.json({ error: "Choose a valid schedule date and time." }, { status: 400 });
      if (!["once", "daily", "weekly", "monthly"].includes(body.repeat ?? "")) return Response.json({ error: "Choose a valid repeat frequency." }, { status: 400 });
      if (body.endsAt && (!Number.isFinite(Date.parse(body.endsAt)) || Date.parse(body.endsAt) < Date.parse(body.startsAt))) {
        return Response.json({ error: "The repeat end must be on or after the first send." }, { status: 400 });
      }
      const startsAt = new Date(body.startsAt);
      const schedule = await mailDb.collection("mailingSchedules").add({
        ...campaign,
        audienceMode: audience.mode,
        recipientIds: audience.recipientIds,
        audienceSince: audience.since,
        label: typeof body.label === "string" ? body.label.slice(0, 100) : campaign.subject,
        repeat: body.repeat,
        startsAt: startsAt.toISOString(),
        endsAt: body.repeat === "once" ? "" : body.endsAt ?? "",
        timeZone: typeof body.timeZone === "string" ? body.timeZone.slice(0, 80) : "UTC",
        nextSendAt: Timestamp.fromDate(startsAt),
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: adminId,
      });
      return Response.json({ id: schedule.id }, { status: 201 });
    }
    return Response.json({ error: "Choose send or schedule." }, { status: 400 });
  } catch (error) {
    console.error("Mailing action failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "The email operation failed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const adminId = await requireMailAdmin(request);
    if (!adminId) return Response.json({ error: "Administrator access is required." }, { status: 401 });
    const mailDb = getMailDb();
    const body = await request.json() as ScheduleInput & { collection?: string; id?: string; status?: string };
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid request body." }, { status: 400 });
    if (!body.id || body.id.length > 150) return Response.json({ error: "Choose a valid record." }, { status: 400 });
    if (body.collection === "history" && body.status === "delete") {
      await mailDb.collection("mailingHistory").doc(body.id).delete();
      return Response.json({ ok: true });
    }
    if (body.collection === "schedules" && body.status === "cancelled") {
      await mailDb.collection("mailingSchedules").doc(body.id).update({ active: false, status: "cancelled", nextSendAt: FieldValue.delete() });
      return Response.json({ ok: true });
    }
    if (body.collection === "schedules" && body.status === "scheduled") {
      const campaign = parseCampaign(body);
      if (typeof campaign === "string") return Response.json({ error: campaign }, { status: 400 });
      const audience = parseCampaignAudience(body.audienceMode, body.recipientIds, body.audienceSince);
      if (typeof audience === "string") return Response.json({ error: audience }, { status: 400 });
      if (!body.startsAt || !Number.isFinite(Date.parse(body.startsAt)) || !["once", "daily", "weekly", "monthly"].includes(body.repeat ?? "")) {
        return Response.json({ error: "Choose a valid date, time, and repeat frequency." }, { status: 400 });
      }
      if (body.endsAt && (!Number.isFinite(Date.parse(body.endsAt)) || Date.parse(body.endsAt) < Date.parse(body.startsAt))) {
        return Response.json({ error: "The repeat end must be on or after the first send." }, { status: 400 });
      }
      const ref = mailDb.collection("mailingSchedules").doc(body.id);
      const updated = await mailDb.runTransaction(async (transaction) => {
        const prior = await transaction.get(ref);
        if (!prior.exists) return false;
        const lock = prior.get("processingUntil") as Timestamp | undefined;
        if (lock && lock.toMillis() > Date.now()) return null;
        const startsAt = new Date(body.startsAt!);
        transaction.update(ref, {
          ...campaign,
          audienceMode: audience.mode,
          recipientIds: audience.recipientIds,
          audienceSince: audience.since,
          repeat: body.repeat,
          startsAt: startsAt.toISOString(),
          endsAt: body.repeat === "once" ? "" : body.endsAt ?? "",
          timeZone: typeof body.timeZone === "string" ? body.timeZone.slice(0, 80) : "UTC",
          nextSendAt: Timestamp.fromDate(startsAt),
          active: true, status: "scheduled", updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminId, lastError: FieldValue.delete(), retryCount: FieldValue.delete(), retryFor: FieldValue.delete(),
        });
        return true;
      });
      if (updated === null) return Response.json({ error: "This email is currently being sent. Try again shortly." }, { status: 409 });
      if (!updated) return Response.json({ error: "The scheduled email no longer exists." }, { status: 404 });
      return Response.json({ ok: true });
    }
    if (body.collection === "members" && ["pending", "verified"].includes(body.status ?? "")) {
      await mailDb.collection("onlineMeetingMembers").doc(body.id).update({
        status: body.status,
        ...(body.status === "verified" ? { verifiedAt: FieldValue.serverTimestamp(), verifiedBy: adminId } : { verifiedAt: FieldValue.delete(), verifiedBy: FieldValue.delete() }),
      });
      return Response.json({ ok: true });
    }
    if (body.collection === "members" && body.status === "delete") {
      await mailDb.collection("onlineMeetingMembers").doc(body.id).delete();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unsupported mailing update." }, { status: 400 });
  } catch (error) {
    console.error("Mailing record update failed", error);
    return Response.json({ error: "Could not update the mailing record." }, { status: 500 });
  }
}
