// L-07, L-16, L-18, L-29: value helpers shared by node runners. No third-party imports (P-01).
import type { Heap, HeapEntry, Value } from "@/lang/types";

export type NumberValue = { t: "int"; v: number } | { t: "float"; v: number };

export function isNumber(value: Value): value is NumberValue {
  return value.t === "int" || value.t === "float";
}

/** L-07: an int result outside ±2^53 becomes a float. */
const INT_LIMIT = 2 ** 53;

export function makeNumber(n: number, float: boolean): NumberValue {
  if (float || !Number.isInteger(n) || Math.abs(n) > INT_LIMIT) return { t: "float", v: n };
  return { t: "int", v: n };
}

export function entryOf(heap: Heap, ref: number): HeapEntry {
  const entry = heap.get(ref);
  if (!entry) throw new Error(`dangling heap ref ${ref}`);
  return entry;
}

export function typeName(value: Value, heap: Heap): string {
  if (value.t === "obj")
    return entryOf(heap, value.ref).kind === "obj" ? classOf(value, heap) : "obj";
  return value.t;
}

function classOf(value: { ref: number }, heap: Heap): string {
  const entry = entryOf(heap, value.ref);
  return entry.kind === "obj" ? entry.cls : "obj";
}

/** L-18 */
export function truthy(value: Value, heap: Heap): boolean {
  switch (value.t) {
    case "int":
    case "float":
      return value.v !== 0;
    case "str":
      return value.v.length > 0;
    case "bool":
      return value.v;
    case "none":
      return false;
    case "list": {
      const entry = entryOf(heap, value.ref);
      return entry.kind === "list" && entry.items.length > 0;
    }
    case "dict": {
      const entry = entryOf(heap, value.ref);
      return entry.kind === "dict" && entry.entries.size > 0;
    }
    case "obj":
      return true;
  }
}

/** L-16 */
export function equals(a: Value, b: Value, heap: Heap): boolean {
  if (isNumber(a) && isNumber(b)) return a.v === b.v;
  if (a.t !== b.t) return false;
  switch (a.t) {
    case "str":
    case "bool":
      return a.v === (b as typeof a).v;
    case "none":
      return true;
    case "obj":
      return a.ref === (b as typeof a).ref;
    case "list": {
      const x = entryOf(heap, a.ref);
      const y = entryOf(heap, (b as typeof a).ref);
      if (x.kind !== "list" || y.kind !== "list") return false;
      return (
        x.items.length === y.items.length &&
        x.items.every((item, i) => equals(item, y.items[i] ?? { t: "none" }, heap))
      );
    }
    case "dict": {
      const x = entryOf(heap, a.ref);
      const y = entryOf(heap, (b as typeof a).ref);
      if (x.kind !== "dict" || y.kind !== "dict") return false;
      if (x.entries.size !== y.entries.size) return false;
      for (const [key, item] of x.entries) {
        const other = y.entries.get(key);
        if (!other || !equals(item, other, heap)) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

/** Python `repr(float)`: shortest round-trip digits, exponent form outside 1e-4 … 1e16. */
export function floatRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (Object.is(x, -0)) return "-0.0";
  const [mantissa = "0", exponent = "0"] = x.toExponential().split("e");
  const sign = mantissa.startsWith("-") ? "-" : "";
  const digits = mantissa.replace("-", "").replace(".", "");
  const e = Number(exponent);
  if (e < -4 || e >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${m}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
  }
  if (e >= 0) {
    const intPart = digits.slice(0, e + 1).padEnd(e + 1, "0");
    const fraction = digits.slice(e + 1) || "0";
    return `${sign}${intPart}.${fraction}`;
  }
  return `${sign}0.${"0".repeat(-e - 1)}${digits}`;
}

/** Python `repr(str)`: single quotes unless the text has a single quote and no double quote. */
export function strRepr(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of text) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += `\\${quote}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out + quote;
}

/** L-29: Python `str()`. Strings inside containers use `repr()`. */
export function str(value: Value, heap: Heap): string {
  return value.t === "str" ? value.v : repr(value, heap);
}

export function repr(value: Value, heap: Heap): string {
  switch (value.t) {
    case "int":
      return String(value.v);
    case "float":
      return floatRepr(value.v);
    case "str":
      return strRepr(value.v);
    case "bool":
      return value.v ? "True" : "False";
    case "none":
      return "None";
    case "list": {
      const entry = entryOf(heap, value.ref);
      return entry.kind === "list"
        ? `[${entry.items.map((item) => repr(item, heap)).join(", ")}]`
        : "[]";
    }
    case "dict": {
      const entry = entryOf(heap, value.ref);
      if (entry.kind !== "dict") return "{}";
      const parts: string[] = [];
      for (const [key, item] of entry.entries) {
        const k = key.startsWith("i:") ? key.slice(2) : strRepr(key.slice(2));
        parts.push(`${k}: ${repr(item, heap)}`);
      }
      return `{${parts.join(", ")}}`;
    }
    case "obj": {
      const entry = entryOf(heap, value.ref);
      if (entry.kind !== "obj") return "<obj>";
      const fields = [...entry.fields].map(([name, field]) => `${name}=${repr(field, heap)}`);
      return `${entry.cls}(${fields.join(", ")})`;
    }
  }
}
