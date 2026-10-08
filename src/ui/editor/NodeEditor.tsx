// The node editor: a popover anchored to the selected node, showing the block's sentence with
// its slots editable in place (names as inputs with a suggestion row, expressions as chips
// with their menu, lists with add and remove, texts as inputs), the node's diagnostics with
// their fixes, the block's help, and `Duplicate` and `Delete`. Reads slot roles, never a kind.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getChallenge } from "@/challenges";
import { errorText, t } from "@/i18n/t";
import { duplicateStmt, hoistAssign, removeItem, removeStmt, setExpr, setSlot } from "@/lang/edit";
import { newId } from "@/lang/id";
import { visibleAt } from "@/lang/scope";
import type { Diagnostic, Expr, NodeId, Program, Stmt, Target } from "@/lang/types";
import { validate } from "@/lang/validate";
import { isExpr, nodesById, ownerStmts } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { getNode, keyOf } from "@/nodes";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { nodeText, templateOf } from "@/ui/chart/text";
import { ChipView, type ChipActions } from "@/ui/expression/ChipView";
import { emptyChip, replaceChip, unwrapChip } from "@/ui/expression/chips";
import { firstEmpty, placeItem, type Item } from "@/ui/expression/items";
import { matchTemplate } from "@/ui/expression/templates";
import { ValueMenu } from "@/ui/expression/ValueMenu";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Popover, PopoverTrigger } from "@/ui/primitives/popover";
import { apply } from "./edits";
import { nameChars, nameSuggestions } from "./names";

type Bag = Record<string, unknown>;

/** The diagnostics nodes show, by statement: no empty slot, whose placeholder is its mark. */
export function flaggedStatements(program: Program): Map<NodeId, Diagnostic[]> {
  const owners = ownerStmts(program);
  const flagged = new Map<NodeId, Diagnostic[]>();
  for (const d of validate(program)) {
    if (d.code === "E_EMPTY_SLOT") continue;
    const owner = owners.get(d.nodeId) ?? d.nodeId;
    flagged.set(owner, [...(flagged.get(owner) ?? []), d]);
  }
  return flagged;
}

/** The diagnostics node `id` shows. */
export function nodeDiagnostics(program: Program, id: NodeId): Diagnostic[] {
  return flaggedStatements(program).get(id) ?? [];
}

/** The same diagnostic in another validation of the program: same node, code, and params. */
function sameDiagnostic(a: Diagnostic, b: Diagnostic): boolean {
  return (
    a.nodeId === b.nodeId &&
    a.code === b.code &&
    JSON.stringify(a.params) === JSON.stringify(b.params)
  );
}

/** Applies a diagnostic's fix; only the fixes validation names exist. */
export function applyFix(diagnostic: Diagnostic): void {
  if (diagnostic.fix !== "hoistAssign") return;
  const { frame, name } = diagnostic.params;
  if (typeof frame === "string" && typeof name === "string") {
    apply((program) => hoistAssign(program, frame, name));
  }
}

/** A diagnostic's message, with the button applying its fix when it has one. */
export function DiagnosticMessage({ diagnostic }: { diagnostic: Diagnostic }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-2"
      role="alert"
    >
      <span className="flex-1 text-destructive">{errorText(diagnostic)}</span>
      {diagnostic.fix && (
        <Button size="sm" variant="outline" onClick={() => applyFix(diagnostic)}>
          {t(`editor.fix.${diagnostic.fix}` as "editor.fix.hoistAssign", diagnostic.params)}
        </Button>
      )}
    </div>
  );
}

/** The name in an `id` slot, or in a `target` slot holding a variable. */
function nameOf(stmt: Stmt, slot: string): string | undefined {
  const value = (stmt as unknown as Bag)[slot];
  if (typeof value === "string") return value;
  const target = value as Target | undefined;
  return target?.kind === "var" ? target.name : undefined;
}

