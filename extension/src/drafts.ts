// Drafts: a missing side opens as `kb-draft:` over the real path. The document starts clean, so closing it
// untouched never prompts. Saving writes the real file, and the tab then switches over to it.
import * as vscode from "vscode";

export const DRAFT_SCHEME = "kb-draft";

export function toDraft(real: vscode.Uri): vscode.Uri {
  return real.with({ scheme: DRAFT_SCHEME, query: real.scheme });
}

export function toReal(draft: vscode.Uri): vscode.Uri {
  return draft.with({ scheme: draft.query || "file", query: "" });
}

class DraftFileSystem implements vscode.FileSystemProvider {
  private readonly changed = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.changed.event;

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    try {
      return await vscode.workspace.fs.stat(toReal(uri));
    } catch {
      return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
    }
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    try {
      return await vscode.workspace.fs.readFile(toReal(uri));
    } catch {
      return new Uint8Array();
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    await vscode.workspace.fs.writeFile(toReal(uri), content);
  }

  readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions("Drafts have no directories");
  }

  delete(uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  rename(uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions(uri);
  }
}

/** After a draft is saved, open the real file in the draft's place and close the draft tab. */
async function swapToReal(doc: vscode.TextDocument): Promise<void> {
  if (doc.uri.scheme !== DRAFT_SCHEME) return;
  const key = doc.uri.toString();
  const real = toReal(doc.uri);
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      const options = { viewColumn: group.viewColumn, preview: false };
      if (input instanceof vscode.TabInputCustom && input.uri.toString() === key) {
        await vscode.commands.executeCommand("vscode.openWith", real, input.viewType, options);
      } else if (input instanceof vscode.TabInputText && input.uri.toString() === key) {
        await vscode.window.showTextDocument(real, options);
      } else continue;
      await vscode.window.tabGroups.close(tab);
    }
  }
}

export function registerDrafts(): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.workspace.registerFileSystemProvider(DRAFT_SCHEME, new DraftFileSystem(), { isCaseSensitive: true }),
    vscode.workspace.onDidSaveTextDocument((doc) => void swapToReal(doc)),
  );
}
