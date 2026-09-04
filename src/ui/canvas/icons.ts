// U-32: the card icon is the block's category icon (M-02); U-11 may refine this per block.
import {
  BoxIcon,
  BracesIcon,
  CalculatorIcon,
  EqualIcon,
  ListIcon,
  RepeatIcon,
  SquareFunctionIcon,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/nodes/categories";

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  basic: EqualIcon,
  list: ListIcon,
  control: RepeatIcon,
  function: SquareFunctionIcon,
  dict: BracesIcon,
  class: BoxIcon,
  math: CalculatorIcon,
};
