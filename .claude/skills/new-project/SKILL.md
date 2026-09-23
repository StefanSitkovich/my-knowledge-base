---
name: new-project
description: Create a new client project knowledge base repo from template/.
disable-model-invocation: true
argument-hint: <target-path>
---

Scaffold a knowledge-base repo for one client project. Run from the tool repo root; `template/` is copied verbatim.

## 1. Inputs

Settle with the human, asking only for what the argument leaves open:

- **target path** — must not exist, or be an empty folder. Otherwise stop.
- **name** — the project name (`ACME ERP rollout`)
- **client** — the client organisation
- **language** — the client's language for project content (`German`, `English`, …)

## 2. Copy and fill

1. Copy all of `template/` (including dot folders `.claude/`, `.kb/`) into the target: `cp -r template/. "<target>/"`.
2. In `<target>/AGENTS.md`, replace `{{name}}`, `{{client}}`, `{{language}}`.
3. In `<target>/.kb/project.yaml`, replace `{{tool_version}}` with `git rev-parse --short HEAD` of the tool repo (append `-dirty` if `git status --porcelain template` is non-empty) and `{{created}}` with today's date.
4. Check no `{{` remains anywhere in the target (`grep -r "{{" "<target>"`).

## 3. Repository

In the target: `git init`, `git add -A`, `git commit -m "Scaffold knowledge base for <name>"`. No remote.

Report the path and tell the human to open Claude Code in it. Two user-level skills must be installed for its skills to work: `parse` (for `/ingest-doc`) and `grilling` (for `/debrief`); check `~/.claude/skills/` and warn if either is missing.
