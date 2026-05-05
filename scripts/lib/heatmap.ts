// SVG heatmap renderer — GitHub-style 7×52 grid, percentile-binned, Flexoki palettes.

export const PALETTES = {
  green: ["#1C1B1A", "#2A3D11", "#4D6B0E", "#879A39", "#CDCD86"],
  magenta: ["#1C1B1A", "#451033", "#751F4F", "#CE5D97", "#F4A4C2"],
} as const;

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
  const dow = d.getUTCDay(); // 0=Sun
  return dow === 0 ? 6 : dow - 1;
}

function percentiles(counts: number[]): [number, number, number, number] {
  if (counts.length === 0) return [1, 2, 4, 8];
  const sorted = counts.slice().sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return [at(0.25), at(0.5), at(0.75), at(0.9)];
}

function colorFor(count: number, p: [number, number, number, number], palette: readonly string[]): string {
  if (count <= 0) return palette[0];
  if (count <= p[0]) return palette[1];
  if (count <= p[1]) return palette[2];
  if (count <= p[2]) return palette[3];
  return palette[4];
}

export interface HeatmapInput {
  /** Map from YYYY-MM-DD → numeric value (count or sum). */
  counts: Record<string, number>;
  paletteName: PaletteName;
  /** End date (inclusive). Defaults to today UTC. */
  endDate?: Date;
  /** Days back from endDate. Defaults to 365. */
  windowDays?: number;
}

export function renderHeatmap(input: HeatmapInput): string {
  const palette = PALETTES[input.paletteName];
  const end = input.endDate ?? new Date();
  const days = input.windowDays ?? 365;

  // Build column-major grid, ending on the column containing `end`.
  // Each column = one week (Mon..Sun).
  const endDow = dayOfWeekMon0(end);
  const lastColDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  // First date in last column = the Monday on or before `end`.
  const lastColMonday = new Date(lastColDate);
  lastColMonday.setUTCDate(lastColMonday.getUTCDate() - endDow);

  const numCols = Math.ceil(days / 7) + 1;
  const cells: { x: number; y: number; date: Date; key: string; count: number }[] = [];
  const monthLabelCols: { col: number; month: number }[] = [];
  let lastMonth = -1;

  for (let col = 0; col < numCols; col++) {
    const colMonday = new Date(lastColMonday);
    colMonday.setUTCDate(colMonday.getUTCDate() - (numCols - 1 - col) * 7);
    for (let row = 0; row < 7; row++) {
      const d = new Date(colMonday);
      d.setUTCDate(d.getUTCDate() + row);
      // Trim cells outside the [end - days + 1, end] window.
      const diffDays = Math.floor((lastColDate.getTime() - d.getTime()) / 86400000);
      if (diffDays < 0 || diffDays >= days) continue;
      const key = dateKey(d);
      cells.push({
        x: LEFT_PAD + col * STEP,
        y: TOP_PAD + row * STEP,
        date: d,
        key,
        count: input.counts[key] ?? 0,
      });
    }
    // Month label: first column of each new month.
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
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9">`);

  // Month labels
  for (const m of monthLabelCols) {
    if (m.col === 0) continue;
    const x = LEFT_PAD + m.col * STEP;
    parts.push(`<text x="${x}" y="${TOP_PAD - 6}" fill="#878580">${RO_MONTHS[m.month]}</text>`);
  }

  // Day-of-week labels (Mon, Wed, Fri)
  const dayLabelRows = [0, 2, 4];
  for (let i = 0; i < dayLabelRows.length; i++) {
    const row = dayLabelRows[i];
    parts.push(`<text x="2" y="${TOP_PAD + row * STEP + CELL_SIZE - 2}" fill="#878580">${RO_DAYS_SHORT[i]}</text>`);
  }

  // Cells
  for (const c of cells) {
    const fill = colorFor(c.count, p, palette);
    const title = `${c.key}: ${c.count}`;
    parts.push(
      `<rect x="${c.x}" y="${c.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" ry="2" fill="${fill}"><title>${title}</title></rect>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("");
}
