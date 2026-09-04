// U-33: a connector before the first card, between cards, and after the last card.
// Connectors gain drop and click behaviour in M-03 (U-12); here they only mark the spots.
import { PlusIcon } from "lucide-react";
import { Fragment } from "react";
import { t } from "@/i18n/t";
import type { NodeId, Stmt } from "@/lang/types";
import { Card } from "./Card";

function Connector() {
  return (
    <li className="flex h-4 items-center pl-3">
      <button
        type="button"
        aria-label={t("canvas.connector")}
        data-testid="connector"
        disabled
        className="flex size-4 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
      >
        <PlusIcon className="size-3" />
      </button>
    </li>
  );
}

export function Region({ stmts, creates }: { stmts: Stmt[]; creates: Set<NodeId> }) {
  return (
    <ol className="flex flex-col">
      <Connector />
      {stmts.map((stmt) => (
        <Fragment key={stmt.id}>
          <Card stmt={stmt} creates={creates} />
          <Connector />
        </Fragment>
      ))}
    </ol>
  );
}
