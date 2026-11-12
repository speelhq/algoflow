// A chart node with a diagnostic shows a red dot; hovering shows the message and its fix.
import { expect, test } from "./fixtures";
import { declareFirstProgram, programWith, seedProgram, seedProgress } from "./seed";

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("hovering a flagged chart node shows its message, and the fix applies", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", declareFirstProgram());
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("red-dot")).toHaveCount(1);
  await page.locator('[data-chart-node="dgn-prnt-001"]').hover();
  const message = page.getByTestId("diagnostic-message");
  await expect(message).toContainText("Give total a value before the if or loop");
  await message.getByRole("button", { name: "Give total a value before it" }).click();
  await expect(page.getByTestId("red-dot")).toHaveCount(0);
  await expect(page.getByTestId("chart")).toContainText("total ← None");
});

test("an empty slot shows no dot, only its hint", async ({ page }) => {
  const assign = {
    id: "dgn-asg0-001",
    type: "assign",
    target: { id: "dgn-tgt-0002", type: "var", name: "x" },
    value: { id: "dgn-emp0-001", type: "draft", text: "" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("chart")).toContainText("x ← value");
  await expect(page.getByTestId("red-dot")).toHaveCount(0);
});

test("a draft shows its text and no dot, until Run leads to it", async ({ page }) => {
  const assign = {
    id: "dgn-asg1-001",
    type: "assign",
    target: { id: "dgn-tgt-0003", type: "var", name: "x" },
    value: { id: "dgn-drf0-001", type: "draft", text: "1 +" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("chart")).toContainText("x ← 1 +");
  await expect(page.getByTestId("red-dot")).toHaveCount(0);
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-line").nth(1)).toHaveText("2x = 1 +");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.locator('[data-chart-node="dgn-asg1-001"]')).toHaveAttribute(
    "data-selected",
    "true",
  );
  // The message is on the explanation line, not at the editor's top, and the line underlines the
  // draft's text from where the parser stopped.
  const editor = page.getByTestId("block-editor");
  await expect(editor.getByTestId("explanation")).toContainText("Syntax error at character 3");
  await expect(editor.getByRole("alert")).toHaveCount(0);
  await expect(editor.locator("[data-value-line]").last()).toHaveValue("1 +");
});

test("once Run leads to a target's text that writes no target, its line underlines all of it", async ({
  page,
}) => {
  const assign = {
    id: "dgn-asg2-001",
    type: "assign",
    target: { id: "dgn-drf0-002", type: "draft", text: "a + 1" },
    value: { id: "dgn-num0-001", type: "num", value: 1, float: false, raw: "1" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await page.getByRole("button", { name: "▶ Run" }).click();
  const editor = page.getByTestId("block-editor");
  await expect(editor.getByTestId("explanation")).toContainText(
    "Only a variable or an item of a list",
  );
  // The variable keeps its own span, so the underline runs over two.
  await expect(editor.locator(".decoration-wavy")).toHaveText(["a", " + 1"]);
});
