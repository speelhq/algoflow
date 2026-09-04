// U-60: Run (Pause while playing), Step, Back, Stop, speed 1–50, test selector (challenges
// only), status `Step N` / `Loops N` / error message. U-61: Data, Trace, Output, Tests, Python.
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, SquareIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { getChallenge } from "@/challenges";
import { t } from "@/i18n/t";
import { useProgram } from "@/store/program";
import { canRun, SPEED, useRun } from "@/store/run";
import { useTests } from "@/store/tests";
import { PanelTab, PanelTabContent, PanelTabList, PanelTabs } from "@/ui/app/PanelTabs";
import { Button } from "@/ui/primitives/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";
import { DataTab } from "./DataTab";
import { OutputTab } from "./OutputTab";
import { PythonTab } from "./PythonTab";
import { TestsTab } from "./TestsTab";
import { TraceTab } from "./TraceTab";

const VIEWS = ["data", "trace", "output", "tests", "python"] as const;
type View = (typeof VIEWS)[number];
const isView = (value: unknown): value is View => VIEWS.includes(value as View);

const PANELS: Record<View, () => React.JSX.Element> = {
  data: DataTab,
  trace: TraceTab,
  output: OutputTab,
  tests: TestsTab,
  python: PythonTab,
};

function StatusText() {
  const status = useRun((s) => s.status);
  const step = useRun((s) => s.step);
  const done = useRun((s) => s.done);
  if (status === "error" && done?.type === "error") {
    return <>{t(`error.${done.error.code}`, done.error.params)}</>;
  }
  const steps = t("run.stepCount", { n: step });
  if (status === "done" && done?.type === "done") {
    return <>{`${steps} · ${t("run.loops", { n: done.loops })}`}</>;
  }
  return <>{steps}</>;
}

function TestSelector() {
  const program = useProgram((s) => s.program);
  const challenge = getChallenge(program.challengeId);
  const testIndex = useRun((s) => s.testIndex);
  const selectTest = useRun((s) => s.selectTest);
  if (!challenge) return null;
  const items = challenge.tests.map((test, i) => ({ value: String(i), label: test.name.en }));
  return (
    <label className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
      {t("run.test")}
      <Select
        items={items}
        value={String(testIndex)}
        onValueChange={(value) => selectTest(Number(value))}
      >
        <SelectTrigger size="sm" aria-label={t("run.test")} className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function BottomPanel() {
  const program = useProgram((s) => s.program);
  const runnable = useMemo(() => canRun(program), [program]);
  const status = useRun((s) => s.status);
  const step = useRun((s) => s.step);
  const speed = useRun((s) => s.speed);
  const { play, pause, stepOnce, back, stop, setSpeed } = useRun.getState();
  const cleared = useTests((s) => s.cleared);
  const [view, setView] = useState<View>("data");

  // U-61: when every test passes, the Python tab is activated (state adjusted during render).
  const [seenCleared, setSeenCleared] = useState(cleared);
  if (cleared !== seenCleared) {
    setSeenCleared(cleared);
    if (cleared) setView("python");
  }

  const finished = status === "done" || status === "error";
  const playing = status === "playing";
  const onRun = () => {
    if (playing) pause();
    else {
      if (finished) stop();
      play();
    }
  };

  return (
    <div className="flex h-full flex-col border-t border-border">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <Button variant="default" size="sm" onClick={onRun} disabled={!runnable}>
          {playing ? <PauseIcon data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
          {playing ? t("run.pause") : t("run.run")}
        </Button>
        <Button variant="outline" size="sm" onClick={stepOnce} disabled={!runnable || finished}>
          <SkipForwardIcon data-icon="inline-start" />
          {t("run.step")}
        </Button>
        <Button variant="outline" size="sm" onClick={back} disabled={step === 0}>
          <SkipBackIcon data-icon="inline-start" />
          {t("run.back")}
        </Button>
        <Button variant="outline" size="sm" onClick={stop} disabled={status === "idle"}>
          <SquareIcon data-icon="inline-start" />
          {t("run.stop")}
        </Button>
        <label className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
          {t("run.speed")}
          <input
            type="range"
            min={SPEED.min}
            max={SPEED.max}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            className="w-32"
          />
        </label>
        <TestSelector />
        <span data-testid="run-status" className="ml-auto text-xs text-muted-foreground">
          <StatusText />
        </span>
      </div>

      <PanelTabs
        value={view}
        onValueChange={(value) => {
          if (isView(value)) setView(value);
        }}
        className="min-h-0 flex-1"
      >
        <PanelTabList>
          {VIEWS.map((name) => (
            <PanelTab key={name} value={name}>
              {t(`view.${name}`)}
            </PanelTab>
          ))}
        </PanelTabList>
        {VIEWS.map((name) => {
          const Panel = PANELS[name];
          return (
            <PanelTabContent key={name} value={name} className="min-h-0 overflow-auto p-3">
              {view === name && <Panel />}
            </PanelTabContent>
          );
        })}
      </PanelTabs>
    </div>
  );
}
