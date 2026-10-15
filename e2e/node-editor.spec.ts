// Editing: build FizzBuzz from an empty chart through the + menu and the node editors, by
// typing and choosing in value lines, and submit it to Accepted.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { programWith, seedPlayground, seedProgram, seedProgress, solutionOf } from "./seed";

const editor = (page: Page) => page.getByTestId("node-editor");
const chart = (page: Page) => page.getByTestId("chart");

/** Inserts the block `entry` at the connector of `place`, returning the new statement's id. */
async function insert(page: Page, place: string, entry: string): Promise<string> {
  await page.keyboard.press("Escape");
  await page.locator(`[data-testid="connector"][data-place="${place}"]`).click();
  await page.getByTestId("block-menu").locator(`[data-entry="${entry}"]`).click();
  await expect(editor(page)).toBeVisible();
  return (await editor(page).getAttribute("data-node")) ?? "";
}

/** Types into whatever has the keyboard, one key at a time. */
async function keys(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
}

/** A print of one text, chosen as Text and typed without quotes. */
async function printText(page: Page, place: string, text: string): Promise<void> {
  await insert(page, place, "print");
  await keys(page, "text");
  await page.keyboard.press("Enter");
  await expect(editor(page).locator("[data-text-field]")).toBeFocused();
  await keys(page, text);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
}

test("FizzBuzz is built from an empty chart by typing and choosing, and accepted", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByRole("button", { name: "Add your first block" })).toBeVisible();

  const loop = await insert(page, "main/main/0", "for");
  // The variable's name field has the keyboard: a typed name is offered as a new variable.
  await keys(page, "i");
  await expect(editor(page).getByTestId("editor-list")).toContainText("New variable");
  await page.keyboard.press("Enter");
  // The start value is selected: a digit replaces it; Tab reaches the stop.
  await keys(page, "1");
  await page.keyboard.press("Tab");
  await keys(page, "n+1");
  await page.keyboard.press("Enter");
  await expect(editor(page)).toHaveCount(0);
  await expect(chart(page)).toContainText("i < n + 1?");

  const fifteen = await insert(page, `${loop}/body/0`, "if");
  await keys(page, "i%15==0");
  await expect(editor(page).getByTestId("explanation")).toContainText("Equals");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("i % 15 = 0?");
  await printText(page, `${fifteen}/then/0`, "FizzBuzz");

  const three = await insert(page, `${fifteen}/else/0`, "if");
  await keys(page, "i%3==0");
  await page.keyboard.press("Enter");
  await printText(page, `${three}/then/0`, "Fizz");

  const five = await insert(page, `${three}/else/0`, "if");
  await keys(page, "i%5==0");
  await page.keyboard.press("Enter");
  await printText(page, `${five}/then/0`, "Buzz");
  await insert(page, `${five}/else/0`, "print");
  await keys(page, "i");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");

  await page.getByTestId("tab-result").click();

  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("for i in range(1, n + 1):");
  await expect(page.getByTestId("python-code")).toContainText("if i % 15 == 0:");
});

test("the list follows what is before the caret, and a choice after a value takes it", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/sum-to-n");
  await insert(page, "main/main/0", "assign");
  // This problem's names come first.
  await expect(editor(page).getByTestId("editor-list")).toContainText("This problem");
  await keys(page, "to");
  await expect(editor(page).locator('[data-row^="v:total"]')).toBeVisible();
  await expect(editor(page).locator('[data-row="new:to"]')).toBeVisible();
  await page.keyboard.press("Enter");
  const list = editor(page).getByTestId("editor-list");
  await expect(list).toContainText("Variables");
  await expect(list).toContainText("Random whole number");
  await keys(page, "n ");
  await expect(list).toContainText("Calculate");
  await expect(list).not.toContainText("Random whole number");
  await list.locator('[data-row="e:call:str"]').click();
  await expect(chart(page)).toContainText("total ← str(n)");
  // Backspace after the call's bracket keeps its first input.
  await page.keyboard.press("Backspace");
  await expect(chart(page)).toContainText("total ← n");
});

test("a typed word that names nothing is underlined with the closest name", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/sum-to-n");
  await insert(page, "main/main/0", "print");
  await keys(page, "nn+");
  await expect(editor(page).getByTestId("explanation")).toContainText("Did you mean n?");
});

test("naming a node shows the name on it and as a comment in Python", async ({ page }) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-if15-001"]').click({ position: { x: 20, y: 30 } });
  await editor(page).getByTestId("node-name").fill("Is i a multiple of 15?");
  await expect(chart(page)).toContainText("Is i a multiple of 15?");
  // The node draws its name in place of its condition, which its hover title keeps.
  const node = page.locator('[data-chart-node="fzb-if15-001"]');
  await expect(node.locator("text", { hasText: "i % 15 = 0?" })).toHaveCount(0);
  await expect(node.locator("title")).toHaveText("i % 15 = 0?");
  await page.keyboard.press("Escape");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("    # Is i a multiple of 15?");
});

