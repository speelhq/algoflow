// M-04 exit: build FizzBuzz from an empty chart through the + menu and the node editors, and
// submit it to Accepted. U-34, U-40, U-41, U-50..U-53.
import { expect, test, type Page } from "@playwright/test";
import { seedProgress } from "./seed";

/** Inserts the block `entry` at the connector of `place`, returning the new statement's id. */
async function insert(page: Page, place: string, entry: string): Promise<string> {
  await page.keyboard.press("Escape");
  await page.locator(`[data-testid="connector"][data-place="${place}"]`).click();
  await page.getByTestId("block-menu").locator(`[data-entry="${entry}"]`).click();
  const editor = page.getByTestId("node-editor");
  await expect(editor).toBeVisible();
  return (await editor.getAttribute("data-node")) ?? "";
}

const editor = (page: Page) => page.getByTestId("node-editor");
const menu = (page: Page) => page.getByTestId("value-menu");

/** Opens the editor's first empty chip. */
async function openEmpty(page: Page): Promise<void> {
  await editor(page).locator("[data-chip]", { hasText: "choose a value" }).first().click();
}

/** Types into the open menu's field and takes what it makes. */
async function type(page: Page, text: string): Promise<void> {
  await menu(page).getByTestId("value-field").fill(text);
  await menu(page).getByTestId("value-field").press("Enter");
}

/** Fills the condition slot with `i is divisible by <n>`. */
async function divisible(page: Page, by: string): Promise<void> {
  await openEmpty(page);
  await menu(page).locator('[data-template="divisible"]').click();
  await menu(page).getByRole("button", { name: "i", exact: true }).click();
  await type(page, by);
}

/** A print of one value: typed text, or a variable from the value row. */
async function printed(page: Page, place: string, value: string): Promise<void> {
  await insert(page, place, "print");
  await openEmpty(page);
  if (value.startsWith('"')) await type(page, value);
  else await menu(page).getByRole("button", { name: value, exact: true }).click();
}

test("M-04 exit: FizzBuzz is built from an empty chart and accepted", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByRole("button", { name: "Add your first block" })).toBeVisible();

  const loop = await insert(page, "main/main/0", "for");
  await editor(page).locator('[data-name-slot="var"]').fill("i");
  await editor(page).locator("[data-chip]", { hasText: /^0$/ }).click();
  await type(page, "1");
  await openEmpty(page);
  await menu(page).getByRole("button", { name: "n", exact: true }).click();
  await editor(page).locator("[data-chip]", { hasText: /^n$/ }).click();
  await menu(page).locator('[data-group="math"]').click();
  await page.getByRole("menuitem", { name: "+", exact: true }).click();
  await type(page, "1");
  await expect(page.getByTestId("chart")).toContainText("Is i < n + 1?");

  const fifteen = await insert(page, `${loop}/body/0`, "if");
  await divisible(page, "15");
  await expect(page.getByTestId("chart")).toContainText("Is i divisible by 15?");
  await printed(page, `${fifteen}/then/0`, '"FizzBuzz');

  const three = await insert(page, `${fifteen}/else/0`, "if");
  await divisible(page, "3");
  await printed(page, `${three}/then/0`, '"Fizz');

  const five = await insert(page, `${three}/else/0`, "if");
  await divisible(page, "5");
  await printed(page, `${five}/then/0`, '"Buzz');
  await printed(page, `${five}/else/0`, "i");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("for i in range(1, n + 1):");
});

test("Type as text parses on Enter and keeps the expression on an error; chips Unwrap and Delete (U-55, U-54)", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await insert(page, "main/main/0", "assign");
  await editor(page).locator('[data-name-slot="target"]').fill("x");
  await openEmpty(page);
  await type(page, "1");
  await expect(page.getByTestId("chart")).toContainText("Create x and set it to 1");

  await editor(page).locator("[data-chip]", { hasText: /^1$/ }).click();
  await menu(page).getByRole("button", { name: "Type as text" }).click();
  const text = menu(page).getByTestId("type-as-text");
  await text.fill("n +");
  await text.press("Enter");
  await expect(menu(page).getByRole("alert")).toHaveText("Syntax error at character 3");
  await expect(page.getByTestId("chart")).toContainText("Create x and set it to 1");
  await text.fill("n + 2");
  await text.press("Enter");
  await expect(page.getByTestId("chart")).toContainText("Create x and set it to n + 2");

  await editor(page).locator("[data-chip]", { hasText: "+" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Unwrap" }).click();
  await expect(page.getByTestId("chart")).toContainText("Create x and set it to n");
  await editor(page).locator("[data-chip]", { hasText: /^n$/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByTestId("chart")).toContainText("Create x and set it to choose a value");
});

test("U-53: after a value, the menu moves to the next empty value of the same list", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await editor(page).getByRole("button", { name: "+ value" }).click();
  await editor(page).locator("[data-chip]", { hasText: "choose a value" }).first().click();
  await type(page, '"Hello,');
  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole("button", { name: "name", exact: true }).click();
  await expect(menu(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
});

test("U-51: a print with no value draws no placeholder", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await editor(page).getByRole("button", { name: "Remove this value" }).click();
  await expect(page.getByTestId("chart")).not.toContainText("choose a value");
});
