# CRG — Architecture Document

Companion to SPEC.md. This document pre-answers implementation decisions that the specsheet intentionally leaves open. Claude Code and any agent working on this codebase should follow these decisions. If a decision here conflicts with the specsheet, this document takes precedence — it represents later, more specific decisions.

## 1. Source Code Structure
```
/src
  /main                     # Electron main process
    /crg                    # Core orchestration engine
      orchestrator.ts       # Main loop: phase progression, turn execution
      template-resolver.ts  # Layer 1: reads phase files, resolves [file:] and [data:] blocks
      variable-sub.ts       # Layer 2: Handlebars pass over assembled text
      context-builder.ts    # Generates data block content (graph serialization, position, etc.)
      action-parser.ts      # State-machine parser for LLM action output
      action-validator.ts   # Validates parsed actions against rules (Section 5.4 of spec)
      action-executor.ts    # Executes validated actions on the graph state
      token-budget.ts       # Estimates token counts and trims context by priority
      phase-manager.ts      # Tracks current phase, turn count, transitions, loop behavior
    /llm
      llm-provider.ts       # Abstract interface for LLM communication
      lmstudio-provider.ts  # LM Studio implementation
      openai-provider.ts    # OpenAI-compatible API implementation
      anthropic-provider.ts # Anthropic API implementation
    /data
      graph-store.ts        # Authoritative graph state in main process
      file-persistence.ts   # Reads/writes graph JSON, sub-graph files, id-counter
      config-loader.ts      # Reads all definition files, phase files, defaults, settings
      file-watcher.ts       # Chokidar setup, change detection, reload triggers
    /ipc
      ipc-handlers.ts       # All IPC channel handlers (main-side)
      ipc-channels.ts       # Channel name constants (shared with renderer)
    main.ts                 # Electron main entry point

  /renderer                 # Electron renderer process
    /stores
      renderer-graph-store.ts   # Zustand store: nodes, edges, positions, selections
      ui-store.ts           # Zustand store: active tab, inspector state, UI prefs
      session-store.ts      # Zustand store: LLM status, phase info, chat messages
    /components
      /graph
        GraphCanvas.tsx      # React Flow wrapper
        CustomNode.tsx       # Node rendering (size by importance, color by type/state)
        CustomEdge.tsx       # Edge rendering (color by type, offset for multiples)
        NodeInspector.tsx    # Right-side inspector panel
        ChatBox.tsx          # Collapsible message box
      /tabs
        GraphTab.tsx
        PromptsTab.tsx
        LogsTab.tsx
        SettingsTab.tsx
        StatsTab.tsx
      /controls
        TopControlBar.tsx    # Start/Stop, mode toggles, status display
      App.tsx
    /ipc
      ipc-bridge.ts         # Renderer-side IPC helpers (wraps window.electronAPI)
    /layout
      force-layout.ts       # d3-force integration for auto-layout
    renderer.ts             # Renderer entry point

  /shared                   # Code shared between main and renderer
    /types
      graph.ts              # Node, Edge, GraphState type definitions
      actions.ts            # Action types, parsed action interfaces
      config.ts             # Phase, prompt template, definition types
      ipc.ts                # IPC message payload types
    /constants
      defaults.ts           # Default values (importance, colors, etc.)
    ipc-channels.ts         # Channel name constants

  /test
    /unit
      action-parser.test.ts
      action-validator.test.ts
      template-resolver.test.ts
      token-budget.test.ts
      context-builder.test.ts
    /integration
      orchestrator.test.ts
      file-persistence.test.ts
```

The guiding principle is: every file has one job, and dependencies flow downward. The orchestrator depends on the parser, validator, and executor — none of them depend on the orchestrator. The renderer depends on Zustand stores — components never call IPC directly; they call store actions which handle IPC internally.

## 2. Process Architecture & State Flow

### 2.1 Two-Process Model

CRG runs as an Electron app with two processes. The boundary between them is strict.

