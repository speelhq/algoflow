// `pnpm size [base]` counts the lines that the branch changes since it left `base`, by default
// `origin/develop`, without generated files, and fails above the limit.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LIMIT, countLines, parseGeneratedPaths, parseNumstat } from "./lib/size";

const root = fileURLToPath(new URL("..", import.meta.url));
const base = process.argv[2] ?? "origin/develop";
const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

const files = parseNumstat(git(["diff", "--numstat", "-z", `${base}...HEAD`]));
const paths = files.map((file) => file.path);
const generated = parseGeneratedPaths(
  paths.length === 0 ? "" : git(["check-attr", "-z", "linguist-generated", "--", ...paths]),
);
const { lines, counted, leftOut } = countLines(files, generated);
console.log(
  `size: ${lines} lines changed in ${counted} files since ${base}, ${leftOut} generated files left out (limit ${LIMIT})`,
);
process.exit(lines > LIMIT ? 1 : 0);
