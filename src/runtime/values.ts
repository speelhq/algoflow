// L-07, L-15, L-16, L-18, L-29: value helpers shared by node runners. No third-party imports (P-01).
import type { Heap, HeapEntry, Value } from "@/lang/types";

export type NumberValue = { t: "int"; v: number } | { t: "float"; v: number };

export function isNumber(value: Value): value is NumberValue {
  return value.t === "int" || value.t === "float";
}

const INT_LIMIT = 2 ** 53;

/** L-07: an int result outside ±2^53 becomes a float; ints have no negative zero. */
export function makeNumber(n: number, float: boolean): NumberValue {
  if (float || !Number.isInteger(n) || Math.abs(n) > INT_LIMIT) return { t: "float", v: n };
  return { t: "int", v: n === 0 ? 0 : n };
}

const copySign = (magnitude: number, sign: number) =>
  sign < 0 || Object.is(sign, -0) ? -Math.abs(magnitude) : Math.abs(magnitude);

/** Python `float.__mod__`: the result takes the divisor's sign, including for zero. */
export function floatMod(a: number, b: number): number {
  let mod = a % b;
  if (mod !== 0) {
    if (b < 0 !== mod < 0) mod += b;
  } else {
    mod = copySign(0, b);
  }
  return mod;
}

/** Python `float.__floordiv__`, consistent with `floatMod` (a == b * floordiv + mod). */
export function floatFloorDiv(a: number, b: number): number {
  const mod = a % b;
  let div = (a - mod) / b;
  if (mod !== 0 && b < 0 !== mod < 0) div -= 1;
  if (div === 0) return copySign(0, a / b);
  let floor = Math.floor(div);
  if (div - floor > 0.5) floor += 1;
  return floor;
}

export function entryOf(heap: Heap, ref: number): HeapEntry {
  const entry = heap.get(ref);
  if (!entry) throw new Error(`dangling heap ref ${ref}`);
  return entry;
}

export function typeName(value: Value, heap: Heap): string {
  if (value.t !== "obj") return value.t;
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

/** L-15: numbers order with numbers, strings with strings; anything else is not orderable. */
export function compare(a: Value, b: Value): -1 | 0 | 1 | undefined {
  let x: number | string;
  let y: number | string;
  if (isNumber(a) && isNumber(b)) {
    x = a.v;
    y = b.v;
  } else if (a.t === "str" && b.t === "str") {
    x = a.v;
    y = b.v;
  } else {
    return undefined;
  }
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
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
