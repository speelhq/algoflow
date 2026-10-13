// The one check for a JSON object; an array is not one. Dependency-free, so the
// scripts and the i18n catalog share it.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
