---
name: kb-check
description: Check the knowledge base for broken links and naming-convention violations, and report them.
disable-model-invocation: true
---

Audit the whole project and report. Change nothing; the report is the output. Conventions: `AGENTS.md`.

## Links

Collect every link: Markdown links `[..](target)` in all `.md` files, `relations[].to` in `tasks/*.yaml`, and attendee paths in `meetings/*.yaml`. Resolve each relative to its file. A link is **broken** when:

- the target file does not exist
- it points to `x.md` while only `x.ai.md` exists (fix: link the `.ai.md`)
- its `#L<n>` anchor exceeds the target's line count
- it is absolute or leaves the project

Skip external URLs (`http…`, `mailto:`).

## Naming

Flag every file that breaks a convention:

- filenames not lowercase kebab-case (except `AGENTS.md`)
- meeting files not matching `YYYY-MM-DD-<slug>.{yaml,prep.ai.md,notes.md,debrief.ai.md,summary.ai.md}`, or meeting phase files without a matching `.yaml`
- task files not matching `T-NNN-<slug>.{yaml,md,ai.md}`; task `.md`/`.ai.md` without a `.yaml`; `id` not matching the filename; duplicate IDs; `status` outside `proposed · backlog · todo · in-progress · waiting · done`; missing `title`
- `sources/docs/<slug>/` missing `extracted.md`, `index.ai.md` or `summary.ai.md`, or whose index `source` points to a missing original; originals with no `sources/docs/` folder
- `.md` files anywhere other than the places in the `AGENTS.md` folder map

## Report

Group findings by check, one line each: `path:line — problem — suggested fix`. End with the counts per group, or a single line saying the knowledge base is clean. Done when every file in the project has been visited by every check.
