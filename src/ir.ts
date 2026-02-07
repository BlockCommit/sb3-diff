import { ParsedProject, BlockIR, ScriptIR, TargetIR, ProjectIR, NormalizedBlock, Script } from './types.js'

export class BlockIRBuilder {
  /**
   * Build Block IR from a parsed project
   */
  public static buildIR(project: ParsedProject): ProjectIR {
    const targetIRs: TargetIR[] = [];
    
    for (const target of project.targets) {
      const scriptsIR: ScriptIR[] = [];
      
      for (const script of target.scripts) {
        const blockIR = this.buildBlockIR(script.topLevelBlock);
        
        // Fingerprint will be added later by the FingerprintGenerator
        scriptsIR.push({
          block: blockIR,
          targetName: script.targetName,
          fingerprint: ''
        });
      }
      
      targetIRs.push({
        isStage: target.isStage,
        name: target.name,
        scripts: scriptsIR,
        variables: target.variables,
        lists: target.lists,
        costumes: target.costumes,
        sounds: target.sounds
      });
    }
    
    // Return IR with raw targets attached
    // @ts-ignore - We'll attach raw targets later in the pipeline
    return {
      targets: targetIRs
    };
  }

  /**
   * Build Block IR from a normalized block
   */
  private static buildBlockIR(block: NormalizedBlock): BlockIR {
    const blockIR: BlockIR = {
      opcode: block.opcode,
      inputs: block.inputs,
      fields: block.fields,
      mutation: block.mutation,
      next: block.next ? this.buildBlockIR(block.next) : undefined,
      children: []
    };
    
    // Extract children from inputs
    this.extractChildrenFromInputs(blockIR);
    
    return blockIR;
  }

  /**
   * Extract child blocks from inputs
   */
  private static extractChildrenFromInputs(blockIR: BlockIR): void {
    for (const [inputName, inputValue] of Object.entries(blockIR.inputs)) {
      const [inputType, inputData] = inputValue;
      
      // Check if input data is a nested block structure
      // In Scratch, input data can be [blockType, [inputType, value]]
      if (Array.isArray(inputData) && inputData.length === 2) {
        const [nestedType, nestedValue] = inputData;
        
        // If nestedValue is an object with opcode, it's a nested block
        if (typeof nestedValue === 'object' && nestedValue !== null && 'opcode' in nestedValue) {
          const childBlockIR = this.buildBlockIR(nestedValue as NormalizedBlock);
          blockIR.children.push(childBlockIR);
        }
      }
    }
  }

  /**
   * Traverse a Block IR tree and apply a visitor function
   */
  public static traverseIR(
    blockIR: BlockIR,
    visitor: (block: BlockIR, parent?: BlockIR) => void,
    parent?: BlockIR
  ): void {
    visitor(blockIR, parent);
    
    // Visit children first (depth-first)
    for (const child of blockIR.children) {
      this.traverseIR(child, visitor, blockIR);
    }
    
    // Visit next block if it exists
    if (blockIR.next) {
      this.traverseIR(blockIR.next, visitor, parent);
    }
  }

  /**
   * Convert a Block IR tree back to a string representation for debugging
   */
  public static irToString(blockIR: BlockIR, indent: number = 0): string {
    const indentStr = '  '.repeat(indent);
    let str = `${indentStr}${blockIR.opcode}`;
    
    if (Object.keys(blockIR.fields).length > 0) {
      str += ` ${JSON.stringify(blockIR.fields)}`;
    }
    
    str += '\n';
    
    // Print children
    for (const child of blockIR.children) {
      str += `${indentStr}  Child: ${this.irToString(child, indent + 2)}`;
    }
    
    // Print next block
    if (blockIR.next) {
      str += `${indentStr}  Next: ${this.irToString(blockIR.next, indent + 1)}`;
    }
    
    return str;
  }
}
