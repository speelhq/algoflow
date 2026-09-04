// U-61 Output: stdout, latest line highlighted.
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { useRun } from "@/store/run";

export function OutputTab() {
  const stdout = useRun((s) => s.stdout);
  if (stdout.length === 0) return <p className="text-muted-foreground">{t("view.noOutput")}</p>;
  return (
    <ol className="font-mono text-xs">
      {stdout.map((line, i) => (
        <li
          key={`${i}:${line}`}
          data-testid="output-line"
          className={cn("px-1 whitespace-pre", i === stdout.length - 1 && "bg-accent")}
        >
          {line}
        </li>
      ))}
    </ol>
  );
}
