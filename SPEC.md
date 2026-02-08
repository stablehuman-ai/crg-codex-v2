\# CRG — Collaborative Reasoning Graphs: Technical Specsheet v3



\## 1. Overview



CRG is a Windows 11 desktop application that allows a user and one or more LLMs to collaboratively build and explore a reasoning graph. The user interacts with the graph directly through the UI. LLMs interact with the graph through CRG's orchestration layer.



\*\*Core Loop:\*\*



User → Graph ↔ CRG ↔ LLM(s)



CRG Prompt → LLM Reply → Parse Reply → Validate → Execute → Repeat



All node and edge types share a single schema-stable data structure. "Type," "category," "state," "inputs," and "outputs" are semantic metadata that affect UI rendering and how CRG serializes graph context into text for the LLM. They do not change storage or executable behavior. Any special behavior lives in the CRG policy layer (prompt templates, action validation, and phase configuration), not the data model.



\## 2. Tech Stack Requirements



\- Windows 11 desktop app. Runs locally. Portable (no installer required).

\- Modular architecture with clear frontend/backend separation and code/data separation.

\- Well-defined internal APIs so features can be added or modified without breaking others.

\- Compartmentalized and highly editable — suitable for multiple agents to work on the codebase.

\- Easy for a non-technical user to install and run.

\- Scalable to more complex feature sets over time.



\## 3. Text-File-Driven Architecture



\### 3.1 Core Principle



The project folder is the single source of truth. CRG is a runtime that reads the folder, interprets its contents, and operates accordingly. Every configurable element — phases, prompt templates, node types, edge types, categories, importance defaults, state definitions, and action definitions — is defined as a plain text file in a structured folder hierarchy.



CRG loads the full folder on startup. Changes to files are detected and reflected in the UI. Changes made in the UI are written back to the files. Sync does not need to be real-time — a short delay is acceptable. In the event of simultaneous edits, last write wins.



The user never needs to touch code. All customization happens through text files or the UI.



\### 3.2 Project Folder Structure

```

/project-name/

&nbsp; /phases/

&nbsp;   exploration.txt

&nbsp;   growth.txt

&nbsp;   connections.txt

&nbsp;   cleanup.txt

&nbsp;   phase-order.txt            ← defines the sequence, turn counts, and loop behavior

&nbsp; /prompts/

&nbsp;   intro.txt

&nbsp;   general-guidelines.txt

&nbsp;   guidelines-explore.txt

&nbsp;   guidelines-growth.txt

&nbsp;   guidelines-cleanup.txt

&nbsp;   chat.txt                   ← template for user chat interactions (see Section 8)

&nbsp; /definitions/

&nbsp;   /node-types/

&nbsp;     goal.txt

&nbsp;     standard.txt

&nbsp;     hypothesis.txt

&nbsp;     master.txt

&nbsp;     artifact.txt

&nbsp;     question.txt

&nbsp;   /edge-types/

&nbsp;     supports.txt

&nbsp;     contradicts.txt

&nbsp;     derived-from.txt

&nbsp;   /categories/

&nbsp;     ...

&nbsp;   /states/

&nbsp;     active.txt

&nbsp;     supported.txt

&nbsp;     contested.txt

&nbsp;     resolved.txt

&nbsp;     archived.txt

&nbsp; /defaults/

&nbsp;   importance.txt             ← maps node types to default importance values

&nbsp;   colors.txt                 ← maps types/categories/states to display colors

&nbsp; /graph/

&nbsp;   graph-data.json            ← top-level graph state (nodes, edges, positions)

&nbsp;   graph-data-n05.json        ← sub-graph for Master Node n05 (created on demand)

&nbsp;  (id counter is stored in graph-data.json metadata, not as a separate file)

&nbsp; /files/

&nbsp;   imported-document.txt      ← user-imported files that become Artifact Nodes

&nbsp; /settings/

&nbsp;   llm-config.txt

&nbsp;   ui-config.txt

```



This structure is a starting point. CRG should handle missing folders or files gracefully and use sensible defaults.



\### 3.3 Phase Template Format



A phase file is an ordered list of block references. Each block reference is a line in brackets. CRG reads the file top to bottom and assembles the prompt by resolving each block in order.



There are two kinds of blocks:



\*\*File blocks\*\* reference a text file written by the user. CRG reads the file and inserts its content.



\*\*Data blocks\*\* tell CRG to inject live information from the current graph state, the LLM's session, or the system.



Phase files contain only block references. Turn counts are defined exclusively in phase-order.txt (see Section 6.6).



\*\*Example — exploration.txt:\*\*

```

\[file: intro]

\[data: agent-identity]

\[data: recent-actions]

\[data: current-position]

\[data: current-graph-context]

\[data: current-task]

\[file: guidelines-explore]

\[file: general-guidelines]

\[data: available-actions]

```



When CRG processes this file it resolves each line:



\- `\[file: intro]` → reads /prompts/intro.txt and inserts its content.

\- `\[data: agent-identity]` → CRG generates a text block with the agent's name, model, and role.

\- `\[data: current-graph-context]` → CRG serializes the graph at proximity-appropriate detail levels based on the LLM's current position.

\- `\[file: guidelines-explore]` → reads /prompts/guidelines-explore.txt.



The user can reorder lines in the text file directly, or reorder blocks in the Prompts Tab UI via drag-and-drop or arrow buttons. Either action updates the other.



\### 3.4 File Blocks — User-Authored Content



File blocks contain text the user has written. They can include `{{template\_variables}}` that CRG substitutes at prompt construction time.



\*\*Available template variables (v1):\*\*



| Variable | What It Resolves To |

|----------|---------------------|

| `{{agent\_name}}` | Agent's display name |

| `{{agent\_role}}` | Agent's role description from config |

| `{{agent\_model}}` | Model name from config |

| `{{phase\_name}}` | Current phase name |

| `{{turn\_number}}` | Current turn within the phase |

| `{{total\_turns}}` | Total turns configured for this phase |

| `{{goal\_content}}` | Goal node's full text content |

| `{{goal\_name}}` | Goal node's name/label |

| `{{node\_count}}` | Total nodes in current graph level |

