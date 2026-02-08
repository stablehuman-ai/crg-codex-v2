\# CRG — Task Breakdown



Implementation roadmap for Agent. Work through milestones in order — each builds on the previous. Subtasks within a milestone can sometimes be parallelized, but the listed order is the recommended sequence.



References: SPEC.md (specsheet), ARCHITECTURE.md (architectural decisions). Both are authoritative. If they conflict, ARCHITECTURE.md takes precedence.



---



\## Milestone 1: Project Scaffolding \& Electron Shell



Get a blank Electron app running with the correct folder structure, build tooling, and dev workflow. Nothing functional yet — just the skeleton.



\*\*Tasks\*\*



\*\*1.1 — Initialize Electron Forge project with TypeScript and React\*\*



\- Use Electron Forge to scaffold the project.

\- Configure TypeScript for both main and renderer processes.

\- Configure React for the renderer.

\- Verify: npm start launches a blank Electron window.



\*\*1.2 — Create source folder structure\*\*



\- Create the full /src directory layout as defined in ARCHITECTURE.md Section 1.

\- Create placeholder files (empty .ts / .tsx with basic exports) for every module listed in the architecture.

\- This is scaffolding only — no implementation yet.



\*\*1.3 — Configure Vitest\*\*



\- Install Vitest and configure it for the project.

\- Create /src/test/ directory structure mirroring source.

\- Write one trivial passing test to confirm the test pipeline works.

\- Verify: npm test runs and passes.



\*\*1.4 — Configure IPC preload bridge\*\*



\- Set up Electron's contextBridge and preload script.

\- Expose a typed window.electronAPI object in the renderer.

\- Define the IPC channel name constants in /src/shared/ipc-channels.ts (all channels from ARCHITECTURE.md Section 3).

\- Wire up one round-trip test channel (renderer sends ping, main replies pong) to confirm IPC works.

\- Verify: renderer can send a message to main and receive a response.



\*\*1.5 — Set up shared type definitions\*\*



\- Define all shared TypeScript types in /src/shared/types/:

&nbsp;   - graph.ts — Node, Edge, GraphState, NodeType, EdgeType, NodeState, Category, SubGraphReference. Include all node fields from SPEC.md Section 4.1 (ID, name, content, type, category, state, L0—L3, importance, expected inputs/outputs). Include all edge fields.

&nbsp;   - actions.ts — ParsedAction, ActionType enum (create\_node, create\_edge, edit\_node, delete\_node, move\_to, merge\_nodes, set\_importance, set\_type, set\_category, set\_state), ActionValidationResult, ActionField.

&nbsp;   - config.ts — PhaseConfig, PromptBlock (file block vs data block), DefinitionFile, LLMAgentConfig, TemplateVariable.

&nbsp;   - ipc.ts — Typed payloads for every IPC channel defined in ARCHITECTURE.md Section 3.

\- These types are imported by both main and renderer. They are the contract between processes.



---



\## Milestone 2: Data Layer — Persistence, Config Loading, File Watching



Build the file system layer that reads and writes the project folder. After this milestone, CRG can create a new project, load an existing one, and detect external file changes.



\*\*Tasks\*\*



\*\*2.1 — Implement default project folder generator\*\*



\- When the user creates a new project, CRG generates the full folder structure defined in SPEC.md Section 3.2.

\- Include sensible default files: a basic intro.txt, chat.txt template, all default phase files (exploration.txt, growth.txt, connections.txt, cleanup.txt), phase-order.txt, all default node type definitions (goal.txt, standard.txt, hypothesis.txt, master.txt, artifact.txt, question.txt), all default edge type definitions, all default state definitions, importance.txt, colors.txt, empty graph-data.json with initialized metadata (nextId: 1), default llm-config.txt, default ui-config.txt.

\- Verify: calling the generator produces a complete, valid project folder on disk.



\*\*2.2 — Implement config loader\*\*



\- config-loader.ts reads all definition files, phase files, defaults, and settings from a project folder.

