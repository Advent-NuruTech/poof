const apiKey = process.env.CRONJOB_ORG_API_KEY;
const cronSecret = process.env.CRON_SECRET;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://faithofthepioneers.org").replace(/\/+$/, "");
const jobTitle = "Poof scheduled mailing delivery";

if (!apiKey || !cronSecret) {
  throw new Error("Set CRONJOB_ORG_API_KEY and CRON_SECRET before syncing the mailing cron job.");
}

const parsedSiteUrl = new URL(siteUrl);
if (parsedSiteUrl.protocol !== "https:") {
  throw new Error("The mailing cron job requires an HTTPS site URL.");
}

const desiredJob = {
  title: jobTitle,
  url: `${siteUrl}/api/mailing/cron`,
  enabled: true,
  saveResponses: false,
  requestMethod: 0,
  extendedData: {
    headers: { Authorization: "Bearer".concat(" ", cronSecret) },
  },
  schedule: {
    timezone: "UTC",
    expiresAt: 0,
    hours: [-1],
    mdays: [-1],
    minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
    months: [-1],
    wdays: [-1],
  },
};

async function apiRequest(path, method, body) {
  const response = await fetch(`https://api.cron-job.org${path}`, {
    method,
    headers: {
      Authorization: "Bearer".concat(" ", apiKey),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(`cron-job.org API request failed (HTTP ${response.status}).`);
  }
  return method === "PATCH" || response.status === 204 ? null : response.json();
}

const listing = await apiRequest("/jobs", "GET");
if (!listing || listing.someFailed !== false || !Array.isArray(listing.jobs)) {
  throw new Error("cron-job.org returned an incomplete job list; no changes were made.");
}

const matchingJobs = listing.jobs.filter((job) => job.title === jobTitle);
if (matchingJobs.length > 1) {
  throw new Error("Multiple mailing cron jobs exist in cron-job.org; remove duplicates before syncing.");
}

if (matchingJobs.length === 1) {
  const jobId = matchingJobs[0].jobId;
  if (!Number.isInteger(jobId)) throw new Error("cron-job.org returned an invalid mailing job ID.");
  await apiRequest(`/jobs/${jobId}`, "PATCH", { job: desiredJob });
  console.log("Updated the mailing cron job.");
} else {
  const created = await apiRequest("/jobs", "PUT", { job: desiredJob });
  if (!created || !Number.isInteger(created.jobId)) {
    throw new Error("cron-job.org did not return the created mailing job ID.");
  }
  console.log("Created the mailing cron job.");
}
