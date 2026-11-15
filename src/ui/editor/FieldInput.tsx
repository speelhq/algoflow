// The application's input as the block editor draws each field: only the field that has the
// keyboard draws the selection color's border and ring (`editor.md`, Block editor), and a field
// that Run or Submit led to keeps its red border while it has the keyboard (`editor.md`, Value
// line, Drafts).
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/ui/primitives/input";

export function FieldInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "focus-visible:border-selection focus-visible:ring-selection/30 aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}