| `{{edge\_count}}` | Total edges in current graph level |

| `{{current\_node\_name}}` | Name of the node the LLM is on |

| `{{current\_node\_id}}` | ID of the node the LLM is on |



These are available inside file blocks (user-authored prompt text). They are distinct from data blocks, which inject whole sections of formatted context. Template variables are for weaving dynamic values into natural prose.



\*\*Example — intro.txt:\*\*

```

You are {{agent\_name}}, an analytical reasoning agent. Your purpose is to

explore ideas methodically and build structured knowledge graphs. You

communicate your reasoning clearly and always explain why you take an action.

```



\*\*Example — general-guidelines.txt:\*\*

```

You take actions using bracketed commands. Every action must include a

reason field explaining your thinking.



Format: \[ACTION: action\_name | field: value | field: value | reason: "your explanation"]



Example actions:



\[ACTION: create\_node | type: standard | name: "My Node" | content: "This node explores..." | reason: "I want to analyze this aspect separately."]



\[ACTION: create\_edge | from: current | to: last\_created | type: supports | reason: "This new node supports my current position."]



\[ACTION: move\_to | target: last\_created | reason: "Moving to develop this idea further."]



Rules:

\- You must include a reason field on every action.

\- Put move\_to last if you include it — no actions after movement.

\- You can reference your current node with "current" and the most

&nbsp; recently created node with "last\_created".

\- Wrap string values in double quotes.

\- You can take multiple actions per turn.

\- Think out loud before your actions — text outside action blocks is

&nbsp; logged as your reasoning.

```



\### 3.5 Data Blocks — CRG-Generated Content



Data blocks are keywords that tell CRG to generate and insert a specific piece of live context. The set of available data blocks is defined by CRG and documented for the user.



\*\*Core data blocks (v1):\*\*



| Block Keyword | What CRG Injects |

|---------------|------------------|

| agent-identity | Agent name, model, current role |

| goal-node | The goal node's full content (always L3) |

| current-position | Which node the LLM is standing on, with node ID, name, type, state, importance, and the sub-graph path if inside a Master Node |

| recent-actions | The last N actions taken and the LLM's stated reasons (configurable, default 5) |

| current-task | The current phase name, turn number, and what the LLM is expected to do |

| current-graph-context | Graph serialized at proximity-appropriate detail levels (L0—L3). See Section 7.2 for format |

| available-actions | List of actions the LLM can take in this phase |

| nearby-nodes | Adjacent nodes at L2 detail |

| current-node-full | Current node at L3 detail |



New data block types can be added to CRG as the system evolves. If CRG does not recognize a keyword, it logs a warning and inserts a placeholder.



\### 3.6 Definition Files



Node types, edge types, categories, and states are each defined as individual text files. CRG scans the appropriate folder and loads whatever it finds.



\*\*Example — /definitions/node-types/hypothesis.txt:\*\*

```

name: Hypothesis

default-importance: 4

default-state: active

color: #F5A623

description: A proposed explanation or prediction to be tested against the graph.

expected-inputs: 1+

expected-outputs: 1+

```



`expected-inputs` and `expected-outputs` are soft expectations, not hard constraints. CRG surfaces unmet expectations as visual indicators (e.g., a subtle warning icon on a hypothesis with zero incoming edges). The cleanup phase can instruct the LLM to look for under-connected nodes and address them.



\*\*Example — /definitions/edge-types/supports.txt:\*\*

```

name: Supports

color: #7ED321

directional: true

description: The source node provides evidence or reasoning that supports the target node.

```



\*\*Example — /definitions/states/contested.txt:\*\*

```

name: Contested

color: #E74C3C

icon: warning

description: This node's claims are challenged by conflicting evidence in the graph.

The supporting branch should be reviewed.

```



\*\*Example — /defaults/importance.txt:\*\*

```

goal: 5

hypothesis: 4

master: 3

standard: 2

question: 1

```



To add a new node type, the user creates a new text file in /definitions/node-types/. On next load or file-watch trigger, CRG picks it up and it appears in the UI dropdowns. Same for edge types, categories, and states.



\### 3.7 File Watching



\*\*Watched for changes during runtime:\*\* Everything in /phases/, /prompts/, /definitions/, /defaults/, /settings/. These are configuration files. Changes are picked up and reflected in the UI and in subsequent prompt construction. If a phase file is edited mid-run, the change takes effect on the next turn that uses that phase — safe because Stateless Mode reconstructs the prompt from scratch every turn.



\*\*Not watched during runtime:\*\* /graph/graph-data.json and sub-graph files. CRG owns the graph state in memory while running. External edits to graph files while CRG is running are ignored and would be overwritten on next save. When CRG is stopped, the graph state on disk is the source of truth.



\### 3.8 What This Architecture Gives You



\- \*\*No-code customization.\*\* Everything the user adjusts is plain text.

\- \*\*Portable experiments.\*\* Duplicate the project folder to branch. Swap one phase file to test a different approach.

\- \*\*Agent-friendly.\*\* A coding agent working on CRG can add new data block types or definition fields without restructuring the system.

\- \*\*Transparent.\*\* Anyone can open the folder, read the files, and understand exactly how the system is configured.



\## 4. Graph Data Model



\### 4.1 Nodes



All nodes share the same underlying structure. Type, category, and state are metadata fields.



\*\*Node Fields:\*\*



\- \*\*ID\*\* — Auto-assigned short identifier (e.g., n01, n02), globally unique across all graph levels. The ID counter is a single incrementing value stored in the root graph-data.json metadata as the "nextId" field. Whether a node is created at the top level or nested deep inside Master Nodes, it gets the next global ID.

\- \*\*Name / Label\*\* — Human-readable name.

\- \*\*Content\*\* (text body)

\- \*\*Type\*\* (e.g., Goal, Standard, Hypothesis, Master, Artifact, Question — defined via text files in /definitions/node-types/)

\- \*\*Category\*\* (user-defined via text files in /definitions/categories/)

\- \*\*State\*\* (e.g., Active, Supported, Contested, Resolved, Archived — defined via text files in /definitions/states/. See Section 4.6)

