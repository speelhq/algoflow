---
paths:
  - "challenges/**"
  - "src/challenges/**"
---

# The challenges

Before you change a challenge or the judge, read
`docs/spec/challenges/challenges.md` and the curriculum in
`docs/spec/scope/scope.md`. Add a challenge with `/add-challenge`.

- Edit a challenge file line by line rather than rewriting it with
  `JSON.stringify`: oxfmt keeps a JSON object on one line only if it was
  already on one line.
- In a `ja` text, call each term by its word in `src/i18n/glossary.json`
  (`pages.md`, Catalogs).
