# Parser

The parser reads one Python expression as an `Expr`. The emitter's
`unparse` writes an `Expr` back as text (`emitter.md`). This file states the
grammar the parser reads, how it resolves a call, the errors it reports,
and the round trip between the parser and the emitter.

Code: `src/python/parse.ts`, `number.ts`, `precedence.ts`. Tests:
`parse.test.ts`, `number.test.ts`.

## Grammar

`parse` reads one expression, or reports a parse error:

`parse(text, scope): Expr | ParseError`

The parser reads this grammar:

```
expr     := or
or       := and ("or" and)*
and      := not ("and" not)*
not      := "not" not | cmp
cmp      := arith (("==" | "!=" | "<" | "<=" | ">" | ">=" | "in") arith)?
arith    := term (("+" | "-") term)*
term     := factor (("*" | "/" | "//" | "%") factor)*
factor   := "-" factor | power
power    := postfix ("**" factor)?
postfix  := atom ("[" expr "]" | "." NAME | "." NAME "(" args ")" | "(" args ")")*
atom     := NUMBER | STRING | "True" | "False" | "None" | NAME
          | "[" args "]" | "{" (expr ":" expr ("," expr ":" expr)*)? "}" | "(" expr ")"
args     := (expr ("," expr)*)?
```

In a string, the parser decodes `\xNN` escapes.

A number literal that CPython rejects gives `E_PARSE_SYNTAX`. For
example: `0777`.

An int literal outside the int range (`language.md`, Run-time values,
Int range), or a float literal beyond the largest float, gives
`E_PARSE_SYNTAX` at its token. The parser rejects a float literal
beyond the largest float because Python reads it as `inf`, which the
JSON of a stored program would hold as `null`.

In a stored program, `migrate()` rejects an int literal outside the int
range, or a float literal beyond the largest float, by the parser's own
rule (`language.md`, Data, Faults that `migrate()` rejects).

A construct whose block isn't in the registry gives `E_PARSE_SYNTAX` at
its token, so the registry alone determines what the language accepts.
For example: `[1, 2]` and `xs[i]` parse only while their blocks are
registered. The parser rejects such a construct at its token because a
grammar-legal form whose block isn't registered would otherwise fail
later, in `unparse`, `validate`, or `run`, with an unknown-block error
instead of a diagnostic.

The parser reads no Python statement, for three reasons:

- A learner who can type Python doesn't need blocks.
- The `Python` tab (`pages.md`, Panel, Python tab) is the way from chart
  to text.
- The block language is a strict subset of Python, so most pasted
  Python would fail without a clear diagnostic.

## Calls

This section states how the parser resolves a call.

The parser resolves `NAME(...)` in the order of `language.md`, Scope,
Resolving a call:

1. a function or class of the program
2. a learner module
3. a built-in module
4. a builtin of `blocks.md`

A name that none of these defines gives `E_UNKNOWN_CALL`.

The parser resolves `a.b(...)` to one of two things:

- a method in `blocks.md`
- the builtin that declares `a.b` as an alias (`blocks.md`, The block
  definition). For example: `random.randint`.

An `a.b(...)` that is neither gives `E_UNKNOWN_CALL`.

## Errors

The parser reports one of three codes:

- `E_PARSE_CHAIN`: a chained comparison
- `E_PARSE_SYNTAX`: any other syntax error
- `E_UNKNOWN_CALL`: a call that resolves to nothing (Calls)

`E_PARSE_SYNTAX` and `E_PARSE_CHAIN` carry `position`.

## Round trip

This section states that the parser reads back what the emitter
writes.

For an expression `e` with no empty slot (`language.md`, Expressions,
Empty slots), `parse(unparse(e))` in the scope of `e`'s program is `e`
apart from each `NodeId`, so `unparse(parse(s))` is a fixed point of
`parse ∘ unparse`.

The round trip compares expressions, not texts, because only the
expression shows a lost meaning. For example: `a - (b - c)` written as
`a - b - c` parses and writes back unchanged.

## Verification

- A property test generates 1,000 expressions and checks the round trip
  (Round trip) on each.
- Each parse error code has a test.
