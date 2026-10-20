---
paths:
  - ".github/ISSUE_TEMPLATE/**"
  - ".github/pull_request_template.md"
---

# Issues and pull requests

An issue's readers are the developer, who decides a `decision`, and
`/issue` and `/milestone`, which work from it. An issue holds only what they
need to decide and to start the work. It points at what the spec and the
code say rather than copying it, because a copy goes stale while the issue
waits.

- Give an issue's body the sections of its kind's template. The template's
  `about` line says when that kind applies, and no tool applies the
  template for you.
- Give the issue the template's label, and the milestone of the release
  that takes it, if any.
- Under a section that doesn't apply, write `None` and the reason, because a
  missing section looks forgotten. A section that its template marks as
  optional may be left out when it has nothing to hold.
- Title a problem to decide or fix as a sentence that states a fact ("The
  run bar has no Step over"). Title a task with the work it names ("Rename
  getChallenge to findChallenge"). Write the title in plain words, without
  code formatting or quotation marks. Write the Summary so that a reader
  understands it without reading the source. In the Summary, format as code
  only the names, values, and expressions that the issue is about, and quote
  nothing.
- When the work waits on open issues or pull requests, write one line,
  such as `Waits on #34 and #47.`, after the Summary's paragraph, and name
  them nowhere else, so a reader sees at once whether the issue can start.
- In the Spec section, cite each statement the issue rests on by its file
  and heading (`docs/spec/README.md`, Statements). Quote only the part of a
  statement that a defect contradicts, the statements and recorded reasons
  that constrain a decision, and the statements that the work changes.
- In Observed, give the inputs, the actions or the command, and the output,
  so a reader can repeat it. Say so when a fact is read from the code
  rather than run.
- Point at code by its function and file. Give a line number only inside
  pasted output or in a link pinned to a commit, because lines move with
  every edit.
- Write the facts as they stand. Give history only when it tells a reader
  where to look.
- Write Done when as a list, one condition per item.
- When a fact changes, edit the body, and use a comment to record what
  changed, so the body stays the one place a reader reads.
- Record an idea for a learner's problem as an issue labeled `challenge`
  that names the study plan it joins. It gets no milestone until a release
  takes it.
- Write a pull request's body from `.github/pull_request_template.md`
  (`/issue`, Finish).
