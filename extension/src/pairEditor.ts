// Pair editor: one tab per human file. Left, the human `.md` in an editor (backed by the real TextDocument, so
// VS Code owns save, dirty state, undo and hot exit). Right, the AI side rendered live: one `.ai.md`, or a
// meeting's prep/debrief/summary behind a switcher.
import * as vscode from "vscode";
import { DRAFT_SCHEME, toReal } from "./drafts.ts";
import { aiSidesFor } from "./kb.ts";
import { exists, openPath, openPlain, PAIR_VIEW_TYPE, readText } from "./project.ts";
import { textDiff } from "./textDiff.ts";

type FromWebview =
  | { type: "ready" }
  | { type: "edit"; text: string }
  | { type: "link"; href: string }
  | { type: "openAi"; name: string }
  | { type: "openHumanText" };

export function registerPairEditor(extensionUri: vscode.Uri): vscode.Disposable {
  return vscode.window.registerCustomEditorProvider(PAIR_VIEW_TYPE, new PairEditor(extensionUri), {
    webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true },
  });
}

class PairEditor implements vscode.CustomTextEditorProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    const human = document.uri.scheme === DRAFT_SCHEME ? toReal(document.uri) : document.uri;
    const humanName = human.path.split("/").pop()!;
    const dir = vscode.Uri.joinPath(human, "..");

    // Opened on an `.ai.md` via "Reopen With": show its pair instead.
    if (/\.ai\.md$/i.test(humanName)) {
      panel.dispose();
      await openPath(human);
      return;
    }

    const aiSides = aiSidesFor(humanName).map((side) => ({ ...side, uri: vscode.Uri.joinPath(dir, side.name) }));
    const post = (message: unknown) => void panel.webview.postMessage(message);
    const readAi = async () =>
      Promise.all(aiSides.map(async (s) => ({ label: s.label, name: s.name, text: (await exists(s.uri)) ? await readText(s.uri) : null })));
    const sendAi = async () => post({ type: "ai", sides: await readAi() });

    // Edits arrive as full text per keystroke. They apply in order; while any are pending, document
    // changes are our own echoes. Once idle, a document that differs from the webview changed elsewhere
    // (undo, revert, another editor), so the webview gets the new text.
    let fromWebview = document.getText();
    let pending = 0;
    let queue = Promise.resolve();
    const syncBack = () => {
      const text = document.getText();
      if (pending === 0 && text !== fromWebview) {
        fromWebview = text;
        post({ type: "human", text });
      }
    };
    const applyEdit = (text: string) => {
      fromWebview = text;
      pending++;
      queue = queue
        .then(async () => {
          const diff = textDiff(document.getText(), text);
          if (!diff) return;
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(document.positionAt(diff.start), document.positionAt(diff.end)), diff.insert);
          await vscode.workspace.applyEdit(edit);
        })
        .finally(() => {
          pending--;
          syncBack();
        });
    };

    const watchers = aiSides.map((s) => vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dir, s.name)));
    const subscriptions = [
      ...watchers,
      ...watchers.flatMap((w) => [w.onDidCreate(sendAi), w.onDidChange(sendAi), w.onDidDelete(sendAi)]),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === document) syncBack();
      }),
      panel.webview.onDidReceiveMessage(async (m: FromWebview) => {
        switch (m.type) {
          case "ready":
            post({
              type: "init",
              human: document.getText(),
              humanName,
              draft: document.uri.scheme === DRAFT_SCHEME,
              sides: await readAi(),
            });
            break;
          case "edit":
            applyEdit(m.text);
            break;
          case "link":
            await openLink(aiSides[0].uri, m.href);
            break;
          case "openAi": {
            const side = aiSides.find((s) => s.name === m.name);
            if (side && (await exists(side.uri))) await openPlain(side.uri);
            break;
          }
          case "openHumanText":
            await vscode.window.showTextDocument(document, { preview: false });
            break;
        }
      }),
    ];
    panel.onDidDispose(() => subscriptions.forEach((d) => d.dispose()));

    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist", "webview"), vscode.Uri.joinPath(this.extensionUri, "media")] };
    panel.webview.html = this.html(panel.webview);
  }

  private html(webview: vscode.Webview): string {
    const asset = (...path: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...path));
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${asset("media", "pair.css")}">
<title>Pair</title>
</head>
<body>
<main class="pair" id="pair">
  <section class="pane" aria-label="Your side">
    <header>
      <span class="role human">you</span>
      <span class="name" id="human-name"></span>
      <span class="state" id="human-state"></span>
      <button class="icon" id="human-text" title="Open in text editor" aria-label="Open in text editor">⧉</button>
    </header>
    <div class="editor" id="human"></div>
  </section>
  <div class="divider" id="divider" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize"></div>
  <section class="pane" aria-label="AI side">
    <header>
      <span class="role ai">AI</span>
      <nav class="switcher" id="switcher" aria-label="AI documents"></nav>
      <span class="name" id="ai-name"></span>
      <button class="icon" id="ai-text" title="Open as text" aria-label="Open AI side as text">⧉</button>
    </header>
    <article class="rendered" id="ai"></article>
  </section>
</main>
<script nonce="${nonce}" src="${asset("dist", "webview", "pair.js")}"></script>
</body>
</html>`;
  }
}

/** Links in rendered AI text resolve relative to the AI file; `#L120` anchors open that line. */
async function openLink(base: vscode.Uri, href: string): Promise<void> {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    await vscode.env.openExternal(vscode.Uri.parse(href));
    return;
  }
  const [path, fragment = ""] = href.split("#");
  if (!path) return;
  const target = vscode.Uri.joinPath(base, "..", decodeURIComponent(path));
  const line = /^L(\d+)/.exec(fragment)?.[1];
  await openPath(target, line ? Number(line) : undefined);
}
