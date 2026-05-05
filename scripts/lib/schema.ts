interface KeyMap {
  [key: string]: { first_seen: string; last_seen: string };
}

interface SchemaFingerprint {
  entry_keys: KeyMap;
  event_keys: KeyMap;
}

export function loadFingerprint(path: string): SchemaFingerprint {
  try {
    return JSON.parse(Deno.readTextFileSync(path));
  } catch {
    return { entry_keys: {}, event_keys: {} };
  }
}

export function updateFingerprint(
  fp: SchemaFingerprint,
  entries: Array<Record<string, unknown>>,
  today: string,
): SchemaFingerprint {
  const out: SchemaFingerprint = {
    entry_keys: { ...fp.entry_keys },
    event_keys: { ...fp.event_keys },
  };
  const observe = (target: KeyMap, key: string) => {
    if (target[key]) {
      target[key].last_seen = today;
    } else {
      target[key] = { first_seen: today, last_seen: today };
    }
  };
  for (const entry of entries) {
    for (const k of Object.keys(entry)) observe(out.entry_keys, k);
    const ev = entry.event;
    if (ev && typeof ev === "object") {
      for (const k of Object.keys(ev)) observe(out.event_keys, k);
    }
  }
  return out;
}

export function saveFingerprint(path: string, fp: SchemaFingerprint): void {
  const sorted = (m: KeyMap): KeyMap => {
    const o: KeyMap = {};
    for (const k of Object.keys(m).sort()) o[k] = m[k];
    return o;
  };
  const out = {
    entry_keys: sorted(fp.entry_keys),
    event_keys: sorted(fp.event_keys),
  };
  Deno.writeTextFileSync(path, JSON.stringify(out, null, 2) + "\n");
}
