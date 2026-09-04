// U-61 Trace: one row per write/swap/compare/loop, one column per variable in
// first-assignment order, cells only on change, a Condition column, click = Back to that step.
import { useEffect, useRef } from "react";
import { t } from "@/i18n/t";
import { useRun } from "@/store/run";

export function TraceTab() {
  const events = useRun((s) => s.events);
  const columns = useRun((s) => s.columns);
  const seek = useRun((s) => s.seek);

  // Clicking anywhere on a row seeks; the step button keeps it keyboard reachable.
  const body = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    const element = body.current;
    if (!element) return;
    const onClick = (event: MouseEvent) => {
      const row = (event.target as Element | null)?.closest<HTMLElement>("[data-step]");
      const step = Number(row?.dataset.step);
      if (Number.isFinite(step)) seek(step);
    };
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [seek]);

  return (
    <table className="w-max border-collapse font-mono text-xs">
      <thead className="sticky top-0 bg-background text-left text-muted-foreground">
        <tr>
          <th className="px-2 py-1 font-medium">{t("view.step")}</th>
          {columns.map((name) => (
            <th key={name} className="px-2 py-1 font-medium">
              {name}
            </th>
          ))}
          <th className="px-2 py-1 font-medium">{t("view.condition")}</th>
        </tr>
      </thead>
      <tbody ref={body}>
        {events.map((row) => (
          <tr
            key={row.step}
            data-testid="trace-row"
            data-step={row.step}
            className="cursor-pointer hover:bg-muted"
          >
            <td className="px-2 py-0.5">
              <button type="button" className="w-full text-left">
                {row.step}
              </button>
            </td>
            {columns.map((name) => (
              <td key={name} className="px-2 py-0.5">
                {row.cells[name] ?? ""}
              </td>
            ))}
            <td className="px-2 py-0.5">{row.condition ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
