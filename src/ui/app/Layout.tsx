// U-01: 48 px top bar; left 240 (200–360); canvas; right 320 (280–480);
// bottom 280 (160 px to 60 % of height) spanning the full width. The bottom
// limit depends on the viewport, so it is applied again at render time.
import { t } from "@/i18n/t";
import { bottomMax, useLayout } from "@/store/layout";
import { BottomPanel } from "@/ui/bottom/BottomPanel";
import { LeftPanel } from "@/ui/blocks/LeftPanel";
import { Canvas } from "@/ui/canvas/Canvas";
import { useViewportHeight } from "@/ui/hooks/useViewportHeight";
import { RightPanel } from "@/ui/properties/RightPanel";
import { ResizeHandle } from "./ResizeHandle";
import { TopBar } from "./TopBar";

export function Layout() {
  const left = useLayout((s) => s.left);
  const right = useLayout((s) => s.right);
  const storedBottom = useLayout((s) => s.bottom);
  const setLeft = useLayout((s) => s.setLeft);
  const setRight = useLayout((s) => s.setRight);
  const setBottom = useLayout((s) => s.setBottom);
  const viewportHeight = useViewportHeight();
  const bottom = Math.min(storedBottom, bottomMax(viewportHeight));

  return (
    <div className="grid h-screen w-screen grid-rows-[auto_minmax(0,1fr)_auto_auto] overflow-hidden bg-background text-foreground">
      <TopBar />

      <div className="flex min-h-0">
        <aside
          data-testid="left-panel"
          className="flex min-h-0 shrink-0 flex-col overflow-hidden"
          style={{ width: left }}
        >
          <LeftPanel />
        </aside>
        <ResizeHandle
          orientation="vertical"
          label={t("app.resize.left")}
          testId="resize-left"
          size={left}
          onResize={(start, delta) => setLeft(start + delta)}
        />

        <main data-testid="canvas" className="min-h-0 min-w-0 flex-1 overflow-auto">
          <Canvas />
        </main>

        <ResizeHandle
          orientation="vertical"
          label={t("app.resize.right")}
          testId="resize-right"
          size={right}
          onResize={(start, delta) => setRight(start - delta)}
        />
        <aside
          data-testid="right-panel"
          className="flex min-h-0 shrink-0 flex-col overflow-auto"
          style={{ width: right }}
        >
          <RightPanel />
        </aside>
      </div>

      <ResizeHandle
        orientation="horizontal"
        label={t("app.resize.bottom")}
        testId="resize-bottom"
        size={bottom}
        onResize={(start, delta) => setBottom(start - delta, viewportHeight)}
      />
      <section
        data-testid="bottom-panel"
        className="flex min-h-0 flex-col overflow-hidden"
        style={{ height: bottom }}
      >
        <BottomPanel />
      </section>
    </div>
  );
}