\- Parse node type definitions (name, default-importance, default-state, color, description, expected-inputs, expected-outputs).

\- Parse edge type definitions (name, color, directional, description).

\- Parse state definitions (name, color, icon, description).

\- Parse category definitions.

\- Parse importance.txt and colors.txt defaults.

\- Parse phase-order.txt (phase sequence, turn counts, loop flag).

\- Parse llm-config.txt (agent configs with provider, host, model, role, temperature, max-tokens, context-window).

\- Parse ui-config.txt.

\- Handle missing files/folders gracefully — log warnings and use sensible defaults.

\- Write unit tests for each parser, including edge cases (missing fields, malformed lines, empty files).



\*\*2.3 — Implement graph file persistence\*\*



\- file-persistence.ts implements the GraphDataAccess interface from ARCHITECTURE.md Section 12.

\- loadGraph: reads graph-data.json, returns GraphState.

\- saveGraph: writes GraphState to graph-data.json.

\- loadSubGraph: reads graph-data-{nodeId}.json.

\- saveSubGraph: writes sub-graph state to graph-data-{nodeId}.json.

\- getNextNodeId: reads current counter, returns formatted ID (e.g., n01).

\- incrementNodeId: increments and persists the counter.

\- Handle the nextId counter in root graph metadata as described in ARCHITECTURE.md Section 9.

\- Write unit tests using a temporary project folder.



\*\*2.4 — Implement file watcher\*\*



\- file-watcher.ts uses chokidar to watch the directories listed in ARCHITECTURE.md Section 8.

\- On change: identify what changed, call config-loader.ts to reload the affected config, push file:changed notification to renderer via IPC.

\- Do not watch /graph/ or /files/ during runtime.

\- Debounce rapid changes (e.g., 300ms) to avoid redundant reloads.

\- Write integration test: modify a phase file on disk, verify the watcher triggers and config reloads.



\*\*2.5 — Implement main-process graph store\*\*



\- graph-store.ts in main process holds the authoritative in-memory graph state during runtime.

\- Supports: load from disk (via GraphDataAccess), save to disk, apply mutations (add/remove/edit nodes and edges), manage node locks, track LLM position.

\- Exposes methods for querying graph structure: get adjacent nodes, get nodes by distance, get nodes within a sub-graph, resolve node IDs.

\- This is the single point of truth for graph state while CRG is running.



---



\## Milestone 3: Action Parser \& Validator



Build and thoroughly test the action parsing and validation pipeline. This is the most failure-prone component — it must be rock-solid before the orchestrator is built on top of it.



\*\*Tasks\*\*



\*\*3.1 — Implement state-machine action parser\*\*



\- action-parser.ts implements the state-machine parser described in ARCHITECTURE.md Section 4.

\- Parser states: OUTSIDE, ACTION\_NAME, FIELD\_KEY, FIELD\_VALUE\_UNQUOTED, FIELD\_VALUE\_QUOTED, BETWEEN\_FIELDS.

\- Handle all escaping rules: \\\\" and \\\\] inside quoted strings, | inside quoted strings.

\- Capture reasoning text (content outside \[ACTION: ...] blocks) separately.

\- Return: array of ParsedAction objects + reasoning text string.

\- Handle last\_created and current as special node reference tokens (resolved later during execution, not during parsing).



\*\*3.2 — Write full parser test suite\*\*



\- Implement every test case listed in ARCHITECTURE.md Section 4 (Test Coverage Requirements).

\- At minimum: single action, multiple actions, pipes in quotes, brackets in quotes, escaped quotes, missing reason, unknown action, malformed output, empty response, reasoning-only response, mixed valid/invalid, last\_created resolution, current resolution.

\- Add edge cases: extremely long content fields, actions with no fields except reason, multiple consecutive delimiters, unicode content.



\*\*3.3 — Implement action validator\*\*



\- action-validator.ts validates each parsed action against the rules in SPEC.md Section 5.4.

\- Takes a ParsedAction and the current GraphState (including LLM position, locked nodes, node types).

