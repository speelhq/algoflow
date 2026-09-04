// U-61 Data: one view per variable of the current frame (V-01). The call-stack strip arrives in M-05.
import { t } from "@/i18n/t";
import { useRun } from "@/store/run";
import { InlineValue } from "@/ui/views/InlineValue";

export function DataTab() {
  const state = useRun((s) => s.state);
  const frame = state?.frames[state.frames.length - 1];
  if (!state || !frame || frame.vars.size === 0) {
    return <p className="text-muted-foreground">{t("view.noVariables")}</p>;
  }
  return (
    <dl className="grid w-fit grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {[...frame.vars].map(([name, value]) => (
        <div key={name} className="contents" data-testid="data-row" data-name={name}>
          <dt className="font-mono font-medium">{name}</dt>
          <dd>
            <InlineValue value={value} heap={state.heap} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
