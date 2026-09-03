// PostToolUse (Write|Edit): run oxfmt on the edited file when it is under src/ or challenges/.
import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const file = input.tool_response?.filePath || input.tool_input?.file_path;
if (!file) process.exit(0);

const rel = relative(root, file).split("\\").join("/");
if (!/^(src|challenges)\//.test(rel)) process.exit(0);
if (!existsSync(join(root, "package.json"))) process.exit(0);

spawnSync("pnpm", ["exec", "oxfmt", rel], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
  shell: process.platform === "win32",
});
process.exit(0);
