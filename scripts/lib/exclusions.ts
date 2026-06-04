import { parse as parseYaml } from "@std/yaml";

interface ExclusionsConfig {
  hosts?: string[];
}

export function loadExcludedHostIds(path: string): Set<string> {
  try {
    const cfg = parseYaml(Deno.readTextFileSync(path)) as ExclusionsConfig;
    return new Set(cfg.hosts ?? []);
  } catch {
    return new Set();
  }
}
