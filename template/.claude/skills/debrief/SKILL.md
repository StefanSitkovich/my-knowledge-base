---
name: debrief
description: Debrief a meeting from the human's notes — clarifying interview, debrief and summary, proposed tasks, context updates.
disable-model-invocation: true
argument-hint: "[path to .notes.md]"
---

Debrief one meeting. Ownership rule and folder map: `AGENTS.md`.

## 1. Find the notes

Use the `.notes.md` named in the argument. Without one, take the newest `meetings/*.notes.md` that has no matching `.debrief.ai.md`; if there are several candidates, confirm the choice with the human. The meeting **stem** is the notes path minus `.notes.md`.

## 2. Read around the notes

Read the notes, `<stem>.yaml` and `<stem>.prep.ai.md` if they exist, and the context file of every attendee and system the notes mention. Human notes are terse: shorthand, half-sentences, names without roles. List for yourself every point where you would otherwise guess — unclear decisions, owners, dates, who said what, unknown names, contradictions with context or docs, prep questions left unanswered.

## 3. Interview

Interview the human with the **`grilling`** skill. The plan under grilling is *your reading of the meeting*: every point from step 2, plus each decision, action item and new fact you intend to record, with your reading as the recommended answer. Write nothing to the knowledge base until the interview reaches shared understanding and the human confirms it.

## 4. Write

All in the project language:

- **`<stem>.yaml`** — create if missing (date, title, attendees as in `/meeting-prep`); otherwise complete the attendees.
- **`<stem>.debrief.ai.md`** — the interview's outcome: each clarified point with its confirmed answer.
- **`<stem>.summary.ai.md`** — **Decisions**, **Action items** (owner, due date, task link), **New facts**, **Open points**. Only what the human confirmed.
- **Tasks** — one per action item and open point the human wants tracked, as `tasks/T-NNN-<slug>.yaml` (next number = highest existing + 1) plus a `tasks/T-NNN-<slug>.ai.md` description:

  ```yaml
  id: T-051
  title: Clarify SSO with IT
  status: proposed
  relations:
    - { to: ../meetings/2026-09-23-kickoff-it.summary.ai.md, type: "raised in" }
    - { to: ../context/people/customer/anna-meier.ai.md, type: "owner on their side" }
  ```

  Before creating, check existing tasks: if one already covers the point, update its relations and `.ai.md` instead.
- **Context** — update or create the `.ai.md` of every person, system and topic the confirmed facts touch, linking the summary as the source.

Done when every confirmed decision, action item and fact lands in exactly one of these places, with links resolving. Report the files written and the proposed tasks by ID and title, reminding the human that moving a task out of `proposed` confirms it.
