// T-10: one screenshot per screen state, saved under e2e/screenshots/ for review; compared
// with baselines from M-10. Drawn at 1280 × 800, the size of the boards in docs/design/.
import { expect, test, type Page } from "@playwright/test";

const DIR = "e2e/screenshots";

async function seedProgress(page: Page, entries: Record<string, unknown>): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("algoflow:progress", value);
  }, JSON.stringify(entries));
}

test.use({ viewport: { width: 1280, height: 800 } });

test("Problems", async ({ page }) => {
  await seedProgress(page, {
    tutorial: { status: "solved", hints: 0, solution: false },
    "sum-to-n": { status: "solved", hints: 0, solution: false },
    fizzbuzz: { status: "attempted", hints: 1, solution: false },
  });
  await page.goto("/#/");
  await expect(page.getByTestId("problems")).toBeVisible();
  await page.screenshot({ path: `${DIR}/problems.png` });
});
