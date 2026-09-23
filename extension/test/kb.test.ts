import { test } from "node:test";
import assert from "node:assert/strict";
import { aiSidesFor, classify, groupFiles, nextTaskId, parseTask, setField, slugify, newTaskYaml } from "../src/kb.ts";
import { textDiff } from "../src/textDiff.ts";

test("classify splits group, stem and role", () => {
  assert.deepEqual(classify("2026-09-23-kickoff-it.prep.ai.md"), {
    group: "2026-09-23-kickoff-it",
    stem: "2026-09-23-kickoff-it.prep",
    role: "ai",
  });
  assert.deepEqual(classify("anna-meier.md"), { group: "anna-meier", stem: "anna-meier", role: "human" });
  assert.deepEqual(classify("T-050-sso.yaml"), { group: "T-050-sso", stem: "T-050-sso", role: "yaml" });
  assert.deepEqual(classify("brd-v3.docx"), { group: "brd-v3", stem: "brd-v3.docx", role: "other" });
});

test("groupFiles pairs .md with .ai.md and keeps meeting phases apart", () => {
  const groups = groupFiles([
    ".gitkeep",
    "2026-09-23-kickoff-it.yaml",
    "2026-09-23-kickoff-it.notes.md",
    "2026-09-23-kickoff-it.prep.ai.md",
    "enterprise.ai.md",
    "enterprise.md",
  ]);
  assert.deepEqual([...groups.keys()], ["2026-09-23-kickoff-it", "enterprise"]);
  assert.deepEqual(groups.get("enterprise"), [
    { stem: "enterprise", human: "enterprise.md", ai: "enterprise.ai.md", others: [] },
  ]);
  assert.deepEqual(
    groups.get("2026-09-23-kickoff-it")!.map((e) => e.stem),
    ["2026-09-23-kickoff-it", "2026-09-23-kickoff-it.notes", "2026-09-23-kickoff-it.prep"],
  );
});

test("slugify transliterates German and cuts at a word boundary", () => {
  assert.equal(slugify("Klärung SSO mit IT"), "klaerung-sso-mit-it");
  assert.equal(slugify("Straße & Café!"), "strasse-cafe");
  assert.equal(slugify("aaaa bbbb cccc", 12), "aaaa-bbbb");
  assert.equal(slugify("!!!"), "task");
});

test("nextTaskId is highest + 1, padded to three digits", () => {
  assert.equal(nextTaskId([]), "T-001");
  assert.equal(nextTaskId(["T-009-a.yaml", "T-050-b.md", "notes.md"]), "T-051");
  assert.equal(nextTaskId(["T-999-a.yaml"]), "T-1000");
});

test("parseTask reads fields and falls back to the filename", () => {
  const entry = { stem: "T-050-sso", yaml: "T-050-sso.yaml", ai: "T-050-sso.ai.md", others: [] };
  const task = parseTask(
    entry,
    'id: T-050\ntitle: Clarify SSO\nstatus: waiting\nrelations:\n  - { to: ../x.md, type: "owner" }\n',
  );
  assert.equal(task.title, "Clarify SSO");
  assert.equal(task.status, "waiting");
  assert.deepEqual(task.relations, [{ to: "../x.md", type: "owner" }]);
  assert.equal(task.hasAi, true);
  assert.equal(task.hasHuman, false);

  const broken = parseTask(entry, "title: [unclosed\n");
  assert.equal(broken.id, "T-050");
  assert.ok(broken.error);
});

test("setField changes one value and keeps comments and flow style", () => {
  const before = '# keep me\nid: T-050\ntitle: Clarify SSO\nstatus: todo\nrelations:\n  - { to: ../x.md, type: "owner" }\n';
  const after = setField(before, "status", "in-progress");
  assert.equal(after, before.replace("status: todo", "status: in-progress"));
});

test("newTaskYaml writes the four fields", () => {
  assert.equal(newTaskYaml("T-001", "Do it", "backlog"), "id: T-001\ntitle: Do it\nstatus: backlog\nrelations: []\n");
});

test("aiSidesFor gives meetings their three phases and everything else its .ai.md", () => {
  assert.deepEqual(aiSidesFor("2026-09-20-kickoff-it.notes.md"), [
    { label: "prep", name: "2026-09-20-kickoff-it.prep.ai.md" },
    { label: "debrief", name: "2026-09-20-kickoff-it.debrief.ai.md" },
    { label: "summary", name: "2026-09-20-kickoff-it.summary.ai.md" },
  ]);
  assert.deepEqual(aiSidesFor("anna-meier.md"), [{ label: "ai", name: "anna-meier.ai.md" }]);
});

test("textDiff replaces only the changed middle", () => {
  assert.equal(textDiff("abc", "abc"), undefined);
  assert.deepEqual(textDiff("hello world", "hello brave world"), { start: 6, end: 6, insert: "brave " });
  assert.deepEqual(textDiff("aXc", "aYc"), { start: 1, end: 2, insert: "Y" });
  assert.deepEqual(textDiff("aaa", "aa"), { start: 2, end: 3, insert: "" });
});
