export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
  GRAPH_STATE_UPDATE: 'graph:state-update',
  GRAPH_NODE_LOCKED: 'graph:node-locked',
  LLM_STATUS: 'llm:status',
  LLM_CHAT_RESPONSE: 'llm:chat-response',
  LOG_ENTRY: 'log:entry',
  PHASE_UPDATE: 'phase:update',
  FILE_CHANGED: 'file:changed',
  PROMPT_PREVIEW: 'prompt:preview',
  GRAPH_USER_EDIT: 'graph:user-edit',
  GRAPH_USER_SELECT: 'graph:user-select',
  GRAPH_USER_DESELECT: 'graph:user-deselect',
  CONTROL_START: 'control:start',
  CONTROL_STOP: 'control:stop',
  CONTROL_STEP_APPROVE: 'control:step-approve',
  CONTROL_STEP_REJECT: 'control:step-reject',
  CONTROL_PHASE_TRANSITION: 'control:phase-transition',
  CHAT_SEND: 'chat:send',
  SETTINGS_UPDATE: 'settings:update',
  PROMPTS_UPDATE: 'prompts:update'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