function setName(program: Program, stmt: Stmt, slot: string, name: string): Program {
  const role = getNode(keyOf(stmt)).slots.find((s) => s.name === slot)?.role;
  return setSlot(program, stmt.id, slot, role === "target" ? { kind: "var", name } : name);
}

type Open = { chip: NodeId; root: NodeId; slot: string } | null;

function Body({
  stmt,
  program,
  initial,
}: {
  stmt: Stmt;
  program: Program;
  initial: string | null;
}) {
  const def = getNode(keyOf(stmt));
  const bag = stmt as unknown as Bag;
  const led = useEditor((s) => s.diagnostic);
  const select = useEditor((s) => s.select);
  const names = useRef<Record<string, HTMLInputElement | null>>({});

  // The slot clicked on the node opens with its menu: an expression's chip, or a name's input.
  const [open, setOpen] = useState<Open>(() => {
    if (initial === null) return null;
    const value = bag[initial];
    const first = Array.isArray(value) ? value.find(isExpr) : value;
    return isExpr(first) ? { chip: first.id, root: first.id, slot: initial } : null;
  });
  const [nameSlot, setNameSlot] = useState<string | null>(() => {
    const slot = def.slots.find((s) => s.name === initial);
    return slot?.role === "id" || slot?.role === "target" ? initial : null;
  });

  // A name slot clicked on the node takes the focus.
  useEffect(() => {
    if (initial !== null) names.current[initial]?.focus();
  }, [initial]);

  const visible = useMemo(() => visibleAt(program, stmt.id) ?? [], [program, stmt.id]);
  const nodes = nodesById(program);
  const challenge = getChallenge(program.challengeId);
  const asked = Object.keys(challenge?.tests[0]?.expect.variables ?? {});
  const suggestions = nameSuggestions(program, asked);
  const nameSlots = def.slots.filter(
    (slot) =>
      (slot.role === "id" || slot.role === "target") && nameOf(stmt, slot.name) !== undefined,
  );
  const suggestFor = nameSlot ?? nameSlots[0]?.name;
  // The diagnostic Run led to is shown while the program still has it, once.
  const diagnostics = nodeDiagnostics(program, stmt.id);
  const still = led ? validate(program).find((d) => sameDiagnostic(d, led)) : undefined;
  if (still && (ownerStmts(program).get(still.nodeId) ?? still.nodeId) === stmt.id) {
    if (!diagnostics.includes(still)) diagnostics.unshift(still);
  }

  const actions = (slot: string, root: Expr): ChipActions => ({
    open: open?.chip ?? null,
    choose: (expr) => setOpen({ chip: expr.id, root: root.id, slot }),
    remove: (expr) => apply((p) => emptyChip(p, expr.id)),
    unwrap: (expr) => apply((p) => unwrapChip(p, expr)),
  });

  const slotView = (slot: string, expr: Expr): ReactNode => {
    const matched = def.shape === "stmt" ? matchTemplate(expr) : undefined;
    if (!matched) return <ChipView expr={expr} actions={actions(slot, expr)} />;
    const sentence = t(matched.template.key);
    return (
      <span
        className="inline-flex flex-wrap items-center gap-1"
        data-slot-template={matched.template.name}
      >
        {sentence.split(/\{([ab])\}/).map((piece, i) => {
          // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
          if (piece === "a")
            return <ChipView key={i} expr={matched.a} actions={actions(slot, expr)} />;
          // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
          if (piece === "b")
            return <ChipView key={i} expr={matched.b} actions={actions(slot, expr)} />;
          return piece.trim() === "" ? null : (
            <button
              // oxlint-disable-next-line react/no-array-index-key -- pieces are positional
              key={i}
              type="button"
              className="cursor-pointer rounded px-0.5 hover:bg-muted"
              onClick={() => setOpen({ chip: expr.id, root: expr.id, slot })}
            >
              {piece.trim()}
            </button>
          );
        })}
      </span>
    );
  };

  const widget = (name: string): ReactNode => {
    const slot = def.slots.find((s) => s.name === name);
    if (!slot) return null;
    const value = bag[name];
    switch (slot.role) {
      case "id":
      case "target": {
        const current = nameOf(stmt, name);
        if (current === undefined) return null;
        return (
          <Input
            key={name}
            ref={(element) => {
              names.current[name] = element;
            }}
            value={current}
            aria-label={name}
            data-name-slot={name}
            className="h-8 w-32 font-mono"
            onFocus={() => setNameSlot(name)}
            onChange={(event) =>
              apply(
                (p) => setName(p, stmt, name, nameChars(event.target.value)),
                `${stmt.id}:${name}`,
              )
            }
          />
        );
      }
      case "text":
        return (
          <Input
            key={name}
            value={typeof value === "string" ? value : ""}
            aria-label={name}
            className="h-8 w-48"
            onChange={(event) =>
              apply((p) => setSlot(p, stmt.id, name, event.target.value), `${stmt.id}:${name}`)
            }
          />
        );
      case "expr":
        return isExpr(value) ? (
          <span key={name}>{slotView(name, value)}</span>
        ) : (
          <button
            key={name}
            type="button"
            className="h-7 rounded-full border border-dashed px-2.5 text-muted-foreground"
            onClick={() => {
              const empty: Expr = { id: newId(), kind: "empty" };
              if (apply((p) => setExpr(p, stmt.id, name, empty)))
                setOpen({ chip: empty.id, root: empty.id, slot: name });
            }}
          >
            {t("editor.addValue")}
          </button>
        );
      case "exprs": {
        const items = Array.isArray(value) ? value.filter(isExpr) : [];
        return (
          <span key={name} className="inline-flex flex-wrap items-center gap-1">
            {items.map((item, index) => (
              <span key={item.id} className="inline-flex items-center gap-0.5">
                {slotView(name, item)}
                <button
                  type="button"
                  aria-label={t("editor.removeValue")}
                  className="size-5 cursor-pointer rounded-full text-muted-foreground hover:bg-muted"
                  onClick={() => apply((p) => removeItem(p, stmt.id, name, index))}
                >
                  {t("editor.removeGlyph")}
                </button>
              </span>
            ))}
            <button
              type="button"
              className="h-7 cursor-pointer rounded-full border border-dashed px-2.5 text-sm text-muted-foreground hover:bg-muted"
              onClick={() => {
                const empty: Expr = { id: newId(), kind: "empty" };
                if (apply((p) => setExpr(p, stmt.id, name, empty)))
                  setOpen({ chip: empty.id, root: empty.id, slot: name });
              }}
            >
              {t("editor.addValue")}
            </button>
          </span>
        );
      }
      default:
        return null;
    }
  };

  const template = templateOf(stmt, program);
  const sentence: ReactNode[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    const text = template.slice(at, found.index).trim();
    if (text !== "") sentence.push(<span key={`t${at}`}>{text}</span>);
    sentence.push(widget(found[1] ?? ""));
    at = found.index + found[0].length;
  }
  const tail = template.slice(at).trim();
  if (tail !== "") sentence.push(<span key="tail">{tail}</span>);

  const chip = open ? nodes.get(open.chip) : undefined;
  const root = open ? nodes.get(open.root) : undefined;
  const conditionSlot =
    def.chart && ("branch" in def.chart || "check" in def.chart)
      ? def.slots.find((s) => s.role === "expr")?.name
      : undefined;

  const place = (expr: Expr, focus: Expr | null) => {
    if (!open) return;
    const at = open;
    if (!apply((p) => replaceChip(p, at.chip, expr))) return;
    const rootId = at.root === at.chip ? expr.id : at.root;
    if (focus) return setOpen({ chip: focus.id, root: rootId, slot: at.slot });
    // With the chip complete, the menu moves to the next empty slot of the same statement
    // slot: inside this expression, else in a later item of the slot's list.
    const placed = useProgram.getState().program;
    const nodes = nodesById(placed);
    const root = nodes.get(rootId);
    const inside = root && isExpr(root) ? firstEmpty(root) : undefined;
    if (inside) return setOpen({ chip: inside.id, root: rootId, slot: at.slot });
    const owner = nodes.get(stmt.id) as unknown as Bag | undefined;
    const items: unknown[] = Array.isArray(owner?.[at.slot]) ? (owner?.[at.slot] as unknown[]) : [];
    const later = items.slice(items.findIndex((item) => isExpr(item) && item.id === rootId) + 1);
    for (const item of later) {
      const empty = isExpr(item) ? firstEmpty(item) : undefined;
      if (empty && isExpr(item)) return setOpen({ chip: empty.id, root: item.id, slot: at.slot });
    }
    setOpen(null);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="node-editor" data-node={stmt.id}>
      {diagnostics.map((d, i) => (
        // oxlint-disable-next-line react/no-array-index-key -- diagnostics have no id of their own
        <DiagnosticMessage key={i} diagnostic={d} />
      ))}
      <div
        className="flex flex-wrap items-center gap-1.5 text-[0.95rem]"
        data-testid="editor-sentence"
      >
        {sentence}
      </div>
      {suggestFor !== undefined && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="name-suggestions">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            {t("editor.names")}
          </span>
          {suggestions.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  "h-7 cursor-pointer rounded-full border px-2.5 font-mono text-sm hover:bg-muted",
                  s.asked && "border-selection bg-selection/10",
                )}
                onClick={() => {
                  apply((p) => setName(p, stmt, suggestFor, s.name));
                  names.current[suggestFor]?.focus();
                }}
              >
                {s.name}
              </button>
              {s.asked && (
                <span className="text-xs text-muted-foreground">{t("editor.asked")}</span>
              )}
            </span>
          ))}
        </div>
      )}
      {open && chip && root && (
        <ValueMenu
          key={open.chip}
          program={program}
          visible={visible}
          condition={open.slot === conditionSlot && open.chip === open.root}
          choose={(item: Item) => {
            const placed = placeItem(item, chip as Expr);
            place(placed.expr, placed.focus);
          }}
          template={(make) => {
            const made = make();
            place(made, matchTemplate(made)?.a ?? null);
          }}
        />
      )}
      <p className="text-muted-foreground">{nodeText(def.key, "help")}</p>
      <div className="flex gap-2 border-t pt-3">
        <Button variant="outline" onClick={() => apply((p) => duplicateStmt(p, stmt.id))}>
          {t("editor.duplicate")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (apply((p) => removeStmt(p, stmt.id))) select(null);
          }}
        >
          {t("editor.delete")}
        </Button>
      </div>
    </div>
  );
}

