import { expect, test, type Locator, type Page } from "@playwright/test";

const LAYOUT_KEY = "algoflow:layout";

async function width(locator: Locator): Promise<number | undefined> {
  return (await locator.boundingBox())?.width;
}
async function height(locator: Locator): Promise<number | undefined> {
  return (await locator.boundingBox())?.height;
}

/** Drag a resize handle by (dx, dy) from its centre. */
async function drag(page: Page, handle: Locator, dx: number, dy: number) {
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle is not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

test.describe("M-00 shell", () => {
  test("U-01/U-02/U-10/U-30/U-61: app name and every panel title are visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("top-bar")).toContainText("AlgoFlow");

    await expect(page.getByRole("tab", { name: "Blocks" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Task" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "main" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
    for (const name of ["Data", "Trace", "Output", "Tests", "Python"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }

    for (const name of ["Undo", "Redo", "Export", "Import", "Help"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await expect(page.getByTestId("save-status")).toHaveText("Saved");
    await expect(page.getByRole("combobox", { name: "Challenge" })).toContainText("Free mode");
    await expect(page.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("run-status")).toHaveText("Step 0");
  });

  test("U-01: panels start at 240 / 320 / 280 px under a 48 px top bar", async ({ page }) => {
    await page.goto("/");
    expect(await height(page.getByTestId("top-bar"))).toBe(48);
    expect(await width(page.getByTestId("left-panel"))).toBe(240);
    expect(await width(page.getByTestId("right-panel"))).toBe(320);
    expect(await height(page.getByTestId("bottom-panel"))).toBe(280);
  });

  test("U-01: side panels resize, clamp, and persist under algoflow:layout", async ({ page }) => {
    await page.goto("/");
    const left = page.getByTestId("left-panel");
    const right = page.getByTestId("right-panel");

    await drag(page, page.getByTestId("resize-left"), 60, 0);
    expect(await width(left)).toBe(300);
    await drag(page, page.getByTestId("resize-left"), -500, 0);
    expect(await width(left)).toBe(200);
    await drag(page, page.getByTestId("resize-left"), 500, 0);
    expect(await width(left)).toBe(360);

    await drag(page, page.getByTestId("resize-right"), -40, 0);
    expect(await width(right)).toBe(360);
    await drag(page, page.getByTestId("resize-right"), 900, 0);
    expect(await width(right)).toBe(280);

    await page.reload();
    expect(await width(left)).toBe(360);
    expect(await width(right)).toBe(280);
    const stored = await page.evaluate((key) => localStorage.getItem(key), LAYOUT_KEY);
    expect(stored).not.toBeNull();
    const state = (JSON.parse(stored ?? "{}") as { state: { left: number; right: number } }).state;
    expect(state).toMatchObject({ left: 360, right: 280 });
  });

  test("U-01: bottom panel ranges from 160 px to 60 % of the height", async ({ page }) => {
    await page.goto("/");
    const bottom = page.getByTestId("bottom-panel");
    await drag(page, page.getByTestId("resize-bottom"), 0, -600);
    expect(await height(bottom)).toBe(540);
    await drag(page, page.getByTestId("resize-bottom"), 0, 800);
    expect(await height(bottom)).toBe(160);
    await page.reload();
    expect(await height(bottom)).toBe(160);
  });

  test("U-10: palette section expansion persists", async ({ page }) => {
    await page.goto("/");
    const fn = page.getByRole("button", { name: "Function" });
    await expect(fn).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Basic" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await fn.click();
    await expect(fn).toHaveAttribute("aria-expanded", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Function" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("S-02: a viewport under 1280 px shows app.desktopOnly and no editor", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("desktop-only")).toBeVisible();
    await expect(page.getByTestId("left-panel")).toHaveCount(0);
    await expect(page.getByTestId("top-bar")).toHaveCount(0);
  });
});
