// R-11, R-12: the driver. The Runner, the play timer, and the run-to-end token live in
// module scope; the store holds what the UI renders. Back and Trace clicks replay a
// fresh runner (R-10), so a step number fully identifies a position.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import type { Data, Id, NodeId, Program } from "@/lang/types";
import { validate } from "@/lang/validate";
import { ownerStmts } from "@/lang/walk";
import { run as startRunner } from "@/runtime/run";
import type { Done, Event, Runner, State } from "@/runtime/types";
import { useProgram } from "./program";
import { traceRow, withColumns, type TraceRow } from "./trace";

export type Status = "idle" | "paused" | "playing" | "done" | "error";

export const SPEED = { min: 1, max: 50, default: 10 } as const;
export const TRACE_LIMIT = 500; // U-61
export const BATCH = 2000; // R-11

export type RunState = {
  status: Status;
  step: number;
  lastEvent: Event | null;
  /** U-36/U-38: the statement card to highlight (owner of `lastEvent`, or of the error). */
  activeId: NodeId | null;
  state: State | null;
  events: TraceRow[];
  /** Trace columns in first-assignment order (inputs first). */
  columns: Id[];
  stdout: string[];
  /** U-38: the last compare result under each frame header, by statement id. */
  verdicts: Record<NodeId, boolean>;
  done: Done | null;
  speed: number;
  testIndex: number;
  stepOnce: () => void;
  play: () => void;
  pause: () => void;
  runToEnd: () => Promise<void>;
  back: () => void;
  seek: (step: number) => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  selectTest: (index: number) => void;
};

/** R-01: a run starts only when validation is clean. */
export function canRun(program: Program): boolean {
  return validate(program).length === 0;
}

// ---------------------------------------------------------------- module state

type Origin = { program: Program; inputs: Record<Id, Data>; seed: number };
type Projection = {
  step: number;
  lastEvent: Event | null;
  events: TraceRow[];
  columns: Id[];
  stdout: string[];
  verdicts: Record<NodeId, boolean>;
};

let runner: Runner | null = null;
let origin: Origin | null = null;
let owners = new Map<NodeId, NodeId>();
let projection: Projection = freshProjection([]);
let timer: ReturnType<typeof setInterval> | null = null;
let generation = 0;

function freshProjection(columns: Id[]): Projection {
  return { step: 0, lastEvent: null, events: [], columns, stdout: [], verdicts: {} };
}

