// @ts-check
// Task board webview. State lives in the YAML files; this only renders and sends intents to the extension.
(function () {
  const vscode = acquireVsCodeApi();
  const board = /** @type {HTMLElement} */ (document.getElementById("board"));

  const LABELS = {
    proposed: "Proposed",
    backlog: "Backlog",
    todo: "To do",
    "in-progress": "In progress",
    waiting: "Waiting on customer",
    done: "Done",
  };
  const HINTS = {
    proposed: "Suggested by the AI. Move a card out to confirm its title.",
  };

  /** @type {{stem:string,id:string,title:string,status:string,relations:{to:string,type:string}[],hasHuman:boolean,hasAi:boolean,error?:string}[]} */
  let tasks = [];
  /** @type {string[]} */
  let statuses = [];
  let editing = false;
  let pending = false;
  let dragging = "";

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type !== "tasks") return;
    tasks = msg.tasks;
    statuses = msg.statuses;
    if (editing) pending = true;
    else render();
  });

  function send(msg) {
    vscode.postMessage(msg);
  }

  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    for (const c of children) if (c != null && c !== false) node.append(c);
    return node;
  }

  function columns() {
    const extra = [...new Set(tasks.map((t) => t.status))].filter((s) => !statuses.includes(s)).sort();
    return [...statuses, ...extra];
  }

  function render() {
    const focusedStem = /** @type {HTMLElement|null} */ (document.activeElement)?.dataset?.stem;
    board.replaceChildren(...columns().map(column));
    if (focusedStem) /** @type {HTMLElement|null} */ (board.querySelector(`[data-stem="${CSS.escape(focusedStem)}"]`))?.focus();
  }

  function column(status) {
    const items = tasks.filter((t) => t.status === status).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const known = statuses.includes(status);
    const list = el("ol", { className: "cards" });
    list.dataset.status = status;
    list.append(...items.map(card));

    const add = el("button", { className: "icon", title: `New task in ${LABELS[status] ?? status}`, textContent: "+" });
    add.setAttribute("aria-label", `New task in ${LABELS[status] ?? status}`);
    add.addEventListener("click", () => newTaskInput(list, status));

    const section = el(
      "section",
      { className: `column status-${known ? status : "unknown"}` },
      el(
        "header",
        {},
        el("h2", { textContent: LABELS[status] ?? status }),
        el("span", { className: "count", textContent: String(items.length) }),
        known && add,
      ),
      HINTS[status] && el("p", { className: "hint", textContent: HINTS[status] }),
      !known && el("p", { className: "hint", textContent: "Unknown status. Drag cards to a valid column." }),
      list,
    );
    section.setAttribute("aria-label", LABELS[status] ?? status);

    list.addEventListener("dragover", (e) => {
      if (!dragging || !known) return;
      e.preventDefault();
      list.classList.add("over");
    });
    list.addEventListener("dragleave", (e) => {
      if (!list.contains(/** @type {Node} */ (e.relatedTarget))) list.classList.remove("over");
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.classList.remove("over");
      move(dragging, status);
    });
    return section;
  }

  function card(task) {
    const title = el("span", { className: "title", textContent: task.title, title: "Double-click to rename" });
    title.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      rename(title, task);
    });

    const relations = task.relations.length
      ? el("span", {
          className: "relations",
          textContent: `↔ ${task.relations.length}`,
          title: task.relations.map((r) => `${r.type}: ${r.to}`).join("\n"),
        })
      : null;

    const li = el(
      "li",
      { className: "card", draggable: true, tabIndex: 0 },
      el(
        "div",
        { className: "meta" },
        el("span", { className: "id", textContent: task.id }),
        task.hasHuman && el("span", { className: "badge human", textContent: "you", title: "Has your description" }),
        task.hasAi && el("span", { className: "badge ai", textContent: "AI", title: "Has the AI description" }),
        relations,
      ),
      title,
      task.error && el("p", { className: "error", textContent: `YAML error: ${task.error}` }),
    );
    li.dataset.stem = task.stem;
    li.title = "Click to open · Alt+←/→ to move";

    li.addEventListener("click", () => {
      if (!editing) send({ type: "open", stem: task.stem });
    });
    li.addEventListener("keydown", (e) => {
      if (editing) return;
      if (e.key === "Enter") send({ type: "open", stem: task.stem });
      if (e.key === "F2") rename(title, task);
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const i = statuses.indexOf(task.status);
        const next = statuses[i + (e.key === "ArrowLeft" ? -1 : 1)];
        if (i >= 0 && next) move(task.stem, next);
      }
    });
    li.addEventListener("dragstart", (e) => {
      dragging = task.stem;
      e.dataTransfer?.setData("text/plain", task.stem);
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => {
      dragging = "";
      li.classList.remove("dragging");
    });
    return li;
  }

  function move(stem, status) {
    const task = tasks.find((t) => t.stem === stem);
    if (!task || task.status === status) return;
    task.status = status; // optimistic; the extension answers with the files' truth
    render();
    send({ type: "move", stem, status });
  }

  function rename(title, task) {
    if (editing) return;
    editing = true;
    title.contentEditable = "plaintext-only";
    title.focus();
    getSelection()?.selectAllChildren(title);
    const finish = (commit) => {
      title.removeEventListener("blur", onBlur);
      title.removeEventListener("keydown", onKey);
      title.contentEditable = "false";
      editing = false;
      const value = (title.textContent ?? "").trim();
      if (commit && value && value !== task.title) {
        task.title = value;
        send({ type: "rename", stem: task.stem, title: value });
      } else title.textContent = task.title;
      if (pending) (pending = false), render();
    };
    const onBlur = () => finish(true);
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") (e.preventDefault(), title.blur());
      if (e.key === "Escape") finish(false);
    };
    title.addEventListener("blur", onBlur);
    title.addEventListener("keydown", onKey);
  }

  function newTaskInput(list, status) {
    if (editing) return;
    editing = true;
    const input = el("input", { className: "new", placeholder: "Task title, Enter to create", type: "text" });
    input.setAttribute("aria-label", "New task title");
    const li = el("li", { className: "card editing" }, input);
    list.prepend(li);
    input.focus();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      editing = false;
      const value = input.value.trim();
      li.remove();
      if (commit && value) send({ type: "create", title: value, status });
      if (pending) (pending = false), render();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  send({ type: "ready" });
})();
