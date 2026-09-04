// U-30: tabs `main`, one per function (classes in M-05), and `+` (M-05).
// U-31: Start, one read-only Input card per input, the main region, End.
import { CircleIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { t } from "@/i18n/t";
import { firstAssignments } from "@/lang/validate";
import { dataToPython } from "@/python/emit";
import { useProgram } from "@/store/program";
import { PanelTab, PanelTabContent, PanelTabList, PanelTabs } from "@/ui/app/PanelTabs";
import { Button } from "@/ui/primitives/button";
import { Region } from "./Region";

const MAIN = "main";

function Terminal({ label }: { label: string }) {
  return (
    <li className="flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-sm">
      <CircleIcon aria-hidden className="size-2 fill-current" />
      {label}
    </li>
  );
}

export function Canvas() {
  const program = useProgram((s) => s.program);
  const creates = useMemo(() => firstAssignments(program), [program]);
  const [tab, setTab] = useState(MAIN);
  // A selected function tab may vanish with the program (challenge switch): fall back to main.
  const value = program.functions.some((fn) => fn.id === tab) ? tab : MAIN;

  return (
    <PanelTabs
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") setTab(next);
      }}
    >
      <PanelTabList>
        <PanelTab value={MAIN} className="font-mono">
          {t("canvas.main")}
        </PanelTab>
        {program.functions.map((fn) => (
          <PanelTab key={fn.id} value={fn.id} className="font-mono">
            {fn.name}
          </PanelTab>
        ))}
        <Button variant="ghost" size="icon-sm" aria-label={t("canvas.add")} disabled>
          <PlusIcon />
        </Button>
      </PanelTabList>

      <PanelTabContent value={MAIN} className="p-6">
        <ol className="mx-auto flex max-w-3xl flex-col gap-1">
          <Terminal label={t("canvas.start")} />
          {program.inputs.map((input) => (
            <li
              key={input.name}
              data-testid="input-card"
              className="flex w-fit items-center rounded-lg border border-border bg-muted/40 px-3 py-1.5 font-mono text-sm text-muted-foreground"
            >
              {t("canvas.input", { name: input.name, value: dataToPython(input.value) })}
            </li>
          ))}
          <li>
            <Region stmts={program.main} creates={creates} />
          </li>
          <Terminal label={t("canvas.end")} />
        </ol>
      </PanelTabContent>

      {program.functions.map((fn) => (
        <PanelTabContent key={fn.id} value={fn.id} className="p-6">
          <div className="mx-auto max-w-3xl">
            <Region stmts={fn.body} creates={creates} />
          </div>
        </PanelTabContent>
      ))}
    </PanelTabs>
  );
}
