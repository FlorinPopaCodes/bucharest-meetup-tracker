import { readEventsCsv, type EventRow } from "./lib/csv.ts";
import { renderHeatmap } from "./lib/heatmap.ts";
import { renderReadme, renderUpcomingList } from "./lib/render.ts";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const PATHS = {
  events: `${REPO_ROOT}data/events.csv`,
  readme: `${REPO_ROOT}README.md`,
  eventsSvg: `${REPO_ROOT}assets/heatmap-events.svg`,
  guestsSvg: `${REPO_ROOT}assets/heatmap-guests.svg`,
};

function bucharestDateKey(iso: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bucharest",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = fmt.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return null;
  }
}

function buildHeatmapInputs(rows: EventRow[]): { events: Record<string, number>; guests: Record<string, number> } {
  const events: Record<string, number> = {};
  const guests: Record<string, number> = {};
  for (const r of rows) {
    const key = bucharestDateKey(r.start_at);
    if (!key) continue;
    events[key] = (events[key] ?? 0) + 1;
    const g = parseInt(r.guest_count || "0", 10);
    if (Number.isFinite(g)) guests[key] = (guests[key] ?? 0) + g;
  }
  return { events, guests };
}

function ensureDir(path: string) {
  try { Deno.mkdirSync(path, { recursive: true }); } catch { /* ignore */ }
}

function main() {
  const rows = readEventsCsv(PATHS.events);
  console.log(`[postprocess] events.csv: ${rows.length} rows`);

  const { events, guests } = buildHeatmapInputs(rows);

  // Sliding 365-day window ending 14 days in the future,
  // so upcoming events are visible alongside history.
  const heatmapEnd = new Date(Date.now() + 14 * 86400000);
  const eventsSvg = renderHeatmap({ counts: events, paletteName: "green", endDate: heatmapEnd });
  const guestsSvg = renderHeatmap({ counts: guests, paletteName: "magenta", endDate: heatmapEnd });

  ensureDir(`${REPO_ROOT}assets`);
  Deno.writeTextFileSync(PATHS.eventsSvg, eventsSvg + "\n");
  Deno.writeTextFileSync(PATHS.guestsSvg, guestsSvg + "\n");

  const upcomingMd = renderUpcomingList(rows);
  const readme = renderReadme({
    upcomingMd,
    eventsHeatmapPath: "assets/heatmap-events.svg",
    guestsHeatmapPath: "assets/heatmap-guests.svg",
    generatedAt: new Date(),
  });
  Deno.writeTextFileSync(PATHS.readme, readme);
  console.log(`[postprocess] wrote README + 2 SVGs`);
}

if (import.meta.main) {
  main();
}
