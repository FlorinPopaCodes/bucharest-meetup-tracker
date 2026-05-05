// Strip PII and high-churn noise from raw lu.ma entries before snapshotting.
// Downstream pipeline (Zod parse → entryToRow) is unaffected: the Zod schema
// in luma.ts already pulls out only the fields we need, and the schema
// fingerprint runs on the unsanitized raw data.

const HOST_KEEP = new Set(["api_id", "name", "username"]);
const PERSONAL_USER_KEEP = new Set(["api_id", "name", "username"]);

const ENTRY_DROP = new Set([
  "cover_image",
  "host_info",
  "manager_info",
  "guest_info",
  "featured_guests",
  "submitted_by_user_api_id",
  "score",
  "query_score",
]);

const EVENT_DROP = new Set(["cover_url"]);

const CALENDAR_DROP = new Set([
  "avatar_url",
  "cover_image_url",
  "social_image_url",
  "google_measurement_id",
  "meta_pixel_id",
  "instagram_handle",
  "twitter_handle",
  "linkedin_handle",
  "tiktok_handle",
  "youtube_handle",
  "tint_color",
  "stripe_account_id",
  "tax_config",
  "refund_policy",
  "track_meta_ads_from_luma",
  "luma_plus_active",
  "luma_plan",
  "event_submission_restriction",
  "is_blocked",
  "launch_status",
  "verified_at",
]);

const TICKET_INFO_DROP = new Set(["spots_remaining", "is_near_capacity"]);

function pickKeys(o: Record<string, unknown>, keep: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keep) if (k in o) out[k] = o[k];
  return out;
}

function sanitizeEntry(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const e = { ...(raw as Record<string, unknown>) };
  for (const k of ENTRY_DROP) delete e[k];

  if (e.event && typeof e.event === "object") {
    const ev = { ...(e.event as Record<string, unknown>) };
    for (const k of EVENT_DROP) delete ev[k];
    e.event = ev;
  }

  if (Array.isArray(e.hosts)) {
    e.hosts = e.hosts.map((h) =>
      h && typeof h === "object" ? pickKeys(h as Record<string, unknown>, HOST_KEEP) : h
    );
  }

  if (e.calendar && typeof e.calendar === "object") {
    const cal = { ...(e.calendar as Record<string, unknown>) };
    for (const k of CALENDAR_DROP) delete cal[k];
    if (cal.personal_user && typeof cal.personal_user === "object") {
      cal.personal_user = pickKeys(cal.personal_user as Record<string, unknown>, PERSONAL_USER_KEEP);
    }
    e.calendar = cal;
  }

  if (e.ticket_info && typeof e.ticket_info === "object") {
    const t = { ...(e.ticket_info as Record<string, unknown>) };
    for (const k of TICKET_INFO_DROP) delete t[k];
    e.ticket_info = t;
  }

  return e;
}

export function sanitizeSnapshot(payload: Record<string, unknown[]>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const [k, arr] of Object.entries(payload)) out[k] = arr.map(sanitizeEntry);
  return out;
}
