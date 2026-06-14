import { strict as assert } from "node:assert";
import { icalToRows, type IcalFeed } from "./ical.ts";

const assertEquals = (a: unknown, b: unknown) => assert.deepEqual(a, b);

const FEED: IcalFeed = {
  name: "Roaba de Cultură",
  slug: "roaba-de-cultura",
  url: "https://example.test",
  category: "2024",
};

// One in-category Bucharest event, one out-of-category, one out-of-town -> only the first survives.
const SAMPLE = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "DTSTART;TZID=UTC:20260614T190000",
  "DTEND;TZID=UTC:20260614T200000",
  "UID:keep@gr.ro",
  "SUMMARY:Teatru\\, în aer liber",
  "URL:https://gr.ro/e/1",
  "LOCATION:Parcul Regele Mihai I\\, București\\, Romania",
  "CATEGORIES:2024",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;TZID=UTC:20260620T100000",
  "UID:wrongcat@gr.ro",
  "SUMMARY:Yoga",
  "CATEGORIES:9999",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;TZID=UTC:20260701T180000",
  "UID:outoftown@gr.ro",
  "SUMMARY:Tur Cluj",
  "LOCATION:Parcul Central\\, Cluj-Napoca\\, Romania",
  "CATEGORIES:2024",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

Deno.test("icalToRows: category + Bucharest filter, tz, unescape", () => {
  const rows = icalToRows(SAMPLE, FEED, "2026-06-14");
  assertEquals(rows.length, 1);
  const r = rows[0];
  assertEquals(r.event_id, "keep@gr.ro");
  assertEquals(r.name, "Teatru, în aer liber"); // \, unescaped
  // 19:00 Europe/Bucharest in June (EEST, +3) -> 16:00Z
  assertEquals(r.start_at, "2026-06-14T16:00:00.000Z");
  assertEquals(r.end_at, "2026-06-14T17:00:00.000Z");
  assertEquals(r.host, "Roaba de Cultură");
  assertEquals(r.sources, "ical:roaba-de-cultura");
});
