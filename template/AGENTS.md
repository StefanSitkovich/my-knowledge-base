# {{name}}

Knowledge base for the {{name}} project with {{client}}. It is a consultant's working memory for a software implementation project: people, systems, documents, meetings and tasks.

**Project language: {{language}}.** Write all new content in this language. Sources stay in their original language.

## Ownership rule

| Suffix    | Owner                                            |
|-----------|--------------------------------------------------|
| `x.ai.md` | AI: write and edit freely                        |
| `x.md`    | Human (or a tool): the AI reads it, never writes |
| `x.yaml`  | Shared: both edit                                |

Files with the same stem form a pair; either side may exist alone. A hook blocks AI writes to `*.md` that are not `*.ai.md`. To add to a human-owned file, write into its `.ai.md` side. This file (`AGENTS.md`) is human-owned.

## Where to look

| Folder                     | Holds                                                                      |
|----------------------------|----------------------------------------------------------------------------|
| `context/people/customer/` | One file per person on the client side                                     |
| `context/people/ours/`     | One file per person on our side                                            |
| `context/systems/`         | One file per system                                                        |
| `context/enterprise.*`     | Enterprise landscape, logging, technical capabilities                      |
| `context/project/`         | `finance.*`, `timeline.*`                                                  |
| `meetings/`                | `<date>-<slug>.yaml` + `.prep.ai.md`, `.notes.md`, `.debrief.ai.md`, `.summary.ai.md` |
| `sources/originals/`       | Original documents (PDF, DOCX, …), flat                                     |
| `sources/docs/<slug>/`     | `extracted.md` (parser output, never edited), `index.ai.md` (sections by line range), `summary.ai.md` |
| `tasks/`                   | `T-NNN-<slug>.yaml` (title, status, relations) + `.md` / `.ai.md` descriptions |

Find things by filename and grep; there are no folder indexes. When grep lands in `extracted.md:<line>`, look up the section in that folder's `index.ai.md`.

## Conventions

- Relative Markdown links that point to a file that exists. When a pair has no `.md` side, link the `.ai.md`. Link doc sections with a line anchor: `sources/docs/<slug>/extracted.md#L120`.
- Filenames: lowercase kebab-case slugs. Meetings are `YYYY-MM-DD-<slug>.<phase>[.ai].md`. Tasks are `T-NNN-<slug>` (three digits, next = highest + 1, slug fixed at creation).
- Task `status`: `proposed` · `backlog` · `todo` · `in-progress` · `waiting` · `done`. AI-created tasks start as `proposed`; the human confirms a task by moving it out of `proposed`.
- Keep facts in `context/`, not here.

## Skills

`/ingest-doc` · `/meeting-prep` · `/debrief` · `/kb-check`
