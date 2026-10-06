// U-03, U-60: the top bar's middle: `▶ Run` in build mode; `Running with n = 15` and
// `■ Stop` while running.
import type { Challenge } from "@/challenges";
import { t } from "@/i18n/t";
import { useRun } from "@/store/run";
import { Button } from "@/ui/primitives/button";
import { startRun } from "./actions";
import { caseText } from "./caseText";

export function RunControls({ challenge }: { challenge: Challenge }) {
  const status = useRun((s) => s.status);
  const busy = useRun((s) => s.busy);
  const caseIndex = useRun((s) => s.caseIndex);
  const stop = useRun((s) => s.stop);
  if (status === "idle") {
    return (
      <Button variant="outline" disabled={busy} onClick={() => startRun()}>
        {t("problem.run")}
      </Button>
    );
  }
  const inputs = challenge.tests[caseIndex]?.inputs ?? {};
  return (
    <>
      <span
        className="rounded-full border border-attempted/60 bg-attempted/15 px-3 py-1 text-sm"
        data-testid="running"
      >
        {t("problem.running", { inputs: caseText(inputs) })}
      </span>
      <Button variant="outline" onClick={stop}>
        {t("problem.stop")}
      </Button>
    </>
  );
}
