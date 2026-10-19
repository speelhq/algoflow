# Parser

Code: `src/python/parse.ts`, `number.ts`, `precedence.ts`. Tests:
`parse.test.ts`, `number.test.ts`.

`parse(text, scope): Expr | ParseError` reads one expression and
implements:

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

It reads no Python statement, because a learner who can type Python doesn't
need blocks, the `Python` tab (`pages.md`, Python tab) is the way from chart
to text, and because the block language is a strict subset, so most pasted
Python would fail without a clear diagnostic.

Number text that CPython rejects (`0777`) gives `E_PARSE_SYNTAX`, and `\xNN`
escapes are decoded. A construct whose block isn't in the registry gives
`E_PARSE_SYNTAX` at its token, so the registry alone determines what the
language accepts. The parser rejects such a construct at its token because a
grammar-legal form whose block isn't registered (`[1, 2]`, `xs[i]`) would
otherwise fail later in `unparse`, `validate`, or `run`, with an unknown-block
error instead of a diagnostic.

An int literal outside the int range (`language.md`, Run-time values), or a
float literal beyond the largest float, gives `E_PARSE_SYNTAX` at its
token. `migrate()` refuses such a literal in a stored program by the
parser's own rule. A float beyond the largest is refused because Python
reads it as `inf`, which stored JSON would write as `null`.

`NAME(...)` resolves in the order of `language.md`, Scope: a class or
function of the program, a learner module, a built-in module, then a
builtin in `blocks.md` (`random.randint` is accepted as an alias). A name
that none of these defines gives `E_UNKNOWN_CALL`.

`a.b(...)` resolves to a method in `blocks.md`. An `a.b(...)` whose `b` is
no method in `blocks.md` gives `E_UNKNOWN_CALL`.

A chained comparison gives `E_PARSE_CHAIN`, and any other syntax error
gives `E_PARSE_SYNTAX`. Both carry `position`.

`unparse` is the emitter's expression function.

For an expression `e` with no empty slot (`language.md`, Expressions),
`parse(unparse(e))`, with the scope of `e`'s program, is `e` apart from
node ids, so `unparse(parse(s))` is a fixed point of `parse ∘ unparse`. The
round trip compares expressions, not texts, because only the expression
shows a lost meaning: `a - (b - c)` written as `a - b - c` parses and
writes back unchanged.

## Verification

A property test generates 1,000 expressions and checks the round trip above
on each, and each parse error code has a test.
