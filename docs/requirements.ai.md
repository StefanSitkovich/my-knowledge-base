# Project Knowledge Management System — v1 Requirements

Derived from `requirements.md` in grilling sessions on 2026-09-23. AI-written; the human-owned source of intent is `requirements.md`.

## 1. Purpose

A personal knowledge system for a consultant on software implementation projects. It keeps track of all context for one project and serves two audiences:

1. **Humans** — organized, browsable, interactive (board, side-by-side views).
2. **Agents** — an efficient, greppable knowledge base with small, well-named files.

## 2. Repositories

- **This repo is the tool**: `/new-project` and `/update-project` skills, the project `template/`, later the UI.
- **Each client project is its own git repo**, created via `/new-project` run from this repo.
- Project repos are **local only** (no remote). Originals (PDF, DOCX, …) **are committed**.
- **Distribution: copy per project.** `/new-project` copies `template/` (including `.claude/` with skills, hook and settings) into the new repo, so the tool never affects other repos. `/update-project <path>` re-copies `template/.claude/**` only and never touches content or `settings.local.json`.
- **KB-project marker:** `.kb/project.yaml` with `tool_version` (the tool repo commit it was created or updated from) and `created`.

## 3. Ownership rule (core invariant)

| Suffix     | Meaning                                                              |
|------------|----------------------------------------------------------------------|
| `x.ai.md`  | **For AI** — the AI may write and edit it                            |
| `x.md`     | **Not AI** — the AI must not edit it (written by a human or a tool)  |
| `x.yaml`   | **Shared** — structured metadata both sides edit                     |

- Files with the same stem form a **pair/group**; any member may exist alone.
- **No promote/accept mechanism.** Confirmation happens in conversation (the debrief). If the human wants content to be theirs, they write it into the `.md` themselves.
- **Enforcement:** a Claude Code **PreToolUse hook** (`.claude/hooks/guard-md.mjs`, dependency-free Node) blocks `Write`/`Edit`/`MultiEdit`/`NotebookEdit` on any `*.md` that is not `*.ai.md`, only inside the project root. Creating new `.md` files is blocked too: the human creates every human-side file, including meeting notes.
  - Known gap: writes via shell commands (Bash) are not covered by the hook. Tool-written files such as `extracted.md` are produced this way.
- `AGENTS.md` is created from a template by `/new-project`; afterwards it is human-owned.

## 4. Conventions

- **Markdown** for all prose. **No frontmatter for shared data** — shared metadata lives in `.yaml`. (`.ai.md` files may carry frontmatter, e.g. `index.ai.md`.)
- **Links:** relative Markdown links, e.g. `[Anna](../context/people/customer/anna-meier.md)`. A link always targets a file that exists: when a pair has no `.md` side, link the `.ai.md`.
- **No folder indexes.** Filenames must be descriptive enough to find things by name and grep. Exception: ingested docs have a section index (§7).
- **Language:** per project, following the client. Recorded in `AGENTS.md`. Sources stay in their original language.
- **`AGENTS.md` is a router**: ~5 lines on the project, folder map, ownership rule, where to look for what. Facts live in context docs, not here.

## 5. Project layout

```
<project-repo>/
  AGENTS.md
  context/
    people/customer/<name>.md|.ai.md
    people/ours/<name>.md|.ai.md
    systems/<system>.md|.ai.md
    enterprise.md|.ai.md          # landscape, logging, technical capabilities
    project/finance.md|.ai.md
    project/timeline.md|.ai.md
  meetings/
  sources/
    originals/
    docs/<doc-slug>/
  tasks/
```

## 6. Context docs

- **One file per entity** (person, system) so tasks and docs can link to them and agents read small files.
- **Topic files** for enterprise context and project management (finance, timeline).
- AI keeps the `.ai.md` side current from ingestion and debriefs; the human maintains the `.md` side.

## 7. Sources: documents

```
sources/originals/                 # all originals, flat — the one place humans look
  2026-08-vertrag-rahmenvertrag.pdf
  brd-v3.docx
sources/docs/brd-v3/               # agent side, never viewed by humans
  extracted.md                     # parser output: deterministic, nobody edits it
  index.ai.md                      # frontmatter: source file; sections as line ranges + 1-line summary
  summary.ai.md
```

- **No symlinks** (fragile on Windows + git).
- **Extraction** to Markdown from PDF/DOCX/XLSX/PPTX by a **deterministic parser** into one `extracted.md`. It is tool-written, so it is a plain `.md`: the hook keeps the AI from altering the client's text.
- **The parser is pluggable:** `/ingest-doc` delegates to the user-level `parse` skill, named in one line of its `SKILL.md`. That skill owns dependencies, flags, images and its coverage gate; the only contract is one Markdown file at `extracted.md`.
- **Sectioning is semantic**, decided by the ingest agent per document (not purely by headings), and recorded only in `index.ai.md` as line ranges — the extracted text is never split or rewritten:
  ```
  - L120–245 · Interfaces to SAP · Outbound IDocs for orders, inbound confirmations.
  ```
