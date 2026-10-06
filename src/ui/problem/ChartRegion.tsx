// U-03, U-22, U-30..U-32, U-60..U-65: the chart region: the solution band when the solution
// is shown, the path bar, the chart, and, while running, the transport. The Input nodes show
// the chosen case and list every case.
import { useCallback, useMemo } from "react";
import type { Challenge } from "@/challenges";
import { errorText, t } from "@/i18n/t";
import type { NodeId, Program } from "@/lang/types";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun, type RunState } from "@/store/run";
import { Chart, type Note } from "@/ui/chart/Chart";
import { layout, type ChartLayout } from "@/ui/chart/layout";
import { measureText, useFontStatus } from "@/ui/chart/measure";
import { nodeFor, paint, type Paint } from "@/ui/chart/paint";
import { PathBar } from "@/ui/chart/PathBar";
import { Button } from "@/ui/primitives/button";
import { narrate, narrateDifference, narrateEnd, type Narration } from "@/ui/run/narrate";
import { caseText } from "./caseText";
import { Transport } from "./Transport";

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

const say = (sentence: Narration) => t(sentence.key, sentence.params);

/** U-63, U-81, U-65: the sentence for the run's position, or none before the first step. */
function narration(run: RunState, program: Program): string | null {
  const { step, total, outcome, lastEvent, state, difference } = run;
  const end = outcome && step === total ? narrateEnd(outcome, total) : null;
  // An error is said wherever the run stops on it; a difference is said in place of the step.
  if (end && outcome?.type === "error") return say(end);
  if (difference && step === difference.step) return say(narrateDifference(difference));
  if (end) return say(end);
  if (!lastEvent || !state) return null;
  return say(narrate(lastEvent, { program, state, frame: run.frame, pass: run.pass }));
}

/** What the chart draws and says: the run while running, else the diagnostic Run led to. */
function useRunPaint(
  chart: ChartLayout | null,
  program: Program,
): { paint?: Paint; note: Note | null } {
  const run = useRun();
  const diagnostic = useEditor((s) => s.diagnostic);
  const selectedId = useEditor((s) => s.selectedId);
  return useMemo(() => {
    if (!chart) return { note: null };
    if (run.status === "idle") {
      const node = diagnostic && selectedId ? nodeFor(chart.nodes, selectedId) : undefined;
      return {
        note:
          node && diagnostic ? { node: node.id, text: errorText(diagnostic), tone: "error" } : null,
      };
    }
    const painted = paint(chart, {
      ended: run.status === "done",
      activeId: run.activeId,
      lastEvent: run.lastEvent,
      taken: run.taken,
      verdicts: run.verdicts,
      breakpoint: run.breakpoint,
    });
    const text = narration(run, program);
    const tone: Note["tone"] =
      run.status === "error" && run.step === run.total ? "error" : "narration";
    const note: Note | null =
      painted.current && text ? { node: painted.current, text, tone } : null;
    return { paint: painted, note };
  }, [chart, run, program, diagnostic, selectedId]);
}

export function ChartRegion({ challenge }: { challenge: Challenge }) {
  const mine = useProgram((s) => s.program);
  const solution = useEditor((s) => s.solution);
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);
  const select = useEditor((s) => s.select);
  const caseIndex = useRun((s) => s.caseIndex);
  const selectCase = useRun((s) => s.selectCase);
  const running = useRun((s) => s.status !== "idle");
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
  const { paint: painted, note } = useRunPaint(solution ? null : chart, mine);

  // U-60: in build mode a click selects; while running it sets or clears the breakpoint,
  // pausing first; once the run has ended it returns to build mode with the node selected.
  const onSelect = useCallback(
    (owner: NodeId) => {
      const run = useRun.getState();
      if (run.status === "idle") return select(owner);
      if (run.status === "done" || run.status === "error") {
        run.stop();
        return select(owner);
      }
      if (run.status === "playing") run.pause();
      run.setBreakpoint(run.breakpoint === owner ? null : owner);
    },
    [select],
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col" data-testid="chart-region">
      {solution && <SolutionBand />}
      <PathBar />
      {chart && (
        <Chart
          key={solution ? "solution" : "mine"}
          chart={chart}
          selectedId={solution || running ? null : selectedId}
          hoveredId={solution ? null : hoveredId}
          onSelect={solution ? undefined : onSelect}
          cases={solution || running ? undefined : cases}
          paint={painted}
          note={note}
        />
      )}
      {running && !solution && <Transport />}
    </section>
  );
}
