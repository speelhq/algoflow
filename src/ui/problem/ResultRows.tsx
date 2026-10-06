// U-23, U-81, U-84: `Output` beside `Expected`, aligned line by line with a blank cell where
// a side has no line, then every expected variable beside its expected value. The first
// row that differs is marked; nothing else about the difference is said (U-82).
import type { FirstDifference, Rows } from "@/challenges/rows";
import { t } from "@/i18n/t";
import type { Data } from "@/lang/types";
import { cn } from "@/lib/utils";
import { dataText } from "@/ui/chart/text";

type Props = {
  rows: Rows;
  /** Shown only once a verdict exists (U-23). */
  marked: FirstDifference | null;
  /** U-84: a test that ended in a runtime error shows its message in place of `Output`. */
  error?: string;
  /** Whether the case has expectations to show beside the output. */
  expected: boolean;
};

const cell = "min-w-0 px-2 py-0.5 font-mono text-xs whitespace-pre-wrap break-words";

/** A variable row's cell: `name = value`, or blank when the program never created it. */
function assignment(name: string, value: Data | undefined): string {
  return value === undefined ? "" : t("problem.assignment", { name, value: dataText(value) });
}

export function ResultRows({ rows, marked, error, expected }: Props) {
  return (
    <div className="space-y-3" data-testid="result-rows">
      <div className={cn("grid gap-x-2 text-xs", expected ? "grid-cols-2" : "grid-cols-1")}>
        <h3 className="tracking-wide text-muted-foreground uppercase">{t("result.output")}</h3>
        {expected && (
          <h3 className="tracking-wide text-muted-foreground uppercase">{t("result.expected")}</h3>
        )}
      </div>
      {error !== undefined ? (
        <div className={cn("grid gap-x-2", expected ? "grid-cols-2" : "grid-cols-1")}>
          <p
            className="self-start rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-destructive"
            data-testid="result-error"
          >
            {error}
          </p>
          {expected && (
            <div className="rounded-lg border py-1">
              {rows.output.map((row) => (
                <div key={row.line} className={cell}>
                  {row.expected ?? ""}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "grid max-h-72 overflow-y-auto rounded-lg border py-1",
            expected ? "grid-cols-2" : "grid-cols-1",
          )}
          data-testid="output-rows"
        >
          {rows.output.map((row) => {
            const first = marked?.kind === "output" && marked.line === row.line;
            return (
              <div
                key={row.line}
                className={cn(
                  "contents",
                  first && "[&>*]:bg-destructive/10 [&>*]:text-destructive",
                )}
                data-testid="output-row"
                data-differs={first || undefined}
              >
                <span className={cell}>{row.actual ?? ""}</span>
                {expected && <span className={cell}>{row.expected ?? ""}</span>}
              </div>
            );
          })}
        </div>
      )}
      {rows.variables.length > 0 && (
        <div className="grid grid-cols-2 rounded-lg border py-1" data-testid="variable-rows">
          {rows.variables.map((row) => {
            const first = marked?.kind === "variable" && marked.name === row.name;
            return (
              <div
                key={row.name}
                className={cn(
                  "contents",
                  first && "[&>*]:bg-destructive/10 [&>*]:text-destructive",
                )}
                data-testid="variable-row"
                data-differs={first || undefined}
              >
                <span className={cell}>{assignment(row.name, row.actual)}</span>
                <span className={cell}>{assignment(row.name, row.expected)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
