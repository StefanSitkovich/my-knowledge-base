// File access for one knowledge-base project: the workspace folder that holds `.kb/project.yaml`.
import * as vscode from "vscode";
import { toDraft } from "./drafts.ts";
import { groupFiles, newTaskYaml, nextTaskId, parseTask, setField, slugify, type Entry, type Status, type Task } from "./kb.ts";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export async function findProjectRoot(): Promise<vscode.Uri | undefined> {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (await exists(vscode.Uri.joinPath(folder.uri, ".kb", "project.yaml"))) return folder.uri;
  }
  return undefined;
}

export async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function readText(uri: vscode.Uri): Promise<string> {
  return decoder.decode(await vscode.workspace.fs.readFile(uri));
}

export async function writeText(uri: vscode.Uri, text: string): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, encoder.encode(text));
}

export interface Listing {
  dirs: string[];
  files: string[];
}

export async function list(dir: vscode.Uri): Promise<Listing> {
  let items: [string, vscode.FileType][] = [];
  try {
    items = await vscode.workspace.fs.readDirectory(dir);
  } catch {
    // Missing folder: show it empty.
  }
  const visible = items.filter(([name]) => !name.startsWith("."));
  return {
    dirs: visible.filter(([, t]) => t & vscode.FileType.Directory).map(([n]) => n).sort(),
    files: visible.filter(([, t]) => t & vscode.FileType.File).map(([n]) => n).sort(),
  };
}

export class Tasks {
  readonly dir: vscode.Uri;

  constructor(root: vscode.Uri) {
    this.dir = vscode.Uri.joinPath(root, "tasks");
  }

  uri(name: string): vscode.Uri {
    return vscode.Uri.joinPath(this.dir, name);
  }

  async entries(): Promise<Entry[]> {
    const { files } = await list(this.dir);
    return [...groupFiles(files).values()].flat().filter((e) => e.yaml && /^T-\d+-/.test(e.stem));
  }

  async load(): Promise<Task[]> {
    const entries = await this.entries();
    return Promise.all(entries.map(async (e) => parseTask(e, await readText(this.uri(e.yaml!)))));
  }

  async entry(stem: string): Promise<Entry | undefined> {
    return (await this.entries()).find((e) => e.stem === stem);
  }

  async setField(stem: string, key: "status" | "title", value: string): Promise<void> {
    const uri = this.uri(`${stem}.yaml`);
    await writeText(uri, setField(await readText(uri), key, value));
  }

  /** Creates `T-NNN-<slug>.yaml`; the slug is fixed from here on. Returns the stem. */
  async create(title: string, status: Status): Promise<string> {
    const { files } = await list(this.dir);
    const id = nextTaskId(files);
    const stem = `${id}-${slugify(title)}`;
    await writeText(this.uri(`${stem}.yaml`), newTaskYaml(id, title, status));
    return stem;
  }
}

export const PAIR_VIEW_TYPE = "kb.pair";
const BINARY = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|zip|msg|eml)$/i;

/** Opens a human file in the pair editor; a missing one opens as an empty draft that Ctrl+S creates. */
export async function openPairEditor(human: vscode.Uri): Promise<void> {
  const target = (await exists(human)) ? human : toDraft(human);
  await vscode.commands.executeCommand("vscode.openWith", target, PAIR_VIEW_TYPE, { preview: false });
}

/** Context and tasks: `x.md` on the left, `x.ai.md` on the right, in one tab. */
export function openEntry(dir: vscode.Uri, entry: Pick<Entry, "stem">): Promise<void> {
  return openPairEditor(vscode.Uri.joinPath(dir, `${entry.stem}.md`));
}

/** Meetings: `<base>.notes.md` on the left, prep/debrief/summary switchable on the right. */
export function openMeeting(dir: vscode.Uri, base: string): Promise<void> {
  return openPairEditor(vscode.Uri.joinPath(dir, `${base}.notes.md`));
}

/** Opens a file as itself: text in an editor (at `line`, 1-based), binaries in their default app. */
export async function openPlain(uri: vscode.Uri, line?: number): Promise<void> {
  if (BINARY.test(uri.path)) {
    await vscode.env.openExternal(uri);
    return;
  }
  const at = line ? new vscode.Position(Math.max(0, line - 1), 0) : undefined;
  await vscode.window.showTextDocument(uri, { preview: false, selection: at && new vscode.Range(at, at) });
}

/** Opens any knowledge-base path the way the tree would: meetings and pairs in the pair editor, the rest plain. */
export async function openPath(uri: vscode.Uri, line?: number): Promise<void> {
  const path = uri.path;
  const name = path.split("/").pop()!;
  const dir = vscode.Uri.joinPath(uri, "..");
  if (line || !/\.md$/i.test(name) || path.includes("/sources/")) return openPlain(uri, line);
  if (path.includes("/meetings/")) return openMeeting(dir, name.slice(0, name.indexOf(".")));
  return openEntry(dir, { stem: name.replace(/(\.ai)?\.md$/i, "") });
}