Main process owns: file I/O (reading/writing the project folder), file watching (chokidar), LLM communication (API calls via Axios), template assembly (Phase Template Resolver + Handlebars), action parsing (state-machine parser), action validation, action execution (modifying authoritative graph state), graph persistence (writing graph-data.json and sub-graph files), token budget estimation and context trimming, logging (winston), and phase management (tracking current phase, turn count, transitions).

Renderer process owns: Zustand stores (UI-facing graph state, UI preferences, selection state), React Flow rendering, the Inspector panel, all tab UIs (Graph, Prompts, Logs, Settings, Stats), user interaction handling, and chat message input.

The rule of thumb: if it touches files, the network, or LLM APIs, it's main process. If it touches the screen, it's renderer.

### 2.2 Dual Graph State

The graph's in-memory state exists in both processes — Zustand in the renderer for UI, and a parallel representation in main (graph-store.ts) for CRG operations. Main is authoritative during LLM runs.

State flow during LLM operation:
```
CRG (main) executes action
  → updates main graph state
  → pushes delta to renderer via IPC
  → Zustand updates
  → React Flow re-renders
```

State flow during user editing (CRG idle):
```
User edits in Inspector
  → Zustand updates
  → React Flow re-renders
  → change pushed to main via IPC
  → main updates its graph state
  → file persistence writes to disk
```

State flow during user editing (CRG running):
```
User selects node → node is locked
  → lock status pushed to main via IPC → CRG respects lock
User edits node → same as idle flow
  → CRG is informed of the change on next turn context construction
```

### 2.3 React Flow's Role

Zustand is the single source of truth. React Flow is a rendering layer that reads from Zustand and dispatches events back to it.

React Flow receives graph state from Zustand as props and renders it. When the user drags a node, React Flow fires an event, which updates Zustand, which flows back down to React Flow. React Flow's internal state is never read directly by any other part of the system.

This creates a small amount of boilerplate to keep React Flow in sync, but it gives us a single place where graph state is managed, which every other part of the system (CRG, file persistence, Inspector panel, Stats tab) can rely on.

## 3. IPC Channel Definitions

All IPC communication uses a defined set of named channels. These are the complete set for v1. New channels can be added as features require them.

### Main → Renderer

| Channel | Payload | Purpose |
|---------|---------|---------|
| graph:state-update | Updated nodes/edges (delta or full) | After CRG executes actions, pushes updated graph state |
| graph:node-locked | Node ID, lock source | Notifies when CRG is operating on a node |
| llm:status | Status string | Status updates ("Prompting LLM…", "Waiting for reply…", etc.) |
| llm:chat-response | Response text | Chat reply from LLM |
| log:entry | Log entry object | New log entry for the Logs tab |
| phase:update | Phase name, turn number | Current phase/turn info |
| file:changed | File path, change type | File watch notification (config file changed externally) |
| prompt:preview | Assembled prompt string | Assembled prompt for Step-by-Step approval |

### Renderer → Main

| Channel | Payload | Purpose |
|---------|---------|---------|
| graph:user-edit | Node/edge data, edit type | User created/edited/deleted a node or edge |
| graph:user-select | Node ID | User selected a node (triggers lock) |
| graph:user-deselect | Node ID | User deselected a node (releases lock) |
| control:start | — | Start button pressed |
| control:stop | — | Stop button pressed |
| control:step-approve | — | Approve in Step-by-Step mode |
| control:step-reject | — | Reject in Step-by-Step mode |
| control:phase-transition | Target phase name | Manual phase transition |
| chat:send | Message text | User sent a chat message |
| settings:update | Settings key/value | Settings changed |
| prompts:update | Phase name, block data | Prompt template edited in UI |

## 4. Action Output Parser: State Machine

The LLM action output parser is a state-machine, not regex-based. A regex approach will seem simpler initially but will break on escaped characters inside quoted strings, nested special characters, and edge cases with malformed output. A state-machine parser walks through the string character by character, tracking whether it's inside quotes, handling escapes, and splitting on delimiters only when in the right state. This is not much more code than regex — but it's far more robust and debuggable.

