// Every page sets the browser tab title to `<title> — AlgoFlow`.
import { useEffect } from "react";
import { t } from "@/i18n/t";

export function useTitle(title: string): void {
  useEffect(() => {
    document.title = t("app.title", { title });
  }, [title]);
}
