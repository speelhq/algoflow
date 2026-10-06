// U-03: the Problem page: the top bar, then two regions, the panel and the chart region.
// C-13: opening a problem loads its program and discards any runner; U-20: it opens on
// the first tab.
import { useEffect } from "react";
import { getChallenge, type Challenge } from "@/challenges";
import { localized } from "@/i18n/t";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useTitle } from "@/ui/hooks/useTitle";
import { ChartRegion } from "./ChartRegion";
import { Panel } from "./Panel";
import { RunControls } from "./RunControls";
import { TopBar } from "./TopBar";
import { useRunKeys } from "./useRunKeys";

export function ProblemPage({ id }: { id: string }) {
  const challenge = getChallenge(id);
  return challenge ? <Problem challenge={challenge} /> : null;
}

function Problem({ challenge }: { challenge: Challenge }) {
  const title = localized(challenge.title);
  useTitle(title);
  useRunKeys();
  useEffect(() => {
    useProgram.getState().load(challenge.id);
    useEditor.getState().open("problem");
  }, [challenge.id]);

  return (
    <div className="flex h-full flex-col" data-testid="problem-page">
      <TopBar title={title}>
        <RunControls challenge={challenge} />
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <Panel challenge={challenge} />
        <ChartRegion challenge={challenge} />
      </div>
    </div>
  );
}
