import { createHash, randomUUID } from "node:crypto";
import { FieldValue, getMailDb, requireMailAdmin, Timestamp, type Campaign, deliverCampaign } from "@/lib/mailing-server";

export const maxDuration = 300;

type ScheduleInput = Campaign & {
  action?: string;
  repeat?: "once" | "daily" | "weekly" | "monthly";
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
  label?: string;
  email?: string;
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
  const campaign = Object.fromEntries(fields.map((field) => [field, body[field]!.trim()])) as Omit<Campaign, "kind">;
  const result: Campaign = { ...campaign, kind: body.kind };
  if (!result.subject || result.subject.length > 180 || !result.headline || result.headline.length > 180 || result.body.length > 12000) {
    return "Add a subject and headline, and keep the message within 12,000 characters.";
  }
  if (!validUrl(result.buttonUrl) || !validUrl(result.videoUrl)) return "Links must use HTTPS.";
  if (result.kind === "meeting" && !result.buttonUrl) return "Add the meeting link before sending.";
  if (result.kind === "newsletter" && !result.body) return "Write the newsletter message before sending.";
  return result;
}

export async function GET(request: Request) {
  try {
    if (!await requireMailAdmin(request)) return Response.json({ error: "Administrator access is required." }, { status: 401 });
    const mailDb = getMailDb();
    const [members, subscribers, schedules, history, verifiedMembers, pendingMembers, activeSubscribers, unsubscribed] = await Promise.all([
      mailDb.collection("onlineMeetingMembers").orderBy("createdAt", "desc").limit(500).get(),
      mailDb.collection("newsletterSubscribers").orderBy("createdAt", "desc").limit(500).get(),
      mailDb.collection("mailingSchedules").orderBy("createdAt", "desc").limit(100).get(),
      mailDb.collection("mailingHistory").orderBy("sentAt", "desc").limit(50).get(),
      mailDb.collection("onlineMeetingMembers").where("status", "==", "verified").count().get(),
      mailDb.collection("onlineMeetingMembers").where("status", "==", "pending").count().get(),
      mailDb.collection("newsletterSubscribers").where("status", "==", "active").count().get(),
      mailDb.collection("newsletterSubscribers").where("status", "==", "unsubscribed").count().get(),
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
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Mailing admin list failed", error);
    return Response.json({ error: "Could not load mailing lists and history." }, { status: 500 });
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
      const id = createHash("sha256").update(email).digest("hex");
      const member = mailDb.collection("onlineMeetingMembers").doc(id);
      const result = await mailDb.runTransaction(async (transaction) => {
        const prior = await transaction.get(member);
        if (prior.exists && prior.get("status") === "verified") return "already-verified";
        transaction.set(member, {
          email, status: "verified", source: "admin",
          ...(prior.exists ? { createdAt: prior.get("createdAt") } : { createdAt: FieldValue.serverTimestamp() }),
          verifiedAt: FieldValue.serverTimestamp(),
        });
        return "verified";
      });
      return Response.json({ status: result }, { status: result === "verified" ? 201 : 200 });
    }
    const campaign = parseCampaign(body);
    if (typeof campaign === "string") return Response.json({ error: campaign }, { status: 400 });

    if (body.action === "send") {
      const audience = await mailDb.collection(campaign.kind === "meeting" ? "onlineMeetingMembers" : "newsletterSubscribers")
        .where("status", "==", campaign.kind === "meeting" ? "verified" : "active")
        .limit(10000).get();
      const recipients = audience.docs.map((item) => ({ id: item.id, email: String(item.get("email") ?? "") })).filter((item) => item.email);
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `https://${process.env.VERCEL_URL ?? new URL(request.url).host}`;
      const result = await deliverCampaign(campaign, recipients, baseUrl, randomUUID());
      await mailDb.collection("mailingHistory").add({
        kind: campaign.kind, subject: campaign.subject, headline: campaign.headline,
        requested: recipients.length, sent: result.sent, failed: result.failures.length,
        failures: result.failures.slice(0, 100), sentAt: FieldValue.serverTimestamp(), sentBy: adminId,
      });
      return Response.json({ sent: result.sent, failed: result.failures.length, failures: result.failures.slice(0, 20) });
    }

    if (body.action === "schedule") {
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
    if (body.collection === "schedules" && body.status === "cancelled") {
      await mailDb.collection("mailingSchedules").doc(body.id).update({ active: false, status: "cancelled", nextSendAt: FieldValue.delete() });
      return Response.json({ ok: true });
    }
    if (body.collection === "schedules" && body.status === "scheduled") {
      const campaign = parseCampaign(body);
      if (typeof campaign === "string") return Response.json({ error: campaign }, { status: 400 });
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
