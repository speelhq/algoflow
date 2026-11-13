// @vitest-environment jsdom
// What the focused element owns; the keyboard table's Delete and Backspace stay in an open
// editor; Ctrl/Cmd+Enter and the play button run, pause, play, and replay as one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ast } from "@/blocks/testing";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { togglePlay } from "./actions";
import { act, ownsKeys } from "./keys";
import { useEditor } from "@/store/editor";
import { settle } from "@/store/testing";

const { for_, num, print, v, program } = ast;

function press(target: Element, key: string, mod = false) {
  return { target, key, ctrlKey: mod, metaKey: false, getModifierState: () => false };
}

function element(html: string): Element {
  document.body.innerHTML = html;
  const found = document.querySelector("[data-focus]");
  if (!found) throw new Error("no focused element");
  return found;
}

describe("ownsKeys", () => {
  it("a field or a slider owns every key", () => {
    expect(ownsKeys(press(element("<input data-focus>"), "z", true))).toBe(true);
    expect(ownsKeys(press(element('<div role="slider" data-focus></div>'), "ArrowLeft"))).toBe(
      true,
    );
  });

  it("a value line owns every key but Esc and the table's keys with Ctrl or Cmd", () => {
    const line = element("<input data-value-line data-focus>");
    expect(ownsKeys(press(line, "a"))).toBe(true);
    expect(ownsKeys(press(line, "Backspace"))).toBe(true);
    expect(ownsKeys(press(line, "ArrowLeft"))).toBe(true);
    expect(ownsKeys(press(line, "v", true))).toBe(true);
    expect(ownsKeys(press(line, "z", true))).toBe(false);
    expect(ownsKeys(press(line, "d", true))).toBe(false);
    expect(ownsKeys(press(line, "Enter", true))).toBe(false);
    expect(ownsKeys(press(line, "Escape"))).toBe(false);
    // A character that AltGr makes, which Windows reports with Ctrl, is the line's.
    const altGr = { ...press(line, "z", true), getModifierState: (s: string) => s === "AltGraph" };
    expect(ownsKeys(altGr)).toBe(true);
  });

  it("an open editor or menu owns Delete and Backspace only", () => {
    const editor = element('<div role="dialog"><button data-focus></button></div>');
    expect(ownsKeys(press(editor, "Delete"))).toBe(true);
    expect(ownsKeys(press(editor, "Backspace"))).toBe(true);
    expect(ownsKeys(press(editor, "z", true))).toBe(false);
    expect(ownsKeys(press(element("<button data-focus></button>"), "Delete"))).toBe(false);
  });
});

describe("Delete and Backspace on the page (chart.md, Editing on the chart, Selection and keys)", () => {
  const block = print(num(1));
  beforeEach(() => {
    useProgram.setState({ program: program([block]) });
  });
  const key = (name: string) => new KeyboardEvent("keydown", { key: name });

  it("remove nothing while the selected block's editor is open", () => {
    useEditor.getState().select(block.id);
    for (const name of ["Delete", "Backspace"]) {
      expect(act(key(name))).toBe(false);
      expect(useProgram.getState().program.main).toHaveLength(1);
    }
  });

  it("remove the selected block once its editor is closed", () => {
    for (const name of ["Delete", "Backspace"]) {
      useProgram.setState({ program: program([block]) });
      useEditor.getState().select(block.id);
      useEditor.getState().closeEditor();
      expect(act(key(name))).toBe(true);
      expect(useProgram.getState().program.main).toEqual([]);
      expect(useEditor.getState().selectedId).toBeNull();
    }
  });
});

describe("togglePlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useProgram.setState({ program: program([for_("i", num(0), num(3), [print(v("i"))])]) });
  });
  afterEach(() => {
    useRun.getState().stop();
    vi.useRealTimers();
  });

  it("runs, pauses, plays, and at the last step replays from step 0", async () => {
    togglePlay();
    expect(useRun.getState().busy).toBe(true);
    await settle(new Promise((resolve) => setTimeout(resolve, 0)));
    expect(useRun.getState().status).toBe("playing");
    togglePlay();
    expect(useRun.getState().status).toBe("paused");
    togglePlay();
    expect(useRun.getState().status).toBe("playing");
    await settle(useRun.getState().skip());
    expect(useRun.getState().status).toBe("done");
    togglePlay();
    await settle(new Promise((resolve) => setTimeout(resolve, 0)));
    expect(useRun.getState()).toMatchObject({ status: "playing", step: 0 });
  });

  it("during the pre-run it does nothing, and the run opens playing", async () => {
    togglePlay();
    const again = vi.spyOn(useRun.getState(), "run");
    togglePlay();
    expect(again).not.toHaveBeenCalled();
    await settle(new Promise((resolve) => setTimeout(resolve, 0)));
    expect(useRun.getState()).toMatchObject({ status: "playing", step: 0, busy: false });
  });
});
