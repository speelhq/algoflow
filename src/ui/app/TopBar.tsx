// U-02: app name, editable title, challenge selector, undo, redo, save status,
// Export, Import, Help, JA/EN. Program-dependent controls are placeholders until M-02/M-03;
// the language switch becomes functional in M-06 (S-03).
import { Redo2Icon, Undo2Icon } from "lucide-react";
import { getLocale, LOCALES, t } from "@/i18n/t";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";

const FREE_MODE = "free";

export function TopBar() {
  const locale = getLocale();
  const challenges = [{ value: FREE_MODE, label: t("app.freeMode") }];

  return (
    <header
      data-testid="top-bar"
      className="flex h-12 items-center gap-2 border-b border-border bg-background px-3"
    >
      <span className="text-sm font-semibold tracking-tight">{t("app.name")}</span>

      <Input
        aria-label={t("app.titlePlaceholder")}
        placeholder={t("app.titlePlaceholder")}
        className="w-56"
      />

      <Select items={challenges} defaultValue={FREE_MODE}>
        <SelectTrigger aria-label={t("app.challenge")} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {challenges.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" aria-label={t("app.undo")} disabled>
        <Undo2Icon />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t("app.redo")} disabled>
        <Redo2Icon />
      </Button>
      <span data-testid="save-status" className="text-xs text-muted-foreground">
        {t("app.saved")}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm">
          {t("app.export")}
        </Button>
        <Button variant="outline" size="sm">
          {t("app.import")}
        </Button>
        <Button variant="ghost" size="sm">
          {t("app.help")}
        </Button>
        <fieldset
          aria-label={t("app.language.label")}
          className="ml-2 flex overflow-hidden rounded-lg border border-border"
        >
          {LOCALES.map((code) => (
            <Button
              key={code}
              variant={locale === code ? "secondary" : "ghost"}
              size="xs"
              className="rounded-none"
              aria-pressed={locale === code}
              disabled={code !== "en"}
            >
              {t(`app.language.${code}`)}
            </Button>
          ))}
        </fieldset>
      </div>
    </header>
  );
}
