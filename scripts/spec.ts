// `pnpm spec check` reports the statement identifiers' problems; `pnpm spec next <prefix>`
// prints the identifier a new statement with that prefix takes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoFiles } from "./lib/files";
import {
  checkSpecIds,
  failed,
  formatReport,
  nextId,
  SPEC_README,
  specDefinitions,
  specFiles,
} from "./lib/spec-ids";

const root = fileURLToPath(new URL("..", import.meta.url));
const [command, prefix] = process.argv.slice(2);
const table = specFiles(readFileSync(join(root, SPEC_README), "utf8"));

if (command === "check") {
  const report = checkSpecIds(root, repoFiles(root));
  for (const line of formatReport(report)) console.log(line);
  process.exit(failed(report) ? 1 : 0);
} else if (command === "next" && prefix !== undefined && table.has(prefix)) {
  console.log(nextId(specDefinitions(root, repoFiles(root), table).defined, prefix));
} else {
  console.error(`usage: pnpm spec check | pnpm spec next <${[...table.keys()].join("|")}>`);
  process.exit(2);
}
