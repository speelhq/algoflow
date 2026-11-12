# Parser

The parser reads one Python expression as an `Expr`. The emitter's
`unparse` writes an `Expr` back as text (`emitter.md`). This file states the
grammar the parser reads, how it reads a call, what it reads before a
caret, the errors it reports, and the round trip between the parser and
the emitter.

## Grammar

`parse` reads one expression, or reports a parse error:

`parse(text): Expr | ParseError`

Whether a text parses depends only on the text and the registry, never
on the program, so an edit elsewhere never turns a draft into a value or
a value into a draft (`language.md`, Expressions, Drafts).

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

The parser reads the text of an `exprs` slot as `args`: its values
separated by commas (`language.md`, Expressions, Drafts).

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

A construct whose block definition isn't in the registry gives
`E_PARSE_SYNTAX` at its token, so the registry alone determines what the
language accepts. The parser rejects such a construct at its token because
a grammar-legal form whose block definition isn't registered would
otherwise fail later, in `unparse`, `validate`, or `run`, with an error
that names an unknown block definition instead of a diagnostic. For
example: `[1, 2]` and `xs[i]` parse only while their block definitions
are registered.

The parser reads no Python statement, for three reasons:

- A learner who can type Python doesn't need blocks.
- The `Python` tab (`pages.md`, Panel, Python tab) is the way from blocks
  to text.
- The block language is a strict subset of Python, so most pasted
  Python would fail without a clear diagnostic.

## Calls

This section states how the parser reads a call.

The parser reads `NAME(...)` by the form of `NAME` (`language.md`,
Identifiers), whatever the program defines:

- a class name: a `new` of that class
- any other name: the builtin's call when `NAME` names a builtin, and
  otherwise a call of the program's function `NAME`

`validate()` resolves the call or the `new` (`language.md`, Scope,
Resolving a call), and reports a name that resolves to nothing as
`E_UNKNOWN_CALL`.

The parser resolves `a.b(...)` to one of two things:

- a method in `blocks.md`
- the builtin that declares `a.b` as an alias (`blocks.md`, The block
  definition). For example: `random.randint`.

An `a.b(...)` that is neither gives `E_UNKNOWN_CALL`.

## Reading before a caret

This section states what the parser reads in the text before a caret,
which a value line's lists and its explanation line read (`editor.md`,
Value list; Explanation line).

`readBefore(text): CaretReading` reads a text that ends at the caret:

- whether the caret is inside a text: the text holds a `"` or `'` that no
  matching quote closes
- the innermost parenthesis or bracket still open, where the caret's text
  starts
- whether a value is expected: the text since that parenthesis or bracket
  is empty or ends with an operator or a `,`
- the expression that ends at the caret: the largest expression that the
  text since that parenthesis or bracket ends with
- the value just before the caret: the largest expression that ends at the
  caret and binds as an atom (`blocks.md`, Notation, The form of an
  expression)
- the operation one of whose slots holds the caret, and that slot

The parser reads the operation from the text with an empty slot at the
caret where a value is expected, and with each parenthesis and bracket
still open closed. For example: in `dp[`, the caret is in the `index` slot
of `dp[]`.

The parser reads the largest expression that the text ends with, not the
whole text, because a text that fails to parse earlier on would then give
no value before the caret. For example: in `a b + c`, the expression that
ends at the caret is `b + c`.

Where the text ends with no expression and expects no value, no
expression ends at the caret. For example: `a.`.

## Errors

The parser reports one of three codes:

- `E_PARSE_CHAIN`: a chained comparison
- `E_PARSE_SYNTAX`: any other syntax error
- `E_UNKNOWN_CALL`: an `a.b(...)` that names no method and no builtin's
  alias (Calls)

Each code carries `position`, where the parser stops, so a value line
underlines a draft's text from there (`editor.md`, Value line, Drafts).

## Round trip

This section states that the parser reads back what the emitter
writes.

For an expression `e` that is no draft (`language.md`, Expressions,
Drafts), `parse(unparse(e))` is `e` apart from each `NodeId`, so
`unparse(parse(s))` is a fixed point of `unparse ∘ parse`.

The round trip compares expressions, not texts, because only the
expression shows a lost meaning. For example: `a - (b - c)` written as
`a - b - c` parses and writes back unchanged.

## Verification

- A property test generates 1,000 expressions and checks the round trip
  (Round trip) on each.
- Each parse error code has a test.