\- \*\*Levels of Detail:\*\* L0 (Label only), L1 (Short description), L2 (Medium description), L3 (Full content)

\- \*\*Expected Inputs and Outputs\*\* (soft expectations for how many incoming/outgoing edges a node of this type should have; defined in the type file, surfaced as visual indicators, not enforced as hard constraints)

\- \*\*Importance\*\* (numeric; determines visual scale; defaults assigned by node type via /defaults/importance.txt; overridable by user or LLM per node)



\*\*Node Types (initial set, extensible via text files):\*\*



\- \*\*Goal Node:\*\* Created by the user. Acts as the north star for LLM activity. Always included in prompts sent to the LLM at L3. LLMs cannot modify Goal Nodes — they can only form hypotheses connected to them. Every graph requires at least one. A Goal Node must exist before the LLM can start.

\- \*\*Standard Node:\*\* Default node type.

\- \*\*Hypothesis Node:\*\* A proposed explanation or prediction connected to a goal or other node.

\- \*\*Question Node:\*\* A question raised during exploration.

\- \*\*Master Node:\*\* Contains a sub-graph. Users and LLMs can enter a Master Node and work inside it. See Section 4.7 for storage details. Master Nodes can contain other Master Nodes. For v1, nesting is supported to arbitrary depth but practical testing will determine usable limits.

\- \*\*Artifact Node:\*\* Created when a file is imported (dragged into the graph or project folder). The file's text content populates the node's L3 body. Artifact Nodes are read-only — they persist as original source material and cannot be edited by the LLM or through CRG actions. LLMs may create Derived Nodes (summaries, extracts, structured breakdowns) linked back to the source Artifact via edges. LLMs may create Patch Suggestion Nodes containing proposed edits, linked to the Artifact. The user decides whether to apply patches — it never happens automatically.



\### 4.2 Edges



All edges share the same underlying structure. Type and category are metadata fields defined via text files in /definitions/edge-types/.



\*\*Key properties:\*\*



\- All edges are directional (from → to).

\- Multiple edges between the same two nodes are allowed. If A supports B and B also supports A, those are two separate edges, each with their own type, direction, and context. This is simpler and more expressive than bidirectional edges.

\- In the graph visualization, multiple edges between the same node pair render as slightly offset curved lines (React Flow handles this natively).

\- Different types and categories have different display colors (configurable in /defaults/colors.txt or Settings).



\### 4.3 Level-of-Detail Generation



L0, L1, and L2 are generated by the LLM during the Cleanup phase. L3 is the raw content authored by the user or LLM. Until cleanup generates summaries, CRG uses L3 for all levels (truncated as needed for L0—L2).



\### 4.4 Node Importance \& Visual Sizing



Node importance determines visual scale in the graph. Defaults are assigned by node type (defined in /defaults/importance.txt):



1\. Goal Node — largest (default 5)

2\. Hypothesis — large (default 4)

3\. Master Node — medium-large (default 3)

4\. Standard Node — medium (default 2)

5\. Question Node — small (default 1)



Defaults can be overridden by the user or the LLM per node. The importance scale and per-type defaults are editable via text files.



\### 4.5 Visual Properties



\- Node size scales with importance.

\- Node and edge colors are determined by type/category/state, configurable in /defaults/colors.txt and the Settings Tab.

\- Nodes with unmet connection expectations (e.g., a hypothesis with zero incoming edges) display a subtle visual indicator.

\- Node state may affect visual appearance (e.g., contested nodes show a warning border color).



\### 4.6 Node State



Node states represent the reliability or status of a node's claims within the graph. States are defined as text files in /definitions/states/ and are fully user-customizable.



\*\*Default states (v1):\*\*



\- \*\*Active\*\* — Default state for newly created nodes. Work in progress.

\- \*\*Supported\*\* — The node's claims are well-supported by its branch (strong incoming evidence, no significant contradictions).

\- \*\*Contested\*\* — Conflicting evidence exists in the graph that challenges this node. The branch should be reviewed.

\- \*\*Resolved\*\* — The node has been reviewed and its claims are considered settled.

\- \*\*Archived\*\* — The node is no longer relevant but preserved for reference.



\*\*How states work in v1:\*\* States are semantic labels managed by the LLM during Cleanup phases, not automatically propagated. During cleanup, the LLM reviews branches, evaluates the strength of supporting and contradicting evidence, and updates node states accordingly using the `set\_state` action. This approach leverages the LLM's reasoning ability rather than attempting to encode propagation rules.



Node states are included in the context the LLM sees for each node, so the LLM standing on a node understands how reliable its branch is considered to be.



\*\*\[DEFERRED]\*\* Automatic state propagation (e.g., when a "contradicts" edge is created, downstream nodes are flagged for review). The state field is ready for this; only CRG policy logic would need to be added.



\### 4.7 Master Node Sub-Graph Storage



Each sub-graph is stored as a separate JSON file in the /graph/ folder. When a Master Node is created, CRG creates a file named by the Master Node's ID (e.g., graph-data-n05.json). The parent graph's node entry for the Master Node stores a reference to this file path.



Node ID uniqueness is global, not per-graph-level. The ID counter is a single incrementing value stored in the root graph-data.json metadata. Whether a node is created at the top level or three levels deep inside nested Master Nodes, it gets the next global ID. This eliminates ID collisions entirely — a given ID can only ever exist once across the entire project.



When the LLM enters a Master Node, CRG loads that sub-graph file and uses it as the active graph context. The parent graph stays in memory for constructing reduced-detail parent context (see Section 7.5).



\*\*graph-data.json structure (example):\*\*

