import { parse, stringify } from "@std/csv";
import type { Entry } from "./luma.ts";

export interface EventRow {
  event_id: string;
  start_at: string;
  end_at: string;
  name: string;
  url: string;
  host: string;
  host_id: string;
  calendar_slug: string;
  calendar_name: string;
  location: string;
  city_state: string;
  lat: string;
  lng: string;
  guest_count: string;
  ticket_count: string;
  location_type: string;
  first_seen: string;
  sources: string;
}

export const COLUMNS: (keyof EventRow)[] = [
  "event_id", "start_at", "end_at", "name", "url",
  "host", "host_id", "calendar_slug", "calendar_name",
  "location", "city_state", "lat", "lng",
  "guest_count", "ticket_count", "location_type",
  "first_seen", "sources",
];

export function readEventsCsv(path: string): EventRow[] {
  let text: string;
  try {
    text = Deno.readTextFileSync(path);
  } catch {
    return [];
  }
  if (!text.trim()) return [];
  const rows = parse(text, { skipFirstRow: true, columns: COLUMNS as string[] }) as unknown as EventRow[];
  return rows;
}

export function writeEventsCsv(path: string, rows: EventRow[]): void {
  rows.sort((a, b) => a.start_at.localeCompare(b.start_at) || a.event_id.localeCompare(b.event_id));
  const out = stringify(rows as unknown as Record<string, unknown>[], { columns: COLUMNS as string[] });
  Deno.writeTextFileSync(path, out);
}

export function entryToRow(entry: Entry, source: string, today: string): EventRow {
  const ev = entry.event;
  const host = entry.hosts?.[0];
  const cal = entry.calendar;
  return {
    event_id: ev.api_id,
    start_at: ev.start_at,
    end_at: ev.end_at ?? "",
    name: ev.name,
    url: `https://lu.ma/${ev.url}`,
    host: host?.name ?? "",
    host_id: host?.api_id ?? "",
    calendar_slug: cal?.slug ?? "",
    calendar_name: cal?.name ?? "",
    location: ev.geo_address_info?.full_address ?? ev.geo_address_info?.address ?? "",
    city_state: ev.geo_address_info?.city_state ?? "",
    lat: ev.coordinate?.latitude != null ? String(ev.coordinate.latitude) : "",
    lng: ev.coordinate?.longitude != null ? String(ev.coordinate.longitude) : "",
    guest_count: entry.guest_count != null ? String(entry.guest_count) : "0",
    ticket_count: entry.ticket_count != null ? String(entry.ticket_count) : "0",
    location_type: ev.location_type ?? "",
    first_seen: today,
    sources: source,
  };
}

export function upsert(existing: EventRow[], fresh: EventRow[]): EventRow[] {
  const byId = new Map<string, EventRow>();
  for (const r of existing) byId.set(r.event_id, r);
  for (const f of fresh) {
    const prev = byId.get(f.event_id);
    if (prev) {
      const sourceSet = new Set(prev.sources.split("|").filter(Boolean));
      for (const s of f.sources.split("|")) sourceSet.add(s);
      byId.set(f.event_id, {
        ...prev,
        start_at: f.start_at || prev.start_at,
        end_at: f.end_at || prev.end_at,
        name: f.name || prev.name,
        url: f.url || prev.url,
        host: f.host || prev.host,
        host_id: f.host_id || prev.host_id,
        calendar_slug: f.calendar_slug || prev.calendar_slug,
        calendar_name: f.calendar_name || prev.calendar_name,
        location: f.location || prev.location,
        city_state: f.city_state || prev.city_state,
        lat: f.lat || prev.lat,
        lng: f.lng || prev.lng,
        guest_count: f.guest_count,
        ticket_count: f.ticket_count,
        location_type: f.location_type || prev.location_type,
        sources: [...sourceSet].sort().join("|"),
      });
    } else {
      byId.set(f.event_id, f);
    }
  }
  return [...byId.values()];
}

export interface ScrapeError {
  date: string;
  source: string;
  error_kind: string;
  message: string;
}

export function appendScrapeErrors(path: string, errs: ScrapeError[]): void {
  if (errs.length === 0) return;
  let existingText: string;
  try {
    existingText = Deno.readTextFileSync(path);
  } catch {
    existingText = "date,source,error_kind,message\n";
  }
  const lines = errs.map((e) => {
    const cells = [e.date, e.source, e.error_kind, e.message]
      .map((c) => `"${c.replace(/"/g, '""')}"`);
    return cells.join(",");
  });
  Deno.writeTextFileSync(path, existingText + lines.join("\n") + "\n");
}