test("the editor opens on the node's right inside the canvas, the chart scrolled to make room", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  // The rightmost node: the centred chart leaves no room for the editor beside it.
  const node = page.locator('[data-chart-node="fzb-prfb-001"]');
  await node.click({ position: { x: 8, y: 8 } });
  await expect(editor(page)).toBeVisible();
  await expect
    .poll(async () => {
      const box = await node.boundingBox();
      const popup = await editor(page).boundingBox();
      const canvas = await page.getByTestId("canvas").boundingBox();
      if (!box || !popup || !canvas) return "not drawn";
      if (popup.x < box.x + box.width) return "not on the right";
      if (popup.x + popup.width > canvas.x + canvas.width) return "outside the canvas";
      return "ok";
    })
    .toBe("ok");
});

test("the editor is placed by its node without a control on it", async ({ page }) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-prfz-001"]').click({ position: { x: 8, y: 20 } });
  await expect(editor(page)).toBeVisible();
  // Nothing under the node is focusable or announces a popup, apart from the popup's focus guards.
  await expect(
    page
      .getByTestId("editor-anchor")
      .locator("[tabindex]:not([data-base-ui-focus-guard]), [aria-haspopup]"),
  ).toHaveCount(0);
});

test("`,` in a list of values opens the next value after this one", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await keys(page, "1,2");
  await expect(chart(page)).toContainText("print(1, 2)");
  await editor(page).locator("[data-value-line]").first().click();
  await keys(page, ",");
  await expect(chart(page)).toContainText("print(1, …, 2)");
});

test("a print with no value draws no placeholder", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await editor(page).getByRole("button", { name: "Remove this value" }).click();
  await expect(chart(page)).not.toContainText("…");
});

test("a list is typed, its item read, and one item set in the target's line", async ({ page }) => {
  await seedProgress(page, {});
  const id = "play-listitems001";
  await seedProgram(page, id, { ...programWith([]), title: "Lists" });
  await seedPlayground(page, { [id]: { edited: 0 } });
  await page.goto(`/#/play/${id}`);

  await insert(page, "main/main/0", "assign");
  await keys(page, "nums");
  await page.keyboard.press("Enter");
  await keys(page, "[4,9,2,7]");
  // After a list, the list offers what can be done with it.
  const list = editor(page).getByTestId("editor-list");
  await expect(list.locator('section[aria-label="Items"]')).toContainText("Item at a position");
  await expect(list.locator('section[aria-label="Items"]')).toContainText("Count");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("nums ← [4, 9, 2, 7]");

  await insert(page, "main/main/1", "assign");
  await keys(page, "x");
  await page.keyboard.press("Enter");
  // An item is typed as the chart writes it.
  await keys(page, "nums[1]");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("x ← nums[1]");

  // After a variable, a target's list offers only an item of it, and `[` makes one.
  await insert(page, "main/main/2", "assign");
  await keys(page, "nums ");
  await expect(list).toHaveText(/Item at a position/);
  await expect(list).not.toContainText("Count");
  await keys(page, "[");
  await expect(chart(page)).toContainText("nums[…] ← …");
  await keys(page, "0");
  await page.keyboard.press("Tab");
  await keys(page, "x");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("nums[0] ← x");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("narration")).toHaveText(/Finished in/);
  await expect(page.getByTestId("variables")).toContainText("nums ← [9, 9, 2, 7]");
  await expect(page.getByTestId("variables")).toContainText("x ← 9");
});

test("an item target is typed by keys alone, as the chart writes it", async ({ page }) => {
  await seedProgress(page, {});
  const id = "play-itemkeys0001";
  await seedProgram(page, id, { ...programWith([]), title: "Items" });
  await seedPlayground(page, { [id]: { edited: 0 } });
  await page.goto(`/#/play/${id}`);

  await insert(page, "main/main/0", "assign");
  await keys(page, "nums");
  await page.keyboard.press("Enter");
  await keys(page, "[3,1,2]");
  await page.keyboard.press("Enter");
  await insert(page, "main/main/1", "assign");
  await keys(page, "j");
  await page.keyboard.press("Enter");
  await keys(page, "0");
  await page.keyboard.press("Enter");

  // `[` after the list's name makes the item; Tab goes on to the value.
  await insert(page, "main/main/2", "assign");
  await keys(page, "nums[j+1]");
  await page.keyboard.press("Tab");
  await keys(page, "nums[j]");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("nums[j + 1] ← nums[j]");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("narration")).toHaveText(/Finished in/);
  await expect(page.getByTestId("variables")).toContainText("nums ← [3, 3, 2]");
});

