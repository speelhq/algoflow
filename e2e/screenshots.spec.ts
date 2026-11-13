// One screenshot per screen state, and per state of a part that opens over the canvas, written to
// e2e/screenshots/ for review by `pnpm screenshots` and under test-results/ by any other run. Drawn
// at 1280 × 800, the size that docs/design/README.md gives a design and its screenshot.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  declareFirstProgram,
  programWith,
  seedPlayground,
  seedProgram,
  seedProgress,
  readSolution,
} from "./seed";

/** Where the screenshot `name` goes: the tracked folder only when snapshots are being updated. */
function shot(name: string): string {
  const info = test.info();
  const asked = info.config.updateSnapshots === "all" || info.config.updateSnapshots === "changed";
  return asked ? `e2e/screenshots/${name}.png` : info.outputPath(`${name}.png`);
}

test.use({ viewport: { width: 1280, height: 800 } });

test("First launch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add your first block" })).toBeVisible();
  await page.screenshot({ path: shot("first-launch"), animations: "disabled" });
});

test("Problems", async ({ page }) => {
  await seedProgress(page, {
    tutorial: { status: "solved", hints: 0, solution: false },
    "sum-to-n": { status: "solved", hints: 0, solution: false },
    fizzbuzz: { status: "attempted", hints: 1, solution: false },
  });
  await page.goto("/#/");
  await expect(page.getByTestId("problems")).toBeVisible();
  await page.screenshot({ path: shot("problems"), animations: "disabled" });
});

test.describe("FizzBuzz", () => {
  test.beforeEach(async ({ page }) => {
    await seedProgress(page, { fizzbuzz: { status: "attempted", hints: 1, solution: false } });
    await seedProgram(page, "fizzbuzz", readSolution("fizzbuzz"));
  });

  test("Build", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await expect(page.getByTestId("chart")).toContainText("i % 15 == 0?");
    await page.screenshot({ path: shot("build"), animations: "disabled" });
  });

  test("Solution", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByRole("button", { name: "Show solution" }).click();
    await expect(page.getByTestId("solution-band")).toBeVisible();
    await page.screenshot({ path: shot("solution"), animations: "disabled" });
  });

  test("Run", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByRole("button", { name: "▶ Run" }).click();
    await page.getByRole("button", { name: "❚❚ Pause" }).click();
    await page.locator('[data-chart-node="fzb-if03-001"]').click();
    for (let pass = 0; pass < 3; pass += 1) {
      await page.getByRole("button", { name: "Skip ▶▶" }).click();
      await expect(page.getByTestId("variables")).toContainText(`i ← ${pass + 1}`);
    }
    await expect(page.getByTestId("narration")).toHaveText("Checking i % 3 == 0");
    await page.screenshot({ path: shot("run"), animations: "disabled" });
  });

  test("Accepted", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByTestId("tab-result").click();
    await page.getByRole("button", { name: "✓ Submit" }).click();
    await expect(page.getByTestId("verdict")).toHaveText("Accepted");
    await page.screenshot({ path: shot("accepted"), animations: "disabled" });
  });

  test("Python tab", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByTestId("tab-python").click();
    await page.getByTestId("python-line").nth(5).click();
    await expect(page.locator('[data-chart-node="fzb-if03-001"]')).toHaveAttribute(
      "data-selected",
      "true",
    );
    await page.screenshot({ path: shot("python"), animations: "disabled" });
  });

  test("Block menu", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.locator('[data-testid="connector"][data-place="main/main/0"]').click();
    await expect(page.getByTestId("block-menu")).toBeVisible();
    await page.screenshot({ path: shot("block-menu"), animations: "disabled" });
  });

  test("Input chart node's menu", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByTestId("input-chart-node").click();
    await expect(page.getByRole("menuitem", { name: "n ← 3" })).toBeVisible();
    await page.screenshot({ path: shot("input-menu"), animations: "disabled" });
  });
});

test("Wrong Answer", async ({ page }) => {
  await seedProgress(page, { fizzbuzz: { status: "attempted", hints: 0, solution: false } });
  const program = readSolution("fizzbuzz");
  const [loop] = program.main as Array<Record<string, unknown>>;
  if (loop) loop.start = { id: "fzb-one0-001", type: "num", value: 0, float: false, raw: "0" };
  await seedProgram(page, "fizzbuzz", program);
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("tab-result").click();
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Wrong Answer");
  await page.screenshot({ path: shot("wrong"), animations: "disabled" });
});

test("Playground", async ({ page }) => {
  await seedProgress(page, {});
  const programs = [
    ["play-fizzbuzz00001", "FizzBuzz up to 100", "2026-10-07T14:05:00"],
    ["play-squares000001", "Sum of squares", "2026-10-06T18:40:00"],
    ["play-untitled00001", "Untitled", "2026-10-06T09:12:00"],
    ["play-hello00000001", "Hello, everyone", "2026-10-03T16:58:00"],
  ] as const;
  const index: Record<string, { edited: number }> = {};
  for (const [id, title, time] of programs) {
    index[id] = { edited: new Date(time).getTime() };
    await seedProgram(page, id, { ...programWith([]), title });
  }
  await seedPlayground(page, index);
  await page.goto("/#/play");
  await expect(page.getByTestId("playground-row")).toHaveCount(4);
  await page.screenshot({ path: shot("playground"), animations: "disabled" });
});

