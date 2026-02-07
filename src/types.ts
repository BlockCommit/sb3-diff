// Raw project.json types from sb3 files
export interface RawProject {
  targets: RawTarget[];
  monitors: any[];
  extensions: string[];
  meta: {
    semver: string;
    vm: string;
    agent: string;
    platform?: {
      name: string;
      url: string;
    };
  };
}

export interface RawTarget {
  isStage: boolean;
  name: string;
  variables: Record<string, [string, any]>;
  lists: Record<string, [string, any[]]>;
  broadcasts: Record<string, string>;
  blocks: Record<string, RawBlock>;
  comments: Record<string, any>;
  costumes: any[];
  sounds: any[];
  volume: number;
  layerOrder: number;
  // Stage-specific properties
  tempo?: number;
  videoTransparency?: number;
  videoState?: string;
  textToSpeechLanguage?: string | null;
  // Sprite-specific properties
  visible?: boolean;
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  draggable?: boolean;
  rotationStyle?: string;
}

export interface RawBlock {
  opcode: string;
  next?: string;
  parent?: string | null;
  inputs: Record<string, [number, any]>;
  fields: Record<string, [string, string | null]>;
  shadow: boolean;
  topLevel: boolean;
  x?: number;
  y?: number;
  mutation?: any;
}

// Parsed and normalized types
export interface NormalizedBlock {
  opcode: string;
  next?: NormalizedBlock;
  inputs: Record<string, [number, any]>;
  fields: Record<string, [string, string | null]>;
  mutation?: any;
}

export interface Script {
  topLevelBlock: NormalizedBlock;
  targetName: string;
}

export interface ParsedTarget {
  isStage: boolean;
  name: string;
  scripts: Script[];
  variables: Record<string, [string, any]>;
  lists: Record<string, [string, any[]]>;
  costumes: any[];
  sounds: any[];
}

export interface ParsedProject {
  targets: ParsedTarget[];
}

// Block IR (Intermediate Representation)
export interface BlockIR {
  opcode: string;
  inputs: Record<string, [number, any]>;
  fields: Record<string, [string, string | null]>;
  next?: BlockIR;
  mutation?: any;
  children: BlockIR[];
}

export interface ScriptIR {
  block: BlockIR;
  targetName: string;
  fingerprint: string;
  originalData?: Record<string, any>;
}

export interface TargetIR {
  isStage: boolean;
  name: string;
  scripts: ScriptIR[];
  variables: Record<string, [string, any]>;
  lists: Record<string, [string, any[]]>;
  costumes: any[];
  sounds: any[];
}

export interface ProjectIR {
  targets: TargetIR[];
}

// Textual representation types for efficient diffing
export interface BlockText {
  text: string;        // Standardized block text
  fingerprint: string; // Block hash fingerprint
  depth: number;       // Hierarchy depth
  original: any;       // Original block data
}

export interface ScriptText {
  text: string;        // Complete script text
  fingerprint: string; // Script hash fingerprint
  blocks: BlockText[]; // List of blocks in the script
  original: any;       // Original script data
  topId: string;       // Top-level block ID
}

// Diff types
export type DiffType = 
  | 'script-add'
  | 'script-delete'
  | 'script-modify'
  | 'block-add'
  | 'block-delete'
  | 'block-edit'
  | 'block-move'
  | 'variable-add'
  | 'variable-delete'
  | 'variable-edit'
  | 'list-add'
  | 'list-delete'
  | 'list-edit'
  | 'costume-add'
  | 'costume-delete'
  | 'costume-edit'
  | 'sound-add'
  | 'sound-delete'
  | 'sound-edit';

export interface DiffLocation {
  targetName: string;
  scriptIndex?: number;
  blockIndex?: number;
  blockPath?: string;
}

export interface DiffItem {
  type: DiffType;
  location: DiffLocation;
  old?: any;
  new?: any;
  fingerprint?: string;
  diff?: {
    added: number;
    removed: number;
    text: string;
  };
}

export interface Diff {
  items: DiffItem[];
}

// Enhanced diff result structure for better output and analysis
export interface DiffSummary {
  targetsAdded: number;
  targetsDeleted: number;
  scriptsAdded: number;
  scriptsDeleted: number;
  scriptsModified: number;
  blocksAdded: number;
  blocksDeleted: number;
  blocksModified: number;
  variablesAdded: number;
  variablesDeleted: number;
  variablesModified: number;
  listsAdded: number;
  listsDeleted: number;
  listsModified: number;
  costumesAdded: number;
  costumesDeleted: number;
  costumesModified: number;
  soundsAdded: number;
  soundsDeleted: number;
  soundsModified: number;
}

export interface TargetChange {
  type: 'add' | 'delete';
  name: string;
  isStage: boolean;
}

export interface AssetChange {
  type: 'add' | 'delete' | 'modify';
  name: string;
  path: string;
  targetName: string;
  assetType: 'costume' | 'sound';
}

export interface EnhancedDiffResult {
  summary: DiffSummary;
  changes: {
    targets: TargetChange[];
    scripts: DiffItem[];
    variables: DiffItem[];
    lists: DiffItem[];
    assets: AssetChange[];
  };
  raw: Diff;
  formatted: {
    summary: string;
    detailed: string;
  };
}
