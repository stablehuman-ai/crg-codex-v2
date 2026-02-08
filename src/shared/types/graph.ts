export interface GraphMetadata {
  nextId?: number;
  createdAt?: string;
  lastModified?: string;
}

export type NodeType = string;
export type EdgeType = string;
export type NodeState = string;
export type Category = string;

export interface SubGraphReference {
  file: string;
}

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  name: string;
  content: string;
  type: NodeType;
  category: Category;
  state: NodeState;
  importance: number;
  l0: string;
  l1: string;
  l2: string;
  l3: string;
  expectedInputs: number | string;
  expectedOutputs: number | string;
  position: GraphNodePosition;
  subgraph?: SubGraphReference;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  category?: Category;
}

export interface GraphState {
  metadata?: GraphMetadata;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeTypeDefinition {
  name: string;
  defaultImportance: number;
  defaultState: NodeState;
  color: string;
  description: string;
  expectedInputs: number | string;
  expectedOutputs: number | string;
}

export interface EdgeTypeDefinition {
  name: string;
  color: string;
  directional: boolean;
  description: string;
}

export interface StateDefinition {
  name: string;
  color: string;
  icon: string;
  description: string;
}

export interface CategoryDefinition {
  name: string;
  color: string;
  description: string;
}
