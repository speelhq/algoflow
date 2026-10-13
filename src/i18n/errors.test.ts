import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./codes";
import en from "./en.json";
import { flatten } from "./flatten";
import { errorKey } from "./t";

describe("error messages", () => {
  const catalog = flatten(en);

  it.each(ERROR_CODES)("%s has error.<CODE> in en.json", (code) => {
    expect(catalog[errorKey(code)]).toEqual(expect.any(String));
  });
});
