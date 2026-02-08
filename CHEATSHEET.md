# CHEATSHEET.md — CRG (Collaborative Reasoning Graphs) Agent Quick Reference

This is the “read me first, every session” guide for implementing CRG with Codex/agents.

---

## 0) Authority + How to Use the Docs

**Authority order (when things conflict):**
1. **ARCHITECTURE.md** (how to build it / settled decisions)
2. **SPEC.md** (what to build / product behavior)
3. **TASKS.md** (build order / milestones)
4. **AGENT.md / PROMPT.md** (how to behave / work orders)

**Working rule:** Don’t paste all docs into prompts. Open the repo docs as needed, but keep your *working context* per milestone.

---

## 1) Non-Negotiable Gotchas (Do Not Break These)

- **Node IDs are globally unique** across root + all sub-graphs. One global counter.
- **`move_to` must be the last action in a turn.** If `move_to` appears and *any* other action follows, **reject the entire batch** (not just `move_to`).
- **`last_created` is resolved during execution, not parsing.** Parser preserves the token; executor binds it to the actual ID created earlier that turn.
- **React Flow does not own state.** **Zustand is source of truth**; React Flow is just rendering + events.
- **Main process is authoritative during LLM runs.** Renderer edits flow up to main; main applies + pushes updates back.
- **File blocks vs data blocks are different layers.**
  - `[file: name]` → user-authored text from `/prompts/` (may contain Handlebars variables)
  - `[data: keyword]` → generated sections (graph/context/actions/etc.)
  - Pipeline is: **Phase Resolver → Handlebars variable substitution**
- **Goal Nodes are protected.** LLM cannot modify Goal Nodes.
- **Artifact Nodes are protected.** LLM cannot edit Artifact content; it may create edges from Artifact nodes and create new linked nodes.
- **Chat does not mutate the graph.** Conversational chat is separate from the autonomous action loop.
- **Sub-graphs load on demand only.** Load root graph on startup; load Master Node sub-graph when entered.
- **Phase turn counts live in `phase-order.txt`, not in phase files.**

---

## 2) System Architecture in One Page

### Two-process Electron model (strict boundary)
**Main process owns:** file I/O, file watching, LLM API calls, prompt assembly, parsing/validation/execution, authoritative graph state, persistence, token budgeting/trimming, logging, phase management.

**Renderer process owns:** Zustand stores, React Flow rendering, Inspector, tabs (Graph/Prompts/Logs/Settings/Stats), user interactions, chat UI.

**Rule of thumb:** files/network/LLM = **main**; screen/UI = **renderer**.

### Dual graph state
- Renderer: Zustand graph store (UI-facing)
- Main: graph-store.ts (authoritative for CRG operations)
- During **LLM runs**, main is source of truth; renderer displays updates pushed from main.

### React Flow’s role
- Reads nodes/edges from Zustand props
- Emits events (drag/select/connect) → Zustand actions
- **Never** read React Flow internal state as “truth”

---

## 3) Folder Structure (Project Data)

Project folder structure (user-editable + runtime-owned):
- `/phases/` phase templates + `phase-order.txt`
- `/prompts/` user-authored text blocks referenced by `[file: ...]`
- `/definitions/` node types, edge types, categories, states
- `/defaults/` importance + color mappings
- `/settings/` LLM config + UI config
- `/graph/` graph JSON files (CRG-owned during runtime)
- `/files/` artifact source files (read when needed; not watched during runtime)

**File watching during runtime:** watch `/phases /prompts /definitions /defaults /settings`  
**Do not watch during runtime:** `/graph` and `/files`

---

## 4) Graph Persistence + Sub-Graphs

### Root + sub-graph storage
- Root graph: `/graph/graph-data.json`
- Master Node sub-graph: `/graph/graph-data-<nodeId>.json` (e.g., `graph-data-n05.json`)

### Global node ID counter (single source of truth)
- Use **root `graph-data.json` metadata `nextId`** as the global counter.
- Every node created anywhere (root or sub-graph) consumes the next global ID.

### Sub-graph loading
- Load only root at startup.
- Load sub-graph when user/LLM enters a Master Node.
- Do not pre-load all subgraphs.

---

## 5) Prompt Assembly (Two Layers)

