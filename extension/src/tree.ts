// Project tree. Each top folder has its own way of opening things:
// - context/: one entry per pair (`x.md` + `x.ai.md`), opened in the pair editor
// - meetings/: one entry per meeting, opened in the pair editor with notes left and the AI phases right
// - sources/: plain files, opened as themselves
// Tasks come first, as a single item that opens the board.
import * as vscode from "vscode";
import { groupFiles, type Entry } from "./kb.ts";
import { list } from "./project.ts";

type Mode = "pair" | "meeting" | "plain";
const ROOT_FOLDERS: [string, Mode][] = [
  ["context", "pair"],
  ["meetings", "meeting"],
  ["sources", "plain"],
];
const ENTRY_ICON = new vscode.ThemeIcon("file");
const BINARY = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|zip|msg|eml)$/i;

export type Node =
  | { kind: "folder"; uri: vscode.Uri; mode: Mode }
  | { kind: "entry"; dir: vscode.Uri; entry: Entry }
  | { kind: "meeting"; dir: vscode.Uri; base: string; entries: Entry[] }
  | { kind: "file"; uri: vscode.Uri }
  | { kind: "board" };

export class ProjectTree implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(private readonly root: vscode.Uri) {}

  refresh(): void {
    this.changed.fire();
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (!node) {
      const folders: Node[] = ROOT_FOLDERS.map(([f, mode]) => ({ kind: "folder", uri: vscode.Uri.joinPath(this.root, f), mode }));
      return [{ kind: "board" }, ...folders];
    }
    return node.kind === "folder" ? this.folderChildren(node.uri, node.mode) : [];
  }

  private async folderChildren(dir: vscode.Uri, mode: Mode): Promise<Node[]> {
    const { dirs, files } = await list(dir);
    const folders: Node[] = dirs.map((d) => ({ kind: "folder", uri: vscode.Uri.joinPath(dir, d), mode }));
    const at = (name: string) => vscode.Uri.joinPath(dir, name);
    if (mode === "plain") return [...folders, ...files.map((f): Node => ({ kind: "file", uri: at(f) }))];

    const groups = [...groupFiles(files)];
    if (mode === "meeting") {
      return [...folders, ...groups.map(([base, entries]): Node => ({ kind: "meeting", dir, base, entries }))];
    }
    const nodes = groups.flatMap(([, entries]) =>
      entries.flatMap((entry): Node[] => [
        ...(entry.human || entry.ai || entry.yaml ? [{ kind: "entry", dir, entry } as Node] : []),
        ...entry.others.map((o): Node => ({ kind: "file", uri: at(o) })),
      ]),
    );
    return [...folders, ...nodes];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    switch (node.kind) {
      case "folder": {
        const item = new vscode.TreeItem(basename(node.uri), vscode.TreeItemCollapsibleState.Collapsed);
        item.resourceUri = node.uri;
        item.iconPath = vscode.ThemeIcon.Folder;
        return item;
      }
      case "entry": {
        const { dir, entry } = node;
        const item = new vscode.TreeItem(entry.stem);
        item.iconPath = ENTRY_ICON;
        item.contextValue = entry.yaml ? "entry-yaml" : "entry";
        item.tooltip = [entry.human, entry.ai, entry.yaml].filter(Boolean).join("\n");
        // Metadata-only entries have no text pair, so they open as YAML.
        item.command =
          entry.human || entry.ai
            ? { title: "Open Side by Side", command: "kb.openEntry", arguments: [dir, entry] }
            : { title: "Open", command: "vscode.open", arguments: [vscode.Uri.joinPath(dir, entry.yaml!)] };
        return item;
      }
      case "meeting": {
        const { dir, base, entries } = node;
        const names = entries.flatMap((e) => [e.human, e.ai, e.yaml, ...e.others]).filter(Boolean) as string[];
        const item = new vscode.TreeItem(base);
        item.iconPath = ENTRY_ICON;
        item.contextValue = names.includes(`${base}.yaml`) ? "entry-yaml" : "entry";
        item.tooltip = names.join("\n");
        item.command = { title: "Open Meeting", command: "kb.openMeeting", arguments: [dir, base] };
        return item;
      }
      case "board": {
        const item = new vscode.TreeItem("tasks");
        item.iconPath = new vscode.ThemeIcon("project");
        item.description = "board";
        item.tooltip = "Open the task board";
        item.command = { title: "Open Task Board", command: "kb.openBoard" };
        return item;
      }
      case "file": {
        const item = new vscode.TreeItem(basename(node.uri));
        item.resourceUri = node.uri;
        item.command = BINARY.test(node.uri.path)
          ? { title: "Open", command: "kb.openExternal", arguments: [node.uri] }
          : { title: "Open", command: "vscode.open", arguments: [node.uri] };
        return item;
      }
    }
  }
}

function basename(uri: vscode.Uri): string {
  return uri.path.split("/").pop()!;
}

/** The YAML behind a tree node, for "Open YAML". */
export function yamlOf(node: Node): vscode.Uri | undefined {
  if (node.kind === "entry" && node.entry.yaml) return vscode.Uri.joinPath(node.dir, node.entry.yaml);
  if (node.kind === "meeting") return vscode.Uri.joinPath(node.dir, `${node.base}.yaml`);
  return undefined;
}