function clearTimer(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

function snapshot(): State | null {
  if (!runner) return null;
  const { frames, heap } = runner.state();
  return { frames: [...frames], heap };
}

/** Feeds one event into the projection (no store update). */
function apply(event: Event): void {
  const p = projection;
  p.step += 1;
  p.lastEvent = event;
  if (event.type === "enter") delete p.verdicts[event.nodeId];
  else if (event.type === "compare") {
    const owner = owners.get(event.nodeId);
    if (owner !== undefined) p.verdicts[owner] = event.result;
  } else if (event.type === "print") p.stdout.push(event.text);
  if (!runner) return;
  const row = traceRow(event, runner.state(), p.step);
  if (!row) return;
  p.events.push(row);
  p.columns = withColumns(p.columns, row);
  if (p.events.length > TRACE_LIMIT * 2) p.events.splice(0, p.events.length - TRACE_LIMIT);
}

/** One `next()`; returns the Done when the run finished. */
function advanceOne(): Done | undefined {
  if (!runner) return undefined;
  const next = runner.next();
  if (next.type === "done" || next.type === "error") return next;
  apply(next);
  return undefined;
}

function sleep(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function originFor(testIndex: number): Origin | null {
  const program = useProgram.getState().program;
  if (!canRun(program)) return null;
  const test = getChallenge(program.challengeId)?.tests[testIndex];
  return { program, inputs: test?.inputs ?? {}, seed: test?.seed ?? 1 };
}

function reset(from: Origin): void {
  runner = startRunner(from.program, from.inputs, from.seed);
  owners = ownerStmts(from.program);
  projection = freshProjection(from.program.inputs.map((input) => input.name));
}

export const useRun = create<RunState>()((set, get) => {
  const publish = (status: Status, done: Done | null = null) => {
    const focus = done?.type === "error" ? done.error.nodeId : projection.lastEvent?.nodeId;
    set({
      status,
      done,
      step: projection.step,
      lastEvent: projection.lastEvent,
      activeId: focus === undefined ? null : (owners.get(focus) ?? focus),
      state: snapshot(),
      events: projection.events.slice(-TRACE_LIMIT),
      columns: [...projection.columns],
      stdout: [...projection.stdout],
      verdicts: { ...projection.verdicts },
    });
  };

  const finish = (done: Done) => {
    clearTimer();
    publish(done.type, done);
  };

  /** Creates the runner when there is none; false when validation refuses (R-01). */
  const ensureRunner = (): boolean => {
    if (runner) return true;
    const from = originFor(get().testIndex);
    if (!from) return false;
    origin = from;
    reset(from);
    return true;
  };

  const tick = () => {
    const done = advanceOne();
    if (done) finish(done);
    else publish("playing");
  };

  return {
    status: "idle",
    step: 0,
    lastEvent: null,
    activeId: null,
    state: null,
    events: [],
    columns: [],
    stdout: [],
    verdicts: {},
    done: null,
    speed: SPEED.default,
    testIndex: 0,

    stepOnce() {
      if (get().status === "playing") get().pause();
      if (get().status === "done" || get().status === "error") return;
      if (!ensureRunner()) return;
      const done = advanceOne();
      if (done) finish(done);
      else publish("paused");
    },

    play() {
      if (get().status === "playing") return;
      if (get().status === "done" || get().status === "error") return;
      if (!ensureRunner()) return;
      generation += 1;
      clearTimer();
      timer = setInterval(tick, 1000 / get().speed);
      publish("playing");
    },

    pause() {
      generation += 1;
      clearTimer();
      if (get().status === "playing") publish("paused");
    },

    async runToEnd() {
      if (get().status === "done" || get().status === "error") return;
      if (!ensureRunner()) return;
      generation += 1;
      const mine = generation;
      clearTimer();
      publish("playing");
      for (;;) {
        for (let i = 0; i < BATCH; i += 1) {
          const done = advanceOne();
          if (done) {
            finish(done);
            return;
          }
        }
        publish("playing");
        await sleep();
        if (mine !== generation || !runner) return;
      }
    },

    back() {
      const { step } = get();
      if (step > 0) get().seek(step - 1);
    },

    seek(step) {
      if (!ensureRunner() || !origin) return;
      generation += 1;
      clearTimer();
      reset(origin);
      for (let i = 0; i < step; i += 1) {
        const done = advanceOne();
        if (done) {
          finish(done);
          return;
        }
      }
      publish("paused");
    },

    stop() {
      generation += 1;
      clearTimer();
      runner = null;
      origin = null;
      projection = freshProjection([]);
      set({
        status: "idle",
        step: 0,
        lastEvent: null,
        activeId: null,
        state: null,
        events: [],
        columns: [],
        stdout: [],
        verdicts: {},
        done: null,
      });
    },

    setSpeed(speed) {
      const clamped = Math.min(Math.max(Math.round(speed), SPEED.min), SPEED.max);
      set({ speed: clamped });
      if (get().status === "playing") {
        clearTimer();
        timer = setInterval(tick, 1000 / clamped);
      }
    },

    selectTest(index) {
      get().stop();
      set({ testIndex: index });
    },
  };
});

// A new program (challenge switch, later edits) discards the runner and the test choice.
useProgram.subscribe((current, previous) => {
  if (current.program !== previous.program) useRun.getState().selectTest(0);
});
