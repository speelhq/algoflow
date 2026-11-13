// The typefaces: code in JetBrains Mono with no ligature, words in Geist (`pages.md`, Typefaces).
import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";
import { seedProgram, seedProgress, readSolution } from "./seed";

const style = (locator: Locator) =>
  locator.evaluate((el) => {
    const computed = getComputedStyle(el);
    return { family: computed.fontFamily, features: computed.fontFeatureSettings };
  });

test("code is drawn in JetBrains Mono with no ligature, and words in Geist", async ({ page }) => {
  await seedProgress(page, { fizzbuzz: { status: "attempted", hints: 0, solution: false } });
  await seedProgram(page, "fizzbuzz", readSolution("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  const chart = page.getByTestId("chart");

  const condition = await style(chart.locator("tspan", { hasText: "%" }).first());
  expect(condition.family).toContain("JetBrains Mono");
  expect(condition.features).toContain('"calt" 0');
  expect((await style(chart.locator("tspan", { hasText: "Start" }))).family).toContain(
    "JetBrains Mono",
  );

  const example = page.getByTestId("example");
  expect((await style(example.getByText("Output"))).family).toContain("Geist");
  expect((await style(example.getByText("Fizz").first())).family).toContain("JetBrains Mono");

  await page.locator('[data-testid="connector"][data-place="main/main/0"]').click();
  const menu = page.getByTestId("block-menu");
  expect((await style(menu.getByText("print(values)"))).family).toContain("JetBrains Mono");
  expect((await style(menu.getByText("Print", { exact: true }))).family).toContain("Geist");

  await menu.locator('[data-entry="print"]').click();
  const line = page.getByTestId("block-editor").locator("[data-value-line]").first();
  expect((await style(line)).family).toContain("JetBrains Mono");
});

test("both typefaces draw the arrows from JetBrains Mono, and a canvas measures them so", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  const drawn = await page.evaluate(async () => {
    const stack = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name);
    // The faces each stack draws `total ← 0` from, loaded as the page would draw that text.
    for (const font of [
      `13px ${stack("--typeface-code")}`,
      `600 13px ${stack("--typeface-code")}`,
      `13px ${stack("--typeface-words")}`,
    ]) {
      await document.fonts.load(font, "total ← 0");
    }
    // The page's own classes name the arrows' family in both stacks.
    const families = ["font-sans", "font-mono"].map((className) => {
      const span = document.createElement("span");
      span.className = className;
      document.body.append(span);
      return getComputedStyle(span).fontFamily;
    });
    const loaded = [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map(
        (face) =>
          `${face.family} ${face.weight} ${face.unicodeRange.startsWith("U+0-FF") ? "latin" : face.unicodeRange}`,
      );
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return undefined;
    context.font = `13px ${stack("--typeface-code")}`;
    return {
      families,
      loaded,
      arrow: context.measureText("←").width,
      letter: context.measureText("a").width,
    };
  });
  expect(drawn?.loaded).toEqual(
    expect.arrayContaining([
      "JetBrains Mono Arrows 400 U+2190, U+2192, U+2194",
      "JetBrains Mono Arrows 600 U+2190, U+2192, U+2194",
      "Geist Variable 100 900 latin",
      "JetBrains Mono Variable 100 800 latin",
    ]),
  );
  expect(drawn?.arrow).toBe(drawn?.letter);
  for (const family of drawn?.families ?? []) expect(family).toContain("JetBrains Mono Arrows");
});