\- Returns ActionValidationResult (valid/rejected with reason string).

\- Implement every validation rule from the spec table: nonexistent node ID, outside L2 visibility, delete current without move\_to, edit non-current node, undefined type, non-adjacent move\_to, locked node, Goal Node modification, Artifact Node modification, move\_to not last in batch.

\- The move\_to-not-last check operates on the full action batch, not individual actions.



\*\*3.4 — Write full validator test suite\*\*



\- One test per validation rule from SPEC.md Section 5.4.

\- Test that valid actions pass validation.

\- Test that invalid actions return the correct rejection reason.

\- Test batch validation: move\_to last passes, move\_to not last rejects entire batch.

\- Test that rejected actions don't prevent other valid actions in the same batch from executing (except the move\_to batch rejection case).



---



\## Milestone 4: Template System \& Context Builder



Build the prompt assembly pipeline — from phase file to final prompt string. After this milestone, CRG can construct a complete prompt for any phase given a graph state.



\*\*Tasks\*\*



\*\*4.1 — Implement Phase Template Resolver (Layer 1)\*\*



\- template-resolver.ts reads a phase file and resolves all block references.

\- Process each line: \[file: name] → read from /prompts/{name}.txt; \[data: keyword] → call the corresponding data generator.

\- Unknown data keywords: log warning, insert placeholder text.

\- Missing file references: log warning, insert placeholder text.

\- Output: single concatenated string.

\- Write tests: valid phase file, missing file reference, unknown data keyword, empty phase file.



\*\*4.2 — Implement variable substitution (Layer 2)\*\*



\- variable-sub.ts runs Handlebars over the assembled text from Layer 1.

\- Register all template variables from SPEC.md Section 3.4: {{agent\_name}}, {{agent\_role}}, {{agent\_model}}, {{phase\_name}}, {{turn\_number}}, {{total\_turns}}, {{goal\_content}}, {{goal\_name}}, {{node\_count}}, {{edge\_count}}, {{current\_node\_name}}, {{current\_node\_id}}.

\- Provide a context object with current runtime values for all variables.

\- Write tests: all variables resolve, undefined variable produces empty string (not crash), mixed text and variables.



\*\*4.3 — Implement context builder — graph serialization\*\*



\- context-builder.ts generates the content for each data block keyword.

\- Implement current-graph-context: serialize graph at proximity-appropriate detail levels (L0—L3) based on LLM's current position, following the format in SPEC.md Section 7.2.

\- Implement goal-node: Goal Node at L3.

\- Implement current-position: current node ID, name, type, state, importance, sub-graph path.

\- Implement agent-identity: agent name, model, role.

\- Implement recent-actions: last N actions with reasons.

\- Implement current-task: phase name, turn number, expected behavior.

\- Implement available-actions: list of permitted actions for current phase.

\- Implement nearby-nodes: adjacent nodes at L2.

\- Implement current-node-full: current node at L3.

\- Each generator takes graph state + config and returns a formatted string.

\- Write tests for each data block generator. Test graph serialization with a small sample graph (5—10 nodes, various distances from current position).



\*\*4.4 — Implement context for Master Node sub-graphs\*\*



\- Extend context-builder.ts to handle the case where the LLM is inside a Master Node.

\- Include parent context header with full navigation path (SPEC.md Section 7.5).

\- Include parent graph elements at appropriate detail levels: Goal always L3, parent Master Node L2, siblings L1, everything else L0 or omitted.

\- Write tests: LLM inside one level of nesting, LLM inside two levels of nesting.



\*\*4.5 — Implement token budget manager\*\*



\- token-budget.ts estimates token count of assembled prompt (word count × 1.3, or tokenizer if available).

\- If over budget, trim by section priority as defined in ARCHITECTURE.md Section 6.

\- Log all trimming decisions.

\- Pause with error if core sections alone exceed budget.

\- Write tests: under budget (no trimming), slightly over (L0 removed), significantly over (multiple sections removed), way over (error triggered).



\*\*4.6 — Integrate the full prompt assembly pipeline\*\*



