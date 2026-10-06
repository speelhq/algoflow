// U-60: the transport docked under the chart while running: Back, Pause / Play, Step, Skip
// (R-19), the position bar `step k of N`, which seeks to any step (R-11), and the speed
// slider 1–50 (persisted). A pre-run that hit the step limit is reported first.
import { t } from "@/i18n/t";
import { SPEED, useLayout } from "@/store/layout";
import { useRun } from "@/store/run";
import { Button } from "@/ui/primitives/button";
import { Slider } from "@/ui/primitives/slider";

function first(value: number | readonly number[]): number {
  return typeof value === "number" ? value : (value[0] ?? 0);
}

export function Transport() {
  const status = useRun((s) => s.status);
  const step = useRun((s) => s.step);
  const total = useRun((s) => s.total);
  const outcome = useRun((s) => s.outcome);
  const back = useRun((s) => s.back);
  const play = useRun((s) => s.play);
  const pause = useRun((s) => s.pause);
  const stepOnce = useRun((s) => s.stepOnce);
  const skip = useRun((s) => s.skip);
  const seek = useRun((s) => s.seek);
  const speed = useLayout((s) => s.speed);
  const setSpeed = useLayout((s) => s.setSpeed);
  const ended = status === "done" || status === "error";
  const endless = outcome?.type === "error" && outcome.error.code === "E_STEP_LIMIT";

  return (
    <div className="shrink-0 border-t bg-background" data-testid="transport">
      {endless && (
        <p
          role="alert"
          className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
          data-testid="endless"
        >
          {t("run.endless")}
        </p>
      )}
      <div className="flex h-14 items-center gap-2 px-4">
        <Button variant="outline" disabled={step === 0} onClick={() => void back()}>
          {t("run.back")}
        </Button>
        {status === "playing" ? (
          <Button onClick={pause}>{t("run.pause")}</Button>
        ) : (
          <Button disabled={ended} onClick={play}>
            {t("run.play")}
          </Button>
        )}
        <Button variant="outline" disabled={ended} onClick={stepOnce}>
          {t("run.step")}
        </Button>
        <Button variant="outline" disabled={ended} onClick={() => void skip()}>
          {t("run.skip")}
        </Button>
        <Slider
          className="mx-3 min-w-24 flex-1"
          min={0}
          max={total}
          value={[step]}
          onValueChange={(value) => void seek(first(value))}
          aria-label={t("run.positionLabel")}
          data-testid="position"
        />
        <span className="font-mono text-sm whitespace-nowrap" data-testid="position-text">
          {t("run.position", { k: step, n: total })}
        </span>
        <span className="ml-2 text-sm text-muted-foreground">{t("run.speed")}</span>
        <Slider
          className="w-24"
          min={SPEED.min}
          max={SPEED.max}
          value={[speed]}
          onValueChange={(value) => setSpeed(first(value))}
          aria-label={t("run.speed")}
          data-testid="speed"
        />
      </div>
    </div>
  );
}
