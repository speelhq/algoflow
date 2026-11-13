// Editing: build FizzBuzz from an empty chart through the + menu and the block editors, by
// typing and choosing in value lines, and submit it to Accepted.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { programWith, seedPlayground, seedProgram, seedProgress, solutionOf } from "./seed";

const editor = (page: Page) => page.getByTestId("block-editor");
const chart = (page: Page) => page.getByTestId("chart");

/** Inserts the block `entry` at the connector of `place`, returning the new statement's id. */
async function insert(page: Page, place: string, entry: string): Promise<string> {
  await page.keyboard.press("Escape");
  await page.locator(`[data-testid="connector"][data-place="${place}"]`).click();
  await page.getByTestId("block-menu").locator(`[data-entry="${entry}"]`).click();
  await expect(editor(page)).toBeVisible();
  return (await editor(page).getAttribute("data-block")) ?? "";
}

/** Types into whatever has the keyboard, one key at a time. */
async function keys(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
}

/** A print of one text, chosen as Text, which writes its quotes, and typed between them. */
async function printText(page: Page, place: string, text: string): Promise<void> {
  await insert(page, place, "print");
  await keys(page, "text");
  await page.keyboard.press("Enter");
  await expect(editor(page).locator("[data-value-line]").first()).toHaveValue('""');
  await keys(page, text);
  // Inside a text, Enter chooses nothing and closes the editor.
  await page.keyboard.press("Enter");
  await expect(editor(page)).toHaveCount(0);
}

test("FizzBuzz is built from an empty chart by typing and choosing, and accepted", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByRole("button", { name: "Add your first block" })).toBeVisible();

  const loop = await insert(page, "main/main/0", "for");
  // The variable's target line has the keyboard: a typed name is offered as a new variable.
  await keys(page, "i");
  await expect(editor(page).getByTestId("value-list")).toContainText("New variable");
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
  await expect(chart(page)).toContainText("i % 15 == 0?");
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
  await expect(editor(page).getByTestId("value-list")).toContainText("This problem");
  await keys(page, "to");
  await expect(editor(page).locator('[data-row^="v:total"]')).toBeVisible();
  await expect(editor(page).locator('[data-row="new:to"]')).toBeVisible();
  await page.keyboard.press("Enter");
  const list = editor(page).getByTestId("value-list");
  await expect(list).toContainText("Variables");
  await expect(list).toContainText("Random whole number");
  await keys(page, "n ");
  await expect(list).toContainText("Calculate");
  await expect(list).not.toContainText("Random whole number");
  await list.locator('[data-row="e:call:str"]').click();
  await expect(chart(page)).toContainText("total ← str(n)");
  // Backspace removes one character, as in any text field, and the text that is left stays.
  await page.keyboard.press("Backspace");
  await expect(editor(page).locator("[data-value-line]").last()).toHaveValue("str(n");
});

test("a typed word that names nothing is underlined with the closest name", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/sum-to-n");
  await insert(page, "main/main/0", "print");
  await keys(page, "nn");
  await expect(editor(page).getByTestId("explanation")).toContainText("Did you mean n?");
});

test("a caption shows on its chart node and as a comment in Python", async ({ page }) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-if15-001"]').click({ position: { x: 20, y: 30 } });
  await editor(page).getByTestId("caption").fill("Is i a multiple of 15?");
  await expect(chart(page)).toContainText("Is i a multiple of 15?");
  // The chart node draws the caption in place of its condition, which its hover title keeps.
  const node = page.locator('[data-chart-node="fzb-if15-001"]');
  await expect(node.locator("text", { hasText: "i % 15 == 0?" })).toHaveCount(0);
  await expect(node.locator("title")).toHaveText("i % 15 == 0?");
  await page.keyboard.press("Escape");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("    # Is i a multiple of 15?");
});

test("the editor opens on the chart node's right inside the canvas, the chart scrolled to make room", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  // The rightmost chart node: the centered chart leaves no room for the editor beside it.
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

test("the editor is placed by its chart node without a control on it", async ({ page }) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-prfz-001"]').click({ position: { x: 8, y: 20 } });
  await expect(editor(page)).toBeVisible();
  // Nothing under the chart node is focusable or announces a popup, apart from the popup's focus guards.
  await expect(
    page
      .getByTestId("editor-anchor")
      .locator("[tabindex]:not([data-base-ui-focus-guard]), [aria-haspopup]"),
  ).toHaveCount(0);
});

