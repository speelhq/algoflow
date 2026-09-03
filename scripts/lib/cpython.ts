// R-20: run emitted Python under CPython with the random shim and a JSON epilogue.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Data, Id } from "@/lang/types";

export const PYTHON = process.env.PYTHON ?? "python3";

const PROLOGUE = `import sys, io, json
import random as _random
_draws = iter(__DRAWS__)
def _draw(a, b):
    try:
        return next(_draws)
    except StopIteration:
        raise RuntimeError("draws exhausted")
_random.randint = _draw
_random.uniform = _draw
_out = io.StringIO()
sys.stdout = _out
`;

const EPILOGUE = `
sys.stdout = sys.__stdout__
_ids = {}
def _to_data(v):
    if isinstance(v, bool) or isinstance(v, int) or isinstance(v, str) or v is None:
        return v
    if isinstance(v, float):
        if v == v and v not in (float("inf"), float("-inf")) and v == int(v):
            return {"$float": v}
        return v
    if isinstance(v, list):
        return [_to_data(x) for x in v]
    if isinstance(v, dict):
        return {("$int:%d" % k) if isinstance(k, int) and not isinstance(k, bool) else str(k): _to_data(x) for k, x in v.items()}
    if id(v) not in _ids:
        _ids[id(v)] = len(_ids) + 1
    d = {"$cls": type(v).__name__, "$id": _ids[id(v)]}
    for k, x in vars(v).items():
        d[k] = _to_data(x)
    return d
_vars = {name: _to_data(globals()[name]) for name in __NAMES__ if name in globals()}
_lines = _out.getvalue().split("\\n")
if _lines and _lines[-1] == "":
    _lines.pop()
print(json.dumps({"stdout": _lines, "vars": _vars}))
`;

export function buildScript(code: string, draws: number[], names: Id[]): string {
  return (
    PROLOGUE.replace("__DRAWS__", JSON.stringify(draws)) +
    code +
    EPILOGUE.replace("__NAMES__", JSON.stringify(names))
  );
}

export type PythonResult = { stdout: string[]; vars: Record<Id, Data> } | { error: string };

export function runPython(code: string, draws: number[], names: Id[]): PythonResult {
  const dir = mkdtempSync(join(tmpdir(), "algoflow-check-"));
  const file = join(dir, "solution.py");
  try {
    writeFileSync(file, buildScript(code, draws, names));
    const result = spawnSync(PYTHON, [file], { encoding: "utf8", timeout: 30_000 });
    if (result.error) return { error: `${PYTHON}: ${result.error.message}` };
    if (result.status !== 0)
      return { error: result.stderr.trim().split("\n").at(-1) ?? `exit ${result.status}` };
    const last = result.stdout.trim().split("\n").at(-1) ?? "";
    try {
      return JSON.parse(last) as { stdout: string[]; vars: Record<Id, Data> };
    } catch {
      return { error: `unreadable epilogue: ${last.slice(0, 120)}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
