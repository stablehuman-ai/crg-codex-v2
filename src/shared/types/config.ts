export type PromptBlock = FilePromptBlock | DataPromptBlock;

export interface FilePromptBlock {
  kind: 'file';
  name: string;
}

export interface DataPromptBlock {
  kind: 'data';
  keyword: string;
}

export interface PhaseConfig {
  name: string;
  blocks: PromptBlock[];
}

export interface DefinitionFile {
  name: string;
  content: string;
}

export interface LLMAgentConfig {
  name: string;
  provider: string;
  host: string;
  model: string;
  role: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  apiKey?: string;
}

export type TemplateVariable =
  | 'agent_name'
  | 'agent_role'
  | 'agent_model'
  | 'phase_name'
  | 'turn_number'
  | 'total_turns'
  | 'goal_content'
  | 'goal_name'
  | 'node_count'
  | 'edge_count'
  | 'current_node_name'
  | 'current_node_id';
