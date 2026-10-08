// M-04 exit: build FizzBuzz from an empty chart through the + menu and the node editors, by
// typing in value lines, and submit it to Accepted. U-34, U-40, U-41, U-50..U-54, U-93..U-95.
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
const chart = (page: Page) => page.getByTestId("chart");

/** Types a text through the list's Text (U-50): no quotes are typed. */
async function text(page: Page, value: string): Promise<void> {
  await page.keyboard.type("text");
  await page.keyboard.press("Enter");
  await expect(editor(page).getByTestId("text-field")).toBeFocused();
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

test("M-04 exit: FizzBuzz is built from an empty chart by typing, and accepted", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByRole("button", { name: "Add your first block" })).toBeVisible();

  // The name list offers a new name; Enter takes it and the start value is next.
  const loop = await insert(page, "main/main/0", "for");
  await page.keyboard.type("i");
  await expect(editor(page).getByTestId("value-list")).toContainText("New variable");
  await page.keyboard.press("Enter");
  // The start value is selected: typing replaces it; Tab goes on to the stop value.
  await page.keyboard.type("1");
  await page.keyboard.press("Tab");
  await page.keyboard.type("n+1");
  await expect(chart(page)).toContainText("i < n + 1?");

  const fifteen = await insert(page, `${loop}/body/0`, "if");
  await page.keyboard.type("i%15==0");
  await expect(chart(page)).toContainText("(remainder of i divided by 15) = 0?");
  await insert(page, `${fifteen}/then/0`, "print");
  await text(page, "FizzBuzz");

  const three = await insert(page, `${fifteen}/else/0`, "if");
  await page.keyboard.type("i%3==0");
  await insert(page, `${three}/then/0`, "print");
  await text(page, "Fizz");

  const five = await insert(page, `${three}/else/0`, "if");
  await page.keyboard.type("i%5==0");
  await insert(page, `${five}/then/0`, "print");
  await text(page, "Buzz");
  await insert(page, `${five}/else/0`, "print");
  await page.keyboard.type("i ");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("for i in range(1, n + 1):");
});

test("U-52: the list follows the value before the caret, and Show all lists every entry", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await insert(page, "main/main/0", "assign");
  await page.keyboard.type("x");
  await page.keyboard.press("Enter");
  const list = editor(page).getByTestId("value-list");
  await expect(list.locator('[data-group="variables"]')).toContainText("n");
  await expect(list.locator('[data-group="values"]')).toContainText("Text");
  await page.keyboard.type("n ");
  await expect(list.locator('[data-group="calculate"]')).toContainText("Multiply");
  await expect(list.locator('[data-group="values"]')).toHaveCount(0);
  await list.getByText("Show all").click();
  await expect(list.locator('[data-group="combine"]')).toContainText("Or");
  // An entry chosen after a value takes it as its first input (U-53).
  // The explanation line explains the highlighted entry (U-96).
  await list.getByText("Absolute value").hover();
  await expect(editor(page).getByTestId("explanation")).toContainText(
    "The number without its sign",
  );
  await list.getByText("Absolute value").click();
  await expect(chart(page)).toContainText("Create x and set it to absolute value of n");
});

test("U-54: Backspace removes an operator and an operation's words; an operator is switched", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await insert(page, "main/main/0", "assign");
  await page.keyboard.type("x");
  await page.keyboard.press("Enter");
  await page.keyboard.type("n<2");
  await expect(chart(page)).toContainText("Create x and set it to n < 2");
  await editor(page).locator("[data-operator]").click();
  await editor(page).getByTestId("value-list").getByText("At most").click();
  await expect(chart(page)).toContainText("Create x and set it to n ≤ 2");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(chart(page)).toContainText("Create x and set it to n");
  await expect(chart(page)).not.toContainText("≤");
});

test("U-41: a click on a node's words opens its first slot still to fill", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  const id = await insert(page, "main/main/0", "assign");
  await page.keyboard.type("x");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await chart(page).locator(`[data-node-id="${id}"] tspan:not([data-slot])`).first().click();
  await page.keyboard.type("5");
  await expect(chart(page)).toContainText("Create x and set it to 5");
});

test("U-94, U-96: a problem's name set nowhere yet is explained as created here", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/sum-to-n");
  await insert(page, "main/main/0", "assign");
  const list = editor(page).getByTestId("value-list");
  await expect(list.locator('[data-group="problem"]')).toContainText("total");
  await list.getByText("total").hover();
  await expect(editor(page).getByTestId("explanation")).toContainText(
    "Creates the variable total here.",
  );
});

test("U-93: a comparison after a comparison is refused with its message", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await insert(page, "main/main/0", "if");
  await page.keyboard.type("n<3<");
  await expect(editor(page).getByTestId("explanation")).toContainText(
    "Write a < b < c as a < b and b < c",
  );
  await expect(chart(page)).toContainText("n < 3?");
});

test("U-53: , opens the next value of a list of values", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await text(page, "Hello,");
  await page.keyboard.type(",");
  await page.keyboard.type("name ");
  await page.keyboard.press("Escape");
  await expect(chart(page)).toContainText('Print "Hello,", name');
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
});

test("U-95: a named node shows its name, and the Python tab writes it as a comment", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await insert(page, "main/main/0", "if");
  await page.keyboard.type("n%3==0");
  await editor(page).getByTestId("node-name").fill("Is n a multiple of 3?");
  await expect(
    chart(page).locator("text").filter({ hasText: "Is n a multiple of 3?" }),
  ).toHaveCount(1);
  await expect(chart(page).locator("text").filter({ hasText: "remainder of" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("# Is n a multiple of 3?");
});

test("U-51: a print with no value draws no placeholder", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await editor(page).getByRole("button", { name: "Remove this value" }).click();
  await expect(chart(page)).not.toContainText("choose a value");
});
