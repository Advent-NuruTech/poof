import { FieldValue, mailDb, Timestamp, type Campaign, deliverCampaign } from "@/lib/mailing-server";

export const maxDuration = 300;

type MailSchedule = Campaign & {
  repeat: "once" | "daily" | "weekly" | "monthly";
  startsAt: string;
  endsAt: string;
  timeZone: string;
  active: boolean;
};

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

function zonedDate(parts: ReturnType<typeof zonedParts>, timeZone: string) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let result = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(result), timeZone);
    result += target - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  }
  return new Date(result);
}

function nextOccurrence(previous: Date, repeat: MailSchedule["repeat"], timeZone: string) {
  if (repeat === "once") return null;
  const parts = zonedParts(previous, timeZone);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (repeat === "daily") date.setUTCDate(date.getUTCDate() + 1);
  if (repeat === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (repeat === "monthly") {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const finalDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay, finalDay));
  }
  return zonedDate({ ...parts, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }, timeZone);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    const due = await mailDb.collection("mailingSchedules")
      .where("nextSendAt", "<=", Timestamp.now())
      .limit(20)
      .get();
    const results: Array<{ id: string; status: string }> = [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `https://${process.env.VERCEL_URL ?? new URL(request.url).host}`;
    for (const candidate of due.docs) {
      const ref = candidate.ref;
      const claim = await mailDb.runTransaction(async (transaction) => {
        const current = await transaction.get(ref);
        const data = current.data() as (MailSchedule & { nextSendAt?: Timestamp; processingUntil?: Timestamp; retryFor?: number; retryCount?: number }) | undefined;
        if (!current.exists || !data?.active || !data.nextSendAt || data.nextSendAt.toMillis() > Date.now() ||
            (data.processingUntil && data.processingUntil.toMillis() > Date.now())) return null;
        const scheduledAt = data.retryFor ? Timestamp.fromMillis(data.retryFor) : data.nextSendAt;
        transaction.update(ref, { processingUntil: Timestamp.fromMillis(Date.now() + 10 * 60_000) });
        return { data, scheduledAt };
      });
      if (!claim) continue;
      try {
        const configError = !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL
          ? "Configure RESEND_API_KEY and RESEND_FROM_EMAIL before sending email."
          : claim.data.kind === "newsletter" && !process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
            ? "Configure NEWSLETTER_UNSUBSCRIBE_SECRET before sending newsletters."
            : "";
        if (configError) {
          await ref.update({
            active: false, status: "error", nextSendAt: FieldValue.delete(),
            processingUntil: FieldValue.delete(), lastError: configError,
          });
          results.push({ id: ref.id, status: "configuration-error" });
          continue;
        }
        const audience = await mailDb.collection(claim.data.kind === "meeting" ? "onlineMeetingMembers" : "newsletterSubscribers")
          .where("status", "==", claim.data.kind === "meeting" ? "verified" : "active")
          .limit(10000).get();
        const recipients = audience.docs.map((item) => ({ id: item.id, email: String(item.get("email") ?? "") })).filter((item) => item.email);
        const campaign: Campaign = {
          kind: claim.data.kind, subject: claim.data.subject, headline: claim.data.headline,
          preheader: claim.data.preheader, body: claim.data.body, buttonLabel: claim.data.buttonLabel,
          buttonUrl: claim.data.buttonUrl, videoUrl: claim.data.videoUrl,
        };
        const delivery = await deliverCampaign(campaign, recipients, baseUrl, `${ref.id}:${claim.scheduledAt.toMillis()}`);
        await mailDb.collection("mailingHistory").add({
          scheduleId: ref.id, kind: campaign.kind, subject: campaign.subject, headline: campaign.headline,
          requested: recipients.length, sent: delivery.sent, failed: delivery.failures.length,
          failures: delivery.failures.slice(0, 100), sentAt: FieldValue.serverTimestamp(), scheduledFor: claim.scheduledAt.toDate().toISOString(),
        });
        const retryCount = claim.data.retryCount ?? 0;
        if (delivery.failures.some((failure) => failure.retryable) && retryCount < 3) {
          await ref.update({
            nextSendAt: Timestamp.fromMillis(Date.now() + 5 * 60_000),
            retryFor: claim.scheduledAt.toMillis(),
            retryCount: retryCount + 1,
            processingUntil: FieldValue.delete(),
            lastError: "Temporary delivery errors; retrying failed recipient deliveries.",
          });
          results.push({ id: ref.id, status: "retry-scheduled" });
          continue;
        }
        let next = nextOccurrence(claim.scheduledAt.toDate(), claim.data.repeat, claim.data.timeZone || "UTC");
        const endsAt = claim.data.endsAt ? new Date(claim.data.endsAt) : null;
        while (next && next.getTime() <= Date.now()) {
          next = nextOccurrence(next, claim.data.repeat, claim.data.timeZone || "UTC");
        }
        const complete = next === null || (endsAt !== null && next.getTime() > endsAt.getTime());
        await ref.update({
          lastSentAt: FieldValue.serverTimestamp(),
          lastResult: { sent: delivery.sent, failed: delivery.failures.length },
          active: !complete,
          status: complete ? "completed" : "scheduled",
          ...(!complete && next ? { nextSendAt: Timestamp.fromDate(next) } : { nextSendAt: FieldValue.delete() }),
          processingUntil: FieldValue.delete(),
          retryFor: FieldValue.delete(),
          retryCount: FieldValue.delete(),
        });
        results.push({ id: ref.id, status: delivery.failures.length ? "sent-with-failures" : "sent" });
      } catch (error) {
        console.error("Scheduled email failed", { scheduleId: ref.id, error });
        const retryCount = claim.data.retryCount ?? 0;
        if (retryCount < 3) {
          await ref.update({
            nextSendAt: Timestamp.fromMillis(Date.now() + 5 * 60_000),
            retryFor: claim.scheduledAt.toMillis(),
            retryCount: retryCount + 1,
            processingUntil: FieldValue.delete(),
            lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery error",
          });
          results.push({ id: ref.id, status: "retry-scheduled" });
        } else {
          await ref.update({
            active: false, status: "error", nextSendAt: FieldValue.delete(),
            processingUntil: FieldValue.delete(),
            lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery error",
          });
          results.push({ id: ref.id, status: "failed" });
        }
      }
    }
    return Response.json({ processed: results.length, results });
  } catch (error) {
    console.error("Mailing cron failed", error);
    return Response.json({ error: "Could not process scheduled email delivery." }, { status: 500 });
  }
}
