// Every code whose message is `error.<code>` (`pages.md`, Messages): a diagnostic, a parse, or a
// runtime code.
import { DIAGNOSTIC_CODES, type DiagnosticCode } from "@/lang/types";
import { PARSE_CODES, type ParseError } from "@/python/parse";
import { RUNTIME_CODES, type RuntimeCode } from "@/runtime/types";

export type ErrorCode = DiagnosticCode | RuntimeCode | ParseError["code"];

export const ERROR_CODES: readonly ErrorCode[] = [
  ...new Set<ErrorCode>([...DIAGNOSTIC_CODES, ...RUNTIME_CODES, ...PARSE_CODES]),
];
