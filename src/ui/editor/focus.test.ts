// @vitest-environment jsdom
// Tab and Shift+Tab go round an open editor's controls through the editor itself.
import { describe, expect, it } from "vitest";
import { tabTarget } from "./focus";

function editor(): HTMLElement {
  document.body.innerHTML = `
    <div id="editor" tabindex="-1">
      <input id="caption">
      <button id="delete">Delete</button>
      <button disabled>Off</button>
      <div tabindex="-1" id="row"></div>
      <button tabindex="-1">Row</button>
      <input id="value" data-value-line>
    </div>
    <button id="outside"></button>`;
  const found = document.getElementById("editor");
  if (!found) throw new Error("no editor");
  return found;
}

const byId = (id: string) => document.getElementById(id);

describe("tabTarget (editor.md, Block editor)", () => {
  it("moves through the controls in order, skipping what Tab never stops at", () => {
    const self = editor();
    expect(tabTarget(self, byId("caption"), 1)).toBe(byId("delete"));
    expect(tabTarget(self, byId("delete"), 1)).toBe(byId("value"));
    expect(tabTarget(self, byId("value"), -1)).toBe(byId("delete"));
  });

  it("goes to the editor itself past the last control and before the first, never outside", () => {
    const self = editor();
    expect(tabTarget(self, byId("value"), 1)).toBe(self);
    expect(tabTarget(self, byId("caption"), -1)).toBe(self);
  });

  it("from the editor itself goes to the first control, or back to the last", () => {
    const self = editor();
    expect(tabTarget(self, self, 1)).toBe(byId("caption"));
    expect(tabTarget(self, self, -1)).toBe(byId("value"));
    expect(tabTarget(self, byId("row"), 1)).toBe(byId("caption"));
  });
});
