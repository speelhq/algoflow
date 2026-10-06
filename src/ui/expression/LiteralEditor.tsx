// The value editor of an Input node's `Custom…`: the field of an expression slot's menu
// limited to literals (a number or a quoted text typed, `true`, `false`, `none`), and
// `Type as text`, which takes any literal the parser reads.
import { useEffect, useRef, useState } from "react";
import { errorText, t } from "@/i18n/t";
import type { Data, Expr } from "@/lang/types";
import { isParseError, parse } from "@/python/parse";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { typedItem, valueItems } from "./items";
import { literalData } from "./literal";

type Props = { name: string; choose: (value: Data) => void };

export function LiteralEditor({ name, choose }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);

  const take = (expr: Expr | undefined) => {
    const value = expr ? literalData(expr) : undefined;
    if (value === undefined) setError(t("editor.notLiteral"));
    else choose(value);
  };
  const commit = () => {
    const typed = typedItem(text);
    if (typed) return take(typed.make());
    const parsed = parse(text);
    if (isParseError(parsed)) {
      setError(
        errorText({ code: parsed.code, params: { position: parsed.position, ...parsed.params } }),
      );
      return;
    }
    take(parsed);
  };

  return (
    <div className="flex flex-col gap-2" data-testid="custom-editor">
      <span className="text-sm font-medium">{t("chart.customFor", { name })}</span>
      <Input
        ref={field}
        value={text}
        placeholder={t("editor.literal")}
        aria-label={t("editor.literal")}
        data-testid="custom-field"
        className="font-mono"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {valueItems().map((item) => (
          <Button key={item.id} variant="outline" size="sm" onClick={() => take(item.make())}>
            {item.label}
          </Button>
        ))}
        <Button size="sm" className="ml-auto" onClick={commit}>
          {t("editor.useValue")}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