test("an item of a variable of no known kind is set by keys alone; no other value is taken", async ({
  page,
}) => {
  await seedProgress(page, {});
  const id = "play-unknownkind";
  await seedProgram(page, id, { ...programWith([]), title: "Rows" });
  await seedPlayground(page, { [id]: { edited: 0 } });
  await page.goto(`/#/play/${id}`);

  await insert(page, "main/main/0", "assign");
  await keys(page, "grid");
  await page.keyboard.press("Enter");
  await keys(page, "[[1,2],[3,4]]");
  await page.keyboard.press("Enter");
  // An item's value has no kind a list can tell, as a parameter's has none.
  await insert(page, "main/main/1", "assign");
  await keys(page, "row");
  await page.keyboard.press("Enter");
  await keys(page, "grid[0]");
  await page.keyboard.press("Enter");

  await insert(page, "main/main/2", "assign");
  // A key that would make no target is refused, and says why.
  await keys(page, "5");
  await expect(editor(page).getByTestId("explanation")).toContainText(
    "Only a variable or an item of a list can be given a value",
  );
  await keys(page, "row[1]");
  await page.keyboard.press("Tab");
  await keys(page, "9");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("row[1] ← 9");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("narration")).toHaveText(/Finished in/);
  await expect(page.getByTestId("variables")).toContainText("grid ← [[1, 9], [3, 4]]");
});

test("a swap of two items and one of two variables are typed as the chart writes them and run", async ({
  page,
}) => {
  await seedProgress(page, {});
  const id = "play-swapplaces1";
  await seedProgram(page, id, { ...programWith([]), title: "Swaps" });
  await seedPlayground(page, { [id]: { edited: 0 } });
  await page.goto(`/#/play/${id}`);

  for (const [index, name, value] of [
    [0, "nums", "[1,2,3]"],
    [1, "x", "1"],
    [2, "y", "2"],
  ] as const) {
    await insert(page, `main/main/${index}`, "assign");
    await keys(page, name);
    await page.keyboard.press("Enter");
    await keys(page, value);
    await page.keyboard.press("Enter");
  }

  await insert(page, "main/main/3", "swap");
  await keys(page, "nums[0]");
  await page.keyboard.press("Tab");
  await keys(page, "nums[2]");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("swap(nums[0], nums[2])");

  // A variable completes the first place, so Enter moves on to the second.
  await insert(page, "main/main/4", "swap");
  await keys(page, "x");
  await page.keyboard.press("Enter");
  await keys(page, "y");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("swap(x, y)");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("narration")).toHaveText(/Finished in/);
  const variables = page.getByTestId("variables");
  await expect(variables).toContainText("nums ← [3, 2, 1]");
  await expect(variables).toContainText("x ← 2");
  await expect(variables).toContainText("y ← 1");
});

test("the editor stays where it is while its list changes, within the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 520 });
  await seedProgress(page, {});
  const id = "play-stillness001";
  await seedProgram(page, id, { ...programWith([]), title: "Still" });
  await seedPlayground(page, { [id]: { edited: 0 } });
  await page.goto(`/#/play/${id}`);
  await insert(page, "main/main/0", "assign");
  await keys(page, "x");
  await page.keyboard.press("Enter");

  const popup = page.getByRole("dialog");
  const line = editor(page).getByTestId("editor-notation");
  const place = async () => ({
    popup: (await popup.boundingBox())?.y,
    line: (await line.boundingBox())?.y,
  });
  const before = await place();
  const canvas = await page.getByTestId("canvas").boundingBox();
  const box = await popup.boundingBox();
  expect(box && canvas && box.y + box.height <= canvas.y + canvas.height).toBe(true);

  // Rows whose explanations differ in length move neither the editor nor the row pointed at.
  const rows = editor(page).locator("[data-row]");
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const shown = await editor(page).getByTestId("editor-list").boundingBox();
    const row = await rows.nth(i).boundingBox();
    // A row the list has scrolled out of sight is not pointed at.
    if (!row || !shown || row.y + row.height > shown.y + shown.height) continue;
    const at = { x: row.x + 20, y: row.y + row.height / 2 };
    await page.mouse.move(at.x, at.y);
    expect(await place()).toEqual(before);
    const pointed = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-row]")?.getAttribute("data-row"),
      at,
    );
    expect(pointed).toBe(await rows.nth(i).getAttribute("data-row"));
  }
  // Typing that shortens the list keeps the line where it is.
  await keys(page, "tr");
  expect(await place()).toEqual(before);
});

test("a text is edited again by keys and by a click", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await keys(page, "text");
  await page.keyboard.press("Enter");
  await keys(page, "hello");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText('print("hello")');

  // Backspace after the text takes its last character and opens its field on the rest.
  await page.keyboard.press("Backspace");
  const field = editor(page).locator("[data-text-field]");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("hell");
  // In the field, Backspace and keys edit the text as any text field does.
  await page.keyboard.press("Backspace");
  await keys(page, "p");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText('print("help")');

  // A click opens it again; Backspace in the emptied field removes the text.
  await editor(page).locator("[data-value]").first().click();
  await expect(field).toHaveValue("help");
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("Backspace");
  await expect(field).toHaveCount(0);
  await expect(chart(page)).toContainText("print(…)");

  // A click on another value while a field is open ends the field and keeps the keyboard.
  await keys(page, "1+text");
  await page.keyboard.press("Enter");
  await keys(page, "ab");
  await editor(page).locator("[data-value]").first().click();
  await expect(field).toHaveCount(0);
  await keys(page, "2");
  await expect(chart(page)).toContainText('print(12 + "ab")');
});
