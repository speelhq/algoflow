// M-02 exit: the fizzbuzz solution loads (C-13), renders as read-only cards (U-31, U-32),
// plays to the end (R-11, U-36, U-60), and the Tests, Trace, Output, and Python tabs (U-61)
// show the run.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const fizzbuzz = JSON.parse(
  readFileSync(new URL("../challenges/fizzbuzz.json", import.meta.url), "utf8"),
) as { solution: unknown };

/** C-13: the solution sits in localStorage under algoflow:program:fizzbuzz; selecting the challenge restores it. */
async function openFizzbuzz(page: Page) {
  await page.addInitScript(
    (value) => localStorage.setItem("algoflow:program:fizzbuzz", value),
    JSON.stringify(fizzbuzz.solution),
  );
  await page.goto("/");
  await page.getByRole("combobox", { name: "Challenge" }).click();
  await page.getByRole("option", { name: "FizzBuzz" }).click();
  await expect(page.getByTestId("input-card")).toHaveText("Input n = 15");
}

test.describe("M-02 playback", () => {
  test("C-13/U-31/U-32: the solution renders as cards with chips and regions", async ({ page }) => {
    await openFizzbuzz(page);
    const cards = page.getByTestId("card");
    await expect(cards).toHaveCount(8);
    await expect(cards.first()).toContainText("for i from 1 up to n + 1");
    await expect(cards.nth(1)).toContainText("if i % 15 == 0");
    await expect(cards.nth(2)).toContainText('print "FizzBuzz"');
    await expect(page.getByText("then", { exact: true })).toHaveCount(3);
    await expect(page.getByText("else", { exact: true })).toHaveCount(3);
    await expect(page.getByTestId("connector").first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Test" })).toContainText("15");
  });

  test("R-11/U-36: Step and Back move one event, highlight the card, and refresh Data", async ({
    page,
  }) => {
    await openFizzbuzz(page);
    const status = page.getByTestId("run-status");
    await page.getByRole("button", { name: "Step" }).click();
    await page.getByRole("button", { name: "Step" }).click();
    await expect(status).toHaveText("Step 2");
    await expect(page.locator("[data-testid=card][data-active]")).toHaveCount(1);
    await expect(page.locator("[data-testid=card][data-active]")).toContainText("for i from 1");
    await expect(page.getByTestId("data-row").filter({ hasText: "i" })).toContainText("1");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(status).toHaveText("Step 1");
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(status).toHaveText("Step 0");
    await expect(page.locator("[data-testid=card][data-active]")).toHaveCount(0);
  });

  test("R-11/U-61: Run plays to the end; Output, Trace, and Python show the run", async ({
    page,
  }) => {
    await openFizzbuzz(page);
    await page.getByLabel("Speed").fill("50");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    const status = page.getByTestId("run-status");
    await expect(status).toHaveText(/Step \d+ · Loops 15/, { timeout: 15_000 });

    await page.getByRole("tab", { name: "Output" }).click();
    const lines = page.getByTestId("output-line");
    await expect(lines).toHaveCount(15);
    await expect(lines.last()).toHaveText("FizzBuzz");
    await expect(lines.nth(2)).toHaveText("Fizz");

    await page.getByRole("tab", { name: "Trace" }).click();
    await expect(page.getByRole("columnheader", { name: "i", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Condition" })).toBeVisible();
    const rows = page.getByTestId("trace-row");
    await expect(rows.first()).toContainText("1");
    await expect(rows.filter({ hasText: "1 == 0 → False" }).first()).toBeVisible();
    await expect(rows.filter({ hasText: "0 == 0 → True" }).first()).toBeVisible();
    const target = rows.nth(3).getByRole("button");
    const step = await target.textContent();
    await target.click();
    await expect(status).toHaveText(`Step ${step ?? ""}`);

    await page.getByRole("tab", { name: "Python" }).click();
    await expect(page.getByTestId("python-code")).toContainText("for i in range(1, n + 1):");
    await expect(page.locator("[data-testid=python-line][data-active]")).toHaveCount(1);
  });

  test("U-61 Tests: Run all passes every test, shows Cleared!, and activates Python", async ({
    page,
  }) => {
    await openFizzbuzz(page);
    await page.getByRole("tab", { name: "Tests" }).click();
    await expect(page.getByTestId("test-row")).toHaveCount(3);
    await page.getByRole("button", { name: "Run all" }).click();
    // Every test passes at once, so the Python tab takes over (U-61); the rows are checked after.
    await expect(page.getByRole("tab", { name: "Python" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("python-code")).toContainText("for i in range(1, n + 1):");
    await page.getByRole("tab", { name: "Tests" }).click();
    await expect(page.getByText("Pass", { exact: true })).toHaveCount(3);
    await expect(page.getByTestId("cleared")).toHaveText("Cleared!");

    await page.getByRole("button", { name: "Run with this input" }).nth(1).click();
    await expect(page.getByRole("combobox", { name: "Test" })).toContainText("edge: 1");
    await expect(page.getByTestId("run-status")).toHaveText(/Loops 1$/);
    await page.getByRole("tab", { name: "Output" }).click();
    await expect(page.getByTestId("output-line")).toHaveCount(1);
  });

  test("U-60: free mode has no test selector and no tests", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("combobox", { name: "Test" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Tests" }).click();
    await expect(page.getByTestId("bottom-panel")).toContainText("Free mode has no tests");
    await page.getByRole("button", { name: "Step" }).click();
    await expect(page.getByTestId("run-status")).toHaveText("Step 0 · Loops 0");
  });
});
