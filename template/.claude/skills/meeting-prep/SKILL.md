---
name: meeting-prep
description: Prepare a meeting — create its metadata and a prep sheet with agenda and open questions drawn from tasks and context.
disable-model-invocation: true
argument-hint: <meeting title> [date] [attendees]
---

Prepare one meeting. Ownership rule and folder map: `AGENTS.md`.

## 1. Metadata

Settle the date (default: today), a short slug (`kickoff-it`) and the attendees; ask the human for whatever the argument leaves unclear. The meeting **stem** is `meetings/<YYYY-MM-DD>-<slug>`. If `<stem>.yaml` exists, update it rather than replace it; otherwise create it:

```yaml
date: 2026-09-23
title: Kickoff with IT
attendees:
  - ../context/people/customer/anna-meier.ai.md
  - Jonas (IT, no context file yet)
```

Attendees link to their context file (`.md` if it exists, else `.ai.md`); plain text for people without one.

## 2. Gather

Read the context file of every attendee and of every system and topic the meeting title points at. Then collect:

- tasks whose `status` is `waiting`, or whose relations touch an attendee or those systems — across `proposed`, `backlog`, `todo`, `in-progress`
- open questions and discrepancies noted in the relevant `context/` and `sources/docs/*/summary.ai.md` files
- the last `.summary.ai.md` of earlier meetings with the same attendees, for unresolved action items

## 3. Write `<stem>.prep.ai.md`

- **Goal** — one or two lines: what this meeting must settle.
- **Agenda** — ordered points, each with a rough time box.
- **Open questions** — grouped per agenda point, each phrased so it can be asked verbatim, each linking its reason (task, doc section `extracted.md#L…`, context file).
- **Who knows what** — per attendee, one line on their role and what to ask them.

Write in the project language. Tell the human the prep is ready and that their notes go in `<stem>.notes.md`, which they create; `/debrief` picks it up afterwards.