### Parser States
```
OUTSIDE              → Scanning for [ACTION: token
ACTION_NAME          → Reading the action name until first |
FIELD_KEY            → Reading a field name until :
FIELD_VALUE_UNQUOTED → Reading an unquoted value until | or ]
FIELD_VALUE_QUOTED   → Reading a quoted value, handling \" and \] escapes, until closing unescaped "
BETWEEN_FIELDS       → After a field value, expecting | or ]
```

Text outside [ACTION: ...] blocks is captured separately as the LLM's reasoning text and stored in the turn log.

### Test Coverage Requirements (Minimum)

This parser should be one of the first things built and one of the most heavily tested components. The test suite must include:

- Single well-formed action
- Multiple well-formed actions in one response
- Quoted strings containing | characters
- Quoted strings containing ] characters (escaped)
- Escaped quotes within quoted strings
- Missing reason field (→ parse failure for that action)
- Unknown action name (→ logged and skipped, other actions still execute)
- Completely malformed output (no valid action blocks → parse failure)
- Empty response (→ parse failure)
- Response with only reasoning text, no action blocks (→ parse failure)
- Mixed valid and invalid actions in same response
- last_created reference resolving correctly
- current reference resolving correctly

## 5. Two-Layer Template System

Prompt assembly involves two distinct systems that run in sequence. Naming them clearly prevents conflation or attempts to make Handlebars do both jobs.

### Layer 1 — Phase Template Resolver (custom CRG code)

- Reads the phase file (e.g., exploration.txt)
- Processes each line top to bottom
- [file: name] → reads the corresponding file from /prompts/ and inserts its content
- [data: keyword] → calls the corresponding CRG data generator function and inserts its output
- Output: a single concatenated string of all resolved blocks

### Layer 2 — Variable Substitution (Handlebars)

- Takes the concatenated string from Layer 1
- Replaces all {{template_variables}} with their runtime values
- Output: the final prompt string ready to send to the LLM

### Pipeline
```
Phase file → Layer 1 (resolve blocks) → Raw assembled text → Layer 2 (Handlebars) → Final prompt
```

Handlebars is only used for Layer 2. It does not handle block resolution. The Phase Template Resolver is straightforward custom code — essentially a line-by-line reader with a switch on block type.

## 6. Token Budget Trimming: Greedy Section Removal

When the assembled prompt exceeds the token budget, CRG trims by removing whole sections in priority order (lowest priority removed first). No partial trimming of individual nodes within a section. No binary search. Sections are removed atomically. This is simple, predictable, and debuggable.

### Trimming Sequence (first removed → last resort)

1. Remove Graph Overview (L0 section)
2. Remove Nearby Nodes (L1 section)
3. Reduce action history depth (from N to N/2, then to 1, then remove)
4. Remove parent-graph context (when inside a Master Node)
5. Truncate current node L3 content (last resort — keeps first N tokens of content)

### Never Removed

- Goal Node (L3)
- Phase instructions and guidelines
- Available actions
- Adjacent nodes (L2)

If these core sections alone exceed the budget, the prompt is fundamentally too large. CRG pauses with an error rather than producing a degraded prompt.

After trimming, CRG logs exactly which sections were removed and the final token estimate.

## 7. Auto-Layout: Constrained Force-Directed

Auto-layout uses a force-directed simulation with constraints. Reasoning graphs aren't trees — they have cycles, cross-links, and contradictions. A tree layout would either break on these or force artificial hierarchy. Force-directed handles arbitrary topology gracefully and produces organic-looking results that match how people tend to think about concept maps.

### Forces

- Node repulsion: All nodes repel each other, preventing overlap. Minimum spacing distance enforced.
- Edge springs: Connected nodes are pulled toward a readable distance from each other.
- Goal anchoring: The Goal Node is pinned to the right side of the canvas.
- Branch separation: Nodes on disconnected branches experience additional repulsion to prevent tangling.

