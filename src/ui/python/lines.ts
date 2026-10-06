// U-25: which statement each emitted line belongs to, and which lines a statement covers.
import type { NodeId } from "@/lang/types";
import type { LineMap } from "@/python/emit";

/** Line → the innermost statement whose range holds it (E-01 ranges nest). */
export function lineOwners(map: LineMap): Map<number, NodeId> {
  const owners = new Map<number, { id: NodeId; span: number }>();
  for (const [id, { start, end }] of Object.entries(map)) {
    const span = end - start;
    for (let line = start; line <= end; line += 1) {
      const held = owners.get(line);
      if (!held || span < held.span) owners.set(line, { id, span });
    }
  }
  return new Map([...owners].map(([line, { id }]) => [line, id]));
}

/** The lines of `id`, as a set; empty for an id with no line. */
export function linesOf(map: LineMap, id: NodeId | null): Set<number> {
  const range = id === null ? undefined : map[id];
  const lines = new Set<number>();
  if (range) for (let line = range.start; line <= range.end; line += 1) lines.add(line);
  return lines;
}
