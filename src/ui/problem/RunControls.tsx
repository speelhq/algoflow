// The top bar's middle: `▶ Run` and, on a problem, `✓ Submit` in build mode;
// `Running with n = 15` and `■ Stop` while running.
import type { Challenge } from "@/challenges";
import { t } from "@/i18n/t";
import { shownInputs, useRun } from "@/store/run";
import { useTests } from "@/store/tests";
import { Button } from "@/ui/primitives/button";
import { startRun, startSubmit } from "./actions";
import { caseText } from "./caseText";

export function RunControls({ challenge }: { challenge?: Challenge }) {
  const status = useRun((s) => s.status);
  const busy = useRun((s) => s.busy);
  const caseIndex = useRun((s) => s.caseIndex);
  const stop = useRun((s) => s.stop);
  const submitting = useTests((s) => s.running);
  const submit = challenge && (
    <Button
      variant="outline"
      className="border-selection/60 bg-selection/10"
      disabled={submitting}
      onClick={startSubmit}
    >
      {t("problem.submit")}
    </Button>
  );
  if (status === "idle") {
    return (
      <>
        <Button variant="outline" disabled={busy} onClick={() => startRun()}>
          {t("problem.run")}
        </Button>
        {submit}
      </>
    );
  }
  const inputs = shownInputs(challenge?.tests, caseIndex);
  return (
    <>
      <span
        className="rounded-full border border-attempted/60 bg-attempted/15 px-3 py-1 text-sm"
        data-testid="running"
      >
        {inputs ? t("problem.running", { inputs: caseText(inputs) }) : t("problem.runningAlone")}
      </span>
      <Button variant="outline" onClick={stop}>
        {t("problem.stop")}
      </Button>
    </>
  );
}