/** The editor of statement `id`, anchored to the element it is rendered in. */
export function NodeEditor({ id }: { id: NodeId }) {
  const program = useProgram((s) => s.program);
  const slot = useEditor((s) => s.slot);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const [boundary, setBoundary] = useState<Element | null>(null);
  const node = nodesById(program).get(id);
  if (!node || !("kind" in node) || getNode(keyOf(node)).shape !== "stmt") return null;
  return (
    <Popover
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (details.reason === "escape-key") select(null);
        else closeEditor();
      }}
    >
      <PopoverTrigger
        render={
          <div
            ref={(element) => setBoundary(element?.closest("[data-chart-region]") ?? null)}
            className="pointer-events-none size-full"
            aria-hidden
          />
        }
      />
      {/* Beside the node and inside the chart region, so the panel's statement stays readable. */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="right"
          align="start"
          sideOffset={8}
          collisionBoundary={boundary ?? "clipping-ancestors"}
          collisionPadding={8}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            className="z-50 flex w-104 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
            aria-label={t("editor.label")}
            // Focus stays on the chart, so the editing keys act on the selected node.
            initialFocus={false}
            finalFocus={false}
          >
            <Body
              key={`${id}:${slot ?? ""}`}
              stmt={node as Stmt}
              program={program}
              initial={slot}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
