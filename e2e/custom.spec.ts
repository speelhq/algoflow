// U-32, U-23: a Custom… input value, run with no Expected.
import { expect, test } from "@playwright/test";
import { seedProgram, seedProgress, solutionOf } from "./seed";

test("U-32: Custom… sets an Input node's value, and Run uses it with no Expected", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("input-node").click();
  await page.getByRole("menuitem", { name: "Custom…" }).click();
  await page.getByTestId("custom-field").fill("5");
  await page.getByTestId("custom-field").press("Enter");
  await expect(page.getByTestId("chart")).toContainText("Input n = 5");
  await page.getByTestId("tab-result").click();
  await expect(page.getByTestId("case-select")).toHaveText(/Custom…/);

  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("running")).toHaveText("Running with n = 5");
  await page.getByRole("button", { name: "Skip ▶▶" }).click();
  await expect(page.getByTestId("output-row")).toHaveText(["1", "2", "Fizz", "4", "Buzz"]);
  await expect(page.getByTestId("result-tab")).not.toContainText("Expected");
  await expect(page.getByTestId("case-verdict")).toHaveCount(0);
});

test("U-32: a Custom… value that is not a literal is refused", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("input-node").click();
  await page.getByRole("menuitem", { name: "Custom…" }).click();
  await page.getByTestId("custom-field").fill("n + 1");
  await page.getByTestId("custom-field").press("Enter");
  await expect(page.getByTestId("custom-editor").getByRole("alert")).toContainText("Only a number");
  await expect(page.getByTestId("chart")).toContainText("Input n = 15");
});
