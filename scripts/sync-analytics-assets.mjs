import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const reportDir = resolve(cwd, "services", "analytics", "data", "reports", "sales_monthly", "v1");
const publicDir = resolve(cwd, "public", "analytics");
const monthPattern = /^kpi_(20\d{2}-\d{2})\.json$/;

function readExistingInputSignature(indexPath) {
  if (!existsSync(indexPath)) {
    return "";
  }
  try {
    const parsed = JSON.parse(readFileSync(indexPath, "utf8"));
    return typeof parsed.input_signature === "string" ? parsed.input_signature : "";
  } catch {
    return "";
  }
}

function main() {
  if (!existsSync(reportDir)) {
    throw new Error(`Missing report directory: ${reportDir}`);
  }

  mkdirSync(publicDir, { recursive: true });

  const reportFiles = readdirSync(reportDir);
  const reports = {};
  const months = [];
  const expectedFiles = new Set(["index.json"]);

  for (const fileName of reportFiles.sort()) {
    const match = fileName.match(monthPattern);
    if (!match) {
      continue;
    }

    const month = match[1];
    const jsonPath = resolve(reportDir, fileName);
    const htmlFileName = `kpi_${month}_quicklook.html`;
    const htmlPath = resolve(reportDir, htmlFileName);

    if (!existsSync(htmlPath)) {
      continue;
    }

    const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
    const summary = payload && typeof payload.summary === "object" ? payload.summary : null;

    copyFileSync(jsonPath, resolve(publicDir, fileName));
    copyFileSync(htmlPath, resolve(publicDir, htmlFileName));

    expectedFiles.add(fileName);
    expectedFiles.add(htmlFileName);
    months.push(month);
    reports[month] = {
      report_month: month,
      summary,
      json_path: `/analytics/${fileName}`,
      quicklook_path: `/analytics/${htmlFileName}`
    };
  }

  if (months.length === 0) {
    throw new Error("No KPI output files found after sync.");
  }

  for (const fileName of readdirSync(publicDir)) {
    if (fileName === "index.json") {
      continue;
    }
    if (!/^kpi_20\d{2}-\d{2}.*(\.json|_quicklook\.html)$/.test(fileName)) {
      continue;
    }
    if (!expectedFiles.has(fileName)) {
      rmSync(resolve(publicDir, fileName), { force: true });
    }
  }

  const sortedMonths = [...new Set(months)].sort();
  const indexPath = resolve(publicDir, "index.json");
  const inputSignature = readExistingInputSignature(indexPath);
  const indexPayload = {
    generated_at_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    input_signature: inputSignature,
    months: sortedMonths,
    reports: Object.fromEntries(sortedMonths.map((month) => [month, reports[month]]))
  };

  writeFileSync(indexPath, `${JSON.stringify(indexPayload, null, 2)}\n`, "utf8");
  console.log(`Synced KPI month files: ${sortedMonths.length}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
