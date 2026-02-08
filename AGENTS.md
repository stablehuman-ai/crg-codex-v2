# CRG — Agent Instructions

This file is for you, Agent. Read it before every task. Follow it precisely.

## 1. Project Context

CRG (Collaborative Reasoning Graphs) is a Windows 11 Electron desktop app that lets a user and one or more LLMs collaboratively build reasoning graphs. You are building it from scratch.

Three documents govern this project. Read all three before starting any work:

- SPEC.md — The complete product specification. Defines what CRG does, how every feature works, all data structures, all user interactions, and all LLM behaviors. This is the source of truth for what to build.
- ARCHITECTURE.md — Implementation decisions companion. Defines the source code structure, process model, IPC channels, parser design, template pipeline, auto-layout approach, trimming strategy, error handling, and testing strategy. This is the source of truth for how to build it. If it conflicts with SPEC.md, ARCHITECTURE.md wins.
- TASKS.md — The ordered task breakdown. Milestones and subtasks. Work through them in order unless explicitly told otherwise.

## 2. Core Principles

### 2.1 — Follow the documents, not your instincts

Every major design decision has already been made and written down. Do not invent new patterns, introduce new libraries, or restructure the architecture. If something isn't covered in the documents, ask before improvising.

Specific things that are already decided — do not revisit:

- Zustand is the renderer state manager. Not Redux, not MobX, not React context.
- React Flow is the graph visualization layer. It is a rendering layer only — it does not own state.
- The action parser is a state machine. Not regex.
- The template system has two layers. Handlebars does not handle block resolution.
- Auto-layout is force-directed via d3-force. Not tree layout, not grid packing.
- Token trimming removes whole sections in priority order. No partial trimming within sections.
- File persistence uses JSON + plain text. No database for v1.
- IPC channels are the defined set in ARCHITECTURE.md Section 3. Add new ones only when a feature genuinely requires it.

### 2.2 — One file, one job

Every source file should have a single, clear responsibility. If you find yourself writing a file that does two things, split it. The source structure in ARCHITECTURE.md Section 1 is your guide — follow it.

### 2.3 — Dependencies flow downward

The orchestrator depends on the parser, validator, and executor. None of them depend on the orchestrator. Components depend on Zustand stores. Stores never depend on components. Main process modules never import from renderer. Renderer modules never import from main. Both may import from /src/shared/.

If you find yourself creating a circular dependency, stop and restructure.

### 2.4 — Types are the contract

The shared type definitions in /src/shared/types/ are the contract between main and renderer processes. When you need to pass data across IPC, define the payload type there first, then implement both sides. Do not use any. Do not use untyped IPC messages.

### 2.5 — Test as you build

Do not leave testing for later. Every module you build should have tests before you move on to the next task. The priority order in ARCHITECTURE.md Section 15 is deliberate — the action parser and validator are the highest-risk components and must have the most thorough test coverage.

When writing tests:

- Test the happy path first.
- Then test every error case and edge case you can identify.
- For the action parser specifically: implement every test case listed in ARCHITECTURE.md Section 4. That list is a minimum, not a maximum.
- Use Vitest. Tests go in /src/test/ mirroring the source structure.

## 3. Coding Standards

### 3.1 — TypeScript strictness

Use strict TypeScript throughout. Enable strict: true in tsconfig. No any types except in genuinely unavoidable cases (e.g., wrapping an untyped third-party API), and in those cases add a comment explaining why.

### 3.2 — Naming conventions

- Files: kebab-case.ts (e.g., action-parser.ts, graph-store.ts)
- React components: PascalCase.tsx (e.g., GraphCanvas.tsx, NodeInspector.tsx)
- Types/Interfaces: PascalCase (e.g., ParsedAction, GraphState)
- Functions: camelCase (e.g., parseActions, resolveTemplate)
- Constants: UPPER_SNAKE_CASE for true constants, camelCase for configuration values
- IPC channels: namespace:action format (e.g., graph:state-update, control:start)

### 3.3 — Error handling

Never silently swallow errors. Every catch block must either handle the error meaningfully or re-throw it. Use the patterns defined in ARCHITECTURE.md Section 11:

- Parse failures → escalation ladder (retry → reconstruct → pause).
- LLM communication failures → exponential backoff, 3 retries, then pause and alert user.
- File system errors → log, retry once, alert user if persistent. Never lose in-memory state.
- Validation failures → reject individual action, log with reason, continue executing other valid actions in the batch.

Log every error with enough context to diagnose the problem: what was attempted, what failed, and what the input was.

### 3.4 — Logging

Use winston for all logging in the main process. Log levels:

- error — something broke that needs user attention
- warn — something unexpected but recoverable (missing file, unknown data block keyword, token trimming)
- info — normal operational events (action executed, phase transition, LLM call sent/received)
- debug — detailed diagnostic info (full prompt assembled, full LLM response, parser state transitions)

