import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type BuildMeta = {
  builtAtIso?: string;
};

const buildMetaPath = resolve(process.cwd(), "generated", "build-meta.json");

function readBuildMeta(): BuildMeta | null {
  try {
    const raw = readFileSync(buildMetaPath, "utf8");
    const parsed = JSON.parse(raw) as BuildMeta;
    return parsed;
  } catch {
    return null;
  }
}

export function getBuildUpdatedLabel(): string {
  const buildMeta = readBuildMeta();
  const iso = buildMeta?.builtAtIso;
  if (!iso) {
    return "okand";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "okand";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
