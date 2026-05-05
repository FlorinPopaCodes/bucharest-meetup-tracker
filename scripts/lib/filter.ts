import type { Entry } from "./luma.ts";

export const BUCHAREST = { lat: 44.4268, lng: 26.1025 };
const MAX_KM = 25;

const CITY_NEEDLES = ["bucuresti", "bucharest", "ilfov"];

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isBucharestEvent(entry: Entry): boolean {
  const ev = entry.event;
  if (ev.location_type === "online") return false;

  const cs = ev.geo_address_info?.city_state;
  if (cs) {
    const norm = stripDiacritics(cs);
    if (CITY_NEEDLES.some((n) => norm.includes(n))) return true;
    return false;
  }

  const c = ev.coordinate;
  if (c && typeof c.latitude === "number" && typeof c.longitude === "number") {
    const km = haversineKm(BUCHAREST.lat, BUCHAREST.lng, c.latitude, c.longitude);
    return km <= MAX_KM;
  }

  return false;
}
