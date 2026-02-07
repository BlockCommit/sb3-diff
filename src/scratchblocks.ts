import { BlockIR } from './types.js';

/**
 * Convert Block IR to ScratchBlocks syntax
 */
export class ScratchBlocksConverter {
  /**
   * Convert a Block IR tree to ScratchBlocks syntax
   */
  public static convertToScratchBlocks(block: BlockIR): string {
    return this.convertBlock(block);
  }

  /**
   * Convert a single block to ScratchBlocks syntax
   */
  private static convertBlock(block: BlockIR): string {
    let result = '';
    
    // Convert the current block
    result += this.convertSingleBlock(block);
    
    // Convert next block if it exists
    if (block.next) {
      result += '\n';
      result += this.convertBlock(block.next);
    }
    
    return result;
  }

  /**
   * Convert a single block without considering next blocks
   */
  private static convertSingleBlock(block: BlockIR): string {
    const opcode = block.opcode;
    const inputs = block.inputs;
    const fields = block.fields;
    
    // Map common opcodes to scratchblocks syntax
    switch (opcode) {
      // Event blocks
      case 'event_whenflagclicked':
        return 'when flag clicked';
      case 'event_whenkeypressed':
        const key = fields.KEY_OPTION?.[0] || 'space';
        return `when [${key} v] key pressed`;
      
      // Looks blocks
      case 'looks_say':
        const message = this.getInputValue(inputs.MESSAGE);
        return `say [${message}]`;
      case 'looks_thinkforsecs':
        const thinkMessage = this.getInputValue(inputs.MESSAGE);
        const thinkSecs = this.getInputValue(inputs.SECS);
        return `think [${thinkMessage}] for (${thinkSecs}) seconds`;
      
      // Motion blocks
      case 'motion_movesteps':
        const steps = this.getInputValue(inputs.STEPS);
        return `move (${steps}) steps`;
      
      // Control blocks
      case 'control_wait':
        const duration = this.getInputValue(inputs.DURATION);
        return `wait (${duration}) seconds`;
      
      // Default: handle unknown opcodes
      default:
        return `[${opcode}]`;
    }
  }

  /**
   * Extract value from input
   */
  private static getInputValue(input: [number, any] | undefined): string {
    if (!input) return '';
    
    const [inputType, inputData] = input;
    
    // Handle different input types
    if (Array.isArray(inputData)) {
      const [dataType, value] = inputData;
      return value || '';
    }
    
    return inputData || '';
  }

  /**
   * Format a script for ScratchBlocks preview
   */
  public static formatScriptForPreview(scriptBlock: BlockIR): string {
    const blocks = this.convertBlock(scriptBlock);
    return `\`\`\`scratch\n${blocks}\n\`\`\``;
  }

  /**
   * Convert a diff item to a human-readable format with ScratchBlocks
   */
  public static convertDiffItem(item: any): string {
    let result = '';
    
    // Add header
    result += `📋 ${item.type} in ${item.location.targetName}\n`;
    
    // Handle block/script changes (existing functionality)
    if (item.type === 'script-add' && item.new) {
      result += `➕ Added script:\n`;
      result += this.formatScriptForPreview(item.new.block);
    } else if (item.type === 'script-delete' && item.old) {
      result += `➖ Deleted script:\n`;
      result += this.formatScriptForPreview(item.old.block);
    } else if (item.type === 'block-edit' && item.old && item.new) {
      result += `✏️ Modified block:\n`;
      result += `   Before:\n${this.formatScriptForPreview(item.old)}\n`;
      result += `   After:\n${this.formatScriptForPreview(item.new)}\n`;
    } else if (item.type === 'block-add' && item.new) {
      result += `➕ Added block:\n`;
      result += this.formatScriptForPreview(item.new);
    } else if (item.type === 'block-delete' && item.old) {
      result += `➖ Deleted block:\n`;
      result += this.formatScriptForPreview(item.old);
    }
    // Handle variable changes
    else if (item.type.startsWith('variable-')) {
      result += this.convertVariableDiff(item);
    }
    // Handle list changes
    else if (item.type.startsWith('list-')) {
      result += this.convertListDiff(item);
    }
    // Handle costume changes
    else if (item.type.startsWith('costume-')) {
      result += this.convertCostumeDiff(item);
    }
    // Handle sound changes
    else if (item.type.startsWith('sound-')) {
      result += this.convertSoundDiff(item);
    }
    
    return result;
  }

