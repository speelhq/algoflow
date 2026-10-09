// The keyboard table and three lines describing the loop; no external links.
import { t } from "@/i18n/t";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

const LOOP = ["build", "run", "submit"] as const;
// Step over (Shift+→) joins the table with the action itself.
const KEYS = [
  "delete",
  "undo",
  "duplicate",
  "run",
  "step",
  "skip",
  "escape",
  "tab",
  "highlight",
  "caret",
  "enter",
] as const;

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function HelpDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl" data-testid="help">
        <DialogHeader>
          <DialogTitle>{t("app.help.title")}</DialogTitle>
        </DialogHeader>
        <ol className="list-decimal space-y-1 pl-5">
          {LOOP.map((line) => (
            <li key={line}>{t(`app.help.loop.${line}`)}</li>
          ))}
        </ol>
        <table className="w-full text-left">
          <caption className="pb-2 text-left font-medium">{t("app.help.keysTitle")}</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-normal">{t("app.help.keysColumn")}</th>
              <th className="py-1 font-normal">{t("app.help.actionColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {KEYS.map((key) => (
              <tr key={key} className="border-t">
                <td className="py-1 pr-4 font-mono text-xs whitespace-nowrap">
                  {t(`app.help.keys.${key}.keys`)}
                </td>
                <td className="py-1">{t(`app.help.keys.${key}.action`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("app.help.close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
