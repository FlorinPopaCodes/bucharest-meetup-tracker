import type { EventRow } from "./csv.ts";
import { isBucharestText } from "./filter.ts";

const UA =
  "bucharest-meetup-tracker (+https://github.com/FlorinPopaCodes/bucharest-meetup-tracker)";
const TIMEOUT_MS = 20_000;

export interface IabiletVenue {
  name: string;
  slug: string;
  url: string;
}

// ponytail: iaBilet has no feed, but every event carries a schema.org JSON-LD
// Event block. We read those off a single venue page. Date-only — iaBilet's
// startDate has no time-of-day, and the listing rows don't show one either.

interface LdEvent {
  "@type"?: string;
  name?: string;
  url?: string;
  startDate?: string;
  location?: { address?: { streetAddress?: string; addressLocality?: string } };
}

function parseLdEvents(html: string): LdEvent[] {
  const out: LdEvent[] = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gis;
  for (const m of html.matchAll(re)) {
    // Real pages wrap the JSON in a /*<![CDATA[*/ ... /*]]>*/ comment.
    const body = m[1].replace(/\/\*<!\[CDATA\[\*\//, "").replace(/\/\*\]\]>\*\//, "").trim();
    try {
      const obj = JSON.parse(body);
      if (obj && obj["@type"] === "Event") out.push(obj as LdEvent);
    } catch { /* skip non-JSON / malformed blocks */ }
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchVenueRows(venue: IabiletVenue, today: string): Promise<EventRow[]> {
  return htmlToRows(await fetchText(venue.url), venue, today);
}

export function htmlToRows(html: string, venue: IabiletVenue, today: string): EventRow[] {
  const rows: EventRow[] = [];
  for (const ev of parseLdEvents(html)) {
    const url = ev.url;
    const startDate = ev.startDate;
    if (!url || !startDate) continue;

    const addr = ev.location?.address ?? {};
    const locality = addr.addressLocality ?? "";
    if (!isBucharestText(locality)) continue; // drop touring shows (e.g. Costinești)

    const id = url.match(/-(\d+)\/?$/)?.[1];
    if (!id) continue;

    rows.push({
      event_id: `iabilet:${id}`,
      start_at: startDate, // bare YYYY-MM-DD: date-only, render omits the time chip
      end_at: "",
      name: (ev.name ?? "").replace(/^The Fool[^:]*:\s*/, ""),
      url,
      host: venue.name,
      host_id: "",
      calendar_slug: venue.slug,
      calendar_name: venue.name,
      location: addr.streetAddress ?? "",
      city_state: "București",
      lat: "",
      lng: "",
      guest_count: "0",
      ticket_count: "0",
      location_type: "offline",
      first_seen: today,
      sources: `iabilet:${venue.slug}`,
    });
  }
  return rows;
}