test("Block menu with the program's own functions", async ({ page }) => {
  await seedProgress(page, { fizzbuzz: { status: "attempted", hints: 0, solution: false } });
  const greet = { id: "shf-func-001", name: "greet", params: ["name"], body: [] };
  await seedProgram(page, "fizzbuzz", { ...readSolution("fizzbuzz"), functions: [greet] });
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-testid="connector"][data-place="main/main/0"]').click();
  const own = page.getByRole("region", { name: "This program" });
  await own.scrollIntoViewIfNeeded();
  await expect(own.getByRole("button", { name: /greet/ })).toBeInViewport();
  await page.screenshot({ path: shot("block-menu-program"), animations: "disabled" });
});

test("Diagnostic", async ({ page }) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", declareFirstProgram());
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="dgn-prnt-001"]').hover();
  await expect(page.getByTestId("diagnostic-message")).toBeVisible();
  await page.screenshot({ path: shot("diagnostic"), animations: "disabled" });
});

test("Playground program", async ({ page }) => {
  await seedProgress(page, {});
  const id = "play-squares000001";
  const square = {
    id: "shp-prnt-001",
    type: "print",
    args: [
      {
        id: "shp-mult-001",
        type: "binop",
        op: "*",
        left: { id: "shp-num0-001", type: "num", value: 7, float: false, raw: "7" },
        right: { id: "shp-num0-002", type: "num", value: 7, float: false, raw: "7" },
      },
    ],
  };
  await seedProgram(page, id, { ...programWith([square]), title: "Seven squared" });
  await seedPlayground(page, { [id]: { edited: 0 } });
  await page.goto(`/#/play/${id}`);
  await expect(page.getByTestId("chart")).toBeVisible();
  await page.screenshot({ path: shot("playground-program"), animations: "disabled" });
});

test.describe("Block editor", () => {
  const editor = (page: Page) => page.getByTestId("block-editor");
  const list = (page: Page) => editor(page).getByTestId("value-list");

  test.beforeEach(async ({ page }) => {
    await seedProgress(page, { "sum-to-n": { status: "attempted", hints: 0, solution: false } });
    const [init, loop] = readSolution("sum-to-n").main as Array<Record<string, unknown>>;
    const nums = {
      id: "she-nums-001",
      type: "assign",
      target: { id: "she-tgt-0001", type: "var", name: "nums" },
      value: {
        id: "she-list-001",
        type: "list",
        items: [3, 1, 2].map((value, i) => ({
          id: `she-item-00${i}`,
          type: "num",
          value,
          float: false,
          raw: String(value),
        })),
      },
    };
    await seedProgram(page, "sum-to-n", programWith([init, nums, { ...loop, body: [] }]));
    await page.goto("/#/p/sum-to-n");
  });

  /** Inserts the block `entry` into the loop's empty body, which opens its editor. */
  async function insert(page: Page, entry: string): Promise<void> {
    await page.locator('[data-testid="connector"][data-place="sum-loop-001/body/0"]').click();
    await page.getByTestId("block-menu").locator(`[data-entry="${entry}"]`).click();
    await expect(editor(page)).toBeVisible();
  }

  test("on the editor itself", async ({ page }) => {
    await insert(page, "assign");
    await page.keyboard.type("total");
    await page.keyboard.press("Enter");
    await page.keyboard.type("0");
    // Tab past the last field gives the editor itself the keyboard.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("dialog", { name: "Edit block" })).toBeFocused();
    await expect(editor(page).getByTestId("explanation")).toContainText("closes the editor");
    await page.screenshot({ path: shot("editor-itself"), animations: "disabled" });
  });

  test("choosing a variable", async ({ page }) => {
    await insert(page, "assign");
    await page.keyboard.type("to");
    await expect(list(page)).toContainText("New variable");
    await page.screenshot({ path: shot("editor-name"), animations: "disabled" });
  });

  test("where a value is expected", async ({ page }) => {
    await insert(page, "assign");
    await page.keyboard.type("total");
    await page.keyboard.press("Enter");
    await expect(list(page)).toContainText("Variables");
    await page.screenshot({ path: shot("editor-value"), animations: "disabled" });
  });

  test("typing", async ({ page }) => {
    await insert(page, "assign");
    await page.keyboard.type("total");
    await page.keyboard.press("Enter");
    await page.keyboard.type("total + i");
    await expect(editor(page).locator("[data-value-line]").last()).toHaveValue("total + i");
    await page.screenshot({ path: shot("editor-typing"), animations: "disabled" });
  });

  test("after a number", async ({ page }) => {
    await insert(page, "assign");
    await page.keyboard.type("total");
    await page.keyboard.press("Enter");
    await page.keyboard.type("1");
    await expect(list(page)).toContainText("Add");
    await page.screenshot({ path: shot("editor-number"), animations: "disabled" });
  });

  test("after a list", async ({ page }) => {
    await insert(page, "assign");
    await page.keyboard.type("total");
    await page.keyboard.press("Enter");
    await page.keyboard.type("[1,2]");
    await expect(list(page)).toContainText("Items");
    await page.screenshot({ path: shot("editor-list"), animations: "disabled" });
  });

  test("after a check", async ({ page }) => {
    await insert(page, "if");
    await page.keyboard.type("i%3==0");
    await expect(list(page)).toContainText("And");
    await page.screenshot({ path: shot("editor-check"), animations: "disabled" });
  });

  test("setting an item", async ({ page }) => {
    await insert(page, "assign");
    await page.keyboard.type("nums[");
    await expect(editor(page).getByTestId("editor-notation")).toContainText("nums[");
    await page.screenshot({ path: shot("editor-item"), animations: "disabled" });
  });
});
