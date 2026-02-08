export enum ActionType {
  CreateNode = 'create_node',
  CreateEdge = 'create_edge',
  EditNode = 'edit_node',
  DeleteNode = 'delete_node',
  MoveTo = 'move_to',
  MergeNodes = 'merge_nodes',
  SetImportance = 'set_importance',
  SetType = 'set_type',
  SetCategory = 'set_category',
  SetState = 'set_state'
}

export interface ActionField {
  key: string;
  value: string;
}

export interface ParsedAction {
  type: ActionType;
  fields: Record<string, string>;
  reason: string;
  raw: string;
}

export interface ActionValidationResult {
  action: ParsedAction;
  isValid: boolean;
  rejectionReason?: string;
}
