// The `Result` tab for one case: the case selector (the same choice as the Input
// nodes), the variables of the shown frame, and `Output` beside `Expected`; the
// chosen case's verdict and its first differing row once the run has ended there.
// Before any run: the selector, the chosen case's `Expected`, and `result.empty`.
import { useMemo } from "react";
import type { Challenge } from "@/challenges";
import { firstDifference, resultRows } from "@/challenges/rows";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { mainVars } from "@/runtime/outcome";
import { useRun } from "@/store/run";
import { useTests } from "@/store/tests";
import { valueText } from "@/ui/chart/text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";
import { caseText } from "./caseText";
import { ResultRows } from "./ResultRows";
import { SubmissionView } from "./SubmissionView";

function CaseSelect({ challenge }: { challenge: Challenge }) {
  const caseIndex = useRun((s) => s.caseIndex);
  const selectCase = useRun((s) => s.selectCase);
  // The case stays the run's while running.
  const running = useRun((s) => s.status !== "idle");
  const items = challenge.tests.map((test, index) => ({
    value: index,
    label: caseText(test.inputs),
  }));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {t("result.case")}
      </span>
      <Select
        items={items}
        value={caseIndex}
        disabled={running}
        onValueChange={(value) => typeof value === "number" && selectCase(value)}
      >
        <SelectTrigger className="font-mono text-xs" data-testid="case-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} className="font-mono text-xs">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Variables() {
  const state = useRun((s) => s.state);
  const frame = useRun((s) => s.frame);
  const shown = state?.frames[frame];
  if (!state || !shown) return null;
  return (
    <section>
      <h3 className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
        {t("result.variables")}
      </h3>
      <ul className="flex flex-wrap gap-1.5" data-testid="variables">
        {[...shown.vars].map(([name, value]) => (
          <li key={name} className="rounded-full border px-2.5 py-0.5 font-mono text-xs">
            {t("problem.assignment", { name, value: valueText(value, state.heap) })}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The submission, while one is shown, else the run of the chosen case. */
export function ResultTab({ challenge }: { challenge?: Challenge }) {
  const submitted = useTests((s) => s.running || s.results.length > 0);
  return submitted && challenge ? (
    <SubmissionView challenge={challenge} />
  ) : (
    <RunResult challenge={challenge} />
  );
}

/** A Playground program has no case selector and no `Expected`. */
function RunResult({ challenge }: { challenge: Challenge | undefined }) {
  const status = useRun((s) => s.status);
  const caseIndex = useRun((s) => s.caseIndex);
  const stdout = useRun((s) => s.stdout);
  const state = useRun((s) => s.state);
  const verdict = useRun((s) => s.verdict);
  const test = challenge?.tests[caseIndex];
  const idle = status === "idle";
  const rows = useMemo(
    () =>
      resultRows(test?.expect, {
        stdout: idle ? [] : stdout,
        vars: idle || !state ? {} : mainVars(state),
      }),
    [test, idle, stdout, state],
  );
  const marked = verdict ? firstDifference(rows) : null;

  return (
    <div className="space-y-4" data-testid="result-tab">
      {challenge && <CaseSelect challenge={challenge} />}
      {idle ? <p className="text-muted-foreground">{t("result.empty")}</p> : <Variables />}
      {verdict && (
        <p
          className={cn(
            "font-semibold",
            verdict.status === "pass" ? "text-taken" : "text-destructive",
          )}
          data-testid="case-verdict"
        >
          {t(verdict.status === "pass" ? "result.casePassed" : "result.caseFailed")}
        </p>
      )}
      <ResultRows rows={rows} marked={marked} expected={test?.expect.stdout !== undefined} />
    </div>
  );
}
