import { strict as assert } from "node:assert";
import { htmlToRows, type IabiletVenue } from "./iabilet.ts";

const assertEquals = (a: unknown, b: unknown) => assert.deepEqual(a, b);

const VENUE: IabiletVenue = {
  name: "The Fool",
  slug: "the-fool",
  url: "https://www.iabilet.ro/bilete-the-fool-venue-3205/",
};

// Real iaBilet wraps each JSON-LD block in a CDATA comment. One Bucharest Event
// (kept), one Costinești Event (dropped by the city filter), one non-Event block
// (ignored).
function ld(obj: unknown): string {
  return `<script type="application/ld+json">/*<![CDATA[*/${JSON.stringify(obj)}/*]]>*/</script>`;
}

const SAMPLE = [
  "<html><head>",
  ld({
    "@context": "http://www.schema.org",
    "@type": "Event",
    name: "The Fool: The Blind Date Show cu Gherghe și Teo Ioniță",
    url:
      "https://www.iabilet.ro/bilete-the-fool-the-blind-date-show-cu-gherghe-si-teo-ionita-127459/",
    startDate: "2026-06-14",
    endDate: "2026-06-14",
    location: {
      "@type": "Place",
      name: "The Fool",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Calea Victoriei 118, București 010071",
        addressLocality: "București",
      },
    },
  }),
  ld({
    "@context": "http://www.schema.org",
    "@type": "Event",
    name: "The Fool la mare",
    url: "https://www.iabilet.ro/bilete-the-fool-la-mare-999999/",
    startDate: "2026-07-20",
    location: {
      "@type": "Place",
      name: "Ringul Costinești",
      address: { "@type": "PostalAddress", addressLocality: "Costinești" },
    },
  }),
  ld({ "@context": "http://www.schema.org", "@type": "BreadcrumbList", itemListElement: [] }),
  "</head></html>",
].join("\n");

Deno.test("htmlToRows: JSON-LD parse, Bucharest filter, name strip, date-only", () => {
  const rows = htmlToRows(SAMPLE, VENUE, "2026-06-13");
  assertEquals(rows.length, 1);
  const r = rows[0];
  assertEquals(r.event_id, "iabilet:127459");
  assertEquals(r.name, "The Blind Date Show cu Gherghe și Teo Ioniță"); // "The Fool: " stripped
  assertEquals(
    r.url,
    "https://www.iabilet.ro/bilete-the-fool-the-blind-date-show-cu-gherghe-si-teo-ionita-127459/",
  );
  assertEquals(r.start_at, "2026-06-14"); // bare date, no time
  assertEquals(r.host, "The Fool");
  assertEquals(r.location, "Calea Victoriei 118, București 010071");
  assertEquals(r.city_state, "București");
  assertEquals(r.location_type, "offline");
  assertEquals(r.sources, "iabilet:the-fool");
  assertEquals(r.first_seen, "2026-06-13");
});
