import { ParsedProject, NormalizedBlock, Script, ParsedTarget } from './types.js'

export class BlockNormalizer {
  /**
   * Normalize a parsed project
   */
  public static normalize(project: ParsedProject): ParsedProject {
    const normalizedTargets: ParsedTarget[] = [];
    
    for (const target of project.targets) {
      const normalizedTarget: ParsedTarget = {
        isStage: target.isStage,
        name: target.name,
        scripts: [],
        variables: target.variables,
        lists: target.lists,
        costumes: target.costumes,
        sounds: target.sounds
      };
      
      for (const script of target.scripts) {
        const normalizedScript = this.normalizeScript(script);
        normalizedTarget.scripts.push(normalizedScript);
      }
      
      normalizedTargets.push(normalizedTarget);
    }
    
    return {
      targets: normalizedTargets
    };
  }

  /**
   * Normalize a script
   */
  private static normalizeScript(script: Script): Script {
    const normalizedTopLevelBlock = this.normalizeBlock(script.topLevelBlock);
    
    return {
      topLevelBlock: normalizedTopLevelBlock,
      targetName: script.targetName
    };
  }

  /**
   * Normalize a block and its descendants
   */
  private static normalizeBlock(block: any): NormalizedBlock {
    // Create normalized block with only essential fields
    const normalizedBlock: NormalizedBlock = {
      opcode: block.opcode,
      inputs: this.normalizeInputs(block.inputs),
      fields: block.fields || {},
      mutation: block.mutation || undefined,
      next: block.next ? this.normalizeBlock(block.next) : undefined
    };
    
    return normalizedBlock;
  }

  /**
   * Normalize inputs by merging shadow blocks
   */
  private static normalizeInputs(inputs: Record<string, [number, any]>): Record<string, [number, any]> {
    const normalizedInputs: Record<string, [number, any]> = {};
    
    for (const [inputName, inputValue] of Object.entries(inputs)) {
      const [inputType, inputData] = inputValue;
      
      // Handle nested blocks in inputs
      if (Array.isArray(inputData)) {
        // If it's a block reference (first element is 1), we need to normalize it
        // Note: In Scratch, input data can be [blockType, [inputType, value]]
        normalizedInputs[inputName] = [inputType, inputData];
      } else {
        // Direct value, keep as is
        normalizedInputs[inputName] = inputValue;
      }
    }
    
    return normalizedInputs;
  }

  /**
   * Recursively remove any remaining IDs or UI-specific data
   */
  private static cleanBlock(block: any): any {
    // If it's a primitive value, return as is
    if (block === null || typeof block !== 'object') {
      return block;
    }
    
    // If it's an array, clean each element
    if (Array.isArray(block)) {
      return block.map(item => this.cleanBlock(item));
    }
    
    // If it's an object, clean its properties
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(block)) {
      // Skip UI-specific fields
      if (key === 'x' || key === 'y' || key === 'id' || key === 'parent') {
        continue;
      }
      
      // Clean nested properties
      cleaned[key] = this.cleanBlock(value);
    }
    
    return cleaned;
  }
}