Every log entry that relates to the orchestrator loop should include the current phase, turn number, and LLM agent name for easy filtering.

### 3.5 — Comments

Write comments to explain why, not what. The code should be readable enough that what it does is obvious. Comments should explain non-obvious design choices, reference spec/architecture sections for complex logic, and flag deferred features.

Use this format when flagging deferred features:

```typescript
// [DEFERRED] Multi-LLM concurrency — v1 supports single LLM only.
// See SPEC.md Section 16 for future scope.
```

### 3.6 — Imports

Use path aliases if configured, otherwise use relative imports. Keep imports organized: external libraries first, then shared types, then local modules. No unused imports.

## 4. Patterns to Follow

### 4.1 — IPC communication

Always use the typed channel constants from /src/shared/ipc-channels.ts. Never write channel name strings inline.

Main-side handlers go in /src/main/ipc/ipc-handlers.ts. Renderer-side bridge functions go in /src/renderer/ipc/ipc-bridge.ts. Zustand store actions call bridge functions — components never call IPC directly.

Pattern for renderer → main:

```typescript
// In Zustand store action:
const updateNode = (nodeId: string, data: Partial<Node>) => {
  set((state) => { /* optimistic update */ });
  ipcBridge.sendUserEdit({ nodeId, data }); // bridge handles IPC
};
```

Pattern for main → renderer:

```typescript
// In IPC bridge setup (renderer):
window.electronAPI.on(IPC_CHANNELS.GRAPH_STATE_UPDATE, (payload) => {
  useGraphStore.getState().applyStateUpdate(payload);
});
```

### 4.2 — Zustand stores

Keep stores focused. Three stores as defined in ARCHITECTURE.md:

- renderer-graph-store — nodes, edges, positions, selections, locks
- ui-store — active tab, inspector state, UI preferences
- session-store — LLM status, phase info, chat messages

Use Zustand's set with immer-style updates for complex state mutations. Do not read store state inside components with getState() — use hooks (useGraphStore(selector)).

### 4.3 — React Flow integration

React Flow gets its nodes and edges from Zustand via props or hooks. When React Flow fires an event (node drag, click, connect), the handler updates Zustand, which causes React Flow to re-render with the new state.

Never read React Flow's internal state from outside React Flow. Never write to React Flow's state directly. It is a rendering layer.

### 4.4 — Data access abstraction

All file read/write operations for graph data go through the GraphDataAccess interface (ARCHITECTURE.md Section 12). Do not use fs.readFile / fs.writeFile directly for graph files anywhere outside of file-persistence.ts. This abstraction is the clean seam for a future SQLite migration.

Config files (definitions, phases, prompts, settings) are read through config-loader.ts. Same principle — one module owns the file format.

### 4.5 — Adding new features

When adding something new, follow this checklist:

1. Does it need a new IPC channel? If yes, add the channel to ipc-channels.ts, define the payload type in ipc.ts, add the handler in ipc-handlers.ts, add the bridge function in ipc-bridge.ts.
2. Does it need new shared types? If yes, define them in /src/shared/types/ first.
3. Does it touch graph state? If yes, the mutation goes through graph-store.ts (main) and is pushed to renderer via IPC.
4. Does it need UI state? If yes, add it to the appropriate Zustand store.
5. Does it need tests? Yes. It always needs tests.

## 5. Patterns to Avoid

### 5.1 — Do not over-engineer

CRG is designed to evolve through iteration. Build the simplest correct implementation for v1. Specific things to resist:

- Do not build plugin systems, event buses, or middleware layers unless the architecture document calls for them. It doesn't.
- Do not add abstraction layers beyond what ARCHITECTURE.md specifies. One data access interface is enough. One provider interface is enough.
- Do not optimize for performance before there is a measured performance problem. The token estimator uses word count × 1.3. That's fine for v1.
- Do not add libraries that aren't in the tech stack (SPEC.md Section 17) without explicit approval.

### 5.2 — Do not deviate from the spec

If the spec says "v1 boundary," respect it. Specifically:

- Chat does not trigger graph mutations. This is a firm v1 boundary (SPEC.md Section 8).
- Phase transitions are turn-count based only. No conditional transitions for v1 (SPEC.md Section 6.6).
- Single LLM agent only. The multi-LLM concurrency system is deferred (SPEC.md Section 16).
- States are managed by the LLM during cleanup, not automatically propagated (SPEC.md Section 4.6).
- No SQLite. JSON + plain text files only (SPEC.md Section 16).

### 5.3 — Do not create god files

If a file is growing past ~300 lines, it's probably doing too much. Split it. The exception is test files, which can be longer to accommodate thorough test suites.

### 5.4 — Do not bypass the type system

No any. No as unknown as SomeType. No @ts-ignore. If the types don't work, fix the types — don't suppress them.

### 5.5 — Do not leave dead code