```json

{

&nbsp; "metadata": {

&nbsp;   "nextId": 15,

&nbsp;   "createdAt": "2025-01-15T10:30:00Z",

&nbsp;   "lastModified": "2025-01-15T14:22:00Z"

&nbsp; },

&nbsp; "nodes": \[

&nbsp;   {

&nbsp;     "id": "n01",

&nbsp;     "name": "Policy Analysis",

&nbsp;     "content": "Analyze the downstream effects of proposed trade policy X...",

&nbsp;     "type": "goal",

&nbsp;     "category": "",

&nbsp;     "state": "active",

&nbsp;     "importance": 5,

&nbsp;     "l0": "Policy Analysis",

&nbsp;     "l1": "Analysis of trade policy X effects",

&nbsp;     "l2": "Detailed analysis of trade policy X and its downstream effects on regional economies",

&nbsp;     "l3": "Analyze the downstream effects of proposed trade policy X on regional economies, identifying both risks and opportunities.",

&nbsp;     "expectedInputs": 0,

&nbsp;     "expectedOutputs": 1,

&nbsp;     "position": { "x": 500, "y": 300 }

&nbsp;   }

&nbsp; ],

&nbsp; "edges": \[

&nbsp;   {

&nbsp;     "id": "e01",

&nbsp;     "from": "n02",

&nbsp;     "to": "n01",

&nbsp;     "type": "derived-from"

&nbsp;   }

&nbsp; ]

}

```



Sub-graph files (e.g., graph-data-n05.json) follow the same structure but do not contain a `nextId` field — the global counter always lives in the root graph-data.json only.



\*\*Compressing nodes into a Master Node:\*\*



When selected nodes are compressed into a Master Node:



\- All selected nodes move into the new Master Node's sub-graph.

\- All edges between selected nodes move into the sub-graph (internal edges stay internal).

\- Boundary-crossing edges (edges between a selected node and a non-selected node) are redirected to point to/from the new Master Node. For example, if n03 connects to n05 via a "supports" edge and only n05 is compressed, the edge now runs from n03 to the Master Node. The original edge is also preserved inside the sub-graph attached to n05 with a marker indicating it connects to an external node. When the user enters the Master Node, they can see that n05 has an incoming connection from outside.

\- A log entry records every edge redirection so the operation is auditable and theoretically reversible.



\## 5. Serialization \& Syntax



\### 5.1 Prompt Template Syntax



Prompt templates use `{{double\_brace\_variables}}` that CRG replaces with live data at prompt construction time. These appear inside file blocks and are resolved when the phase template is assembled. See Section 3.4 for the full variable list.



\### 5.2 LLM Action Output Syntax



The LLM outputs actions using a structured bracketed format that CRG parses. Each action is self-contained.



\*\*Format:\*\* `\[ACTION: action\_name | field: value | field: value | reason: "..."]`



\*\*Parsing rules:\*\*



\- Field order is flexible. CRG parses by field name, not position.

\- `reason` is required on every action. If missing, CRG treats it as a parse failure.

\- String values are enclosed in double quotes. Quotes inside strings are escaped with backslash (`\\"`). Pipe characters inside quoted strings are permitted. The parser splits on the `|` character (pipe) outside of quoted strings. Spaces around pipes are optional and are trimmed from field keys and values. The pipe character itself is the delimiter, not the space-pipe-space sequence.

\- `]` inside quoted strings must be escaped (`\\]`).

\- Action name must match a known action. Unknown actions are logged and skipped (not a full parse failure — other valid actions in the turn still execute).

\- Node references are bare IDs (e.g., n05), the keyword `current`, or `last\_created`. No quotes needed on these.

\- CRG parses everything inside `\[ACTION: ...]` blocks. Text outside action blocks is treated as the LLM's reasoning — it is logged but not executed.

\- Multiple actions per turn are allowed. CRG executes them sequentially in the order they appear.

\- `move\_to` must be the last action in a turn if present. If CRG detects a `move\_to` before other actions, the entire batch is rejected and the LLM is asked to resubmit with movement last.

\- Later actions in a turn may reference nodes created by earlier actions using `last\_created` or the assigned ID.

\- Nodes are referenced by ID (e.g., n05) in actions. The keyword `current` refers to the LLM's current position.



\*\*Example LLM output:\*\*

```

Based on the goal, I think we need to consider the economic implications separately.



\[ACTION: create\_node | type: hypothesis | name: "Economic Implications" | content: "The policy may have significant downstream effects on regional economies." | reason: "Separating economic factors allows focused analysis."]



\[ACTION: create\_edge | from: current | to: last\_created | type: supports | reason: "This hypothesis derives from the main claim."]



\[ACTION: move\_to | target: last\_created | reason: "I want to develop this hypothesis further."]

```



\*\*Example with edge cases:\*\*

```

\[ACTION: create\_node | type: standard | name: "Cost | Benefit Analysis" | content: "Evaluating the \\"net impact\\" of proposed changes." | reason: "Need to weigh trade-offs explicitly."]

```



\### 5.3 Action Schema



The action schema defines the full set of operations an LLM can request. Each action includes a `reason` field that is logged and fed back in subsequent prompts.



\*\*v1 Actions:\*\*



\- \*\*create\_node\*\* — Create a new node adjacent to the LLM's current position.

\- \*\*create\_edge\*\* — Create a directed edge between two nodes. Both nodes must be within the LLM's L2 visibility range (current node + adjacent nodes).

\- \*\*edit\_node\*\* — Edit the content of the node the LLM is currently standing on.

\- \*\*delete\_node\*\* — Delete a node within L2 visibility. The LLM cannot delete the node it is currently standing on. To delete its current node, the LLM must first move away (in a previous turn), then delete the old node from its new position on the next turn. The target node must be adjacent to the LLM's current position.

\- \*\*move\_to\*\* — Move the LLM's position to a connected node (or into/out of a Master Node sub-graph). Must be the last action in a turn.

\- \*\*merge\_nodes\*\* — Merge two similar/duplicate nodes into one (cleanup phases).

\- \*\*set\_importance\*\* — Change a node's importance value.

\- \*\*set\_type\*\* — Change a node's type.

\- \*\*set\_category\*\* — Change a node's category.

\- \*\*set\_state\*\* — Change a node's state.



Phases can restrict which actions are available (see Section 6.5).



\### 5.4 Action Validation



Every action is validated before execution. Invalid actions are rejected, logged with a clear reason, and the rejection appears in the LLM's recent action history on the next turn so it can self-correct. Other valid actions in the same turn still execute.



\*\*Validation rules:\*\*



| Condition | Result |

|-----------|--------|

| `create\_edge` references a nonexistent node ID | Rejected: "invalid node reference — node \[nXX] does not exist" |