\- Wire together: Phase Template Resolver → Variable Substitution → Token Budget check/trim.

\- Given a phase name, graph state, agent config, and runtime context, produce a final prompt string.

\- Write an integration test: assemble a prompt for the exploration phase with a sample graph. Verify the output contains all expected sections in order.



---



\## Milestone 5: LLM Communication



Build the provider abstraction and implement the concrete providers. After this milestone, CRG can send a prompt to an LLM and receive a reply.



\*\*Tasks\*\*



\*\*5.1 — Define LLM provider interface\*\*



\- Implement the LLMProvider interface from ARCHITECTURE.md Section 10 in llm-provider.ts.

\- Define LLMResponse type (content, tokens used, model, latency).



\*\*5.2 — Implement LM Studio provider\*\*



\- lmstudio-provider.ts implements LLMProvider.

\- Uses Axios to send prompts to the local LM Studio API (OpenAI-compatible endpoint).

\- Handle connection errors, timeouts, and retries (3 attempts with exponential backoff).

\- validateConnection: test the endpoint and return success/failure.

\- estimateTokens: word count × 1.3 fallback.



\*\*5.3 — Implement OpenAI provider\*\*



\- openai-provider.ts implements LLMProvider.

\- Uses Axios to call the OpenAI API.

\- Handle API key authentication, rate limiting, error responses.

\- Retry logic: 3 attempts with exponential backoff.



\*\*5.4 — Implement Anthropic provider\*\*



\- anthropic-provider.ts implements LLMProvider.

\- Uses Axios to call the Anthropic Messages API.

\- Handle API key authentication, rate limiting, error responses.

\- Retry logic: 3 attempts with exponential backoff.



\*\*5.5 — Implement provider factory\*\*



\- Given an agent's config (provider name, host, API key, model), return the appropriate LLMProvider instance.

\- Validate config completeness before constructing the provider.



---



\## Milestone 6: Orchestrator \& Action Execution



Build the core loop that ties everything together — prompt assembly, LLM communication, parsing, validation, and execution. After this milestone, CRG can run autonomously through phases.



\*\*Tasks\*\*



\*\*6.1 — Implement action executor\*\*



\- action-executor.ts takes a validated action and applies it to the graph state in main-process graph-store.

\- Implement each action type:

&nbsp;   - create\_node — create node adjacent to LLM's current position, assign next global ID, apply default importance/state from type definition.

&nbsp;   - create\_edge — create directed edge between two nodes.

&nbsp;   - edit\_node — update content of current node.

&nbsp;   - delete\_node — remove node and all connected edges.

&nbsp;   - move\_to — update LLM position pointer.

&nbsp;   - merge\_nodes — merge two nodes (combine content, redirect edges, delete the merged-away node).

&nbsp;   - set\_importance, set\_type, set\_category, set\_state — update the respective field.

\- Track last\_created — after create\_node, store the new node's ID so subsequent actions can reference it.

\- Resolve current and last\_created tokens to actual node IDs before execution.

\- Write tests for each action type. Include: create then reference via last\_created, delete with edge cleanup, merge with edge redirection.



\*\*6.2 — Implement phase manager\*\*



\- phase-manager.ts tracks current phase, current turn within that phase, and handles transitions.

\- Load phase sequence and turn counts from phase-order.txt.

\- advanceTurn(): increment turn. If turn count exhausted, advance to next phase. If last phase and loop is true, restart from first phase. If loop is false, signal completion.

\- manualTransition(phaseName): jump to a specific phase, reset turn counter.

\- getCurrentPhase(): return phase name and turn info.

\- Write tests: normal progression through phases, loop behavior, manual transition.



\*\*6.3 — Implement parse failure handling\*\*



\- In the orchestrator, implement the escalation ladder from SPEC.md Section 6.2:

&nbsp;   1. First failure: construct a reminder prompt with correct syntax, retry.

&nbsp;   2. After 2 consecutive failures: reconstruct full prompt from scratch, retry.

