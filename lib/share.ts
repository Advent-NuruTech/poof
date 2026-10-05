/** Share a public page through the native sheet, with clipboard as a fallback. */
export async function sharePublicUrl(url: string) {
  try {
    if (navigator.share) {
      await navigator.share({ url });
      return true;
    }
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return false;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
}
