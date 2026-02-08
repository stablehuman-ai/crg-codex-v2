import type { GraphEdge, GraphNode } from './graph';
import type { PromptBlock } from './config';

export interface GraphStateUpdatePayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNodeLockedPayload {
  nodeId: string;
  source: 'user' | 'llm';
}

export interface LlmStatusPayload {
  status: string;
}

export interface LlmChatResponsePayload {
  message: string;
}

export interface LogEntryPayload {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: Record<string, string>;
}

export interface PhaseUpdatePayload {
  phaseName: string;
  turnNumber: number;
}

export interface FileChangedPayload {
  path: string;
  changeType: 'add' | 'change' | 'unlink';
}

export interface PromptPreviewPayload {
  prompt: string;
}

export interface GraphUserEditPayload {
  target: 'node' | 'edge';
  action: 'create' | 'update' | 'delete';
  node?: GraphNode;
  edge?: GraphEdge;
}

export interface GraphUserSelectPayload {
  nodeId: string;
}

export interface GraphUserDeselectPayload {
  nodeId: string;
}

export interface ControlPhaseTransitionPayload {
  phaseName: string;
}

export interface ChatSendPayload {
  message: string;
}

export interface SettingsUpdatePayload {
  key: string;
  value: string;
}

export interface PromptsUpdatePayload {
  phaseName: string;
  blocks: PromptBlock[];
}

export interface AppPingResponse {
  message: string;
}

export interface ElectronAPI {
  ping: () => Promise<AppPingResponse>;
}
