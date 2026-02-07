import { RawProject, ParsedProject, ParsedTarget, Script, RawBlock } from './types.js'

export class ProjectParser {
  /**
   * Parse a raw project into a structured project with scripts, variables, lists, and resources
   */
  public static parse(project: RawProject): ParsedProject {
    const targets: ParsedTarget[] = [];
    
    for (const rawTarget of project.targets) {
      const parsedTarget: ParsedTarget = {
        isStage: rawTarget.isStage,
        name: rawTarget.name,
        scripts: [],
        variables: rawTarget.variables,
        lists: rawTarget.lists,
        costumes: rawTarget.costumes,
        sounds: rawTarget.sounds
      };
      
      // Find all top-level blocks
      const topLevelBlockIds: string[] = [];
      for (const [blockId, block] of Object.entries(rawTarget.blocks)) {
        if (block.topLevel && !block.shadow) {
          topLevelBlockIds.push(blockId);
        }
      }
      
      // Reconstruct scripts from top-level blocks
      for (const blockId of topLevelBlockIds) {
        const script = this.reconstructScript(rawTarget.blocks, blockId, rawTarget.name);
        if (script) {
          parsedTarget.scripts.push(script);
        }
      }
      
      targets.push(parsedTarget);
    }
    
    return {
      targets
    };
  }

  /**
   * Reconstruct a script from a top-level block ID
   */
  private static reconstructScript(
    blocks: Record<string, RawBlock>,
    topLevelBlockId: string,
    targetName: string
  ) {
    const topLevelBlock = blocks[topLevelBlockId];
    if (!topLevelBlock) return null;
    
    // First pass: create normalized blocks with only basic info
    const normalizedBlocks: Record<string, any> = {};
    
    let currentBlockId: string | undefined = topLevelBlockId;
    while (currentBlockId) {
      const rawBlock: RawBlock | undefined = blocks[currentBlockId];
      if (!rawBlock) break;
      
      normalizedBlocks[currentBlockId] = {
        opcode: rawBlock.opcode,
        inputs: rawBlock.inputs,
        fields: rawBlock.fields,
        mutation: rawBlock.mutation,
        next: undefined as any
      };
      
      currentBlockId = rawBlock.next;
    }
    
    // Second pass: link blocks using next pointers
    currentBlockId = topLevelBlockId;
    while (currentBlockId) {
      const rawBlock: RawBlock | undefined = blocks[currentBlockId];
      if (!rawBlock) break;
      
      if (rawBlock.next && normalizedBlocks[rawBlock.next]) {
        normalizedBlocks[currentBlockId].next = normalizedBlocks[rawBlock.next];
      }
      
      currentBlockId = rawBlock.next;
    }
    
    return {
      topLevelBlock: normalizedBlocks[topLevelBlockId],
      targetName
    };
  }
}