### Behavior

- When a new node is created, it is placed near its parent node with a small random offset to break symmetry.
- The simulation runs for a fixed number of iterations (50—100) to resolve the placement, then stops. It does not run continuously.
- Manually placed (user-dragged) nodes are pinned and excluded from the simulation.
- The simulation only affects unpinned nodes in the immediate vicinity of the change — not the entire graph on every node creation.

### Implementation

Use d3-force or a similar lightweight force simulation library. React Flow has community examples of d3-force integration that can serve as a starting point.

This will not produce beautiful layouts. It will produce readable, non-overlapping layouts that keep the graph usable while the LLM works. Visual polish comes through iteration.

## 8. File Watching Scope

### Watched Directories (via chokidar in main process)

- /phases/ — phase template files and phase-order.txt
- /prompts/ — user-authored prompt text files
- /definitions/ — node types, edge types, categories, states
- /defaults/ — importance, colors
- /settings/ — LLM config, UI config

Changes to these files are detected, the relevant configuration is reloaded in main, and a notification is pushed to the renderer to update the UI.

### Not Watched During Runtime

- /graph/ — CRG owns graph state in memory while running. External edits to graph JSON files during runtime are ignored and will be overwritten on next save. When CRG is stopped, the on-disk graph files are the source of truth. CRG loads them on next start.
- /files/ — Artifact source files. These are read on import. Changes to an already-imported file are not automatically reflected in the Artifact Node. The user can re-import if needed.

### Mid-Run Config Changes

If a phase file is edited while that phase is active, the changes take effect on the next turn. This is safe because Stateless Mode reconstructs the prompt from scratch every turn.

## 9. Sub-Graph File Storage

Each Master Node's sub-graph is stored as a separate JSON file in /graph/.

Naming convention: graph-data-{nodeId}.json (e.g., graph-data-n05.json)

Node ID uniqueness: Global, not per-graph-level. A single incrementing counter is stored in the root graph-data.json metadata ("nextId": 47). Every node created anywhere in the project gets the next global ID. Collisions are impossible.

Parent reference: The parent graph's Master Node entry stores a reference to its sub-graph file:
```json
{
  "id": "n05",
  "type": "master",
  "name": "Economic Implications",
  "subgraph": "graph-data-n05.json"
}
```

Loading: Sub-graphs are loaded on demand when the user or LLM enters a Master Node. They are not pre-loaded at startup — only the root graph is loaded initially.

Saving: Sub-graph files are saved whenever their state changes, following the same persistence pattern as the root graph.

## 10. LLM Provider Abstraction

All LLM communication goes through an abstract LLMProvider interface. This keeps the orchestrator decoupled from any specific API.
```typescript
interface LLMProvider {
  sendPrompt(prompt: string, config: LLMConfig): Promise<LLMResponse>;
  validateConnection(): Promise<boolean>;
  estimateTokens(text: string): number;
}

interface LLMResponse {
  content: string;
  tokensUsed: { prompt: number; completion: number };
  model: string;
  latencyMs: number;
}

interface LLMConfig {
  temperature: number;
  maxTokens: number;
  contextWindow: number;
}
```

Each provider (LM Studio, OpenAI, Anthropic) implements this interface. The orchestrator only ever calls LLMProvider methods — it never knows which provider is behind it.

Token estimation falls back to word count × 1.3 unless the provider supplies a proper tokenizer.

## 11. Error Handling Patterns

### Parse Failures

Follow the escalation ladder defined in the spec (Section 6.2):

1. First failure: remind LLM of correct syntax, retry.
2. After 2 consecutive failures: reconstruct prompt from scratch, retry.
3. After 5 consecutive failures: pause and alert the user.

All parse failures are logged with the original LLM output.

### Action Validation Failures

Individual action failures do not block other actions in the same turn. A failed action is logged with the specific rule violated, the rejection appears in the LLM's recent-actions context on the next turn, and CRG continues executing the remaining valid actions.

