import { ProjectIR, BlockIR, ScriptIR } from './types.js';
import { BlockIRBuilder } from './ir.js';

export class FingerprintGenerator {
  /**
   * Generate fingerprints for all scripts in a Project IR
   */
  public static generateFingerprints(projectIR: ProjectIR): void {
    for (const target of projectIR.targets) {
      for (const script of target.scripts) {
        // Generate fingerprint for the script's root block
        const fingerprint = this.generateBlockFingerprint(script.block);
        script.fingerprint = fingerprint;
      }
    }
  }

  /**
   * Generate a stable fingerprint for a Block IR node
   */
  public static generateBlockFingerprint(block: BlockIR): string {
    // Create a serializable object that represents the block's semantics
    const semanticRepr = this.createSemanticRepresentation(block);
    
    // Use a simple hash function based on JSON stringification
    // This ensures consistent hashing across different runs
    const serialized = JSON.stringify(semanticRepr, this.sortKeys);
    return this.simpleHash(serialized);
  }

  /**
   * Create a semantic representation of a block that can be hashed
   */
  private static createSemanticRepresentation(block: BlockIR): any {
    // Start with essential properties
    const repr: any = {
      opcode: block.opcode,
      fields: block.fields,
      mutation: block.mutation
    };

    // Normalize inputs to exclude any volatile data
    repr.inputs = this.normalizeInputs(block.inputs);

    // Add fingerprints of children blocks
    repr.children = block.children.map(child => {
      return this.generateBlockFingerprint(child);
    });

    // Add fingerprint of next block if it exists
    if (block.next) {
      repr.next = this.generateBlockFingerprint(block.next);
    }

    return repr;
  }

  /**
   * Normalize inputs to exclude volatile data
   */
  private static normalizeInputs(inputs: Record<string, [number, any]>): Record<string, [number, any]> {
    const normalized: Record<string, [number, any]> = {};
    
    for (const [inputName, inputValue] of Object.entries(inputs)) {
      const [inputType, inputData] = inputValue;
      
      // Create a normalized version of the input data
      // For arrays, we keep the structure but ensure consistency
      let normalizedData;
      if (Array.isArray(inputData)) {
        normalizedData = [...inputData];
      } else if (typeof inputData === 'object' && inputData !== null) {
        // If it's an object without opcode, it's a value object
        normalizedData = { ...inputData };
      } else {
        normalizedData = inputData;
      }
      
      normalized[inputName] = [inputType, normalizedData];
    }
    
    return normalized;
  }

  /**
   * Simple hash function for strings
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * JSON.stringify replacer that sorts object keys for consistent hashing
   */
  private static sortKeys(key: string, value: any): any {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort());
    }
    return value;
  }
}
