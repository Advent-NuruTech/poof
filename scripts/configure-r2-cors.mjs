import { createHash, createHmac } from "node:crypto";

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function awsEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const accountId = required("R2_ACCOUNT_ID");
const accessKeyId = required("R2_ACCESS_KEY_ID");
const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
const bucket = required("R2_BUCKET_NAME");
const managementToken = process.env.CLOUDFLARE_R2_ADMIN_TOKEN?.trim();
const endpoint = new URL(process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`);
const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://faithofthepioneers.org");
if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".r2.cloudflarestorage.com")) {
  throw new Error("R2_ENDPOINT must be the HTTPS S3 API endpoint for the account.");
}

const origins = new Set([site.origin, "http://localhost:3000", "http://127.0.0.1:3000"]);
if (site.hostname.startsWith("www.")) {
  origins.add(`${site.protocol}//${site.hostname.slice(4)}${site.port ? `:${site.port}` : ""}`);
} else if (!site.hostname.includes("localhost") && !/^\d+(?:\.\d+){3}$/.test(site.hostname)) {
  origins.add(`${site.protocol}//www.${site.hostname}${site.port ? `:${site.port}` : ""}`);
}

const originXml = [...origins].map((origin) => `<AllowedOrigin>${escapeXml(origin)}</AllowedOrigin>`).join("");
const apiRule = {
  id: "library-browser-uploads",
  allowed: { origins: [...origins], methods: ["PUT"], headers: ["Content-Type"] },
  exposeHeaders: ["ETag"],
  maxAgeSeconds: 7200,
};

if (managementToken) {
  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/cors`;
  const currentResponse = await fetch(apiUrl, { headers: { Authorization: `Bearer ${managementToken}` } });
  const currentBody = await currentResponse.json().catch(() => ({}));
  if (!currentResponse.ok || currentBody.success !== true) {
    throw new Error(`Could not read the R2 CORS policy with CLOUDFLARE_R2_ADMIN_TOKEN (${currentResponse.status}).`);
  }
  const existingRules = (currentBody.result?.rules ?? []).filter((rule) => rule.id !== apiRule.id);
  const updateResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${managementToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [...existingRules, apiRule] }),
  });
  const updateBody = await updateResponse.json().catch(() => ({}));
  if (!updateResponse.ok || updateBody.success !== true) {
    throw new Error(`Cloudflare rejected the R2 CORS update (${updateResponse.status}). Check that CLOUDFLARE_R2_ADMIN_TOKEN has R2 bucket edit permission.`);
  }
  console.log(`Configured R2 browser uploads for: ${[...origins].join(", ")}`);
  process.exit(0);
}

const body = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><CORSRule><ID>library-browser-uploads</ID>${originXml}<AllowedMethod>PUT</AllowedMethod><AllowedHeader>Content-Type</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>7200</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
const payloadHash = createHash("sha256").update(body).digest("hex");
const now = new Date();
const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
const date = amzDate.slice(0, 8);
const scope = `${date}/auto/s3/aws4_request`;
const canonicalUri = `${endpoint.pathname.replace(/\/$/, "")}/${awsEncode(bucket)}`;
const canonicalQuery = "cors=";
const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
const canonicalRequest = ["PUT", canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
const dateKey = hmac(`AWS4${secretAccessKey}`, date);
const regionKey = hmac(dateKey, "auto");
const serviceKey = hmac(regionKey, "s3");
const signingKey = hmac(serviceKey, "aws4_request");
const signature = hmac(signingKey, stringToSign).toString("hex");

const response = await fetch(`${endpoint.origin}${canonicalUri}?cors`, {
  method: "PUT",
  headers: {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "Content-Type": "application/xml",
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  },
  body,
});

if (!response.ok) {
  const detail = (await response.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  throw new Error(`R2 rejected the CORS update (${response.status})${detail ? `: ${detail}.` : "."} Use S3 credentials with bucket-level CORS permission or set CLOUDFLARE_R2_ADMIN_TOKEN with R2 bucket edit permission.`);
}

console.log(`Configured R2 browser uploads for: ${[...origins].join(", ")}`);
