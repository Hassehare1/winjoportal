import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputDir = resolve(process.cwd(), "generated");
const outputFile = resolve(outputDir, "build-meta.json");

mkdirSync(outputDir, { recursive: true });

const payload = {
  builtAtIso: new Date().toISOString()
};

writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