test("a print's values are one field, typed, removed, and added by their text", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  // A new print holds no value, draws no hint, and its field has the keyboard.
  await insert(page, "main/main/0", "print");
  await expect(chart(page)).toContainText("print()");
  const field = editor(page).locator("[data-value-line]");
  await expect(field).toHaveCount(1);
  await expect(field).toBeFocused();
  await keys(page, "1,2");
  await expect(chart(page)).toContainText("print(1, 2)");
  await expect(field).toHaveCount(1);
  // No button removes or adds a value: the text does.
  await expect(editor(page).getByRole("button", { name: "+ value" })).toHaveCount(0);
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(chart(page)).toContainText("print(1)");
  await keys(page, ", n");
  await expect(chart(page)).toContainText("print(1, n)");
  // Text that is no values separated by commas is one draft, written as typed.
  await keys(page, " m");
  await expect(chart(page)).toContainText("print(1, n m)");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect(chart(page)).toContainText("print()");
});

test("a stored print opens its values as one text, the slot clicked taking the keyboard", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-prnt-001"] [data-block-slot="args"]').click();
  const field = editor(page).locator("[data-value-line]");
  await expect(field).toHaveCount(1);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("i");
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
  const list = editor(page).getByTestId("value-list");
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

  // After a variable, a target's list offers only an item of it, which writes its brackets.
  await insert(page, "main/main/2", "assign");
  await keys(page, "nums ");
  await expect(list).toHaveText(/Item at a position/);
  await expect(list).not.toContainText("Count");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("nums[] ← value");
  await keys(page, "0");
  await expect(chart(page)).toContainText("nums[0] ← value");
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
  // Text that writes no target stays as typed, and the list offers no row that would write one.
  await keys(page, "5");
  await expect(chart(page)).toContainText("5 ← value");
  await expect(editor(page).getByTestId("value-list")).toContainText("Nothing matches");
  await page.keyboard.press("Backspace");
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
  // A choice past the last field moves the keyboard to the editor itself, which stays open.
  await expect(page.getByRole("dialog", { name: "Edit block" })).toBeFocused();
  await expect(editor(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("narration")).toHaveText(/Finished in/);
  const variables = page.getByTestId("variables");
  await expect(variables).toContainText("nums ← [3, 2, 1]");
  await expect(variables).toContainText("x ← 2");
  await expect(variables).toContainText("y ← 1");
  // The last step is the end of the run; two before it, the exchange of the items.
  const back = page.getByRole("button", { name: "|◀ Back" });
  await back.click();
  await expect(page.getByTestId("narration")).toHaveText("Running swap(x, y)");
  await back.click();
  await expect(page.getByTestId("narration")).toHaveText("Swapped nums[0] and nums[2]");
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
    const shown = await editor(page).getByTestId("value-list").boundingBox();
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

test("a text is typed between its quotes and edited as any text field does", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  const field = editor(page).locator("[data-value-line]").first();
  // `Text` writes its quotes with the caret between them.
  await keys(page, "text");
  await page.keyboard.press("Enter");
  await keys(page, "hello");
  await expect(chart(page)).toContainText('print("hello")');
  // Inside a text, the list offers no row and says how to end the text.
  await expect(editor(page).getByTestId("value-list")).toContainText("Inside a text");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await keys(page, "p");
  await expect(chart(page)).toContainText('print("help")');
  // Selected text is replaced by what is typed.
  await page.keyboard.press("ControlOrMeta+a");
  await keys(page, '1 + "ab"');
  await expect(field).toHaveValue('1 + "ab"');
  await expect(chart(page)).toContainText('print(1 + "ab")');
});

test("an input method's composition edits the program once it ends", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await keys(page, "text");
  await page.keyboard.press("Enter");
  const client = await page.context().newCDPSession(page);
  // While the input method composes, the program keeps the text it had.
  await client.send("Input.imeSetComposition", {
    text: "こんにち",
    selectionStart: 4,
    selectionEnd: 4,
  });
  await expect(editor(page).locator("[data-value-line]").first()).toHaveValue('"こんにち"');
  await expect(chart(page)).toContainText('print("")');
  await client.send("Input.insertText", { text: "こんにちは" });
  await expect(chart(page)).toContainText('print("こんにちは")');
});

