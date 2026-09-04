// U-61 Tests: per test name, Pass/Fail with expected/actual, Run with this input; Run all;
// Cleared! when every test passes (C-10..C-12, C-16).
import { useMemo } from "react";
import { getChallenge } from "@/challenges";
import type { Mismatch, TestResult } from "@/challenges/judge";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { dataToPython } from "@/python/emit";
import { useProgram } from "@/store/program";
import { canRun } from "@/store/run";
import { useTests } from "@/store/tests";
import { Button } from "@/ui/primitives/button";

function mismatchText(m: Mismatch): { expected: string; actual: string } {
  if (m.kind === "stdout") {
    return { expected: m.expected.join("\n"), actual: m.actual.join("\n") };
  }
  return {
    expected: `${m.name} = ${dataToPython(m.expected)}`,
    actual:
      m.actual === undefined
        ? t("error.E_UNDEFINED", { name: m.name })
        : `${m.name} = ${dataToPython(m.actual)}`,
  };
}

function Verdict({ result }: { result: TestResult | null }) {
  if (!result) return null;
  if (result.status === "pass") {
    return (
      <span className="rounded-md bg-green-600/15 px-1.5 text-green-700">{t("view.pass")}</span>
    );
  }
  if (result.status === "error") {
    return (
      <span className="text-destructive">
        {t("view.fail")} · {t(`error.${result.error.code}`, result.error.params)}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="w-fit rounded-md bg-destructive/10 px-1.5 text-destructive">
        {t("view.fail")}
      </span>
      {result.mismatches.map((m, i) => {
        const text = mismatchText(m);
        return (
          <div key={`${m.kind}:${i}`} className="font-mono text-xs">
            <pre className="whitespace-pre-wrap">
              {t("view.expected", { value: text.expected })}
            </pre>
            <pre className="whitespace-pre-wrap">{t("view.actual", { value: text.actual })}</pre>
          </div>
        );
      })}
    </div>
  );
}

export function TestsTab() {
  const program = useProgram((s) => s.program);
  const challenge = getChallenge(program.challengeId);
  const runnable = useMemo(() => canRun(program), [program]);
  const results = useTests((s) => s.results);
  const running = useTests((s) => s.running);
  const cleared = useTests((s) => s.cleared);
  const runAll = useTests((s) => s.runAll);
  const runTest = useTests((s) => s.runTest);

  if (!challenge) return <p className="text-muted-foreground">{t("view.noTests")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => void runAll()} disabled={!runnable || running}>
          {t("view.runAll")}
        </Button>
        {cleared && (
          <span
            data-testid="cleared"
            className="rounded-lg bg-primary px-3 py-1 font-semibold text-primary-foreground"
          >
            {t("view.cleared")}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {challenge.tests.map((test, i) => (
          <li
            key={test.name.en}
            data-testid="test-row"
            className={cn("grid grid-cols-[10rem_1fr_auto] items-start gap-3")}
          >
            <span className="font-medium">{test.name.en}</span>
            <Verdict result={results[i] ?? null} />
            <Button
              variant="outline"
              size="xs"
              onClick={() => void runTest(i)}
              disabled={!runnable || running}
            >
              {t("view.runWithInput")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
