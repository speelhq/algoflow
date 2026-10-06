// The Problem page: the top bar, then two regions, the panel and the chart region.
// Opening a problem loads its program and discards any runner; it opens on
// the first tab.
import { useEffect } from "react";
import { getChallenge, type Challenge } from "@/challenges";
import { localized, t } from "@/i18n/t";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { openInPlayground, startOver } from "@/ui/editor/programs";
import { useEditKeys } from "@/ui/editor/useEditKeys";
import { useTitle } from "@/ui/hooks/useTitle";
import { DropdownMenuItem } from "@/ui/primitives/dropdown-menu";
import { ChartRegion } from "./ChartRegion";
import { Panel } from "./Panel";
import { RunControls } from "./RunControls";
import { TopBar } from "./TopBar";
import { useRunKeys } from "./useRunKeys";

export function ProblemPage({ id }: { id: string }) {
  const challenge = getChallenge(id);
  return challenge ? <Problem challenge={challenge} /> : null;
}

/** `⋯`'s `Start over`, an edit: not while running, nor while the solution is shown. */
export function StartOverItem() {
  const running = useRun((s) => s.status !== "idle");
  const solution = useEditor((s) => s.solution);
  const locked = running || solution;
  return (
    <DropdownMenuItem disabled={locked} onClick={startOver}>
      {t("problem.startOver")}
    </DropdownMenuItem>
  );
}

function Problem({ challenge }: { challenge: Challenge }) {
  const title = localized(challenge.title);
  useTitle(title);
  useRunKeys();
  useEditKeys();
  useEffect(() => {
    useProgram.getState().load(challenge.id);
    // Opening a problem selects the first test's inputs, also when it was open before.
    useRun.getState().selectCase(0);
    useEditor.getState().open("problem");
  }, [challenge.id]);

  return (
    <div className="flex h-full flex-col" data-testid="problem-page">
      <TopBar
        back="problems"
        title={<h1 className="truncate font-semibold">{title}</h1>}
        menu={
          <>
            <DropdownMenuItem
              onClick={() => openInPlayground(useProgram.getState().program, title)}
            >
              {t("problem.openInPlayground")}
            </DropdownMenuItem>
            <StartOverItem />
          </>
        }
      >
        <RunControls challenge={challenge} />
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <Panel challenge={challenge} />
        <ChartRegion challenge={challenge} />
      </div>
    </div>
  );
}
