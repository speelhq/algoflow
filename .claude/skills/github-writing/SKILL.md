---
name: github-writing
description: Write or edit the text of a GitHub issue, pull request, or comment in this repository - the template's sections, the title, the Summary, the citations of the spec, Done when, and a pull request's body. Use whenever you file, edit, or comment on an issue, or write a pull request's title or body, including inside /issue and /milestone.
---

# Writing issues, pull requests, and comments

An issue's readers are the developer, who decides a `decision`, and
`/issue` and `/milestone`, which work from it. An issue holds only what
they need to decide and to start the work. It points at what the spec and
the code say rather than copying it, because a copy goes stale while the
issue waits. Write every text as `CLAUDE.md`, Writing, says.

## Issues

- Read the template for the issue's kind in `.github/ISSUE_TEMPLATE/`
  first, and give the body its sections. Its `about` line says when that
  kind applies, and its comments say what each section holds. No tool
  applies the template for you.
- Give the issue the template's label, and the milestone of the release
  that takes it, if any.
- Under a section that doesn't apply, write `None` and the reason, because
  a missing section looks forgotten. A section that its template marks as
  optional may be left out when it has nothing to hold.
- Title a problem to decide or fix as a sentence that states a fact ("The
  run bar has no Step over"). Title a task with the work it names ("Rename
  getChallenge to findChallenge"). Write the title in plain words, without
  code formatting or quotation marks.
- Write the Summary so that a reader understands it without reading the
  source. In the Summary, format as code only the names, values, and
  expressions that the issue is about, and quote nothing.
- When the work waits on open issues or pull requests, write one line,
  such as `Waits on #34 and #47.`, after the Summary's paragraph, and name
  them nowhere else, so a reader sees at once whether the issue can start.
- When the work is larger than one pull request (`CLAUDE.md`, Issues and
  pull requests), file a parent issue and one sub-issue for each pull
  request, and add each sub-issue to the parent.
- In the Spec section, cite and quote statements as
  `docs/spec/README.md`, Citations from outside the spec, says.
- In Observed, give the inputs, the actions or the command, and the
  output, so a reader can repeat it. Say so when a fact is read from the
  code rather than run.
- Point at code by its function and file. Give a line number only inside
  pasted output or in a link pinned to a commit, because lines move with
  every edit.
- Write the facts as they stand. Give history only when it tells a reader
  where to look.
- Write Done when as a list, one condition per item.
- When a fact changes, edit the body, and add a comment that says what
  changed, so the body stays the one place a reader reads.
- Record an idea for a learner's problem as an issue labeled `challenge`
  that names the study plan it joins. It gets no milestone until a release
  takes it.

## Pull requests

Title a pull request as a commit subject (`CLAUDE.md`, Issues and pull
requests). Open its body with one sentence on what it does, then fill in
each section of `.github/pull_request_template.md` as the section's
comment says.

Name an issue with a closing keyword only in the section Closes. A commit
message that names one closes the issue when a rebase merge puts the
commit on `develop`, so `pnpm commits` refuses it.
