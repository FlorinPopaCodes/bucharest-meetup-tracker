import type { EventRow } from "./csv.ts";

const RO_DAYS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
const RO_MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

const TZ = "Europe/Bucharest";
const HORIZON_DAYS = 14;

function bucharestParts(iso: string): { date: string; hhmm: string; weekday: number; day: number; month: number; year: number } {
  const d = new Date(iso);
  // Build local Bucharest date components via Intl.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = +get("year");
  const month = +get("month");
  const day = +get("day");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");
  // Re-derive weekday from local date
  const local = new Date(Date.UTC(year, month - 1, day));
  const weekday = local.getUTCDay();
  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hhmm: `${hour}:${minute}`,
    weekday,
    day,
    month: month - 1,
    year,
  };
}

function dayHeading(month: number, day: number, weekday: number): string {
  return `### ${RO_DAYS[weekday]}, ${day} ${RO_MONTHS[month]}`;
}

function formatGuests(n: number): string {
  if (n === 1) return "1 participant";
  if (n < 20) return `${n} participanți`;
  return `${n} de participanți`;
}

function escapeName(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function eventLine(row: EventRow, hhmm: string): string {
  const parts: string[] = [`${hhmm} **${escapeName(row.name)}**`];
  const meta: string[] = [];
  if (row.host) meta.push(row.host);
  if (row.city_state && !/bucure/i.test(row.city_state) && !/bucharest/i.test(row.city_state)) {
    meta.push(row.city_state);
  }
  const guests = parseInt(row.guest_count || "0", 10);
  if (guests > 0) meta.push(formatGuests(guests));
  if (meta.length) parts.push(`— ${meta.join(" · ")}`);
  parts.push(`[↗](${row.url})`);
  return `- ${parts.join(" ")}`;
}

interface DayBucket {
  dateKey: string;
  weekday: number;
  day: number;
  month: number;
  year: number;
  events: { hhmm: string; row: EventRow }[];
}

export function renderUpcomingList(rows: EventRow[], today: Date = new Date()): string {
  const todayKey = bucharestParts(today.toISOString()).date;
  const horizonKey = bucharestParts(new Date(today.getTime() + HORIZON_DAYS * 86400000).toISOString()).date;

  const buckets = new Map<string, DayBucket>();
  for (const r of rows) {
    if (!r.start_at) continue;
    let p;
    try { p = bucharestParts(r.start_at); } catch { continue; }
    if (p.date < todayKey || p.date > horizonKey) continue;
    if (!buckets.has(p.date)) {
      buckets.set(p.date, {
        dateKey: p.date, weekday: p.weekday, day: p.day, month: p.month, year: p.year, events: [],
      });
    }
    buckets.get(p.date)!.events.push({ hhmm: p.hhmm, row: r });
  }

  if (buckets.size === 0) {
    return "*Niciun eveniment în următoarele 14 zile.*";
  }

  const sorted = [...buckets.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const out: string[] = [];
  for (const day of sorted) {
    out.push(dayHeading(day.month, day.day, day.weekday));
    out.push("");
    day.events.sort((a, b) => a.hhmm.localeCompare(b.hhmm));
    const tdd = day.events.filter((e) => e.row.calendar_slug === "turadeduminica");
    const others = day.events.filter((e) => e.row.calendar_slug !== "turadeduminica");
    if (tdd.length >= 2) {
      const word = tdd.length === 1 ? "tură de duminică" : "ture de duminică";
      out.push(`<details><summary>🚶 ${tdd.length} ${word}</summary>`);
      out.push("");
      for (const e of tdd) out.push(eventLine(e.row, e.hhmm));
      out.push("");
      out.push(`</details>`);
    } else {
      for (const e of tdd) out.push(eventLine(e.row, e.hhmm));
    }
    for (const e of others) out.push(eventLine(e.row, e.hhmm));
    out.push("");
  }
  return out.join("\n").trim();
}

export interface ReadmeInput {
  upcomingMd: string;
  eventsHeatmapPath: string;
  guestsHeatmapPath: string;
  generatedAt: Date;
}

export function renderReadme(i: ReadmeInput): string {
  const ts = new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ, dateStyle: "long", timeStyle: "short",
  }).format(i.generatedAt);

  return `# Evenimente București

Listă zilnică a evenimentelor din București disponibile pe lu.ma, plus evenimente din calendare selectate manual care nu apar în descoperirea geografică. Actualizat zilnic la 06:00 UTC.

> Datele provin de la lu.ma, supuse Termenilor lor.

## Următoarele 14 zile

${i.upcomingMd}

## Activitate (ultimele 365 de zile)

### Evenimente pe zi

![Evenimente pe zi](${i.eventsHeatmapPath})

### Participanți pe zi

![Participanți pe zi](${i.guestsHeatmapPath})

## Despre

*Hărțile de activitate se populează în timp — pornesc goale și ating vederea completă de 365 de zile după un an.*

Date: \`data/events.csv\` (stare curentă, cumulativă) · \`data/snapshots/\` (arhivă zilnică brută) · \`data/scrape_errors.csv\` (jurnalul rulărilor care au eșuat parțial) · \`data/schema.json\` (amprenta câmpurilor API).

Cod: [scripts/](scripts/) · Workflow: [.github/workflows/scrape.yml](.github/workflows/scrape.yml).

---

*Actualizat: ${ts}*
`;
}
