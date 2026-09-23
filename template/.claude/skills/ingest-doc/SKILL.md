---
name: ingest-doc
description: Ingest a client document (PDF, DOCX, XLSX, PPTX) into the knowledge base — original, extracted text, section index, summary, context updates.
disable-model-invocation: true
argument-hint: <path-to-original>
---

Ingest one original document. Ownership rule and folder map: `AGENTS.md`.

## 1. Place the original

Pick a **doc slug**: lowercase kebab-case, descriptive, version included when the document has one (`brd-v3`, `2026-08-vertrag-rahmenvertrag`). Copy the original to `sources/originals/<slug>.<ext>` unless it already sits in `sources/originals/`. If `sources/docs/<slug>/` already exists, stop and ask: a new version of a document gets a new slug and folder, and existing folders are never re-ingested.

## 2. Extract

Extract with the **`parse`** skill. Its only job here: produce one Markdown file at `sources/docs/<slug>/extracted.md` from the original. Follow that skill's own workflow, dependencies, flags and verification gate. If it fails its gate, stop and report — write nothing further.

`extracted.md` is tool-written and final: never edit or split it. Every later step reads it and cites it by line.

## 3. Index

Read `extracted.md` in full and write `sources/docs/<slug>/index.ai.md`:

```markdown
---
source: ../../originals/<slug>.<ext>
extracted: extracted.md
lines: <total line count>
ingested: <YYYY-MM-DD>
---

# <Document title>

- L1–54 · <Section title> · <one-line summary of what it says>
- L55–119 · …
```

Sections are **semantic**: cut where the topic changes, which is usually but not always a heading. Merge trivial headings and split long sections that cover several topics. Every line of the document belongs to exactly one section; ranges are contiguous from L1 to the last line. Section titles and summaries are in the project language.

## 4. Summarize

Write `sources/docs/<slug>/summary.ai.md`: what the document is (type, author, date, status), its purpose, and the key content. Emphasise commitments, scope, requirements, deadlines, money, named people and systems, and open or contradictory points. Cite every claim with a line link: `[L120](extracted.md#L120)`.

## 5. Update context

For each person, system, enterprise fact, finance or timeline fact the document establishes or changes, update the matching `.ai.md` under `context/` — create it if missing. Cite the source line as `../../sources/docs/<slug>/extracted.md#L120` (adjust depth). Never touch a `.md` human side; when both sides exist and they disagree, note the discrepancy in the `.ai.md`.

Done when: the index covers every line, every context file the document touches is updated, and you report to the human the slug, the section count, and the list of context files created or changed.
