// The Playground page: under the header a card with `Import…` and `New`, then one row per
// Playground program, the last edited first; `Delete` asks first, in a dialog.
import { useRef, useState } from "react";
import { getLocale, t } from "@/i18n/t";
import {
  createPlaygroundProgram,
  deletePlaygroundProgram,
  emptyProgram,
  storedTitle,
} from "@/store/program";
import { playgroundRows, type PlaygroundRow } from "@/store/playground";
import { Header } from "@/ui/app/Header";
import { navigate, routeHash } from "@/ui/app/route";
import { importedProgram } from "@/ui/editor/programs";
import { useTitle } from "@/ui/hooks/useTitle";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

const rows = () => playgroundRows(storedTitle);

function edited(time: number): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(
    time,
  );
}

export function PlaygroundPage() {
  useTitle(t("playground.title"));
  const [list, setList] = useState<PlaygroundRow[]>(rows);
  const [doomed, setDoomed] = useState<PlaygroundRow | null>(null);
  const [failed, setFailed] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const create = () => {
    const id = createPlaygroundProgram(emptyProgram(t("playground.untitled")));
    navigate({ page: "program", id });
  };
  const load = async (picked: File | undefined) => {
    if (!picked) return;
    const program = importedProgram(await picked.text());
    setFailed(program === undefined);
    if (program) {
      createPlaygroundProgram(program);
      setList(rows());
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Header current="playground" />
      <main className="flex-1 overflow-y-auto px-6 py-4" data-testid="playground">
        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold">{t("playground.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("playground.description")}</p>
          </div>
          <Button variant="outline" onClick={() => file.current?.click()}>
            {t("playground.import")}
          </Button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            className="hidden"
            data-testid="import-file"
            onChange={(event) => {
              void load(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button onClick={create}>{t("playground.new")}</Button>
        </div>
        {failed && (
          <p role="alert" className="mt-3 text-destructive">
            {t("playground.importFailed")}
          </p>
        )}
        {list.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{t("playground.empty")}</p>
        ) : (
          <ul aria-label={t("playground.rows")} className="mt-2" data-testid="playground-rows">
            {list.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[1fr_14rem_auto] items-center gap-3 border-b px-3 py-1.5"
                data-testid="playground-row"
              >
                <a
                  href={routeHash({ page: "program", id: row.id })}
                  className="truncate hover:underline"
                >
                  {row.title || t("playground.untitled")}
                </a>
                <span className="text-sm text-muted-foreground">{edited(row.edited)}</span>
                <Button variant="outline" size="sm" onClick={() => setDoomed(row)}>
                  {t("playground.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Dialog open={doomed !== null} onOpenChange={(open) => !open && setDoomed(null)}>
        <DialogContent showCloseButton={false} data-testid="delete-dialog">
          <DialogHeader>
            <DialogTitle>
              {t("playground.deleteTitle", { title: doomed?.title || t("playground.untitled") })}
            </DialogTitle>
            <DialogDescription>{t("playground.deleteText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDoomed(null)}>
              {t("playground.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (doomed) deletePlaygroundProgram(doomed.id);
                setDoomed(null);
                setList(rows());
              }}
            >
              {t("playground.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
