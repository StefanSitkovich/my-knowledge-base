import * as vscode from "vscode";
import { Board } from "./board.ts";
import { registerDrafts } from "./drafts.ts";
import { STATUSES, type Entry, type Status } from "./kb.ts";
import { registerPairEditor } from "./pairEditor.ts";
import { findProjectRoot, openEntry, openMeeting, Tasks } from "./project.ts";
import { ProjectTree, yamlOf, type Node } from "./tree.ts";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // The pair editor and drafts can be restored in any window, so they register before the project check.
  context.subscriptions.push(registerDrafts(), registerPairEditor(context.extensionUri));

  const root = await findProjectRoot();
  if (!root) return;
  await vscode.commands.executeCommand("setContext", "kb.active", true);

  const tasks = new Tasks(root);
  const tree = new ProjectTree(root);
  const refresh = () => {
    tree.refresh();
    Board.refresh();
  };

  // Agents write the same files, so any change on disk refreshes the views.
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, "{context,meetings,sources,tasks}/**"));
  let timer: NodeJS.Timeout | undefined;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  };

  context.subscriptions.push(
    watcher,
    watcher.onDidCreate(debounced),
    watcher.onDidChange(debounced),
    watcher.onDidDelete(debounced),
    vscode.window.registerTreeDataProvider("kb.tree", tree),
    vscode.commands.registerCommand("kb.refresh", refresh),
    vscode.commands.registerCommand("kb.openBoard", () => Board.show(context.extensionUri, tasks)),
    vscode.commands.registerCommand("kb.openEntry", (dir: vscode.Uri, entry: Entry) => openEntry(dir, entry)),
    vscode.commands.registerCommand("kb.openMeeting", (dir: vscode.Uri, base: string) => openMeeting(dir, base)),
    vscode.commands.registerCommand("kb.openYaml", (node: Node) => {
      const yaml = yamlOf(node);
      if (yaml) return vscode.window.showTextDocument(yaml, { preview: false });
    }),
    vscode.commands.registerCommand("kb.openExternal", (uri: vscode.Uri) => vscode.env.openExternal(uri)),
    vscode.commands.registerCommand("kb.newTask", async () => {
      const title = (await vscode.window.showInputBox({ prompt: "Task title", placeHolder: "Clarify SSO with IT" }))?.trim();
      if (!title) return;
      const status = (await vscode.window.showQuickPick([...STATUSES], { placeHolder: "Status", title })) as Status | undefined;
      if (!status) return;
      const stem = await tasks.create(title, status);
      void vscode.window.showInformationMessage(`Created tasks/${stem}.yaml`);
    }),
  );

  const onStartup = vscode.workspace.getConfiguration("kb").get<string>("openOnStartup");
  if (onStartup === "sidebar" || onStartup === "board") {
    await vscode.commands.executeCommand("workbench.view.extension.kb");
  }
  if (onStartup === "board") await Board.show(context.extensionUri, tasks);
}

export function deactivate(): void {}