| `create\_edge` targets a node outside L2 visibility | Rejected: "node \[nXX] is outside L2 visibility range" |

| `delete\_node` targeting the LLM's current node | Rejected: "cannot delete current node — move away first and delete from an adjacent position" |

| `edit\_node` on a node that is not the LLM's current position | Rejected: "can only edit current node" |

| `set\_type` to an undefined type | Rejected: "unknown node type" |

| `move\_to` a node that is not adjacent (or not a Master Node parent/child) | Rejected: "target node is not adjacent" |

| Any action on a user-locked node (user has it selected) | Rejected: "node is locked by user" |

| Any action modifying a Goal Node | Rejected: "Goal Nodes cannot be modified by LLM" |

| Any action modifying an Artifact Node (except creating edges from it) | Rejected: "Artifact Nodes are read-only" |

| `move\_to` appears before other actions in the same turn | Entire batch rejected: "move\_to must be the last action — resubmit" |



\## 6. CRG Orchestration Layer



\### 6.1 Core Responsibilities



\- Construct prompts by reading phase template files and resolving all file blocks and data blocks.

\- Manage token budget: track approximate token count of assembled prompts and trim low-priority context if the budget is exceeded (see Section 7.4).

\- Send prompts to the LLM, receive replies, parse replies into actions, validate actions, and execute actions on the graph.

\- Validate actions against the rules in Section 5.4.

\- Serve user-authored prompts when the user chats with the agent.

\- Serve pre-authored follow-up responses when the LLM requests more information about available actions, node types, etc.

\- Manage locking: if a node is selected/being edited by the user, CRG informs the LLM it is view-only. If the LLM attempts to modify a locked node, the action is blocked and the event is logged.

\- Log all LLM actions with the LLM's stated explanation. The last N actions (configurable, default 5) are fed back to the LLM in subsequent prompts so it always understands what has been done and why.



\### 6.2 Parse Failure Handling



\- If CRG cannot parse an LLM reply, it reminds the LLM of the correct syntax and retries.

\- After more than 2 consecutive parse failures, the prompt is reconstructed from scratch and retried.

\- After 5 consecutive parse failures, CRG pauses and alerts the user rather than burning tokens indefinitely.

\- All parse failures are logged with the original LLM output that failed to parse.



\### 6.3 Clarification Sub-Dialog



\- During action execution, the LLM may request more information from CRG. This is a scoped sub-conversation that does not produce graph actions — it only provides the LLM with additional input to complete the current action.

\- Clarification follow-ups are authored/configured by the user (pre-made replies in the prompts folder).

\- Once the action is completed, the clarification thread is discarded.



\### 6.4 Execution Modes



\- \*\*Stateless Mode (default):\*\* Each action cycle uses a fresh LLM call. All context is constructed and provided by CRG. Chat history is not carried forward. The LLM knows what has happened only through the context CRG provides (recent actions, graph state, current position).

\- \*\*Session Mode (debug/testing):\*\* Preserves the chat transcript across turns for inspection and experimentation. Configurable memory depth (how many turns to keep).

\- \*\*Clarification Thread (scoped):\*\* A temporary sub-conversation tied to completing a single action. Discarded once the action completes.



\### 6.5 Phases



The process runs in named phases. Default phase order: Exploration → Growth → Connections → Cleanup → Repeat.



A \*\*Phase\*\* is a configuration bundle defined by its text file (see Section 3.3), consisting of:



\- Prompt template blocks and their ordering

\- Allowed actions (optional — restricts which actions the LLM can take during this phase)

\- Context selection rules (which data blocks to include)



Turn counts are defined in phase-order.txt, not in individual phase files (see Section 6.6).



Phases are configuration, not hard-coded features. Users can add new phases by creating new text files in /phases/. Phase ordering and turn counts are defined in phase-order.txt and can be overridden per agent. Phase ordering can be modified via the UI or the text file.



\### 6.6 Phase Transitions \& Ordering



Phase transitions are turn-count based for v1. Each phase's turn count is defined in phase-order.txt, which is the single source of truth for sequencing and turn counts.



\*\*phase-order.txt format:\*\*

```

\# Phase sequence — runs top to bottom

\# Format: phase-name : turn-count



exploration : 5

growth : 8

connections : 4

cleanup : 3



\# loop: true means the sequence repeats after the last phase completes

loop: true

```



Each phase name maps to a corresponding file in /phases/ (e.g., exploration → exploration.txt). If `loop` is true, the sequence repeats from the top after the last phase completes. If false, the LLM stops after one pass.



\*\*User controls:\*\*



\- The user can manually trigger a phase transition at any time via the UI.

\- The user can reorder phases, skip phases, or repeat phases through the UI or by editing phase-order.txt.



\*\*\[DEFERRED]\*\* Intelligent/conditional phase transitions.



\### 6.7 Concurrency \& Conflict Resolution



\*\*\[DEFERRED — v1 supports a single LLM]\*\*



When multiple LLMs are active on the graph (future feature):



\- An LLM may only edit the node it is currently positioned on.

\- An LLM may create new nodes adjacent to its current position and create edges to connect nodes within L2 visibility.

\- Two LLMs may not occupy the same node. CRG enforces this and will block or redirect an LLM attempting to move to an occupied node.

\- If a user has selected a node, it is locked from LLM edits. The LLM can still view it. Attempted edits are blocked and logged.

\- Graph cleanup (deduplication, merging near-identical nodes, differentiating similar nodes) is handled through dedicated cleanup phases, not through real-time conflict resolution.

\- Conflict handling will evolve through testing. The priority for v1 is a flexible template system that makes it easy to experiment with different concurrency rules via prompt configuration.



\## 7. LLM Spatial Presence \& Context Construction



\### 7.1 Position



Each LLM's position is a pointer to a node (referenced by ID). This pointer determines what context CRG loads into the prompt.



The LLM's position is visible to the user as a labeled avatar that snaps to its current node on the graph canvas.



\### 7.2 Context Loading by Distance



| Distance | Detail Level | What's Included |

|----------|--------------|-----------------|

| Goal Node | L3 | Always included in full, regardless of distance |

