// Pair editor webview. The human text lives in the extension's TextDocument; this mirrors it in CodeMirror and
// sends every change back. Undo, redo and save are VS Code's (keys are forwarded), so CodeMirror keeps no history.
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Annotation, EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, placeholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import MarkdownIt from "markdown-it";
import { textDiff } from "../src/textDiff.ts";

interface AiSide {
  label: string;
  name: string;
  text: string | null;
}

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): { selected?: string } | undefined;
  setState(state: { selected?: string }): void;
};

const vscode = acquireVsCodeApi();
const md = new MarkdownIt({ html: false, linkify: true });
const remote = Annotation.define<boolean>();
const $ = (id: string) => document.getElementById(id)!;

const highlight = HighlightStyle.define([
  { tag: t.heading, fontWeight: "bold", color: "var(--vscode-textLink-foreground)" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--vscode-textLink-foreground)" },
  { tag: t.url, color: "var(--vscode-descriptionForeground)" },
  { tag: t.monospace, color: "var(--vscode-textPreformat-foreground)" },
  { tag: t.quote, color: "var(--vscode-descriptionForeground)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.list], color: "var(--vscode-descriptionForeground)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--vscode-editor-foreground)", backgroundColor: "var(--vscode-editor-background)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--vscode-editor-font-family)", fontSize: "var(--vscode-editor-font-size)", lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0", caretColor: "var(--vscode-editorCursor-foreground)" },
  ".cm-line": { padding: "0 16px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--vscode-editorCursor-foreground)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--vscode-editor-selectionBackground)",
  },
  ".cm-activeLine": { backgroundColor: "var(--vscode-editor-lineHighlightBackground, transparent)" },
  ".cm-placeholder": { color: "var(--vscode-editorGhostText-foreground, var(--vscode-descriptionForeground))" },
});

let view: EditorView | undefined;
let sides: AiSide[] = [];
let selected = vscode.getState()?.selected;

function createEditor(text: string): void {
  view = new EditorView({
    parent: $("human"),
    state: EditorState.create({
      doc: text,
      extensions: [
        keymap.of(defaultKeymap),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        markdown(),
        syntaxHighlighting(highlight),
        theme,
        placeholder("Your notes. Ctrl+S saves."),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !u.transactions.some((tr) => tr.annotation(remote))) {
            vscode.postMessage({ type: "edit", text: u.state.doc.toString() });
          }
        }),
      ],
    }),
  });
  view.focus();
}

function setHuman(text: string): void {
  if (!view) return;
  const diff = textDiff(view.state.doc.toString(), text);
  if (!diff) return;
  view.dispatch({ changes: { from: diff.start, to: diff.end, insert: diff.insert }, annotations: remote.of(true) });
}

/** Front matter shows as a small metadata block instead of a stray rule and paragraph. */
function renderMarkdown(text: string): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!fm) return md.render(text);
  return `<pre class="frontmatter">${md.utils.escapeHtml(fm[1])}</pre>${md.render(text.slice(fm[0].length))}`;
}

function renderAi(): void {
  // Default: the last phase that exists (summary after a meeting, prep before it).
  if (!sides.some((s) => s.name === selected)) selected = [...sides].reverse().find((s) => s.text !== null)?.name ?? sides[0]?.name;
  vscode.setState({ selected });
  const side = sides.find((s) => s.name === selected);

  const switcher = $("switcher");
  switcher.hidden = sides.length < 2;
  switcher.replaceChildren(
    ...sides.map((s) => {
      const button = document.createElement("button");
      button.textContent = s.label;
      button.className = s.text === null ? "missing" : "";
      button.setAttribute("aria-pressed", String(s.name === selected));
      button.title = s.text === null ? `${s.name} (not written yet)` : s.name;
      button.addEventListener("click", () => {
        selected = s.name;
        renderAi();
      });
      return button;
    }),
  );

  $("ai-name").textContent = sides.length < 2 ? (side?.name ?? "") : "";
  ($("ai-text") as HTMLButtonElement).disabled = !side || side.text === null;
  const article = $("ai");
  if (!side || side.text === null) {
    article.innerHTML = `<p class="empty">No <code>${md.utils.escapeHtml(side?.name ?? ".ai.md")}</code> yet. The AI writes it.</p>`;
  } else {
    article.innerHTML = renderMarkdown(side.text);
  }
}

window.addEventListener("message", (event) => {
  const m = event.data;
  switch (m.type) {
    case "init":
      $("human-name").textContent = m.humanName;
      $("human-state").textContent = m.draft ? "new · Ctrl+S creates it" : "";
      sides = m.sides;
      renderAi();
      createEditor(m.human);
      break;
    case "human":
      setHuman(m.text);
      break;
    case "ai":
      sides = m.sides;
      renderAi();
      break;
  }
});

$("ai").addEventListener("click", (e) => {
  const link = (e.target as Element).closest("a");
  if (!link) return;
  e.preventDefault();
  const href = link.getAttribute("href");
  if (href) vscode.postMessage({ type: "link", href });
});
$("ai-text").addEventListener("click", () => vscode.postMessage({ type: "openAi", name: selected }));
$("human-text").addEventListener("click", () => vscode.postMessage({ type: "openHumanText" }));

// Resizable split, kept per tab.
const pair = $("pair");
const divider = $("divider");
const setSplit = (fraction: number) => pair.style.setProperty("--split", `${Math.min(0.8, Math.max(0.2, fraction)) * 100}%`);
divider.addEventListener("pointerdown", (e) => {
  divider.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => setSplit((ev.clientX - pair.getBoundingClientRect().left) / pair.clientWidth);
  divider.addEventListener("pointermove", move);
  divider.addEventListener("pointerup", () => divider.removeEventListener("pointermove", move), { once: true });
});
divider.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const current = parseFloat(getComputedStyle(pair).getPropertyValue("--split")) / 100 || 0.5;
  setSplit(current + (e.key === "ArrowLeft" ? -0.05 : 0.05));
});

vscode.postMessage({ type: "ready" });
