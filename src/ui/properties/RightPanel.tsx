// U-40: the form for the selected card arrives in M-03.
import { t } from "@/i18n/t";

export function RightPanel() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <h2 className="text-sm font-semibold">{t("props.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("props.empty")}</p>
    </div>
  );
}
