function firstHeaderValue(request: Request, name: string) {
  return request.headers.get(name)?.split(",")[0]?.trim() || null;
}

function originFor(protocol: string, host: string) {
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

export function isValidRequestOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return true;

  let origin: URL;
  let requestUrl: URL;
  try {
    origin = new URL(originHeader);
    requestUrl = new URL(request.url);
  } catch {
    return false;
  }
  if (origin.origin !== originHeader) return false;

  const forwardedHost = firstHeaderValue(request, "x-forwarded-host");
  const host = firstHeaderValue(request, "host");
  const forwardedProtocol = firstHeaderValue(request, "x-forwarded-proto")?.replace(/:$/, "") ?? null;
  const hosts = [...new Set([forwardedHost, host].filter((value): value is string => value !== null))];
  const protocol = forwardedProtocol ?? requestUrl.protocol.slice(0, -1);

  if (hosts.some((candidateHost) => originFor(protocol, candidateHost) === origin.origin)) {
    return true;
  }
  if (requestUrl.origin === origin.origin) return true;

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredSiteUrl) return false;

  let siteUrl: URL;
  try {
    siteUrl = new URL(configuredSiteUrl);
  } catch {
    return false;
  }
  if (siteUrl.origin === origin.origin) return true;

  const aliasHostname = siteUrl.hostname.startsWith("www.")
    ? siteUrl.hostname.slice(4)
    : `www.${siteUrl.hostname}`;
  const aliasHost = `${aliasHostname}${siteUrl.port ? `:${siteUrl.port}` : ""}`;
  return originFor(siteUrl.protocol.slice(0, -1), aliasHost) === origin.origin;
}
