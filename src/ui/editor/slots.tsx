// The editable slot of the editor's notation other than a value line: `+ value`, which gives an
// optional slot a value.
import { t } from "@/i18n/t";

/** `+ value`: gives an optional slot a value. */
export function AddValue({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      className="h-7 cursor-pointer rounded-full border border-dashed px-2.5 font-sans text-muted-foreground hover:bg-muted"
      onClick={onAdd}
    >
      {t("editor.addValue")}
    </button>
  );
}
