// U-60: Run, Step, Back, Stop, speed 1–50, status; U-61: Data, Trace, Output, Tests, Python.
// The driver (R-11/12) arrives in M-02; controls are disabled placeholders here.
// The test selector is absent in free mode (U-60).
import { PlayIcon, SkipBackIcon, SkipForwardIcon, SquareIcon } from "lucide-react";
import { t } from "@/i18n/t";
import { PanelTab, PanelTabContent, PanelTabList, PanelTabs } from "@/ui/app/PanelTabs";
import { Button } from "@/ui/primitives/button";

const VIEWS = ["data", "trace", "output", "tests", "python"] as const;

export function BottomPanel() {
  return (
    <div className="flex h-full flex-col border-t border-border">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <Button variant="default" size="sm" disabled>
          <PlayIcon data-icon="inline-start" />
          {t("run.run")}
        </Button>
        <Button variant="outline" size="sm" disabled>
          <SkipForwardIcon data-icon="inline-start" />
          {t("run.step")}
        </Button>
        <Button variant="outline" size="sm" disabled>
          <SkipBackIcon data-icon="inline-start" />
          {t("run.back")}
        </Button>
        <Button variant="outline" size="sm" disabled>
          <SquareIcon data-icon="inline-start" />
          {t("run.stop")}
        </Button>
        <label className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
          {t("run.speed")}
          <input type="range" min={1} max={50} defaultValue={10} disabled className="w-32" />
        </label>
        <span data-testid="run-status" className="ml-auto text-xs text-muted-foreground">
          {t("run.stepCount", { n: 0 })}
        </span>
      </div>

      <PanelTabs defaultValue="data" className="min-h-0 flex-1">
        <PanelTabList>
          {VIEWS.map((view) => (
            <PanelTab key={view} value={view}>
              {t(`view.${view}`)}
            </PanelTab>
          ))}
        </PanelTabList>
        {VIEWS.map((view) => (
          <PanelTabContent key={view} value={view} className="overflow-auto p-3" />
        ))}
      </PanelTabs>
    </div>
  );
}
