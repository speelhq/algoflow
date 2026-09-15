// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { LAYOUT_STORAGE_KEY, mergePersisted, PANEL, useLayout } from "./layout";

describe("layout store (U-03, U-24)", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayout.setState({ panel: PANEL.default, collapsed: false });
  });

  it("starts at 320 px, expanded", () => {
    expect(useLayout.getState()).toMatchObject({ panel: 320, collapsed: false });
  });

  it("clamps the panel to 280–480 and rounds", () => {
    useLayout.getState().setPanel(10);
    expect(useLayout.getState().panel).toBe(280);
    useLayout.getState().setPanel(9999);
    expect(useLayout.getState().panel).toBe(480);
    useLayout.getState().setPanel(300.4);
    expect(useLayout.getState().panel).toBe(300);
  });

  it("persists the width and the collapsed state under algoflow:layout", () => {
    useLayout.getState().setPanel(360);
    useLayout.getState().setCollapsed(true);
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved: unknown = JSON.parse(raw ?? "{}");
    expect(saved).toMatchObject({ state: { panel: 360, collapsed: true } });
    expect(localStorage.length).toBe(1);
  });

  it("validates and clamps a stored snapshot instead of trusting it", () => {
    const current = useLayout.getState();
    expect(mergePersisted({ panel: 9999, collapsed: "yes" }, current)).toMatchObject({
      panel: 480,
      collapsed: false,
    });
    expect(mergePersisted({ panel: "wide", collapsed: true }, current)).toMatchObject({
      panel: 320,
      collapsed: true,
    });
    expect(mergePersisted(null, current)).toMatchObject({ panel: 320, collapsed: false });
    // A snapshot of the retired shell (left / right / bottom / palette) yields the defaults.
    expect(
      mergePersisted({ left: 240, right: 320, bottom: 280, palette: {} }, current),
    ).toMatchObject({ panel: 320, collapsed: false });
  });

  it("re-hydrates from storage through the same validation", async () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ state: { panel: 5000, collapsed: true }, version: 1 }),
    );
    await useLayout.persist.rehydrate();
    expect(useLayout.getState()).toMatchObject({ panel: 480, collapsed: true });
  });
});
