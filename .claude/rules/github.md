---
paths:
  - ".github/ISSUE_TEMPLATE/**"
  - ".github/pull_request_template.md"
---

# Issues and pull requests

- Give an issue's body the sections of its kind's template. The template's
  `about` line says when that kind applies, and no tool applies the
  template for you.
- Give the issue the template's label, and the milestone of the release
  that takes it, if any.
- Under a section that doesn't apply, write `None` and the reason, because a
  missing section looks forgotten.
- Title a problem to decide or fix as a statement of fact ("The run bar has
  no Step over"). Title a task with the work it names ("Rename getChallenge
  to findChallenge"). Write the title in plain words, without code
  formatting or quotation marks. Write the Summary so that a reader
  understands it without reading the source. In the Summary, format as code
  only the names, values, and expressions that the issue is about, and quote
  nothing.
- In the Spec section, quote each statement with its file and heading.
- Record an idea for a learner's problem as an issue labeled `challenge`
  that names the study plan it joins. It gets no milestone until a release
  takes it.
- Write a pull request's body from `.github/pull_request_template.md`
  (`/issue`, Finish).
