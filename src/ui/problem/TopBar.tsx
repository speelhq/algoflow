// The 52 px top bar: `← Problems`, the title, the run controls, undo, redo, and `⋯`.
import { useState, type ReactNode } from "react";
import { t } from "@/i18n/t";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { HelpDialog } from "@/ui/app/HelpDialog";
import { routeHash } from "@/ui/app/route";
import { Button, buttonVariants } from "@/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu";

type Props = { title: string; children?: ReactNode };

/** Undo and redo, disabled when there is nothing to take back or bring back, and while running. */
function UndoRedo() {
  const canUndo = useProgram((s) => s.past.length > 0);
  const canRedo = useProgram((s) => s.future.length > 0);
  const undo = useProgram((s) => s.undo);
  const redo = useProgram((s) => s.redo);
  const running = useRun((s) => s.status !== "idle");
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("problem.undo")}
        disabled={!canUndo || running}
        onClick={undo}
      >
        {t("problem.undoGlyph")}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("problem.redo")}
        disabled={!canRedo || running}
        onClick={redo}
      >
        {t("problem.redoGlyph")}
      </Button>
    </>
  );
}

/** `children` sits in the middle: the run controls. */
export function TopBar({ title, children }: Props) {
  const [help, setHelp] = useState(false);
  return (
    <header
      className="grid h-13 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4"
      data-testid="top-bar"
    >
      <div className="flex min-w-0 items-center gap-3">
        <a
          href={routeHash({ page: "problems" })}
          className={buttonVariants({ variant: "outline" })}
        >
          {t("problem.back")}
        </a>
        <h1 className="truncate font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{children}</div>
      <div className="flex items-center justify-end gap-2">
        <UndoRedo />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" aria-label={t("problem.more")} />}
          >
            {t("problem.moreGlyph")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setHelp(true)}>{t("problem.help")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <HelpDialog open={help} onOpenChange={setHelp} />
    </header>
  );
}
