// Pure knowledge-base logic: naming, pairing and task YAML. No `vscode` import, so it runs under plain Node tests.
import { parseDocument, stringify } from "yaml";

export const STATUSES = ["proposed", "backlog", "todo", "in-progress", "waiting", "done"] as const;
export type Status = (typeof STATUSES)[number];

export type Role = "human" | "ai" | "yaml" | "other";

export interface Classified {
  /** Filename up to the first dot: one meeting, task or person. */
  group: string;
  /** Filename without its role suffix: `.prep` in `x.prep.ai.md` stays, so each phase is its own pair. */
  stem: string;
  role: Role;
}

export function classify(name: string): Classified {
  const lower = name.toLowerCase();
  let stem = name;
  let role: Role = "other";
  if (lower.endsWith(".ai.md")) [stem, role] = [name.slice(0, -6), "ai"];
  else if (lower.endsWith(".md")) [stem, role] = [name.slice(0, -3), "human"];
  else if (lower.endsWith(".yaml")) [stem, role] = [name.slice(0, -5), "yaml"];
  else if (lower.endsWith(".yml")) [stem, role] = [name.slice(0, -4), "yaml"];
  const dot = name.indexOf(".");
  return { group: dot > 0 ? name.slice(0, dot) : name, stem, role };
}

export interface Entry {
  stem: string;
  human?: string;
  ai?: string;
  yaml?: string;
  others: string[];
}

/** Groups filenames by `group`, then by `stem`. Dotfiles are skipped. Both levels keep sorted order. */
export function groupFiles(names: string[]): Map<string, Entry[]> {
  const groups = new Map<string, Map<string, Entry>>();
  for (const name of [...names].sort()) {
    if (name.startsWith(".")) continue;
    const { group, stem, role } = classify(name);
    const stems = groups.get(group) ?? new Map<string, Entry>();
    groups.set(group, stems);
    const entry = stems.get(stem) ?? { stem, others: [] };
    stems.set(stem, entry);
    if (role === "other") entry.others.push(name);
    else entry[role] = name;
  }
  const byStem = (a: Entry, b: Entry) => (a.stem < b.stem ? -1 : a.stem > b.stem ? 1 : 0);
  return new Map([...groups].map(([g, stems]) => [g, [...stems.values()].sort(byStem)]));
}

const TRANSLIT: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

export function slugify(title: string, maxLength = 50): string {
  const slug = title
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => TRANSLIT[c])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug || "task";
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return lastDash > 0 ? cut.slice(0, lastDash) : cut;
}

/** Next task ID: highest existing `T-NNN` + 1, three digits minimum. */
export function nextTaskId(names: string[]): string {
  let max = 0;
  for (const name of names) {
    const m = /^T-(\d+)-/.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `T-${String(max + 1).padStart(3, "0")}`;
}

export interface Relation {
  to: string;
  type: string;
}

export interface Task {
  stem: string;
  id: string;
  title: string;
  status: string;
  relations: Relation[];
  hasHuman: boolean;
  hasAi: boolean;
  error?: string;
}

export function parseTask(entry: Entry, text: string): Task {
  const base: Task = {
    stem: entry.stem,
    id: /^T-\d+/.exec(entry.stem)?.[0] ?? entry.stem,
    title: entry.stem,
    status: "backlog",
    relations: [],
    hasHuman: !!entry.human,
    hasAi: !!entry.ai,
  };
  const doc = parseDocument(text);
  if (doc.errors.length) return { ...base, error: doc.errors[0].message };
  const data = doc.toJS();
  if (!data || typeof data !== "object") return base;
  const relations = Array.isArray(data.relations)
    ? data.relations
        .filter((r: unknown): r is Record<string, unknown> => !!r && typeof r === "object")
        .map((r: Record<string, unknown>) => ({ to: String(r.to ?? ""), type: String(r.type ?? "") }))
    : [];
  return {
    ...base,
    id: data.id != null ? String(data.id) : base.id,
    title: data.title != null ? String(data.title) : base.title,
    status: data.status != null ? String(data.status) : base.status,
    relations,
  };
}

/** Sets one top-level field, keeping comments, key order and the formatting of everything else. */
export function setField(text: string, key: string, value: string): string {
  const doc = parseDocument(text);
  if (doc.errors.length) throw new Error(doc.errors[0].message);
  doc.set(key, value);
  return doc.toString();
}

export function newTaskYaml(id: string, title: string, status: Status): string {
  return stringify({ id, title, status, relations: [] });
}

export const MEETING_AI_PHASES = ["prep", "debrief", "summary"] as const;

export interface AiSide {
  label: string;
  name: string;
}

/**
 * The AI files shown next to a human file: a meeting's `<base>.notes.md` gets its three AI phases,
 * any other `x.md` gets `x.ai.md`.
 */
export function aiSidesFor(humanName: string): AiSide[] {
  const meeting = /^(.+)\.notes\.md$/i.exec(humanName);
  if (meeting) return MEETING_AI_PHASES.map((phase) => ({ label: phase, name: `${meeting[1]}.${phase}.ai.md` }));
  return [{ label: "ai", name: humanName.replace(/\.md$/i, ".ai.md") }];
}
