// U-03: the 52 px top bar: `← Problems`, the title, and `⋯` (U-05). `Open in Playground`
// and `Start over` join `⋯` with editing (M-04).
import { useState, type ReactNode } from "react";
import { t } from "@/i18n/t";
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

/** `children` sits in the middle: the run controls (U-60). */
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
      <div className="flex justify-end">
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
