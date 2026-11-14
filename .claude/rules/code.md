---
paths:
  - "src/**"
  - "scripts/**"
  - "e2e/**"
---

# The code

These rules hold for every file of `src`, `scripts`, and `e2e`, tests
included.

## Naming

A function whose name begins with one of these prefixes gives a caller
what the prefix says:

- `get…` returns the value and throws when there is none, unlike
  `Map.prototype.get`, so a caller never checks for `undefined`.
- `find…` returns the value or `undefined`, as `Array.prototype.find`
  does.
- `to…` returns the value in another form or type.
- `parse…` reads a value from a text.
- `is…` and `has…` return a boolean.
- `create…` returns a new node, id, or object at each call, as
  `document.createElement()` does.

A function that builds a new `Program`, node, or id begins with
`create`, because node ids are unique within a program (`language.md`,
Program), so a reader must see where a new one is made. A function that
reads one from a text begins with `parse` instead, and one that returns
a changed copy of a node, such as `insertStmt()`, is named for the
change.

A method, or a function in an object literal, may be named for what it
handles, without a verb or a prefix, such as `parser.or()`,
`writer.blank()`, and `ast.num()`. A name destructured from such an
object keeps the member's name. A member that implements an interface
of a library or the platform, such as a storage's `getItem()`, keeps
the interface's name.

A function that returns a boolean and changes nothing reads as a claim:
it begins with `is`, `has`, `can`, or `should`, or it says what
something does, as `includes()`, `startsWith()`, and `rectsOverlap()`
do. A function that changes something and returns whether it succeeded
begins with a verb, as `Set.prototype.delete()` does. A React hook
begins with `use`, whatever it returns. The function that evaluates a
comparison operator, such as `<`, is the one exception. It begins with
`evaluate`, because its boolean is the value of an expression, not an
answer about its arguments.

No function name is only an adjective, a participle, or a preposition,
such as `plain`, `kept`, or `under`, unless it is a method or a function
in an object literal named for what it handles, because such a name says
neither what a function does nor what it returns. A React component is
named for what it renders, such as `RunBar`.

No name that the code declares ends in `Of`, because the suffix says
neither whether a function can find nothing nor whether it makes
something new.

## Lint

`pnpm lint` treats every warning as an error. Fix the code, turn the rule
off in `.oxlintrc.json` with the reason beside it, or disable it for one
line with `// oxlint-disable-next-line <rule> -- <reason>`. The
`no-base-to-string` rule rejects `String(unknown)`.
