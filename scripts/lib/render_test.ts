import { strict as assert } from "node:assert";
import { renderUpcomingList } from "./render.ts";
import type { EventRow } from "./csv.ts";

function row(over: Partial<EventRow>): EventRow {
  return {
    event_id: "x",
    start_at: "",
    end_at: "",
    name: "Ev",
    url: "https://e.test",
    host: "",
    host_id: "",
    calendar_slug: "",
    calendar_name: "",
    location: "",
    city_state: "",
    lat: "",
    lng: "",
    guest_count: "0",
    ticket_count: "0",
    location_type: "offline",
    first_seen: "2026-06-13",
    sources: "",
    ...over,
  };
}

Deno.test("renderUpcomingList: date-only row has no time chip, grouped after timed", () => {
  const today = new Date("2026-06-14T05:00:00.000Z");
  const out = renderUpcomingList([
    row({ event_id: "t", start_at: "2026-06-14T16:00:00.000Z", name: "Timed", host: "X" }),
    row({ event_id: "d", start_at: "2026-06-14", name: "DateOnly", host: "The Fool" }),
  ], today);

  // date-only line: no `HH:MM` chip
  assert.match(out, /^- \[DateOnly\]\(https:\/\/e\.test\)/m);
  // timed line keeps its chip
  assert.match(out, /^- `19:00` \[Timed\]/m);
  // date-only sorts after the timed event, behind a divider
  assert.ok(out.indexOf("Timed") < out.indexOf("---"));
  assert.ok(out.indexOf("---") < out.indexOf("DateOnly"));
});

Deno.test("renderUpcomingList: day with only date-only rows has no divider", () => {
  const today = new Date("2026-06-14T05:00:00.000Z");
  const out = renderUpcomingList([
    row({ event_id: "a", start_at: "2026-06-14", name: "Alfa" }),
    row({ event_id: "b", start_at: "2026-06-14", name: "Beta" }),
  ], today);

  assert.ok(!out.includes("---"));
  assert.ok(out.indexOf("Alfa") < out.indexOf("Beta"));
});
