# my-knowledge-base

A personal knowledge system for consulting on software implementation projects. Each client project is its own local git repo, scaffolded from `template/`. The AI writes only `*.ai.md`, the human owns `*.md`, and `*.yaml` is shared. Requirements: [`docs/requirements.ai.md`](docs/requirements.ai.md).

## Use

Open Claude Code in this repo, then:

- `/new-project <path>` — scaffold a new project knowledge base (asks for name, client, language).
- `/update-project <path>` — refresh an existing project's skills, hook and settings from `template/.claude/`.

In a project: `/ingest-doc`, `/meeting-prep`, `/debrief`, `/kb-check` (see its `AGENTS.md`).

## Requirements

- Node (for the ownership hook)
- User-level skills `parse` (document extraction) and `grilling` (debrief interview)

## Layout

```
.claude/skills/   new-project, update-project   # run here
template/         copied into each project
  AGENTS.md       router, with {{name}} {{client}} {{language}}
  .kb/            project marker (tool_version, created)
  .claude/        settings.json, hooks/guard-md.mjs, skills/
  context/ meetings/ sources/ tasks/
docs/             requirements
```
