// U-30: tabs `main`, one per function/class (M-05), and `+`; U-31: Start … End.
import { CircleIcon, PlusIcon } from "lucide-react";
import { t } from "@/i18n/t";
import { PanelTab, PanelTabContent, PanelTabList, PanelTabs } from "@/ui/app/PanelTabs";
import { Button } from "@/ui/primitives/button";

const TERMINALS = ["start", "end"] as const;

export function Canvas() {
  return (
    <PanelTabs defaultValue="main">
      <PanelTabList>
        <PanelTab value="main" className="font-mono">
          {t("canvas.main")}
        </PanelTab>
        <Button variant="ghost" size="icon-sm" aria-label={t("canvas.add")} disabled>
          <PlusIcon />
        </Button>
      </PanelTabList>

      <PanelTabContent value="main" className="p-6">
        <ol className="mx-auto flex max-w-2xl flex-col items-start gap-3">
          {TERMINALS.map((terminal) => (
            <li
              key={terminal}
              className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-sm"
            >
              <CircleIcon aria-hidden className="size-2 fill-current" />
              {t(`canvas.${terminal}`)}
            </li>
          ))}
        </ol>
      </PanelTabContent>
    </PanelTabs>
  );
}