test("the changes typed in one field are one entry of the history", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await keys(page, "123");
  await expect(chart(page)).toContainText("print(123)");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(chart(page)).toContainText("print()");
  await expect(editor(page).locator("[data-value-line]").first()).toHaveValue("");
});

test("an operator is switched by typing its keys: `=` after the `<` of `i < n` gives `i <= n`", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/sum-to-n");
  await insert(page, "main/main/0", "while");
  await keys(page, "i < n");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await keys(page, "=");
  await expect(editor(page).locator("[data-value-line]").first()).toHaveValue("i <= n");
  await expect(chart(page)).toContainText("i <= n?");
});

test("the editor itself takes the keyboard on a block with no field to take it", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  const node = page.locator('[data-chart-node="fzb-prnt-001"]');
  const dialog = page.getByRole("dialog", { name: "Edit block" });
  // A click away from a slot opens the editor on no field: the editor itself has the keyboard, and
  // its explanation line names the ways out.
  await node.click({ position: { x: 8, y: 20 } });
  await expect(dialog).toBeFocused();
  await expect(editor(page).getByTestId("explanation")).toContainText("closes the editor");
  // Delete and Backspace remove nothing while the editor is open.
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await expect(node).toHaveCount(1);
  // Enter closes the editor and keeps the selection, so Delete then removes the block.
  await page.keyboard.press("Enter");
  await expect(editor(page)).toHaveCount(0);
  await page.keyboard.press("Delete");
  await expect(node).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  // Esc closes the editor and clears the selection, so Delete then removes nothing.
  await node.click({ position: { x: 8, y: 20 } });
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editor(page)).toHaveCount(0);
  await page.keyboard.press("Delete");
  await expect(node).toHaveCount(1);
});

test("Tab and Shift+Tab go round the editor's controls through the editor itself", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-prnt-001"] [data-block-slot="args"]').click();
  const dialog = page.getByRole("dialog", { name: "Edit block" });
  const field = editor(page).locator("[data-value-line]");
  await expect(field).toBeFocused();
  await expect(editor(page).getByTestId("value-list")).toBeVisible();
  // Tab past the last field goes to the editor itself, the value list closes, and the editor stays.
  await page.keyboard.press("Tab");
  await expect(dialog).toBeFocused();
  await expect(editor(page).getByTestId("value-list")).toHaveCount(0);
  // On the editor itself, Tab goes to the first control, and Shift+Tab back to the editor itself.
  await page.keyboard.press("Tab");
  await expect(editor(page).getByTestId("caption")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog).toBeFocused();
  // Shift+Tab on the editor itself goes to the last control, the field.
  await page.keyboard.press("Shift+Tab");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("i");
  // Leaving the field for another control closes its value list, and Tab back selects its text.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+Tab");
  await expect(editor(page).getByRole("button", { name: "Delete" })).toBeFocused();
  await expect(editor(page).getByTestId("value-list")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd]),
  ).toEqual([0, 1]);
});

test("← at a field's start and → at its end move to the field beside", async ({ page }) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-owner="fzb-loop-001"] [data-block-slot="start"]').first().click();
  const fields = editor(page).locator("[data-value-line]");
  const caret = (index: number) =>
    fields
      .nth(index)
      .evaluate((field: HTMLInputElement) => [field.selectionStart, field.selectionEnd]);
  // The start opens selected; → first clears the selection, as in a text field.
  await expect(fields.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(fields.nth(1)).toBeFocused();
  // At the end, → goes to the start of the stop.
  await page.keyboard.press("ArrowRight");
  await expect(fields.nth(2)).toBeFocused();
  expect(await caret(2)).toEqual([0, 0]);
  // At the start, ← goes back to the end of the start.
  await page.keyboard.press("ArrowLeft");
  await expect(fields.nth(1)).toBeFocused();
  expect(await caret(1)).toEqual([1, 1]);
  // At the start of the first field, ← does nothing.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(fields.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(fields.nth(0)).toBeFocused();
  expect(await caret(0)).toEqual([0, 0]);
});