### Layer 1 — Phase Template Resolver (CRG code)
Reads a phase file line-by-line:
- `[file: name]` → inserts `/prompts/name.txt`
- `[data: keyword]` → calls generator and inserts output
Produces one concatenated prompt string.

### Layer 2 — Variable substitution (Handlebars)
Runs on the concatenated string:
- Replaces `{{variables}}` found inside file blocks content.

### Phase file rules
- Phase files contain **only** block references.
- Turn counts/ordering/loops are defined in **`phase-order.txt`**.

---

## 6) LLM Action Syntax (Parsing + Validation)

### Action block format
[ACTION: action_name | field: value | field: value | reason: "..."]


**Parsing rules that matter:**
- `reason` is **required** (missing → parse failure)
- Quoted strings use `"..."`; escape quotes as `\"`
- `]` inside quotes must be escaped as `\]`
- Split on `|` **only outside quotes**
- Unknown actions are skipped/logged (not necessarily total failure)

### Core v1 actions
- `create_node`, `create_edge`, `edit_node`, `delete_node`, `move_to`
- `merge_nodes`, `set_importance`, `set_type`, `set_category`, `set_state`

### Validation highlights
- `create_edge` endpoints must exist; target must be within **L2 visibility** (current + adjacent)
- `edit_node` only allowed on **current position**
- `move_to` only to adjacent or valid Master parent/child transitions
- **Any mutation on a user-locked node is rejected**
- **Goal Nodes cannot be modified by LLM**
- **Artifact Nodes are read-only (except edges from them)**
- **If `move_to` appears before any later action:** reject **entire batch** and ask for resubmission

### Execution ordering
- Execute actions sequentially as they appear.
- Resolve `last_created` at execution time (per-turn).

---

## 7) Context + Token Budget (What Must Always Fit)

### L0–L3 detail levels (distance-based)
- Goal node: **L3 always**
- Current node: **L3 always**
- Adjacent: **L2**
- 2–3 steps: **L1**
- Everything else in current graph level: **L0**

### Token trimming behavior (greedy section removal)
If over budget: remove whole sections in priority order (lowest priority first).  
Never partially “shave” a section except as a last resort for current-node content.

**Never removed:** Goal node, phase instructions/guidelines, available actions, adjacent nodes.  
If even these don’t fit → pause and alert the user.

---

## 8) IPC + UI Conventions

### IPC hygiene
- Keep a defined list of IPC channels (add new ones only for real needs).
- Renderer components should **not** call IPC directly.
- Renderer → Zustand store actions → ipc-bridge → main handlers.

### Locking protocol (must respect)
- User selecting a node locks it in main.
- LLM attempts to mutate locked node → rejected with a clear reason.
- LLM can still *see* locked nodes in context.

---

## 9) Implementation Milestone Order (Build in This Sequence)

1. Electron shell + scaffolding
2. Persistence + config loading + file watching
3. Action parser + validator (highest risk; lock it down early)
4. Template system + context builder
5. LLM provider integration
6. Orchestrator + action execution
7. Renderer foundation (stores/tabs)
8. Graph canvas + visualization
9. Inspector + node editing
10. Prompts tab
11. Logs tab
12. Settings + Stats tabs
13. Top control bar + Chat UI
14. End-to-end integration + polish

---

## 10) Testing Priorities (If You Only Test 3 Things…)

1. **Action parser** (state machine; quote/escape edge cases)
2. **Action validator** (every rule gets a test)
3. **Template resolver + token trimming** (block resolution + budget sequence)

Use unit tests heavily; add integration tests for orchestrator + persistence.

---

## 11) When Docs Are Silent

- **Trivial decision:** pick one, implement, mention in summary.
- **Non-trivial decision:** present options + recommendation, ask before proceeding.
- Don’t “invent product behavior” that changes the spec without surfacing it.

---

## 12) Quick “Stop Signs” Before You Commit

Before pushing a change, confirm you didn’t:
- introduce a regex-based parser (should be state-machine)
- let React Flow become stateful source of truth
- read/write graph files directly outside the data access layer
- watch `/graph` or `/files` during runtime
- break `move_to last` batch rejection rule
- allow LLM to mutate Goal/Artifact nodes
- preload all subgraphs on startup

