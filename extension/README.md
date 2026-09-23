# Knowledge Base (VS Code extension)

The human UI for a project knowledge base (requirements §11). It activates in any workspace that contains `.kb/project.yaml`, and it reads and writes the same files the agents use.

- **Opens itself:** when a folder with `.kb/project.yaml` opens, the Knowledge Base sidebar and the task board open with it. `kb.openOnStartup` controls this: `board` (default), `sidebar` or `none`.
- **Project tree** (activity bar → Knowledge Base). Each folder opens things its own way:
  - **tasks** (first) opens the board.
  - `context/`: one entry per pair (`x.md` + `x.ai.md` + `x.yaml`), opened in the pair editor.
  - `meetings/`: one entry per meeting, opened in the pair editor with the notes on the left.
  - `sources/`: plain files, opened as themselves; originals (PDF, DOCX, …) open in their default app.

  **Open YAML** is in the context menu.
- **Pair editor**: one tab per pair. The left pane, labelled **you**, is your `.md` in a Markdown editor. VS Code still owns saving, the unsaved-changes dot, undo and the close prompt. The right pane, labelled **AI**, renders the `.ai.md` live as the AI writes it, and its links open in the knowledge base (`extracted.md#L120` jumps to that line). For a meeting, the left pane is `<meeting>.notes.md`, and the right pane switches between **prep**, **debrief** and **summary**, starting on the latest one that exists. A missing `.md` of yours opens as an empty draft: closing it untouched creates nothing, and Ctrl+S creates it. Drag the divider to resize the panes; ⧉ opens either side as plain text. **Reopen Editor With…** switches between this editor and the plain text editor for any `.md`.
- **Task board** (`KB: Open Task Board`) shows `tasks/*.yaml` with one column per status. Dragging a card (or pressing Alt+←/→) writes `status`, and only that line changes: comments and formatting stay. Double-click a title (or press F2) to rename it; the slug stays fixed. **+** in a column header creates `T-NNN-<slug>.yaml`. Clicking a card opens its descriptions side by side.
- Views refresh when files change on disk, so agent edits show up live.

## Develop

```
npm install
npm test          # pure logic in src/kb.ts
npm run typecheck
```

Press F5 in VS Code with this folder open to run the extension against `sample/`, a small fixture project.

## Install

```
npm run package
code --install-extension kb-ui-0.1.0.vsix
```

## Layout

```
src/kb.ts         pure logic: pairing, slugs, task IDs, YAML edits (no vscode import)
src/project.ts    file access, open/create pairs, task store
src/tree.ts       project tree
src/board.ts      board webview host
src/pairEditor.ts pair editor (custom text editor over the human .md)
src/drafts.ts     kb-draft: file system for not-yet-created human files
src/textDiff.ts   minimal edit between two texts (shared with the webview)
webview/pair.ts   pair editor webview (CodeMirror + markdown-it), bundled to dist/webview
media/board.*     board webview (plain JS + CSS, VS Code theme variables)
media/pair.css    pair editor styles
sample/           fixture project for F5
```
