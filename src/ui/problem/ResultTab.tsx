// U-23: the `Result` tab. Before any run it shows `result.empty`; the case selector, the
// variables, and the output rows arrive with run mode.
import { t } from "@/i18n/t";

export function ResultTab() {
  return <p className="text-muted-foreground">{t("result.empty")}</p>;
}
