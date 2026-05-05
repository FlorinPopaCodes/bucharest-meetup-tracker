// SVG heatmap renderer — GitHub-style 7×52 grid, percentile-binned, Flexoki palettes.
// Themes via embedded prefers-color-scheme media query (works on GitHub README).

interface ThemePalette {
  empty: string;
  l1: string;
  l2: string;
  l3: string;
  l4: string;
  text: string;
  cellStroke: string;
}

interface ThemedPalette {
  light: ThemePalette;
  dark: ThemePalette;
}

// Light mode: very-light empty → dark accent. Dark mode: very-dark empty → light accent.
// Mirrors GitHub's contribution-graph dual-palette pattern, using Flexoki tones.
export const PALETTES: Record<"green" | "magenta", ThemedPalette> = {
  green: {
    light: {
      empty: "#F2F0E5", // Flexoki bg-2 light
      l1: "#CDCD86",    // green-200
      l2: "#A0AF54",    // green-400
      l3: "#66800B",    // green-600 (light accent)
      l4: "#3D5410",    // green-800
      text: "#6F6E69",  // Flexoki tx-2 light
      cellStroke: "rgba(0,0,0,0.06)",
    },
    dark: {
      empty: "#1C1B1A", // Flexoki bg-2 dark
      l1: "#2A3D11",    // green-850
      l2: "#4D6B0E",    // green-700
      l3: "#879A39",    // green-500 (dark accent)
      l4: "#CDCD86",    // green-200
      text: "#878580",  // Flexoki tx-2 dark
      cellStroke: "rgba(255,255,255,0.04)",
    },
  },
  magenta: {
    light: {
      empty: "#F2F0E5",
      l1: "#F4A4C2", // magenta-200
      l2: "#CE5D97", // magenta-400
      l3: "#A02F6F", // magenta-500 (light accent)
      l4: "#5C193E", // magenta-800
      text: "#6F6E69",
      cellStroke: "rgba(0,0,0,0.06)",
    },
    dark: {
      empty: "#1C1B1A",
      l1: "#451033", // magenta-850
      l2: "#751F4F", // magenta-700
      l3: "#CE5D97", // magenta-400 (dark accent)
      l4: "#F4A4C2", // magenta-200
      text: "#878580",
      cellStroke: "rgba(255,255,255,0.04)",
    },
  },
};

export type PaletteName = keyof typeof PALETTES;

const CELL_SIZE = 11;
const CELL_GAP = 3;
const STEP = CELL_SIZE + CELL_GAP;
const TOP_PAD = 18;
const LEFT_PAD = 24;
const RO_DAYS_SHORT = ["L", "Mi", "V"]; // shown for rows 0 (Mon), 2 (Wed), 4 (Fri)
const RO_MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "noi", "dec"];

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dayOfWeekMon0(d: Date): number {
  const dow = d.getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function percentiles(counts: number[]): [number, number, number, number] {
  if (counts.length === 0) return [1, 2, 4, 8];
  const sorted = counts.slice().sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return [at(0.25), at(0.5), at(0.75), at(0.9)];
}

function levelFor(count: number, p: [number, number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= p[0]) return 1;
  if (count <= p[1]) return 2;
  if (count <= p[2]) return 3;
  return 4;
}

function buildStyle(themed: ThemedPalette): string {
  const { light, dark } = themed;
  // Default rules = light. Overrides under prefers-color-scheme: dark.
  // Single quotes inside the template avoid clashing with the SVG attribute quotes.
  return [
    `.l0{fill:${light.empty};stroke:${light.cellStroke}}`,
    `.l1{fill:${light.l1};stroke:${light.cellStroke}}`,
    `.l2{fill:${light.l2};stroke:${light.cellStroke}}`,
    `.l3{fill:${light.l3};stroke:${light.cellStroke}}`,
    `.l4{fill:${light.l4};stroke:${light.cellStroke}}`,
    `.lbl{fill:${light.text}}`,
    `@media (prefers-color-scheme: dark){`,
    `.l0{fill:${dark.empty};stroke:${dark.cellStroke}}`,
    `.l1{fill:${dark.l1};stroke:${dark.cellStroke}}`,
    `.l2{fill:${dark.l2};stroke:${dark.cellStroke}}`,
    `.l3{fill:${dark.l3};stroke:${dark.cellStroke}}`,
    `.l4{fill:${dark.l4};stroke:${dark.cellStroke}}`,
    `.lbl{fill:${dark.text}}`,
    `}`,
  ].join("");
}

export interface HeatmapInput {
  counts: Record<string, number>;
  paletteName: PaletteName;
  endDate?: Date;
  windowDays?: number;
}

export function renderHeatmap(input: HeatmapInput): string {
  const themed = PALETTES[input.paletteName];
  const end = input.endDate ?? new Date();
  const days = input.windowDays ?? 365;

  const endDow = dayOfWeekMon0(end);
  const lastColDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const lastColMonday = new Date(lastColDate);
  lastColMonday.setUTCDate(lastColMonday.getUTCDate() - endDow);

  const numCols = Math.ceil(days / 7) + 1;
  const cells: { x: number; y: number; key: string; count: number }[] = [];
  const monthLabelCols: { col: number; month: number }[] = [];
  let lastMonth = -1;

  for (let col = 0; col < numCols; col++) {
    const colMonday = new Date(lastColMonday);
    colMonday.setUTCDate(colMonday.getUTCDate() - (numCols - 1 - col) * 7);
    for (let row = 0; row < 7; row++) {
      const d = new Date(colMonday);
      d.setUTCDate(d.getUTCDate() + row);
      const diffDays = Math.floor((lastColDate.getTime() - d.getTime()) / 86400000);
      if (diffDays < 0 || diffDays >= days) continue;
      const key = dateKey(d);
      cells.push({
        x: LEFT_PAD + col * STEP,
        y: TOP_PAD + row * STEP,
        key,
        count: input.counts[key] ?? 0,
      });
    }
    const firstOfCol = new Date(colMonday);
    if (firstOfCol.getUTCMonth() !== lastMonth) {
      monthLabelCols.push({ col, month: firstOfCol.getUTCMonth() });
      lastMonth = firstOfCol.getUTCMonth();
    }
  }

  const positiveCounts = cells.map((c) => c.count).filter((c) => c > 0);
  const p = percentiles(positiveCounts);

  const width = LEFT_PAD + numCols * STEP + 4;
  const height = TOP_PAD + 7 * STEP + 4;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9">`,
  );

  parts.push(`<style>${buildStyle(themed)}</style>`);

  for (const m of monthLabelCols) {
    if (m.col === 0) continue;
    const x = LEFT_PAD + m.col * STEP;
    parts.push(`<text x="${x}" y="${TOP_PAD - 6}" class="lbl">${RO_MONTHS[m.month]}</text>`);
  }

  const dayLabelRows = [0, 2, 4];
  for (let i = 0; i < dayLabelRows.length; i++) {
    const row = dayLabelRows[i];
    parts.push(
      `<text x="2" y="${TOP_PAD + row * STEP + CELL_SIZE - 2}" class="lbl">${RO_DAYS_SHORT[i]}</text>`,
    );
  }

  for (const c of cells) {
    const lvl = levelFor(c.count, p);
    parts.push(
      `<rect x="${c.x}" y="${c.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" ry="2" class="l${lvl}"><title>${c.key}: ${c.count}</title></rect>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("");
}
