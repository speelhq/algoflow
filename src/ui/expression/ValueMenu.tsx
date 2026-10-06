// An expression slot's menu, for the chip it is open on: one field taking a number, a quoted
// text, or letters that filter the items below; a template row (the condition templates for a
// condition slot, else the visible variables and the values); the groups of U-52; and
// `Type as text`, which parses the slot's text on Enter or blur.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { errorText, t, type MessageKey } from "@/i18n/t";
import type { Expr, Id, Program } from "@/lang/types";
import { cn } from "@/lib/utils";
import { isParseError } from "@/python/parse";
import { unparse } from "@/python/emit";
import { Button } from "@/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu";
import { Input } from "@/ui/primitives/input";
import {
  filterItems,
  GROUPS,
  menuItems,
  parseText,
  templateItems,
  typedItem,
  variableItems,
  valueItems,
  type Item,
} from "./items";

type Props = {
  program: Program;
  /** The whole expression of the slot, which `Type as text` edits. */
  root: Expr;
  /** The names visible at the statement, the latest first. */
  visible: readonly Id[];
  /** The slot is a branch's or a loop's condition: the row offers the condition templates. */
  condition: boolean;
  /** An item chosen for the chip: it wraps or replaces the chip. */
  choose: (item: Item) => void;
  /** A template chosen: it replaces the chip. */
  template: (make: () => Expr) => void;
  /** Typed text parsed: it replaces the slot's whole expression. */
  typed: (expr: Expr) => void;
};

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

const pill =
  "inline-flex h-7 cursor-pointer items-center rounded-full border px-2.5 text-sm whitespace-nowrap hover:bg-muted";

function TextMode({ program, root, typed }: Pick<Props, "program" | "root" | "typed">) {
  const [text, setText] = useState(root.kind === "empty" ? "" : unparse(root));
  const [error, setError] = useState<{ position: number; message: string } | null>(null);
  const commit = () => {
    const result = parseText(text, program);
    if (isParseError(result)) {
      setError({
        position: result.position,
        message: errorText({
          code: result.code,
          params: { position: result.position, ...result.params },
        }),
      });
      return;
    }
    setError(null);
    typed(result);
  };
  return (
    <div className="flex flex-col gap-1">
      <Input
        value={text}
        aria-label={t("editor.typeAsText")}
        aria-invalid={error !== null}
        className="font-mono"
        data-testid="type-as-text"
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      {error && (
        <>
          <div className="font-mono text-xs whitespace-pre" aria-hidden>
            <span className="invisible">{text.slice(0, error.position)}</span>
            <span className="underline decoration-destructive decoration-wavy">
              {text.slice(error.position) || " "}
            </span>
          </div>
          <p className="text-xs text-destructive" role="alert">
            {error.message}
          </p>
        </>
      )}
    </div>
  );
}

export function ValueMenu(props: Props) {
  const { program, visible, condition, choose, template } = props;
  const [query, setQuery] = useState("");
  const [asText, setAsText] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // The menu opens with its field ready for typing.
  useEffect(() => field.current?.focus(), []);
  const items = useMemo(() => menuItems(program, visible), [program, visible]);
  const typedNow = typedItem(query);
  const letters = /^[A-Za-z_]/.test(query.trim());
  const filtered = letters ? filterItems(items, query) : [];

  const fill = (text: string) => {
    setQuery(text);
    field.current?.focus();
  };
  const pick = () => {
    if (typedNow) choose(typedNow);
    else if (filtered[0]) choose(filtered[0]);
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-selection/60 p-2"
      data-testid="value-menu"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tracking-wide text-muted-foreground uppercase">
          {t(asText ? "editor.typeAsText" : "editor.value")}
        </span>
        <Button variant="ghost" size="sm" aria-pressed={asText} onClick={() => setAsText(!asText)}>
          {t(asText ? "editor.showChips" : "editor.typeAsText")}
        </Button>
      </div>
      {asText ? (
        <TextMode program={program} root={props.root} typed={props.typed} />
      ) : (
        <>
          <Input
            ref={field}
            value={query}
            placeholder={t("editor.field")}
            aria-label={t("editor.field")}
            data-testid="value-field"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                pick();
              }
            }}
          />
          {typedNow && (
            <button
              type="button"
              className="flex items-center justify-between rounded-md bg-selection/10 px-2 py-1 text-left"
              data-testid="typed-item"
              onClick={() => choose(typedNow)}
            >
              <span className="font-mono">{typedNow.label}</span>
              <span className="text-xs text-muted-foreground">
                {t(typedNow.id === "typed:text" ? "editor.text" : "editor.number")}
              </span>
            </button>
          )}
          {letters && (
            <div className="flex max-h-48 flex-col overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-2 text-muted-foreground">{t("editor.noItems")}</p>
              )}
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex items-center justify-between rounded-md px-2 py-1 text-left hover:bg-accent"
                  onClick={() => choose(item)}
                >
                  <span className="font-mono">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`editor.group.${item.group}` as MessageKey)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!letters && !typedNow && (
            <Row>
              {condition
                ? templateItems().map((item) => (
                    <button
                      key={item.template.name}
                      type="button"
                      className={pill}
                      data-template={item.template.name}
                      onClick={() => template(item.make)}
                    >
                      {t(item.template.key, { a: "□", b: "□" })}
                    </button>
                  ))
                : [
                    ...variableItems(visible).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(pill, "font-mono")}
                        onClick={() => choose(item)}
                      >
                        {item.label}
                      </button>
                    )),
                    <button key="number" type="button" className={pill} onClick={() => fill("0")}>
                      {t("editor.number")}
                    </button>,
                    <button key="text" type="button" className={pill} onClick={() => fill('"')}>
                      {t("editor.text")}
                    </button>,
                    ...valueItems()
                      .slice(0, 2)
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={pill}
                          onClick={() => choose(item)}
                        >
                          {item.label}
                        </button>
                      )),
                  ]}
              <button type="button" className={pill} onClick={() => field.current?.focus()}>
                {t("editor.buildOwn")}
              </button>
            </Row>
          )}
          <Row>
            {GROUPS.map((group) => {
              const members = items.filter((item) => item.group === group);
              if (members.length === 0) return null;
              return (
                <DropdownMenu key={group}>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="sm" data-group={group} />}
                  >
                    {t("editor.groupMenu", { group: t(`editor.group.${group}` as MessageKey) })}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-auto min-w-40">
                    {members.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        className="font-mono"
                        onClick={() => choose(item)}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </Row>
        </>
      )}
    </div>
  );
}
