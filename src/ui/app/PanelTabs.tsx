// One tab-strip chrome for the left panel (U-10), the canvas (U-30) and the bottom panel (U-61).
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs";

export function PanelTabs({ className, ...props }: ComponentProps<typeof Tabs>) {
  return <Tabs className={cn("h-full gap-0", className)} {...props} />;
}

export function PanelTabList({ className, ...props }: ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      variant="line"
      className={cn("w-full justify-start border-b border-border px-2", className)}
      {...props}
    />
  );
}

export function PanelTab({ className, ...props }: ComponentProps<typeof TabsTrigger>) {
  return <TabsTrigger className={cn("flex-none", className)} {...props} />;
}

export const PanelTabContent = TabsContent;
