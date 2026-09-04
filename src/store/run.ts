// R-11, R-12: the driver. The Runner, the play timer, and the run-to-end token live in
// module scope; the store holds what the UI renders. Back and Trace clicks replay a
// fresh runner (R-10), so a step number fully identifies a position.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import type { Data, Id, NodeId, Program } from "@/lang/types";
import { validate } from "@/lang/validate";
import { ownerStmts } from "@/lang/walk";
import { outcomeOf, type Outcome } from "@/runtime/outcome";
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
  /** U-38: the last compare result under each statement, by owner id (cards show it on frame headers). */
  verdicts: Record<NodeId, boolean>;
  done: Done | null;
  speed: number;
  testIndex: number;
  stepOnce: () => void;
  play: () => void;
  pause: () => void;
  /** Resolves with the run's outcome, or undefined when it was refused or interrupted. */
  runToEnd: () => Promise<Outcome | undefined>;
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
  verdicts: Record<NodeId, boolean>;
  /** Fields whose published copy is stale. */
  dirty: { events: boolean; columns: boolean; stdout: boolean; verdicts: boolean };
};

let runner: Runner | null = null;
let origin: Origin | null = null;
let owners = new Map<NodeId, NodeId>();
let projection: Projection = freshProjection([]);
let timer: ReturnType<typeof setInterval> | null = null;
let generation = 0;

function freshProjection(columns: Id[]): Projection {
  return {
    step: 0,
    lastEvent: null,
    events: [],
    columns,
    verdicts: {},
    dirty: { events: true, columns: true, stdout: true, verdicts: true },
  };
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
  if (event.type === "enter") {
    if (event.nodeId in p.verdicts) {
      delete p.verdicts[event.nodeId];
      p.dirty.verdicts = true;
    }
  } else if (event.type === "compare") {
    const owner = owners.get(event.nodeId);
    if (owner !== undefined) {
      p.verdicts[owner] = event.result;
      p.dirty.verdicts = true;
    }
  } else if (event.type === "print") p.dirty.stdout = true;
  if (!runner) return;
  const row = traceRow(event, runner.state(), p.step);
  if (!row) return;
  p.events.push(row);
  p.dirty.events = true;
  const columns = withColumns(p.columns, row);
  if (columns !== p.columns) {
    p.columns = columns;
    p.dirty.columns = true;
  }
  if (p.events.length > TRACE_LIMIT * 2) p.events.splice(0, p.events.length - TRACE_LIMIT);
}

/** Up to `limit` calls of `next()`; returns the Done when the run finished. */
function advanceMany(limit: number): Done | undefined {
  for (let i = 0; i < limit; i += 1) {
    if (!runner) return undefined;
    const next = runner.next();
    if (next.type === "done" || next.type === "error") return next;
    apply(next);
  }
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
    const p = projection;
    const previous = get();
    const focus = done?.type === "error" ? done.error.nodeId : p.lastEvent?.nodeId;
    set({
      status,
      done,
      step: p.step,
      lastEvent: p.lastEvent,
      activeId: focus === undefined ? null : (owners.get(focus) ?? focus),
      state: snapshot(),
      events: p.dirty.events ? p.events.slice(-TRACE_LIMIT) : previous.events,
      columns: p.dirty.columns ? [...p.columns] : previous.columns,
      stdout: p.dirty.stdout ? (runner?.stdout() ?? []) : previous.stdout,
      verdicts: p.dirty.verdicts ? { ...p.verdicts } : previous.verdicts,
    });
    p.dirty = { events: false, columns: false, stdout: false, verdicts: false };
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

  const finished = () => get().status === "done" || get().status === "error";

  const tick = () => {
    const done = advanceMany(1);
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
      if (finished() || !ensureRunner()) return;
      const done = advanceMany(1);
      if (done) finish(done);
      else publish("paused");
    },

    play() {
      if (get().status === "playing" || finished() || !ensureRunner()) return;
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
      if (finished() || !ensureRunner()) return undefined;
      generation += 1;
      const mine = generation;
      clearTimer();
      publish("playing");
      for (;;) {
        const done = advanceMany(BATCH);
        if (done) {
          finish(done);
          return runner ? outcomeOf(runner, done) : undefined;
        }
        publish("playing");
        await sleep();
        if (mine !== generation || !runner) return undefined;
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
      // Forward: advance the current runner; backward: a fresh runner advanced `step` times (R-11).
      if (step < projection.step || finished()) reset(origin);
      const done = advanceMany(step - projection.step);
      if (done) finish(done);
      else publish("paused");
    },

    stop() {
      generation += 1;
      clearTimer();
      runner = null;
      origin = null;
      projection = freshProjection([]);
      publish("idle");
    },

    setSpeed(speed) {
      const clamped = Math.min(Math.max(Math.round(speed), SPEED.min), SPEED.max);
      set({ speed: clamped });
      if (timer !== null) {
        // Only a play timer is re-armed; a run to end (also `playing`) keeps its batches.
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

// C-13: a new program (challenge switch, later edits) discards the runner and the test choice.
useProgram.subscribe((current, previous) => {
  if (current.program !== previous.program) useRun.getState().selectTest(0);
});