- **Links to sections** use line anchors: `../sources/docs/brd-v3/extracted.md#L120`. These are stable because re-parsing the same original is byte-identical; a new document version is a new original and a new folder (`brd-v4`).
- Grep hits land in `extracted.md:<line>`; the agent resolves the section via `index.ai.md`.

## 8. Sources: meetings

v1 source is **the human's own notes only**.

Flat files per meeting, `<date>-<slug>.<phase>[.ai].md`, plus shared metadata:

```
meetings/
  2026-09-23-kickoff-it.yaml              # date, attendees
  2026-09-23-kickoff-it.prep.ai.md        # agenda, open questions
  2026-09-23-kickoff-it.notes.md          # human notes (Mitschrift) / answers
  2026-09-23-kickoff-it.debrief.ai.md     # result of the clarifying interview
  2026-09-23-kickoff-it.summary.ai.md     # decisions, action items
```

More phases may be added later using the same pattern.

## 9. Tasks

```
tasks/
  T-050-clarify-sso-with-it.yaml     # title, status, relations (shared)
  T-050-clarify-sso-with-it.md       # human description
  T-050-clarify-sso-with-it.ai.md    # AI description
```

- **ID + slug** in the filename (`T-001`, three digits, next = highest existing + 1); the slug is fixed at creation (not renamed when the title changes).
- `.yaml` fields: `id`, `title`, `status`, `relations`.
- **Relations** may target any file (task, person, system, meeting, doc section via line anchor), each with a **free-text type**:
  ```yaml
  relations:
    - { to: ../context/people/customer/anna-meier.md, type: "owner on their side" }
    - { to: T-017-sap-interface-spec.yaml, type: "blocked by" }
  ```
- **Status values / board columns:** `proposed` · `backlog` · `todo` · `in-progress` · `waiting` (on customer) · `done`.
- The debrief creates tasks with `status: proposed`. **Moving a task out of Proposed = human confirmation of its title.**
- The AI may change status.
- Strong separation of descriptions: human in `.md`, AI in `.ai.md`.

## 10. Skills (v1)

| Skill           | Does                                                                                                   |
|-----------------|--------------------------------------------------------------------------------------------------------|
| `/new-project`  | Scaffold a project repo from the template, `AGENTS.md` (incl. language), `git init`, KB-project marker, initial commit. Runs from the tool repo. |
| `/update-project` | Re-copy `template/.claude/**` into an existing project and bump `tool_version`. Runs from the tool repo. |
| `/ingest-doc`   | Original → `extracted.md` (parser) + `index.ai.md` (semantic sections by line range) + `summary.ai.md`; update affected context `.ai.md` files. |
| `/meeting-prep` | Write `.prep.ai.md`: agenda and open questions drawn from tasks and context.                           |
| `/debrief`      | Interview the human on their notes via the user-level `grilling` skill; write `.debrief.ai.md` + `.summary.ai.md`, create `proposed` tasks, update context `.ai.md` files. |
| `/kb-check`     | Report broken links and naming-convention violations (agent-judged, no script).                        |

## 11. UI (v1 requirements — implementation out of scope for now)

Motivation: plain Markdown lacked **human interactivity**.

- **Kanban board** over `tasks/*.yaml`: drag between columns (writes `status`), create and edit tasks.
- **Project tree**: browse context, meetings, sources.
- **Side-by-side view**: human `.md` left, `.ai.md` right, for any pair.
- **Inline editing** of the human side.
- Technology: **explore a VS Code extension first**, fall back to a local web app. The UI reads/writes the same files agents use.

## 12. Not in v1

- Deliverables / topical docs
- Comms beyond own meeting notes (transcripts, emails, chats)
- `/ask` (cited Q&A) and `/status-report`
- Promote/accept of AI content
- UI: relationship view, full-text search, triggering agent actions, live meeting-notes screen
- Folder indexes
- Topic map (concept in §14)

## 13. Open decisions

None. Distribution was resolved as copy per project (§2).

**Dependencies on user-level skills:** projects rely on `parse` (for `/ingest-doc`) and `grilling` (for `/debrief`) being installed at user level.

## 14. Later: topic map (concept)

Agreed design, deferred beyond v1.

**Problem:** grep finds words, not concepts. A topic like SSO appears as "Single Sign-On", "Anmeldung", "Azure AD", "Login" — spread over a contract clause, BRD sections, meetings and tasks. Re-discovering that on every question is slow and incomplete.

- **One file per topic:** `topics/<topic>.ai.md` — a 2–3 line definition, synonyms (both languages), and links with a one-line note each to doc sections (`extracted.md#L120`), meetings, tasks and context files.
- **Maintained where content enters:** `/ingest-doc` and `/debrief` update topic files; `/kb-check` validates their links.
- **Topics are created freely by the AI**; `/kb-check` flags near-duplicates (`sso` vs `single-sign-on`). The human may rename or merge at any time.
- **Seed for deliverables:** a human `topics/<topic>.md` alongside the `.ai.md` becomes the topical doc from `design.md`.