| Current node | L3 | Full content |

| Adjacent nodes (1 step) | L2 | Medium description |

| Nearby nodes (2—3 steps) | L1 | Short description |

| All other nodes (current graph level) | L0 | Label and ID only |



\*\*Serialized context format (example):\*\*

```

== GOAL ==

\[n01] "Policy Analysis" (Goal, importance: 5)

Full content: "Analyze the downstream effects of proposed trade policy X

on regional economies, identifying both risks and opportunities."



== YOUR POSITION ==

\[n05] "Economic Implications" (Hypothesis, active, importance: 4)

Full content: "The policy may have significant downstream effects on

regional economies, particularly in manufacturing-dependent areas."



== CONNECTED NODES (L2) ==

→ \[n07] "Regional Impact" (Standard, active, importance: 2) via "supports"

&nbsp; Summary: Focused analysis of regional economic factors including

&nbsp; employment and GDP impact.

← \[n12] "Counter-evidence" (Standard, contested, importance: 2) via "contradicts"

&nbsp; Summary: Recent trade data suggesting limited economic impact in

&nbsp; similar historical cases.

→ \[n01] "Policy Analysis" (Goal, importance: 5) via "derived-from"

&nbsp; \[see GOAL above]



== NEARBY NODES (L1) ==

\[n02] "Historical Precedent" (Standard, supported) — Examines prior

trade policy outcomes.

\[n08] "Labor Market Effects" (Hypothesis, active) — Proposes significant

labor disruption.



== GRAPH OVERVIEW (L0) ==

14 nodes, 18 edges.

\[n03] "Social Implications", \[n04] "Legal Framework",

\[n06] "Environmental Factors", \[n09] "Conclusion Draft",

\[n10] "Source: Trade Report 2024", \[n11] "Labor Data",

\[n13] "Tax Revenue Impact", \[n14] "Supply Chain Analysis"



== RECENT ACTIONS ==

Turn 12: create\_node \[n12] "Counter-evidence" (Standard)

&nbsp; — "Found conflicting data that needs representation."

Turn 12: create\_edge \[n12] → \[n05] via "contradicts"

&nbsp; — "This directly challenges the economic hypothesis."

Turn 12: move\_to \[n12]

&nbsp; — "Want to develop the counter-evidence further."

Turn 11: edit\_node \[n05]

&nbsp; — "Refined the hypothesis to be more specific about regional scope."

Turn 10: create\_node \[n08] "Labor Market Effects" (Hypothesis)

&nbsp; — "Labor is a key sub-component worth isolating."

```



This format is the starting point and will evolve through testing. The key principles are: structured and scannable, every node shows its ID for unambiguous reference, detail decreases with distance, and the LLM always has full context on its immediate surroundings plus a bird's-eye view of the wider graph.



\### 7.3 Navigation



\- The LLM moves by issuing a `move\_to` action (always the last action in a turn). CRG updates the pointer and reconstructs context for the next turn.

\- Each movement includes a `reason` field. This reason is stored and included in the recent actions fed back to the LLM in subsequent prompts.

\- The LLM can enter and exit Master Nodes (sub-graphs). When inside a sub-graph, the context follows the rules in Section 7.5.



\*\*Master Node navigation rules for move\_to:\*\*

```

\- From inside a sub-graph, the LLM can move\_to any node adjacent to its

&nbsp; current position within that sub-graph.

\- To exit a sub-graph, the LLM issues move\_to targeting the parent Master

&nbsp; Node's ID. CRG moves the LLM out to the parent graph, positioned on

&nbsp; the Master Node.

\- To enter a Master Node, the LLM issues move\_to targeting the Master

&nbsp; Node's ID. If the LLM is adjacent to the Master Node, CRG moves it

&nbsp; inside, positioned on the sub-graph's Goal Node (or first node if no

&nbsp; Goal exists inside).

\- The LLM cannot jump directly to nodes in a parent or child graph —

&nbsp; it must explicitly enter or exit through the Master Node boundary.

```



\### 7.4 Token Budget Management



Target context window: 32K tokens (configurable per agent in llm-config.txt).



Prompt budget: 4K—8K tokens for the assembled template (instructions, guidelines, action definitions). The remaining window is available for graph context and action history.



Token estimation: CRG tracks approximate token count using word count × 1.3. If a proper tokenizer is easily available for the configured model, use that instead.



\*\*Priority order for context inclusion (highest to lowest):\*\*



1\. Goal Node (L3) — always included

2\. Current node (L3) — always included

3\. Phase instructions and guidelines — always included

4\. Available actions — always included

5\. Adjacent nodes (L2) — always included

6\. Recent action history (last N) — always included, reduce N if needed

7\. Nearby nodes (L1) — included if space allows

8\. Graph overview (L0) — included if space allows, truncated to fit



If the assembled prompt exceeds the token budget, CRG trims from the lowest-priority sections first: graph overview is truncated, then nearby nodes are reduced, then action history depth is decreased. CRG logs a warning when trimming occurs.



\*\*Organic growth management:\*\* Cleanup phases should instruct the LLM to collapse resolved branches into Master Nodes, which naturally keeps each graph level manageable. This is the primary strategy for preventing unbounded graph growth within a single level.



\### 7.5 Context Inside a Master Node



When the LLM is inside a Master Node's sub-graph, context construction follows these rules:



\*\*Sub-graph context:\*\* The same L0—L3 distance rules from Section 7.2 apply within the sub-graph. The LLM sees its current node at L3, adjacent nodes at L2, nearby at L1, and all other sub-graph nodes at L0. The sub-graph has its own L0 overview (node count, edge count, list of node labels within it).



\*\*Parent context header:\*\* Before the sub-graph context, CRG inserts a section clearly stating where the LLM is: "You are inside Master Node \[n05] 'Economic Implications' which is in the top-level graph." If nesting is deeper, the full path is shown (e.g., "You are inside Master Node \[n22] 'Labor Details' → inside Master Node \[n05] 'Economic Implications' → top-level graph").



\*\*Parent graph context inclusion:\*\*



| Parent Element | Detail Level |

|----------------|--------------|

| Goal Node | L3 — always present regardless of depth |

