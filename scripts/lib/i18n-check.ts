// T-08 / U-71: every `t("...")` literal key in src/ must exist in en.json;
// once ja.json exists, both catalogs must have the same key set.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { flatten } from "../../src/i18n/flatten";

export type Usage = { file: string; line: number; key: string };
export type Missing = { locale: string; key: string };
export type I18nReport = {
  keys: number;
  usages: number;
  unknown: Usage[];
  missing: Missing[];
};

const SOURCE = /\.(ts|tsx)$/;
const SKIP = /(\.test\.(ts|tsx)|\.d\.ts)$/;
// `t("key"` or `t('key'` not preceded by an identifier character or a dot
// (so `at(` and `x.t(` are ignored). Lexical: comments are scanned too.
const USAGE = /(?<![\w.$])t\(\s*(["'])([^"'`]+)\1/g;

export function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (SOURCE.test(name) && !SKIP.test(name)) out.push(path);
  }
  return out;
}

export function usagesIn(file: string, root: string): Usage[] {
  const text = readFileSync(file, "utf8");
  const rel = relative(root, file).replaceAll("\\", "/");
  const usages: Usage[] = [];
  let line = 1;
  let scanned = 0;
  for (const match of text.matchAll(USAGE)) {
    for (let i = scanned; i < match.index; i += 1) if (text[i] === "\n") line += 1;
    scanned = match.index;
    usages.push({ file: rel, line, key: match[2] ?? "" });
  }
  return usages;
}

export function checkI18n(opts: { root: string; srcDir: string; i18nDir: string }): I18nReport {
  const en = flatten(JSON.parse(readFileSync(join(opts.i18nDir, "en.json"), "utf8")));
  const enKeys = new Set(Object.keys(en));

  const usages = sourceFiles(opts.srcDir).flatMap((file) => usagesIn(file, opts.root));
  const unknown = usages.filter((u) => !enKeys.has(u.key));

  const missing: Missing[] = [];
  const jaPath = join(opts.i18nDir, "ja.json");
  if (existsSync(jaPath)) {
    const ja = flatten(JSON.parse(readFileSync(jaPath, "utf8")));
    const jaKeys = new Set(Object.keys(ja));
    for (const key of enKeys) if (!jaKeys.has(key)) missing.push({ locale: "ja", key });
    for (const key of jaKeys) if (!enKeys.has(key)) missing.push({ locale: "en", key });
  }

  return { keys: enKeys.size, usages: usages.length, unknown, missing };
}

export function formatReport(report: I18nReport): string[] {
  const lines = report.unknown.map((u) => `${u.file}:${u.line} unknown key "${u.key}"`);
  for (const m of report.missing) lines.push(`${m.locale}.json missing key "${m.key}"`);
  lines.push(
    `i18n: ${report.keys} keys, ${report.usages} usages, ${lines.length === 0 ? "ok" : `${lines.length} problem(s)`}`,
  );
  return lines;
}