&nbsp;   3. After 5 consecutive failures: pause, alert user via IPC.

\- Track consecutive failure count. Reset on successful parse.

\- Log every failure with the original LLM output.



\*\*6.4 — Implement orchestrator main loop\*\*



\- orchestrator.ts implements the loop described in ARCHITECTURE.md Section 13.

\- Steps: check for pending chat → check phase transition → assemble prompt → send to LLM → parse reply → validate actions → execute actions → push state to renderer → log → increment turn → cooldown/wait.

\- Support autonomous mode (loop with cooldown) and step-by-step mode (pause after prompt assembly, wait for approval).

\- Support stateless mode (default — fresh prompt each turn) and session mode (accumulate chat history).

\- Handle the chat message queue: pause loop, construct chat prompt using chat.txt template, get reply, deliver to renderer, resume.

\- Verify start prerequisites: at least one Goal Node exists, LLM connection is configured and validated.

\- Position LLM on Goal Node at start.



\*\*6.5 — Wire orchestrator to IPC\*\*



\- Connect orchestrator events to IPC channels:

&nbsp;   - Push graph:state-update after action execution.

&nbsp;   - Push llm:status at each stage of the loop.

&nbsp;   - Push phase:update on phase/turn changes.

&nbsp;   - Push log:entry for all logged events.

&nbsp;   - Push prompt:preview in step-by-step mode.

&nbsp;   - Listen for control:start, control:stop, control:step-approve, control:step-reject, control:phase-transition, chat:send.

\- Write integration test: mock LLM provider returns a canned response with two valid actions. Verify orchestrator parses, validates, executes, and pushes correct state update over IPC.



---



\## Milestone 7: Renderer Foundation



Build the renderer shell — Zustand stores, IPC bridge, React app structure, and tab navigation. After this milestone, the app displays a tabbed UI that receives and reflects state from main.



\*\*Tasks\*\*



\*\*7.1 — Implement Zustand graph store (renderer)\*\*



\- renderer-graph-store.ts in renderer: holds nodes, edges, positions, selections, locked nodes.

\- Actions: update from IPC delta, add/edit/delete node (user-initiated), select/deselect node, update positions.

\- On user mutations: push changes to main via IPC (graph:user-edit, graph:user-select, graph:user-deselect).



\*\*7.2 — Implement Zustand UI store\*\*



\- ui-store.ts: active tab, inspector panel state (selected node ID, expanded/collapsed), UI preferences.



\*\*7.3 — Implement Zustand session store\*\*



\- session-store.ts: LLM status string, current phase/turn, chat messages (array of user/LLM message pairs), running/paused/idle status.

\- Update from IPC: llm:status, phase:update, llm:chat-response.



\*\*7.4 — Implement IPC bridge (renderer side)\*\*



\- ipc-bridge.ts wraps window.electronAPI with typed helpers.

\- Set up listeners for all Main → Renderer channels. Route incoming data to the appropriate Zustand store action.

\- Expose typed send functions for all Renderer → Main channels.



\*\*7.5 — Build app shell with tab navigation\*\*



\- App.tsx with a tab bar: Graph, Prompts, Logs, Settings, Stats.

\- Each tab renders its placeholder component.

\- Top control bar placeholder (above tabs).

\- Verify: app launches, tabs switch, layout is correct.



---



\## Milestone 8: Graph Canvas \& Visualization



Build the graph rendering layer — React Flow canvas, custom node and edge rendering, auto-layout, and basic graph interactions.



\*\*Tasks\*\*



\*\*8.1 — Implement React Flow canvas\*\*



\- GraphCanvas.tsx wraps React Flow.

\- Reads nodes and edges from Zustand graph store.

\- Passes interaction events (node drag, click, connect) back to Zustand.

\- Configure: pan (click drag on empty canvas), zoom (mouse wheel).

\- Verify: displays nodes and edges from Zustand state. Dragging a node updates its position in Zustand.



\*\*8.2 — Implement custom node rendering\*\*



\- CustomNode.tsx renders a node based on its type, state, importance, and category.

