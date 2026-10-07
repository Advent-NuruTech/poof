export type PublicShare = { url: string; title?: string; text?: string };

/** Share a public page through the native sheet, with clipboard as a fallback. */
export async function sharePublicUrl(share: string | PublicShare) {
  const payload = typeof share === "string" ? { url: share } : share;
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return true;
    }
    await navigator.clipboard.writeText(payload.url);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return false;
    try {
      await navigator.clipboard.writeText(payload.url);
      return true;
    } catch {
      return false;
    }
  }
}
