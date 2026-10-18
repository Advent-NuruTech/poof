import { createHash, createHmac, randomUUID } from "node:crypto";

function hmac(key: Uint8Array | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function awsPath(value: string) {
  return value.split("/").map(awsEncode).join("/");
}

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const endpoint = process.env.R2_ENDPOINT ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint || !publicBaseUrl) {
    throw new Error("Document storage is not configured. Set the R2 account, bucket, S3 credentials, endpoint, and public URL.");
  }
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== "https:" || !endpointUrl.hostname.endsWith(".r2.cloudflarestorage.com")) throw new Error("R2_ENDPOINT must be the HTTPS S3 API endpoint for your R2 account.");
  return { accountId, accessKeyId, secretAccessKey, bucket, endpointUrl, publicBaseUrl };
}

export function createDocumentKey(fileName: string) {
  const extension = fileName.match(/\.[a-z0-9]{1,10}$/i)?.[0]?.toLowerCase() ?? "";
  return `library/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
}

export function documentPublicUrl(key: string) {
  const { publicBaseUrl } = config();
  return `${publicBaseUrl}/${awsPath(key)}`;
}

export function createR2UploadUrl(key: string, contentType: string, expiresSeconds = 600) {
  const { accessKeyId, secretAccessKey, bucket, endpointUrl } = config();
  const host = endpointUrl.host;
  const safeContentType = contentType.trim().toLowerCase();
  if (!safeContentType || /[\r\n]/.test(safeContentType)) throw new Error("A valid upload content type is required.");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const prefix = endpointUrl.pathname.replace(/\/$/, "");
  const path = `${prefix}/${awsPath(bucket)}/${awsPath(key)}`;
  const pairs: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD"],
    ["X-Amz-Credential", `${accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", "content-type;host"],
  ];
  const canonicalQuery = pairs
    .map(([name, value]) => [awsEncode(name), awsEncode(value)] as const)
    .sort(([aName, aValue], [bName, bValue]) => aName.localeCompare(bName) || aValue.localeCompare(bValue))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  const canonicalHeaders = `content-type:${safeContentType}\nhost:${host}\n`;
  const canonicalRequest = ["PUT", path, canonicalQuery, canonicalHeaders, "content-type;host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");
  return `${endpointUrl.origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function validateR2PublicUrl(value: string) {
  const { publicBaseUrl } = config();
  const base = new URL(publicBaseUrl);
  const url = new URL(value);
  return url.protocol === "https:" && url.origin === base.origin && url.pathname.startsWith(`${base.pathname.replace(/\/$/, "")}/`);
}