\- Size scales with importance value (SPEC.md Section 4.4).

\- Color determined by type/category/state, read from loaded color config.

\- Display: node name, type badge, state indicator.

\- Unmet connection expectations show a subtle warning icon.

\- LLM avatar indicator when the LLM is positioned on this node.



\*\*8.3 — Implement custom edge rendering\*\*



\- CustomEdge.tsx renders edges with color by type.

\- Directional arrows.

\- Multiple edges between the same pair render as slightly offset curves (use React Flow's built-in support).



\*\*8.4 — Implement graph interaction handlers\*\*



\- Right-click context menu: Add Node (with type sub-menu), Delete Node, Group Nodes, Compress to Master Node.

\- Multi-select: click-drag on empty area to select multiple nodes.

\- Connect nodes: drag from a node handle to create an edge (opens a type picker).

\- Double-click node to select and open in Inspector.



\*\*8.5 — Implement auto-layout\*\*



\- force-layout.ts using d3-force as described in ARCHITECTURE.md Section 7.

\- Forces: node repulsion, edge springs, Goal Node pinned right, branch separation.

\- Runs for 50—100 iterations on node creation, then stops.

\- Pinned (user-dragged) nodes are excluded from simulation.

\- Called when: node created, nodes compressed into Master Node.



\*\*8.6 — Implement Master Node enter/exit\*\*



\- Double-click a Master Node to enter its sub-graph.

\- Canvas clears and renders the sub-graph contents.

\- Breadcrumb trail shows current navigation path (e.g., "Top Level > Economic Implications > Labor Details").

\- "Back" button or breadcrumb click to exit to parent level.

\- Request sub-graph data from main via IPC (main loads from file if not in memory).



\*\*8.7 — Implement node compression\*\*



\- Multi-select nodes → right-click → "Compress to Master Node."

\- Send selected node IDs to main via IPC.

\- Main creates the Master Node, moves selected nodes into sub-graph, redirects boundary-crossing edges (SPEC.md Section 4.7), logs edge redirections.

\- Push updated graph state to renderer.



---



\## Milestone 9: Inspector Panel \& Node Editing



Build the right-side panel for viewing and editing node details.



\*\*Tasks\*\*



\*\*9.1 — Implement Inspector panel layout\*\*



\- NodeInspector.tsx displays when a node is selected.

\- Shows: ID (read-only), Name (editable), Content/L3 body (editable textarea), Type (dropdown), Category (dropdown), State (dropdown), Importance (number input), Expected Inputs/Outputs (display with met/unmet indicators), L0—L2 summaries (display, read-only).

\- Dropdowns populated from loaded definition files (node types, categories, states).



\*\*9.2 — Wire Inspector edits to state\*\*



\- Edits in the Inspector update Zustand immediately (optimistic UI).

\- Changes are pushed to main via graph:user-edit IPC.

\- Main updates its graph state and persists to disk.



\*\*9.3 — Implement node deletion via Inspector\*\*



\- Delete button in Inspector. Confirmation dialog.

\- Remove node and all connected edges.

\- Push update to main.



\*\*9.4 — Implement file import (Artifact Nodes)\*\*



\- Drag-and-drop files onto the graph canvas.

\- Support .txt and .md for v1.

\- Copy file to /files/ folder.

\- Create an Artifact Node with the file's text content as L3 body.

\- Artifact Nodes render as read-only in the Inspector (no edit controls on content).



---



\## Milestone 10: Prompts Tab



Build the UI for viewing and editing prompt templates, with bidirectional sync to the project folder.



\*\*Tasks\*\*



\*\*10.1 — Implement Prompts Tab layout\*\*



\- One section per phase, ordered by phase-order.txt.

\- Each section shows its block list.



\*\*10.2 — Implement block display and editing\*\*



\- File blocks: show text content inline, editable. Save on blur or explicit save.

\- Data blocks: show keyword, brief description of what CRG injects, and a short example of output format. Not editable (the keyword is fixed), but can be reordered or removed.

\- Add block button: choose file block (pick or create a prompt file) or data block (pick from available keywords).



\*\*10.3 — Implement block reordering\*\*



\- Drag-and-drop or up/down arrow buttons to reorder blocks within a phase.

\- Reordering updates the phase file on disk (via IPC to main).

\- External edits to the phase file (detected by file watcher) update the UI.



\*\*10.4 — Implement bidirectional sync\*\*



\- UI edits → write to file (via main IPC).

\- File edits → file watcher detects change → push to renderer → UI updates.

\- Handle potential conflicts: last write wins, as specified in SPEC.md Section 3.1.



---



\## Milestone 11: Logs Tab



Build the logging display and step-by-step approval UI.



\*\*Tasks\*\*



\*\*11.1 — Implement log entry display\*\*



\- Scrollable timeline of all events, newest at top (or bottom — configurable).

\- Each entry: timestamp, event type (action executed, action rejected, parse failure, LLM call, phase transition, user edit, file change), details.

\- Color-code by event type.



\*\*11.2 — Implement step-by-step mode UI\*\*



\- When in step-by-step mode: display the fully assembled prompt before it's sent.

\- Approve / Reject buttons.

\- Approve → sends control:step-approve to main → orchestrator proceeds.

\- Reject → sends control:step-reject to main → orchestrator skips this turn and advances.



\*\*11.3 — Implement log export\*\*



\- "Copy to Clipboard" button: exports full log as formatted text.

\- Include: all turns with prompts sent, LLM replies, actions executed, rejections.



---



\## Milestone 12: Settings Tab \& Stats Tab



\*\*Tasks\*\*



\*\*12.1 — Implement Settings Tab\*\*



\- LLM connection settings: provider dropdown, host, API key, model, temperature, max tokens, context window. Save to llm-config.txt via main.

\- "Test Connection" button → calls validateConnection() on the provider.

\- UI settings: node/edge colors (with color pickers), mapped to colors.txt.

\- CRG behavior settings: action history depth, token budget, cooldown timer. Mapped to appropriate config files.



\*\*12.2 — Implement Stats Tab\*\*



\- Display: node count, edge count, total actions taken, tokens used (cumulative), current phase and turn number.

\- Reads from Zustand session store (updated via IPC from main).

\- Simple, read-only display. Refresh on every state update.



---



\## Milestone 13: Top Control Bar \& Chat



Build the control bar and the user-LLM chat interface.



\*\*Tasks\*\*



\*\*13.1 — Implement Top Control Bar\*\*



\- Start button: validates prerequisites (Goal Node exists, LLM configured) → sends control:start. If prerequisites not met, show error message.

\- Stop button: sends control:stop. Orchestrator finishes current action execution, then stops.

\- Mode toggle: Autonomous / Step-by-Step. Stored in UI store, sent to main.

\- Memory toggle: Stateless / Session Mode. If Session Mode, number input for turn retention depth.

\- Cooldown timer: number input (seconds between autonomous turns).

\- Status display: text readout from llm:status IPC channel ("Idle", "Prompting LLM…", "Waiting for reply…", "Executing actions…", "Paused — user message pending").



\*\*13.2 — Implement Chat Box\*\*



\- Collapsible message box at top of Graph Tab (below control bar).

\- Text input + send button.

\- Message history display (user messages and LLM responses).

\- Send → chat:send IPC → main queues message → orchestrator handles per SPEC.md Section 8.2.

\- Receive → llm:chat-response IPC → display in chat.

\- "Busy" indicator when LLM is mid-turn and message is queued.



\*\*13.3 — Implement chat orchestration in main\*\*



\- Chat message queue in orchestrator.

\- After current turn completes, check queue.

\- If pending message: pause autonomous loop, construct chat prompt using chat.txt template with full graph context at LLM's current position, send to LLM, deliver response to renderer via IPC, resume loop.

\- Chat does not count as a turn for phase progression.

\- Chat does not trigger graph mutations.



---



\## Milestone 14: End-to-End Integration \& Polish



Wire everything together, test full workflows, and fix issues.



\*\*Tasks\*\*



\*\*14.1 — Full startup flow test\*\*



\- Launch app → create new project → verify folder generated → create Goal Node → configure LLM in Settings → press Start → verify LLM is positioned on Goal Node → verify Phase 1 Turn 1 begins.



\*\*14.2 — Full autonomous run test\*\*



\- Start with a Goal Node and a configured LLM (can use LM Studio with a local model).

\- Run through one full phase cycle (Exploration → Growth → Connections → Cleanup).

\- Verify: nodes created, edges created, LLM moves through graph, phase transitions happen at correct turn counts, loop restarts.

\- Watch for: parse failures, validation rejections, context trimming, token budget warnings.



\*\*14.3 — User interaction during LLM operation\*\*



\- While LLM is running: select a node, verify it locks, verify LLM's action on that node is rejected and logged.

\- Edit a node while LLM is running. Verify the edit persists and the LLM sees the updated content on next turn.

\- Send a chat message during autonomous operation. Verify it's queued, delivered after current turn, and response appears in chat.



\*\*14.4 — Master Node workflow test\*\*



\- Create several nodes. Compress them into a Master Node. Verify edge redirection.

\- Enter the Master Node. Verify sub-graph renders correctly with breadcrumb trail.

\- Start LLM inside the Master Node. Verify context includes parent graph summary and correct path.

\- Exit Master Node. Verify parent graph is intact.



\*\*14.5 — File sync test\*\*



\- While app is running: edit a phase file externally. Verify the change is picked up and reflected in Prompts Tab.

\- Edit a prompt file externally. Verify the next LLM turn uses the updated text.

\- Duplicate the project folder. Open the copy. Verify it loads correctly as an independent project.



\*\*14.6 — Error resilience test\*\*



\- Disconnect LLM mid-run (kill LM Studio or revoke API key). Verify CRG retries, then pauses and alerts user.

\- Feed the parser intentionally malformed output (via mock). Verify escalation ladder works correctly through to the 5-failure pause.

\- Delete a definition file while app is running. Verify graceful degradation (warning logged, defaults used).



\*\*14.7 — UI polish pass\*\*



\- Consistent styling across all tabs.

\- Loading states for LLM operations.

\- Error messages are clear and actionable.

\- Graph canvas is responsive and performs well with 50+ nodes.

\- Node Inspector scrolls properly with long content.

\- Keyboard shortcuts: Ctrl+Z undo for user graph edits (if feasible for v1, otherwise defer).



---



\## Milestone Summary



| # | Milestone | Focus | Depends On |

|---|-----------|-------|------------|

| 1 | Project Scaffolding | Electron shell, types, test setup | — |

| 2 | Data Layer | File I/O, config loading, persistence | 1 |

| 3 | Action Parser \& Validator | Parse \& validate LLM output | 1 |

| 4 | Template System \& Context | Prompt assembly pipeline | 2, 3 |

| 5 | LLM Communication | Provider abstraction, API integration | 1 |

| 6 | Orchestrator | Core loop tying everything together | 2, 3, 4, 5 |

| 7 | Renderer Foundation | Zustand stores, IPC bridge, app shell | 1 |

| 8 | Graph Canvas | React Flow, custom rendering, auto-layout | 7 |

| 9 | Inspector \& Editing | Node detail panel, file import | 7, 8 |

| 10 | Prompts Tab | Template editing UI with bidirectional sync | 7, 2 |

| 11 | Logs Tab | Log display, step-by-step approval | 7, 6 |

| 12 | Settings \& Stats | Configuration UI, analytics display | 7 |

| 13 | Control Bar \& Chat | Start/stop controls, user-LLM chat | 7, 6 |

| 14 | Integration \& Polish | End-to-end testing, error resilience, UI polish | All |



---



Work through milestones in order. Reference SPEC.md for behavior requirements and ARCHITECTURE.md for implementation decisions. When in doubt, keep it simple — CRG is designed to evolve through iteration.

