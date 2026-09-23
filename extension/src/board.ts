// Kanban board over `tasks/*.yaml`: columns are statuses, dragging a card writes `status`.
import * as vscode from "vscode";
import { STATUSES, type Status } from "./kb.ts";
import { openEntry, type Tasks } from "./project.ts";

type FromWebview =
  | { type: "ready" }
  | { type: "move"; stem: string; status: Status }
  | { type: "rename"; stem: string; title: string }
  | { type: "create"; title: string; status: Status }
  | { type: "open"; stem: string };

export class Board {
  private static current: Board | undefined;

  /** Shows the board in the first column and maximizes that column, so it fills the editor area. */
  static async show(extensionUri: vscode.Uri, tasks: Tasks): Promise<void> {
    if (Board.current) Board.current.panel.reveal(vscode.ViewColumn.One);
    else Board.current = new Board(extensionUri, tasks);
    if (vscode.window.tabGroups.all.length > 1) {
      await vscode.commands.executeCommand("workbench.action.toggleMaximizeEditorGroup");
    }
  }

  static refresh(): void {
    void Board.current?.post();
  }

  private readonly panel: vscode.WebviewPanel;

  private constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly tasks: Tasks,
  ) {
    const media = vscode.Uri.joinPath(extensionUri, "media");
    this.panel = vscode.window.createWebviewPanel("kb.board", "Task Board", vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [media],
      retainContextWhenHidden: true,
    });
    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((m: FromWebview) => this.handle(m).catch(showError));
    this.panel.onDidDispose(() => (Board.current = undefined));
  }

  private async handle(m: FromWebview): Promise<void> {
    switch (m.type) {
      case "ready":
        break;
      case "move":
        await this.tasks.setField(m.stem, "status", m.status);
        break;
      case "rename":
        await this.tasks.setField(m.stem, "title", m.title);
        break;
      case "create":
        await this.tasks.create(m.title, m.status);
        break;
      case "open": {
        const entry = await this.tasks.entry(m.stem);
        if (entry) await openEntry(this.tasks.dir, entry);
        return;
      }
    }
    // The file watcher also refreshes; posting here keeps the board snappy.
    await this.post();
  }

  private async post(): Promise<void> {
    const tasks = await this.tasks.load();
    await this.panel.webview.postMessage({ type: "tasks", tasks, statuses: STATUSES });
  }

  private html(): string {
    const webview = this.panel.webview;
    const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", name));
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${asset("board.css")}">
<title>Task Board</title>
</head>
<body>
<main id="board" aria-label="Task board"></main>
<script nonce="${nonce}" src="${asset("board.js")}"></script>
</body>
</html>`;
  }
}

function showError(err: unknown): void {
  void vscode.window.showErrorMessage(`KB board: ${err instanceof Error ? err.message : String(err)}`);
}
