// An expression slot's menu, for the chip it is open on: one field taking a number, a quoted
// text, or letters that filter the items below; a template row (the condition templates for a
// condition slot, else the visible variables and the values); and the groups of blocks.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { t, type MessageKey } from "@/i18n/t";
import type { Expr, Id, Program } from "@/lang/types";
import { cn } from "@/lib/utils";
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
  templateItems,
  typedItem,
  variableItems,
  valueItems,
  type Item,
} from "./items";

type Props = {
  program: Program;
  /** The names visible at the statement, the latest first. */
  visible: readonly Id[];
  /** The slot is a branch's or a loop's condition: the row offers the condition templates. */
  condition: boolean;
  /** An item chosen for the chip: it wraps or replaces the chip. */
  choose: (item: Item) => void;
  /** A template chosen: it replaces the chip. */
  template: (make: () => Expr) => void;
};

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

const pill =
  "inline-flex h-7 cursor-pointer items-center rounded-full border px-2.5 text-sm whitespace-nowrap hover:bg-muted";

export function ValueMenu(props: Props) {
  const { program, visible, condition, choose, template } = props;
  const [query, setQuery] = useState("");
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
                    {t(item.template.key, { a: t("editor.blank"), b: t("editor.blank") })}
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
                  {group === "values" && (
                    <>
                      <DropdownMenuItem onClick={() => fill("0")}>
                        {t("editor.number")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fill('"')}>
                        {t("editor.text")}
                      </DropdownMenuItem>
                    </>
                  )}
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
    </div>
  );
}
