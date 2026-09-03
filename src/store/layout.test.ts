// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  BOTTOM,
  DEFAULT_PALETTE,
  LAYOUT_STORAGE_KEY,
  LEFT,
  RIGHT,
  bottomMax,
  mergePersisted,
  useLayout,
} from "./layout";

describe("layout store (U-01, U-10)", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayout.setState({
      left: LEFT.default,
      right: RIGHT.default,
      bottom: BOTTOM.default,
      palette: { ...DEFAULT_PALETTE },
    });
  });

  it("starts at 240 / 320 / 280", () => {
    const { left, right, bottom } = useLayout.getState();
    expect([left, right, bottom]).toEqual([240, 320, 280]);
  });

  it("clamps the left panel to 200–360 and the right panel to 280–480", () => {
    useLayout.getState().setLeft(10);
    useLayout.getState().setRight(9999);
    expect(useLayout.getState().left).toBe(200);
    expect(useLayout.getState().right).toBe(480);
    useLayout.getState().setLeft(300.4);
    expect(useLayout.getState().left).toBe(300);
  });

  it("clamps the bottom panel to 160 px … 60 % of the viewport height", () => {
    expect(bottomMax(900)).toBe(540);
    useLayout.getState().setBottom(10, 900);
    expect(useLayout.getState().bottom).toBe(160);
    useLayout.getState().setBottom(9999, 900);
    expect(useLayout.getState().bottom).toBe(540);
  });

  it("persists sizes and palette expansion under algoflow:layout", () => {
    useLayout.getState().setLeft(260);
    useLayout.getState().togglePalette("function");
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved: unknown = JSON.parse(raw ?? "{}");
    expect(saved).toMatchObject({ state: { left: 260, palette: { function: true } } });
    expect(localStorage.length).toBe(1);
  });

  it("expands Basic, List, Control and collapses the rest on first launch", () => {
    expect(useLayout.getState().palette).toEqual({
      basic: true,
      list: true,
      control: true,
      function: false,
      dict: false,
      class: false,
      math: false,
    });
  });

  it("validates and clamps a stored snapshot instead of trusting it", () => {
    const current = useLayout.getState();
    const merged = mergePersisted(
      { left: 9999, right: "wide", bottom: -5, palette: { function: true, basic: "no" } },
      current,
    );
    expect(merged.left).toBe(360);
    expect(merged.right).toBe(320);
    expect(merged.bottom).toBe(160);
    expect(merged.palette).toEqual({ ...DEFAULT_PALETTE, function: true });
    expect(mergePersisted(null, current).palette).toEqual(DEFAULT_PALETTE);
    expect(mergePersisted({ palette: null }, current).left).toBe(240);
  });

  it("re-hydrates from storage through the same validation", async () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ state: { left: 5000, bottom: 5000, palette: null }, version: 1 }),
    );
    await useLayout.persist.rehydrate();
    const { left, bottom, palette } = useLayout.getState();
    expect(left).toBe(360);
    expect(bottom).toBe(bottomMax(window.innerHeight));
    expect(palette).toEqual(DEFAULT_PALETTE);
  });
});
