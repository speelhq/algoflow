// Selecting, removing, duplicating, dragging, undo and redo.
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { programWith, seedProgram, seedProgress, solutionOf } from "./seed";

const node = (page: Page, id: string) => page.locator(`[data-chart-node="${id}"]`);

/** Starts dragging a chart node, which then shows its ghost under the pointer. */
async function lift(page: Page, id: string): Promise<void> {
  // The chart is laid out again once its font has loaded; drag from where it settles.
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await expect
    .poll(async () => JSON.stringify(await node(page, id).boundingBox()), { intervals: [100] })
    .toBe(JSON.stringify(await node(page, id).boundingBox()));
  const from = await node(page, id).boundingBox();
  if (!from) throw new Error("not drawn");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 4 });
}

/** Drags a chart node onto the connector of `place`. */
async function drag(page: Page, id: string, place: string): Promise<void> {
  await lift(page, id);
  const to = await page.locator(`[data-testid="connector"][data-place="${place}"]`).boundingBox();
  if (!to) throw new Error("not drawn");
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** A chart node's text spans, or a ghost's, as each is drawn: its text, weight, and color. */
async function drawnSpans(
  spans: Locator,
): Promise<{ text: string; weight: string; color: string }[]> {
  return spans.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      // An SVG span shows its color as its fill; an HTML span as its color.
      const color = element instanceof SVGElement ? style.fill : style.color;
      return { text: element.textContent ?? "", weight: style.fontWeight, color };
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("Delete removes the selected block, and undo and redo walk it back", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(undo).toBeDisabled();
  await node(page, "fzb-prfz-001").click({ position: { x: 8, y: 20 } });
  await expect(page.getByTestId("block-editor")).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(node(page, "fzb-prfz-001")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(node(page, "fzb-prfz-001")).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(node(page, "fzb-prfz-001")).toHaveCount(0);
  await undo.click();
  await expect(node(page, "fzb-prfz-001")).toHaveCount(1);
  await expect(redo).toBeEnabled();
});

test("undo, redo, and duplicate act while a value line has the keyboard", async ({ page }) => {
  await page.goto("/#/p/tutorial");
  await page.locator('[data-testid="connector"][data-place="main/main/0"]').click();
  await page.getByTestId("block-menu").locator('[data-entry="print"]').click();
  const line = page.getByTestId("block-editor").locator("[data-value-line]");
  const chart = page.getByTestId("chart");
  await expect(line).toBeFocused();
  await page.keyboard.type("1");
  await expect(chart).toContainText("print(1)");
  await page.keyboard.press("Control+z");
  await expect(chart).not.toContainText("print(1)");
  await expect(line).toBeFocused();
  await page.keyboard.press("Control+Shift+z");
  await expect(chart).toContainText("print(1)");
  await expect(line).toBeFocused();
  await page.keyboard.press("Control+d");
  await expect(chart.locator("text", { hasText: "print(1)" })).toHaveCount(2);
});

test("Ctrl+D duplicates the selected block, and Esc clears the selection", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await node(page, "fzb-prfz-001").click({ position: { x: 8, y: 20 } });
  await page.keyboard.press("Control+d");
  await expect(page.getByTestId("chart").locator("text", { hasText: 'print("Fizz")' })).toHaveCount(
    2,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("block-editor")).toHaveCount(0);
  await expect(page.locator("[data-selected]")).toHaveCount(0);
});

test("a block dragged onto another connector moves there", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  // The tab is chosen first: dnd-kit stops every click for 50 ms after a drop.
  await page.getByTestId("tab-python").click();
  await drag(page, "fzb-prnt-001", "main/main/0");
  // A drop opens no editor.
  await expect(page.getByTestId("block-editor")).toHaveCount(0);
  await expect(page.getByTestId("python-line").nth(1)).toHaveText("2print(i)");
});

test("a dragged chart node's ghost draws its spans as the chart node does", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  const ghost = page.getByTestId("drag-ghost");
  // A generated chart node, `i ← 1`, gray with its variable bold in the variable color.
  for (const id of ["fzb-loop-001:init", "fzb-prnt-001"]) {
    const drawn = await drawnSpans(node(page, id).locator("tspan"));
    await lift(page, id);
    await expect(ghost).toBeVisible();
    expect(await drawnSpans(ghost.locator("span"))).toEqual(drawn);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(ghost).toHaveCount(0);
  }
  const init = await drawnSpans(node(page, "fzb-loop-001:init").locator("tspan"));
  const print = await drawnSpans(node(page, "fzb-prnt-001").locator("tspan"));
  expect(init.find((span) => span.text === "i")?.weight).toBe("600");
  expect(init.find((span) => span.text === "i")?.color).toBe(
    print.find((span) => span.text === "i")?.color,
  );
  expect(init.find((span) => span.text !== "i")?.color).not.toBe(
    print.find((span) => span.text !== "i")?.color,
  );
});

test("a dragged chart node's ghost draws an empty slot's hint gray, as the chart node does", async ({
  page,
}) => {
  const assign = {
    id: "gst-asg0-001",
    type: "assign",
    target: { id: "gst-tgt0-001", type: "var", name: "x" },
    value: { id: "gst-emp0-001", type: "draft", text: "" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  const drawn = await drawnSpans(node(page, assign.id).locator("tspan"));
  const hint = drawn.find((span) => span.text === "value");
  expect(hint?.weight).toBe("400");
  expect(hint?.color).not.toBe(drawn.find((span) => span.text === " ← ")?.color);
  await lift(page, assign.id);
  const ghost = page.getByTestId("drag-ghost");
  await expect(ghost).toBeVisible();
  expect(await drawnSpans(ghost.locator("span"))).toEqual(drawn);
  await page.mouse.up();
});

test("a drop that takes break out of its loop is refused with a tooltip", async ({ page }) => {
  const loop = {
    id: "drg-loop-001",
    type: "while",
    cond: { id: "drg-cond-001", type: "bool", value: true },
    body: [{ id: "drg-stop-001", type: "break" }],
  };
  await seedProgram(page, "fizzbuzz", programWith([loop]));
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("tab-python").click();
  await drag(page, "drg-stop-001", "main/main/0");
  await expect(page.getByTestId("drop-refused")).toHaveText("This block only works inside a loop");
  await expect(node(page, "drg-stop-001")).toHaveCount(1);
  await expect(page.getByTestId("python-line")).toHaveText([
    "1n = 15",
    "2while True:",
    "3    break",
  ]);
});