  /**
   * Convert variable diff to human-readable format
   */
  private static convertVariableDiff(item: any): string {
    let result = '';
    
    if (item.type === 'variable-add' && item.new) {
      const [name, value] = item.new;
      result += `➕ Added variable: ${name} = ${value}\n`;
    } else if (item.type === 'variable-delete' && item.old) {
      const [name, value] = item.old;
      result += `➖ Deleted variable: ${name} = ${value}\n`;
    } else if (item.type === 'variable-edit' && item.old && item.new) {
      const [oldName, oldValue] = item.old;
      const [newName, newValue] = item.new;
      result += `✏️ Modified variable:\n`;
      result += `   Before: ${oldName} = ${oldValue}\n`;
      result += `   After: ${newName} = ${newValue}\n`;
    }
    
    return result;
  }

  /**
   * Convert list diff to human-readable format
   */
  private static convertListDiff(item: any): string {
    let result = '';
    
    if (item.type === 'list-add' && item.new) {
      const [name, values] = item.new;
      result += `➕ Added list: ${name} = [${values.join(', ')}]\n`;
    } else if (item.type === 'list-delete' && item.old) {
      const [name, values] = item.old;
      result += `➖ Deleted list: ${name} = [${values.join(', ')}]\n`;
    } else if (item.type === 'list-edit' && item.old && item.new) {
      const [oldName, oldValues] = item.old;
      const [newName, newValues] = item.new;
      result += `✏️ Modified list:\n`;
      result += `   Before: ${oldName} = [${oldValues.join(', ')}]\n`;
      result += `   After: ${newName} = [${newValues.join(', ')}]\n`;
    }
    
    return result;
  }

  /**
   * Convert costume diff to human-readable format
   */
  private static convertCostumeDiff(item: any): string {
    let result = '';
    
    if (item.type === 'costume-add' && item.new) {
      result += `➕ Added costume: ${item.new.name || 'Unnamed'}\n`;
      result += `   Format: ${item.new.dataFormat}\n`;
      result += `   Asset: ${item.new.assetId || item.new.md5ext}\n`;
    } else if (item.type === 'costume-delete' && item.old) {
      result += `➖ Deleted costume: ${item.old.name || 'Unnamed'}\n`;
      result += `   Format: ${item.old.dataFormat}\n`;
      result += `   Asset: ${item.old.assetId || item.old.md5ext}\n`;
    } else if (item.type === 'costume-edit' && item.old && item.new) {
      result += `✏️ Modified costume: ${item.new.name || 'Unnamed'}\n`;
      result += `   Format: ${item.new.dataFormat}\n`;
      result += `   Asset: ${item.new.assetId || item.new.md5ext}\n`;
    }
    
    return result;
  }

  /**
   * Convert sound diff to human-readable format
   */
  private static convertSoundDiff(item: any): string {
    let result = '';
    
    if (item.type === 'sound-add' && item.new) {
      result += `➕ Added sound: ${item.new.name || 'Unnamed'}\n`;
      result += `   Format: ${item.new.dataFormat}\n`;
      result += `   Asset: ${item.new.assetId || item.new.md5ext}\n`;
    } else if (item.type === 'sound-delete' && item.old) {
      result += `➖ Deleted sound: ${item.old.name || 'Unnamed'}\n`;
      result += `   Format: ${item.old.dataFormat}\n`;
      result += `   Asset: ${item.old.assetId || item.old.md5ext}\n`;
    } else if (item.type === 'sound-edit' && item.old && item.new) {
      result += `✏️ Modified sound: ${item.new.name || 'Unnamed'}\n`;
      result += `   Format: ${item.new.dataFormat}\n`;
      result += `   Asset: ${item.new.assetId || item.new.md5ext}\n`;
    }
    
    return result;
  }
}