| Parent Master Node (the one the LLM is inside) | L2 — medium description of the enclosing context |

| Siblings of the Master Node in the parent graph | L1 — short descriptions |

| Everything else in the parent graph | L0 or omitted if token budget is tight |



\## 8. User ↔ LLM Interaction via Chat



The message box on the Graph Tab is a conversational interface, not a command interface.



\- The user can ask the LLM questions about the graph, its reasoning, or its activity.

\- The chat can trigger LLM navigation (e.g., the user asks about a specific area and CRG repositions the LLM's viewpoint to respond in context).

\- The chat does not trigger graph mutations. All graph edits by the user go through the Inspector and right-click context menus. This is a firm v1 boundary.

\- This chat may operate in Session Mode (retaining conversation context across turns) to allow follow-up questions.

\- CRG handles the orchestration: it listens to the chat, repositions the LLM if needed, constructs the appropriate context, and relays the LLM's response.



\### 8.1 Chat Prompt Template



Chat interactions use a separate prompt template defined in /prompts/chat.txt. This template includes the goal node, current position, graph context, and the user's message — but not phase-specific instructions or action definitions. The LLM is responding conversationally, not taking graph actions.



\### 8.2 Chat and the Autonomous Loop



If the user's chat message references a specific area of the graph, CRG may reposition the LLM's viewpoint for the purpose of constructing context for the reply. This is CRG's navigation, not a `move\_to` action. The LLM's official position for the autonomous loop does not change.



\*\*Chat during autonomous operation:\*\* When the LLM is running autonomously through phases, user chat messages are queued. After the current turn completes (actions executed), CRG checks the queue. If there is a pending message, CRG pauses the autonomous loop, constructs a chat-response prompt using chat.txt with full graph context at the LLM's current position, gets the LLM's reply, and delivers it to the user. Autonomous operation then resumes. The UI shows a clear indicator that the LLM is "busy" during a turn and the message is pending.



Chat responses do not count as turns for phase progression. The autonomous loop resumes at the same phase and turn it was on.



\## 9. User Interface



\### 9.1 Top Control Bar



\- Start / Stop buttons. Start requires at least one Goal Node to exist; if none exists, the user is prompted to create one.

\- Mode checkboxes: Autonomous or Step-by-Step.

\- Memory toggle: Stateless or Session Mode. If Session Mode, a control for how many turns to retain.

\- Cooldown timer: configurable delay between autonomous actions.

\- Current status display (text): Is CRG running? What is it currently doing? (e.g., "Prompting LLM...", "Waiting for reply...", "Executing actions...", "Idle", "Paused — user message pending").



\### 9.2 Tabs



\*\*Graph Tab\*\*



\- Collapsible message box at the top (below controls/status) for chatting with the current agent. Can be hidden when the user just wants to watch the graph.

\- Graph canvas on the left.

\- Node Inspector panel on the right. Shows the selected node's: ID, Name, Content, Category, Type, State, L0—L3, Expected Inputs/Outputs (with unmet expectations indicated), Importance.



\*\*Prompts Tab\*\*



\- One section per phase.

\- Each section displays its prompt template as an ordered list of editable text blocks (corresponding to the phase file's block references).

\- Blocks can be added, deleted, reordered (drag-and-drop or arrow buttons), and edited.

\- File blocks show their text content inline, editable.

\- Data blocks show their keyword, a brief description of what CRG will inject, and a short example of the output format. This is a static placeholder, not a live preview. For the exact assembled prompt, the user uses Step-by-Step mode.

\- Bidirectional sync with the project folder's text files.



\*\*Logs Tab\*\*



\- Inbox / history / timeline of all events.

\- In Step-by-Step mode, shows the fully assembled prompt before it is sent to the LLM, with Approve / Reject controls.

\- Easy to export for review.



\*\*Settings Tab\*\*



\- UI settings (node/edge colors, etc.).

\- CRG behavior settings (action history depth, token budget, cooldown timer defaults).

\- LLM connection settings (see Section 10).

\- All settings persist across sessions.



\*\*Stats Tab\*\*



\- Node count, edge count, actions taken.

\- Token count (or word count with approximate token conversion).

\- Current phase and turn number.

\- Any other useful analytics.



\### 9.3 Graph Interactions



\- \*\*Pan:\*\* click and drag on empty canvas.

\- \*\*Zoom:\*\* mouse wheel.

\- \*\*Create node:\*\* right-click → Add.

\- \*\*Select node:\*\* left-click.

\- \*\*Multi-select:\*\* left-click on empty area and drag across nodes.

\- \*\*Move node:\*\* left-click hold and drag.

\- \*\*Edit node:\*\* via the Inspector panel.

\- \*\*Delete node:\*\* via the Inspector panel, or right-click → Delete.

\- \*\*Change node type/category/state:\*\* dropdown on the Inspector panel.

\- \*\*Group nodes:\*\* create a labeled container/comment space that visually groups nodes.

\- \*\*Compress nodes into a Master Node:\*\* selected nodes become a sub-graph inside a new Master Node (see Section 4.7 for edge handling). The user can enter the Master Node to continue working inside. Recursive to arbitrary depth.

\- \*\*Import files:\*\* drag files from the PC into the Graph or Project folder to create Artifact Nodes. .txt and .md files are supported for v1; the architecture accepts any file but only extracts plain text content.



\## 10. LLM Connection



\- \*\*Local LLM via LM Studio:\*\* User specifies Host and Model. Settings persist across sessions.

\- \*\*Hosted LLM via API key:\*\* Supports OpenAI, Anthropic, and similar providers. Settings persist across sessions.

\- Connection settings are per-agent configurable.

\- Context window size is configurable per agent (used by CRG for token budget management).

\- Connection configuration is stored in /settings/llm-config.txt.



\*\*LLM config format:\*\*

```

\# Agent: Explorer

\[agent: Explorer]

provider: lmstudio

host: http://localhost:1234

model: qwen-120b

role: Primary reasoning agent

temperature: 0.7

max-tokens: 2048

context-window: 32768



\# Agent: Critic (future)

\[agent: Critic]

provider: anthropic

api-key: sk-...

model: claude-sonnet-4-5-20250929

role: Adversarial reviewer

temperature: 0.5

max-tokens: 1024

context-window: 200000

```



\## 11. Auto-Layout



CRG provides a minimal auto-layout system to keep the graph readable as LLMs create nodes faster than a user can arrange them.



\*\*V1 requirements:\*\*



\- \*\*No-overlap rule:\*\* Newly created nodes are placed so they do not overlap or intersect with existing nodes. A minimum spacing distance is enforced.

\- \*\*Goal anchoring:\*\* The Goal Node is anchored to one side of the canvas (default: right). New nodes expand outward from the goal toward the opposite side.

\- \*\*Branch separation:\*\* Nodes on different branches are pushed apart to avoid visual tangling.

\- \*\*User override:\*\* The user can manually move any node at any time. Manually placed nodes are treated as pinned and are not moved by auto-layout.



This is not a full layout engine. It is a set of simple placement rules to keep the graph usable. It will be improved through testing and iteration.



\## 12. Debugging \& Logging



\- Structured debug logs that make it easy to identify where failures occur.

\- A chat-log-style view showing: what CRG sent to the LLM, what the LLM replied, and what actions CRG executed. Each turn has a unique ID and can be referenced.

\- In Step-by-Step mode, the fully assembled prompt is displayed before sending, with Approve / Reject controls.

\- Non-compliant LLM behavior (e.g., attempting to edit locked nodes, attempting to modify Goal Nodes, `move\_to` not last in action sequence, edge creation out of L2 range) is logged with details.

\- Parse failures are logged with the original LLM output that failed to parse.

\- Token budget warnings are logged when context trimming occurs.

\- Action validation rejections are logged with the specific rule that was violated.

\- A quick-copy button that exports to clipboard: logs, timeline, graph data, node info, and any other information useful for debugging.



\## 13. Project \& Persistence



\- Graphs can be created, saved, and opened.

\- Creating a new project generates the full folder structure with sensible default files — a basic intro prompt, a chat.txt template, a standard phase sequence, all default node/edge/state type definitions, default importance and color mappings, a default LLM config, an empty graph, and an initialized ID counter.

\- The graph can be started and stopped at any time. The LLM picks up from the current graph state.

\- The entire project lives in a folder. Duplicating the folder creates a backup or branch point, enabling rollback or alternate experimentation paths.

\- All settings persist across sessions (stored in the project's /settings/ folder).



\## 14. Startup Flow



1\. User launches CRG.

2\. CRG presents option to create a new project or open an existing project folder.

3\. If new project: CRG generates the default folder structure and opens it.

4\. User creates at least one Goal Node via the graph canvas.

5\. User configures LLM connection in Settings (if not already configured).

6\. User presses Start.

7\. CRG validates: at least one Goal Node exists, LLM connection is configured.

8\. LLM is positioned on the Goal Node.

9\. Phase 1, Turn 1 begins.



\## 15. Use Cases



These represent intended modes of operation. Each is a configuration of goal nodes, phases, and prompt templates. They are not hard-coded features — they emerge from how the user sets up the project's text files.



| Use Case | Description |

|----------|-------------|

| Debunk | Provide a claim; LLM builds a case against it. |

| Support | Provide a claim; LLM builds a case for it. |

| Analyze | Provide a claim; LLM builds both for and against cases. |

| Choice | Provide options (X vs Y); LLM builds a structured pros/cons graph. |

| Curriculum | Provide a goal; LLM builds a structured plan (learning, self-help, etc.). |

| Research | Provide a topic; LLM builds a research graph with transparent audit trail. |

| Cause \& Effect | Provide a document; LLM maps branching consequences and implications. |

| X-Ray | Provide a document; LLM decomposes every passage, assertion, and source into nodes. |

| Code Review | Provide code; LLM maps structure, flaws, alternatives, improvements, and bugs. |

| Process Map | Specify a process; LLM creates an A-to-Z breakdown of every step, zoomable to any depth. |

| Mathematical Proof | Specify a conjecture; LLM builds a step-by-step proof graph. |

| Long-Form Research | Open-ended, large-scope queries; LLM progressively reads, summarizes, and structures knowledge across arbitrary material. |

| Find the Link | Provide multiple sources; LLM reads, summarizes, and identifies shared themes or connections. |



\## 16. V1 Scope



The following features are described in this spec for architectural awareness but are explicitly deferred beyond v1:



\- \*\*Multi-LLM concurrency\*\* — v1 supports a single LLM agent. The data model and orchestration layer are designed to accommodate multiple agents, but concurrency enforcement, node occupation rules, and multi-agent phase coordination are deferred.

\- \*\*Automatic state propagation\*\* — v1 uses LLM-managed states during cleanup. Automatic propagation rules (e.g., cascading "contested" state when a contradicts edge is added) are deferred.

\- \*\*Socket.IO / multi-user\*\* — Real-time sync for multiple users is a future layer.

\- \*\*Conditional phase transitions\*\* — v1 uses turn-count-based transitions only. Intelligent transitions (e.g., "move to cleanup when graph exceeds N nodes") are deferred.

\- \*\*SQLite migration\*\* — v1 uses JSON + plain text files. The data access layer should be abstracted cleanly to allow a future SQLite backend without rewriting business logic.



\## 17. Tech Stack



| Layer | Choice | Status |

|-------|--------|--------|

| App Shell | Electron (via Electron Forge) | Core |

| Language | TypeScript (full stack) | Core |

| Frontend Framework | React | Core |

| Graph Visualization | React Flow | Core |

| State Management | Zustand | Core |

| Backend / Orchestration | Node.js (Electron main process) | Core |

| Data Persistence | JSON + plain text files (SQLite-ready abstraction) | Core now, SQLite later |

| File Watching | chokidar | Core |

| LLM Communication | Axios + provider abstraction | Core |

| Template Engine | Handlebars | Core |

| Logging | winston | Core |

| Data Validation | Zod | Core |

| Testing | Vitest | Core |

| Real-time Sync | Socket.IO | \[DEFERRED] |



Non-destructive upgrade path. Clean separation between frontend, backend/CRG logic, and data access.

