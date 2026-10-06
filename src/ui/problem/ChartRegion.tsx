// U-03, U-22, U-30..U-32: the chart region: the solution band when the solution is shown,
// the path bar, and the chart. The Input nodes show the chosen case and list every case.
import { useMemo } from "react";
import type { Challenge } from "@/challenges";
import { t } from "@/i18n/t";
import type { Program } from "@/lang/types";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { Chart } from "@/ui/chart/Chart";
import { layout } from "@/ui/chart/layout";
import { measureText, useFontStatus } from "@/ui/chart/measure";
import { PathBar } from "@/ui/chart/PathBar";
import { Button } from "@/ui/primitives/button";
import { caseText } from "./caseText";

function SolutionBand() {
  const showSolution = useEditor((s) => s.showSolution);
  return (
    <div
      className="flex h-11 shrink-0 items-center gap-2 border-b bg-attempted/15 px-4"
      data-testid="solution-band"
    >
      <span className="font-semibold">{t("chart.solution")}</span>
      <span className="text-muted-foreground">{t("chart.readOnly")}</span>
      <Button className="ml-auto" onClick={() => showSolution(false)}>
        {t("chart.backToMine")}
      </Button>
    </div>
  );
}

export function ChartRegion({ challenge }: { challenge: Challenge }) {
  const mine = useProgram((s) => s.program);
  const solution = useEditor((s) => s.solution);
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);
  const select = useEditor((s) => s.select);
  const caseIndex = useRun((s) => s.caseIndex);
  const selectCase = useRun((s) => s.selectCase);
  const fonts = useFontStatus();
  const program: Program = solution ? challenge.solution : mine;
  const inputs = challenge.tests[caseIndex]?.inputs;
  const chart = useMemo(
    () => (fonts ? layout(program, { inputs, measure: measureText }) : null),
    [program, inputs, fonts],
  );
  const cases = useMemo(
    () => ({ labels: challenge.tests.map((test) => caseText(test.inputs)), choose: selectCase }),
    [challenge, selectCase],
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col" data-testid="chart-region">
      {solution && <SolutionBand />}
      <PathBar />
      {chart && (
        <Chart
          key={solution ? "solution" : "mine"}
          chart={chart}
          selectedId={solution ? null : selectedId}
          hoveredId={solution ? null : hoveredId}
          onSelect={solution ? undefined : select}
          cases={solution ? undefined : cases}
        />
      )}
    </section>
  );
}
