export type D1Row = Record<string, string | number | null>;

type D1QueryResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{ success?: boolean; results?: D1Row[]; error?: string }>;
};

function endpoint() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? process.env.D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) throw new Error("Video catalog storage is not configured. Set the Cloudflare D1 account, database, and API token.");
  return {
    url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`,
    token,
  };
}

export async function queryD1<T extends D1Row = D1Row>(sql: string, params: Array<string | number | null> = []) {
  const { url, token } = endpoint();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json() as D1QueryResponse;
  if (!response.ok || body.success === false || body.result?.[0]?.success === false) {
    throw new Error(body.errors?.[0]?.message ?? body.result?.[0]?.error ?? `Cloudflare D1 query failed (${response.status}).`);
  }
  return body.result?.[0]?.results as T[] ?? [];
}

export function isD1Configured() {
  return Boolean((process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID) && (process.env.CLOUDFLARE_D1_DATABASE_ID ?? process.env.D1_DATABASE_ID) && process.env.CLOUDFLARE_API_TOKEN);
}
