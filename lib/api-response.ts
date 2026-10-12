export async function readApiResponse<T extends object>(response: Response, action: string): Promise<T> {
  const text = await response.text();
  let result: unknown;

  try {
    result = text ? JSON.parse(text) as unknown : null;
  } catch {
    if (!response.ok) {
      throw new Error(`${action} failed (HTTP ${response.status}); the server returned an invalid response.`);
    }
    throw new Error(`${action} returned an invalid response (HTTP ${response.status}).`);
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(text
      ? `${action} returned an invalid response (HTTP ${response.status}).`
      : `${action} returned an empty response (HTTP ${response.status}).`);
  }

  const body = result as T & { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `${action} failed (HTTP ${response.status}).`);
  }

  return body;
}
