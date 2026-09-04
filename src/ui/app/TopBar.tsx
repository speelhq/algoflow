// U-02: app name, title, challenge selector grouped by track plus Free mode, undo, redo,
// save status, Export, Import, Help, JA/EN. Undo/redo, title editing, Export, Import and
// Help arrive in M-03; the language switch in M-06 (S-03).
import { Redo2Icon, Undo2Icon } from "lucide-react";
import { challengesByTrack } from "@/challenges";
import { getLocale, LOCALES, t } from "@/i18n/t";
import { FREE, useProgram } from "@/store/program";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";

export function TopBar() {
  const locale = getLocale();
  const program = useProgram((s) => s.program);
  const load = useProgram((s) => s.load);
  const groups = challengesByTrack();
  const items = [
    { value: FREE, label: t("app.freeMode") },
    ...groups.flatMap((g) => g.challenges.map((c) => ({ value: c.id, label: c.title.en }))),
  ];

  return (
    <header
      data-testid="top-bar"
      className="flex h-12 items-center gap-2 border-b border-border bg-background px-3"
    >
      <span className="text-sm font-semibold tracking-tight">{t("app.name")}</span>

      <Input
        aria-label={t("app.titlePlaceholder")}
        placeholder={t("app.titlePlaceholder")}
        value={program.title}
        readOnly
        className="w-56"
      />

      <Select
        items={items}
        value={program.challengeId ?? FREE}
        onValueChange={(value) => {
          if (typeof value === "string") load(value);
        }}
      >
        <SelectTrigger aria-label={t("app.challenge")} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FREE}>{t("app.freeMode")}</SelectItem>
          {groups.map((group) => (
            <SelectGroup key={group.track}>
              <SelectLabel>{t(`challenge.track.${group.track}`)}</SelectLabel>
              {group.challenges.map((challenge) => (
                <SelectItem key={challenge.id} value={challenge.id}>
                  {challenge.title.en}
                </SelectItem>
              ))}
            </SelectGroup>
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
