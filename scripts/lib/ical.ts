import type { EventRow } from "./csv.ts";
import { isBucharestText } from "./filter.ts";

const UA = "bucharest-meetup-tracker (+https://github.com/FlorinPopaCodes/bucharest-meetup-tracker)";
const TIMEOUT_MS = 20_000;

export interface IcalFeed {
  name: string;
  slug: string;
  url: string;
  category: string; // The Events Calendar category id; only matching VEVENTs are kept.
}

// ponytail: minimal RFC5545 reader — this feed has no RRULE/VALARM/VTODO.
// Add a real ical lib only if a feed starts using recurrence.
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

// "20260614T190000" wall-clock in `tz` -> UTC ISO instant.
// ponytail: two-step offset trick; ambiguous only in the 1h DST fall-back overlap, irrelevant here.
function wallclockToUtcIso(stamp: string, tz: string): string {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) throw new Error(`bad DTSTART: ${stamp}`);
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const seen = Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour === "24" ? "00" : p.hour), +p.minute, +p.second);
  return new Date(guess - (seen - guess)).toISOString();
}

function parseVevents(text: string): Map<string, string>[] {
  const lines = unfold(text);
  const events: Map<string, string>[] = [];
  let cur: Map<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = new Map();
    else if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).split(";")[0]; // drop params (DTSTART;TZID=UTC -> DTSTART)
      cur.set(key, line.slice(idx + 1));
    }
  }
  return events;
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

export async function fetchIcalRows(feed: IcalFeed, today: string): Promise<EventRow[]> {
  return icalToRows(await fetchText(feed.url), feed, today);
}

export function icalToRows(text: string, feed: IcalFeed, today: string): EventRow[] {
  const rows: EventRow[] = [];
  for (const ev of parseVevents(text)) {
    const cats = (ev.get("CATEGORIES") ?? "").split(",").map((c) => c.trim());
    if (!cats.includes(feed.category)) continue;

    const dtstart = ev.get("DTSTART");
    const uid = ev.get("UID");
    if (!dtstart || !uid) continue;

    const location = unescape(ev.get("LOCATION") ?? "");
    if (!isBucharestText(location)) continue; // guardrail: feed is single-venue today, smoke-tested Bucharest-only

    const dtend = ev.get("DTEND");
    rows.push({
      event_id: uid,
      start_at: wallclockToUtcIso(dtstart, "Europe/Bucharest"),
      end_at: dtend ? wallclockToUtcIso(dtend, "Europe/Bucharest") : "",
      name: unescape(ev.get("SUMMARY") ?? ""),
      url: ev.get("URL") ?? feed.url,
      host: feed.name,
      host_id: "",
      calendar_slug: feed.slug,
      calendar_name: feed.name,
      location,
      city_state: "București",
      lat: "",
      lng: "",
      guest_count: "0",
      ticket_count: "0",
      location_type: "offline",
      first_seen: today,
      sources: `ical:${feed.slug}`,
    });
  }
  return rows;
}
