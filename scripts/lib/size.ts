// The size of a pull request (CLAUDE.md, Issues and pull requests): the lines it adds and deletes,
// without the files that `.gitattributes` marks `linguist-generated`, which GitHub's diff hides.

/** The most lines a pull request changes, unless the developer allows more in its issue. */
export const LIMIT = 2000;

/** One file that a diff changes, and its lines added and deleted; a binary file has none. */
export type FileChange = { path: string; added: number; deleted: number };

/** The files of `git diff --numstat -z`, each renamed file under its new path. */
export function parseNumstat(output: string): FileChange[] {
  const fields = output.split("\0");
  const files: FileChange[] = [];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i] ?? "";
    if (field === "") continue;
    const [added = "", deleted = "", path = ""] = field.split("\t");
    // A rename leaves its path empty, and its old and new paths are the next two fields.
    let named = path;
    if (path === "") {
      named = fields[i + 2] ?? "";
      i += 2;
    }
    files.push({
      path: named,
      added: added === "-" ? 0 : Number(added),
      deleted: deleted === "-" ? 0 : Number(deleted),
    });
  }
  return files;
}

/** The paths that `git check-attr -z linguist-generated` marks as generated. */
export function parseGeneratedPaths(output: string): Set<string> {
  const fields = output.split("\0");
  const generated = new Set<string>();
  for (let i = 0; i + 2 < fields.length; i += 3) {
    const value = fields[i + 2];
    if (value === "set" || value === "true") generated.add(fields[i] ?? "");
  }
  return generated;
}

/** The lines that `files` change, and how many files count and how many are left out. */
export function countLines(
  files: readonly FileChange[],
  generated: ReadonlySet<string>,
): { lines: number; counted: number; leftOut: number } {
  const counted = files.filter((file) => !generated.has(file.path));
  const lines = counted.reduce((sum, file) => sum + file.added + file.deleted, 0);
  return { lines, counted: counted.length, leftOut: files.length - counted.length };
}
