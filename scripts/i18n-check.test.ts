import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoFiles } from "./lib/files";
import { checkI18n, formatReport, scan } from "./lib/i18n-check";

let root: string;

function write(rel: string, text: string) {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

function run() {
  return checkI18n({ root, files: repoFiles(root), i18nDir: join(root, "src", "i18n") });
}

describe("the key check", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "algoflow-i18n-"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    write("src/i18n/en.json", JSON.stringify({ app: { name: "AlgoFlow", saved: "Saved" } }));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("passes when every t() literal key exists", () => {
    write("src/ui/a.tsx", 'const x = t("app.name");\nconst y = t("app.saved", { n: 1 });');
    const report = run();
    expect(report.unknown).toEqual([]);
    expect(report.unused).toEqual([]);
    expect(report.usages).toBe(2);
    expect(formatReport(report).at(-1)).toBe("i18n: 2 keys, 2 usages, ok");
  });

  it("fails on an unknown literal key with file and line", () => {
    write("src/ui/b.tsx", 'const a = t("app.name");\n\nconst b = t("app.nope");');
    const report = run();
    expect(report.unknown).toEqual([{ file: "src/ui/b.tsx", line: 3, key: "app.nope" }]);
    expect(formatReport(report)[0]).toBe('src/ui/b.tsx:3 unknown key "app.nope"');
  });

  it("ignores test files and calls that are not t()", () => {
    write("src/ui/c.test.tsx", 'expect(t("app.nope"))');
    const text = 'list.at("app.nope"); obj.t("app.nope"); format("app.nope")';
    write("src/ui/d.ts", text);
    expect(run().usages).toBe(0);
    expect(scan({ file: "src/ui/d.ts", text }).usages).toEqual([]);
  });

  it("fails on a file the parser rejects", () => {
    write("src/ui/bad.ts", "const = ;");
    expect(run).toThrow(/^src\/ui\/bad\.ts: /);
  });

  it("names a key by a whole string literal wherever it stands, and not in a comment", () => {
    write(
      "src/i18n/en.json",
      JSON.stringify({
        result: { pass: "Passed", fail: "Failed" },
        run: { run: "Run", narrate: { done: "Done" } },
        app: { unused: "Unused", "sign-in": "Sign in", old: "Old" },
      }),
    );
    write("src/ui/ternary.tsx", 't(ok ? "result.pass" : "result.fail")');
    write("src/ui/map.tsx", 'const LABEL = { idle: "run.run" } as const;');
    write("src/ui/narrate.ts", "const told = { key: `run.narrate.done`, params: {} };");
    write("src/ui/sign.tsx", '<p className="a b">{t("app.sign-in")}</p>; // was "app.old"');
    const report = run();
    expect(report.unused).toEqual(["app.unused", "app.old"]);
    expect(formatReport(report)[0]).toBe('en.json unused key "app.unused"');
  });

  it("names every key a t() template literal matches, and none by one elsewhere", () => {
    write(
      "src/i18n/en.json",
      JSON.stringify({
        problems: {
          topic: { loops: "Loops", lists: "Lists", deep: { x: "X" } },
          mark: { solved: "✓" },
          other: "Other",
        },
        app: { nav: { problems: "Problems" }, cast: { a: "A" }, stored: "Stored" },
      }),
    );
    write("src/ui/tags.tsx", "t(`problems.topic.${topic}`)");
    write(
      "src/ui/forms.tsx",
      "t(ok ? `problems.mark.${mark}` : (`app.nav.${\n  label({ tab })\n}`))",
    );
    write("src/ui/cast.tsx", "t(`app.cast.${name}` as MessageKey)");
    write("src/store/keys.ts", "const key = `${prefix}.${id}`;");
    write("src/ui/any.tsx", "t(`${ns}.${name}`)");
    expect(run().unused).toEqual([
      "problems.topic.deep.x",
      "problems.other",
      "app.cast.a",
      "app.stored",
    ]);
  });

  it("names the keys of registered blocks and of the error codes", () => {
    write(
      "src/i18n/en.json",
      JSON.stringify({
        block: { print: { label: "Print", help: "Shows a value" }, gone: { label: "Gone" } },
        error: { E_KEY: "Key {key} does not exist", E_GONE: "Gone" },
      }),
    );
    expect(run().unused).toEqual(["block.gone.label", "error.E_GONE"]);
  });

  it("checks key parity with ja.json once it exists", () => {
    write("src/i18n/ja.json", JSON.stringify({ app: { name: "アルゴフロー", extra: "x" } }));
    const report = run();
    expect(report.missing).toEqual([
      { locale: "ja", key: "app.saved" },
      { locale: "en", key: "app.extra" },
    ]);
  });
});
