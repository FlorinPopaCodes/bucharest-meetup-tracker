// Returns the URLs that answer 404 (organizer deleted the event).
// Anything else — other statuses, timeouts, network errors — counts as alive,
// so a flaky source never hides real events.
export async function findDeadUrls(urls: string[]): Promise<Set<string>> {
  const results = await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      return res.status === 404 ? url : null;
    } catch {
      return null;
    }
  }));
  return new Set(results.filter((u): u is string => u !== null));
}