If you write something and then realize it's not needed, delete it. Don't comment it out "for later." Version control exists.

## 6. Task Execution Protocol

When you receive a task (either a specific subtask from TASKS.md or an ad-hoc request):

Before writing code:

1. Re-read the relevant sections of SPEC.md and ARCHITECTURE.md.
2. Identify which files you'll need to create or modify.
3. Identify dependencies — what needs to exist before this task can work?
4. If anything is unclear or ambiguous, state your assumptions before proceeding.

While writing code:

5. Create or modify files one at a time. After each file, verify it compiles (no TypeScript errors).
6. Follow the patterns in Section 4. Avoid the anti-patterns in Section 5.
7. Write tests alongside the implementation, not after.

After writing code:

8. Run the test suite. Everything must pass.
9. Briefly summarize what you built, what decisions you made, and anything the user should review.

## 7. Decision-Making When Documents Are Silent

The spec and architecture cover a lot, but not everything. When you encounter something not addressed:

For trivial decisions (naming a helper function, choosing between two equivalent approaches to a small implementation detail): just pick one and move on. Mention it in your summary.

For non-trivial decisions (adding a new IPC channel, changing a data structure, choosing between approaches with different tradeoffs): state the options, your recommendation, and why. Then ask before proceeding.

The hierarchy of authority is: ARCHITECTURE.md > SPEC.md > your best judgment > asking the user. Always prefer the written documents over improvisation.

## 8. Common Gotchas

Things that are easy to get wrong in this project. Watch for them.

**Node IDs are globally unique.** Not per-graph-level. A single counter in the root graph metadata. If you're creating a node inside a Master Node's sub-graph, it still gets the next global ID. See SPEC.md Section 4.1 and ARCHITECTURE.md Section 9.

**move_to must be last.** If the parser finds a move_to action followed by other actions in the same turn, the entire batch is rejected. Not just the move_to — everything. See SPEC.md Section 5.2.

**last_created is resolved during execution, not parsing.** The parser preserves it as a token. The executor resolves it to the actual node ID of the most recently created node in the current turn. See SPEC.md Section 5.2.

**React Flow does not own state.** Zustand owns state. React Flow renders it. Every time you're tempted to call a React Flow method to get node data, stop and get it from Zustand instead. (renderer-graph-store.ts in the renderer, graph-store.ts in main — don't confuse them)

**Main process is authoritative during LLM runs.** When the orchestrator is running, main's graph state is the source of truth. User edits go renderer → main → main applies → main pushes back to renderer. Not the other way around.

**File blocks and data blocks are different things.** File blocks are [file: name] and contain user-written text with {{variables}}. Data blocks are [data: keyword] and are generated by CRG code. Handlebars handles variables in file blocks. The Phase Template Resolver handles block resolution. Two layers, in sequence. See ARCHITECTURE.md Section 5.

**Goal Nodes and Artifact Nodes are protected.** The LLM cannot modify Goal Nodes at all. The LLM cannot modify Artifact Node content — it can only create edges from Artifact Nodes and create new nodes linked to them. See SPEC.md Sections 4.1 and 5.4.

**Chat does not mutate the graph.** The user's chat with the LLM is conversational only. All graph edits by the user go through the Inspector and context menus. Chat responses from the LLM do not produce actions. This is a firm boundary. See SPEC.md Section 8.

**Sub-graph files are loaded on demand.** Only the root graph is loaded at startup. Master Node sub-graphs are loaded when entered. Don't pre-load them. See ARCHITECTURE.md Section 9.

**Phase turn counts live in phase-order.txt, not in individual phase files.** Phase files define prompt template blocks only. See SPEC.md Section 6.6.

## 9. Working With Multiple Milestones

If you're asked to work on an entire milestone (e.g., "do Milestone 3"), work through the subtasks in order. Each subtask should result in compilable, tested code before moving to the next.

If you're asked to jump ahead or work on a task out of order, check the dependency column in the TASKS.md milestone summary table. If the dependencies aren't met, flag this before proceeding.

If you're making changes that affect an already-completed milestone (e.g., adding a field to a shared type), update the tests for the affected milestone as well.

## 10. Handling Scope Creep

If the user asks for something that goes beyond what's in SPEC.md and TASKS.md:

- If it's small and clearly beneficial (fixing a bug, improving an error message): do it.
- If it's a new feature or a change to existing behavior: point out that it's not in the spec, ask if they want to add it, and suggest where in the documents it should be recorded.
- If it's something explicitly deferred in SPEC.md Section 16 (multi-LLM, auto state propagation, SQLite, conditional phase transitions): flag it as deferred and confirm the user wants to pull it into v1 scope before proceeding.

---

Read this document before every work session. Follow SPEC.md for what to build, ARCHITECTURE.md for how to build it, TASKS.md for what to build next, and this document for how to behave while building it.
```