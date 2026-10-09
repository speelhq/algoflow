# AlgoFlow

A block-based algorithm learning tool for people who have never programmed.
The learner builds a program as a flowchart, runs it on one input and
watches each step, compares the result with the expected one, and submits.
The blocks are a fixed subset of Python, and the `Python` tab shows the
program as the Python file it is. Everything runs in the browser, with no
server and no accounts.

## Running it

Requirements: Node 22 (`.node-version`), pnpm 10, and CPython 3.12 or later
for `pnpm check`.

```
pnpm install
pnpm dev        # the application at http://localhost:5173
```

The other commands are in `CONTRIBUTING.md`.

## Where things are

| Path              | Holds                                                          |
| ----------------- | -------------------------------------------------------------- |
| `docs/spec/`      | the specification, one folder per area with its reasons        |
| `docs/design/`    | the artboards the screens are built from                       |
| `src/`            | the application (`ARCHITECTURE.md` maps it)                    |
| `challenges/`     | the problems and the study plans, as JSON                      |
| `scripts/`        | `pnpm check`                                                   |
| `e2e/`            | the end-to-end tests and their screenshots                     |
| `ARCHITECTURE.md` | the code's structure and the fixed choices, with their reasons |
| `CONTRIBUTING.md` | how work proceeds, with the reason for each rule               |
