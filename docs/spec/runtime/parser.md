# Parser

Parser: `src/python/parse.ts`.

G-01 `parse(text, scope): Expr | ParseError` implements:

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

Number text CPython rejects
(`0777`) is `E_PARSE_SYNTAX`; `\xNN` escapes are decoded. A construct whose
block is not in the registry is `E_PARSE_SYNTAX` at its token, so the
registry alone determines what the language accepts.

G-02 `NAME(...)` resolves in the order of L-46: a class or function of the
program, a learner module, a built-in module, a builtin in `nodes.md`
(`math.exp`, `random.randint`, `random.uniform` accepted as aliases), else
`E_UNKNOWN_CALL`.

G-03 `a.b(...)` resolves to a method in `nodes.md`, else `E_UNKNOWN_CALL`.

G-04 Chained comparison → `E_PARSE_CHAIN`; other syntax errors →
`E_PARSE_SYNTAX`; both carry `position`.

G-05 `unparse` is the emitter's expression function;
`unparse(parse(s))` is a fixed point of `parse ∘ unparse` (G-06).

## Verification

G-06 A property test generates 1,000 expressions and checks G-05 on each.
