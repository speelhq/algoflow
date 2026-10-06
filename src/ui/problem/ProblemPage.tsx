// U-03: the Problem page. C-13: opening a problem loads its program and discards any runner.
import { useEffect } from "react";
import { getChallenge } from "@/challenges";
import { localized, t } from "@/i18n/t";
import { useProgram } from "@/store/program";
import { routeHash } from "@/ui/app/route";
import { useTitle } from "@/ui/hooks/useTitle";
import { buttonVariants } from "@/ui/primitives/button";

export function ProblemPage({ id }: { id: string }) {
  const challenge = getChallenge(id);
  const title = challenge ? localized(challenge.title) : "";
  useTitle(title);
  const load = useProgram((s) => s.load);
  useEffect(() => load(id), [id, load]);
  return (
    <div className="flex h-full flex-col" data-testid="problem-page">
      <header className="flex h-13 shrink-0 items-center gap-3 border-b px-4" data-testid="top-bar">
        <a
          href={routeHash({ page: "problems" })}
          className={buttonVariants({ variant: "outline" })}
        >
          {t("problem.back")}
        </a>
        <h1 className="font-semibold">{title}</h1>
      </header>
    </div>
  );
}
