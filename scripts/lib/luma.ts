import { z } from "zod";

const API = "https://api.lu.ma";
const UA = "bucharest-meetup-tracker (+https://github.com/FlorinPopaCodes/bucharest-meetup-tracker)";

export const GeoAddressInfoSchema = z.object({
  city_state: z.string().nullish(),
  city: z.string().nullish(),
  region: z.string().nullish(),
  country: z.string().nullish(),
  address: z.string().nullish(),
  full_address: z.string().nullish(),
}).passthrough();

export const CoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
}).passthrough();

export const EventSchema = z.object({
  api_id: z.string(),
  calendar_api_id: z.string().nullish(),
  name: z.string(),
  url: z.string(),
  start_at: z.string(),
  end_at: z.string().nullish(),
  timezone: z.string().nullish(),
  location_type: z.string().nullish(),
  geo_address_info: GeoAddressInfoSchema.nullish(),
  coordinate: CoordinateSchema.nullish(),
  visibility: z.string().nullish(),
  user_api_id: z.string().nullish(),
}).passthrough();

export const HostSchema = z.object({
  api_id: z.string().nullish(),
  name: z.string().nullish(),
  username: z.string().nullish(),
}).passthrough();

export const CalendarSchema = z.object({
  api_id: z.string().nullish(),
  name: z.string().nullish(),
  slug: z.string().nullish(),
}).passthrough();

export const EntrySchema = z.object({
  api_id: z.string(),
  event: EventSchema,
  hosts: z.array(HostSchema).nullish(),
  calendar: CalendarSchema.nullish(),
  guest_count: z.number().nullish(),
  ticket_count: z.number().nullish(),
}).passthrough();

export type Entry = z.infer<typeof EntrySchema>;

export const PageSchema = z.object({
  entries: z.array(z.unknown()),
  has_more: z.boolean().nullish(),
  next_cursor: z.string().nullish(),
}).passthrough();

const TIMEOUT_MS = 20_000;

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA, "Accept": "application/json" },
          signal: ctrl.signal,
        });
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return res;
      } finally {
        clearTimeout(t);
      }
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = 1000 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

export async function fetchDiscoverPage(
  lat: number,
  lng: number,
  cursor?: string,
): Promise<{ entries: unknown[]; has_more: boolean; next_cursor: string | null }> {
  const params = new URLSearchParams({ latitude: String(lat), longitude: String(lng) });
  if (cursor) params.set("pagination_cursor", cursor);
  const url = `${API}/discover/get-paginated-events?${params}`;
  const data = PageSchema.parse(await getJson(url));
  return {
    entries: data.entries,
    has_more: !!data.has_more,
    next_cursor: data.next_cursor ?? null,
  };
}

export async function fetchAllDiscover(lat: number, lng: number): Promise<unknown[]> {
  const out: unknown[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 25; page++) {
    const p = await fetchDiscoverPage(lat, lng, cursor);
    out.push(...p.entries);
    if (!p.has_more || !p.next_cursor) break;
    cursor = p.next_cursor;
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

export async function fetchCalendarBySlug(
  slug: string,
): Promise<{ calendar_api_id: string; calendar_name: string; calendar_slug: string }> {
  const url = `${API}/url?url=${encodeURIComponent(slug)}`;
  const data = await getJson(url) as { kind?: string; data?: { calendar?: { api_id?: string; name?: string; slug?: string } } };
  if (data.kind !== "calendar" || !data.data?.calendar?.api_id) {
    throw new Error(`Slug ${slug} did not resolve to a calendar`);
  }
  return {
    calendar_api_id: data.data.calendar.api_id,
    calendar_name: data.data.calendar.name ?? slug,
    calendar_slug: data.data.calendar.slug ?? slug,
  };
}

export async function fetchCalendarEvents(calendar_api_id: string): Promise<unknown[]> {
  const out: unknown[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 25; page++) {
    const params = new URLSearchParams({
      calendar_api_id,
      period: "future",
      pagination_limit: "50",
    });
    if (cursor) params.set("pagination_cursor", cursor);
    const url = `${API}/calendar/get-items?${params}`;
    const data = PageSchema.parse(await getJson(url));
    out.push(...data.entries);
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}
