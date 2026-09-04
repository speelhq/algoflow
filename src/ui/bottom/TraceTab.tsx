// U-61 Trace: one row per write/swap/compare/loop, one column per variable in
// first-assignment order, cells only on change, a Condition column, click = Back to that step.
import { t } from "@/i18n/t";
import { useRun } from "@/store/run";

export function TraceTab() {
  const events = useRun((s) => s.events);
  const columns = useRun((s) => s.columns);
  const seek = useRun((s) => s.seek);
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
      <tbody>
        {events.map((row) => (
          <tr key={row.step} data-testid="trace-row" className="hover:bg-muted">
            <td className="px-2 py-0.5">
              <button
                type="button"
                className="w-full text-left underline-offset-2 hover:underline"
                onClick={() => seek(row.step)}
              >
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