The exception is move_to appearing before other actions — this rejects the entire batch (spec Section 5.4).

### LLM Communication Failures

Network errors and API errors are retried with exponential backoff (3 attempts). After exhausting retries, CRG pauses and alerts the user. No silent failures — every error is logged and surfaced.

### File System Errors

Missing definition files or folders: CRG logs a warning and uses sensible defaults. Missing graph files on startup: CRG creates them with empty/default state. Write failures: CRG retries once, then logs an error and alerts the user. The in-memory state is not lost — only persistence is affected.

## 12. Data Access Abstraction

All graph read/write operations go through an abstract data access layer, not direct file operations. This is the clean seam for a future SQLite migration.
```typescript
interface GraphDataAccess {
  loadGraph(graphId: string): Promise<GraphState>;
  saveGraph(graphId: string, state: GraphState): Promise<void>;
  loadSubGraph(masterNodeId: string): Promise<GraphState>;
  saveSubGraph(masterNodeId: string, state: GraphState): Promise<void>;
  getNextNodeId(): Promise<string>;
  incrementNodeId(): Promise<void>;
}
```

The v1 implementation reads/writes JSON files. A future v2 implementation swaps in SQLite. Nothing above the data access layer changes.

## 13. Orchestrator Main Loop

The orchestrator is the heartbeat of CRG. Its loop is straightforward:
```
1. Check: is there a pending user chat message?
   → Yes: pause loop, handle chat (Section 8 of spec), resume.
   → No: continue.

2. Check: has the current phase exhausted its turn count?
   → Yes: advance to next phase (or loop). Update phase manager.
   → No: continue.

3. Assemble prompt:
   a. Read current phase file.
   b. Layer 1: resolve all block references.
   c. Layer 2: substitute template variables.
   d. Estimate tokens. Trim if over budget.

4. Send prompt to LLM.

5. Receive reply.

6. Parse reply (state-machine parser).
   → Parse failure: follow escalation ladder (Section 11).

7. Validate each parsed action.
   → Rejections logged; valid actions continue.

8. Execute valid actions on graph state.

9. Push state updates to renderer via IPC.

10. Log all actions and reasons.

11. Increment turn counter.

12. If autonomous mode: wait for cooldown timer, then go to 1.
    If step-by-step mode: push prompt preview to renderer, wait for approval, then go to 1.
```

## 14. Locking Protocol

Locking prevents conflicts between the user and the LLM operating on the same node.

User-initiated lock: When the user selects a node in the graph canvas, the renderer sends graph:user-select to main. Main marks the node as locked. If the LLM attempts any mutation on a locked node, the action is rejected with reason "node is locked by user." The LLM can still see the node in its context (it appears normally in serialized graph data). When the user deselects, graph:user-deselect releases the lock.

CRG-initiated lock (future/multi-LLM): When an LLM is positioned on a node, that node could be marked as occupied. For v1 with a single LLM, this is informational only — it drives the avatar rendering on the canvas but doesn't block user edits. The user always has priority.

## 15. Testing Strategy

### Priority Order

1. Action parser — highest priority. This is the most failure-prone component and the hardest to debug in production. Full test suite as defined in Section 4 above.
2. Action validator — every rule in spec Section 5.4 gets a test.
3. Template resolver — test block resolution, missing files, malformed block references.
4. Token budget — test trimming sequence, edge cases (exactly at budget, single token over, core sections exceeding budget).
5. Context builder — test L0—L3 serialization, Master Node context, parent context inclusion.
6. Orchestrator integration — end-to-end tests with mock LLM provider.

### Testing Framework

Vitest, as specified in the tech stack. Tests live in /src/test/ mirroring the source structure.

### Mock Strategy

The LLMProvider interface makes mocking trivial — integration tests inject a mock provider that returns canned responses (well-formed, malformed, mixed). File system tests use a temporary project folder created in the test fixture and cleaned up after.

This document should be referenced alongside SPEC.md during implementation. All architectural decisions here are binding for v1.