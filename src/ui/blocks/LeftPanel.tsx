// U-10: tab Blocks with a search field and category sections in fixed order
// (first three expanded on first launch, expansion persisted); tab Task (U-13, M-02).
import { ChevronRightIcon } from "lucide-react";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/nodes/categories";
import { useLayout } from "@/store/layout";
import { PanelTab, PanelTabContent, PanelTabList, PanelTabs } from "@/ui/app/PanelTabs";
import { Input } from "@/ui/primitives/input";

export function LeftPanel() {
  const palette = useLayout((s) => s.palette);
  const togglePalette = useLayout((s) => s.togglePalette);

  return (
    <PanelTabs defaultValue="blocks">
      <PanelTabList>
        <PanelTab value="blocks">{t("palette.blocks")}</PanelTab>
        <PanelTab value="task">{t("palette.task")}</PanelTab>
      </PanelTabList>

      <PanelTabContent value="blocks" className="flex min-h-0 flex-col gap-3 overflow-auto p-2">
        <Input type="search" aria-label={t("palette.search")} placeholder={t("palette.search")} />
        {CATEGORIES.map((category) => {
          const open = palette[category];
          return (
            <section key={category}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => togglePalette(category)}
                className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground uppercase hover:bg-muted"
              >
                <ChevronRightIcon
                  className={cn("size-3.5 transition-transform", open && "rotate-90")}
                />
                {t(`palette.category.${category}`)}
              </button>
              {open && <div className="min-h-4" />}
            </section>
          );
        })}
      </PanelTabContent>

      <PanelTabContent value="task" className="p-3" />
    </PanelTabs>
  );
}
