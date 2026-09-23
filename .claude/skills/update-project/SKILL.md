---
name: update-project
description: Update an existing project knowledge base with the current template/.claude (skills, hook, settings).
disable-model-invocation: true
argument-hint: <project-path>
---

Bring one project's tooling up to date with this tool repo. Run from the tool repo root. Only `.claude/` tooling and `tool_version` change; project content is never touched.

1. **Check the target** — `<project>/.kb/project.yaml` must exist; otherwise stop, it is not a knowledge-base project. `git status --porcelain` in the project must be clean; otherwise stop and ask the human to commit first.
2. **Diff** — compare `template/.claude/` with `<project>/.claude/`, ignoring `settings.local.json`. Show the human the changed, added and removed files. A file removed from the template is removed from the project only if it lives under `.claude/skills/` or `.claude/hooks/`.
   - If the project's `.claude/settings.json` differs from the template in ways the template doesn't explain (project-specific additions), merge rather than overwrite and show the merged result.
3. **Apply** — copy the files, then set `tool_version` in `<project>/.kb/project.yaml` to `git rev-parse --short HEAD` of the tool repo (append `-dirty` if `git status --porcelain template` is non-empty). Leave `created` and all other files alone.
4. **Commit** in the project: `git add .claude .kb && git commit -m "Update KB tooling to <tool_version>"`.

Report the old and new `tool_version` and the files changed. If nothing differed, say so and commit nothing.
