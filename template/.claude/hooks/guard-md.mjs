// PreToolUse hook: the AI may write `*.ai.md`, never any other `*.md` inside the project.
// Blocks by exiting 2; the stderr message is shown to the agent.
import path from "node:path";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let event;
try {
  event = JSON.parse(raw);
} catch {
  process.exit(0);
}

if (!WRITE_TOOLS.has(event.tool_name)) process.exit(0);

const input = event.tool_input ?? {};
const target = input.file_path ?? input.notebook_path;
if (!target) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
const abs = path.resolve(event.cwd || root, target);
const norm = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
const rel = path.relative(norm(root), norm(abs));
const insideProject = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);

const name = norm(path.basename(abs));
const humanOwned = name.endsWith(".md") && !name.endsWith(".ai.md");

if (insideProject && humanOwned) {
  process.stderr.write(
    `Blocked: ${path.relative(root, abs).replaceAll("\\", "/")} is human-owned. ` +
      `The AI writes only *.ai.md files (see the ownership rule in AGENTS.md). ` +
      `Put this content in the matching .ai.md instead, or ask the human to edit the .md.\n`
  );
  process.exit(2);
}
process.exit(0);
