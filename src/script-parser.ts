// Script parser that converts Scratch blocks to standardized text format
// Inspired by scratch-git/src-server/diff/parse_script.rs
import { BlockText, ScriptText } from './types.js';

export interface Sprite {
  blocks: Record<string, any>;
  topIds: string[];
}

interface Script {
  blocks: Record<string, any>;
  startId: string;
  depth: number;
  elseClause: boolean;
}

/**
 * Generate a hash fingerprint from text using a simple hashing algorithm
 */
export function generateFingerprint(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex string and take first 8 characters for brevity
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Remove empty values and format as string
 */
function some(value: any): string {
  if (value === undefined || value === null) {
    return "";
  }
  const string = JSON.stringify(value);
  if (string === "{}" || string === "[]") {
    return "";
  }
  return string;
}

/**
 * Parse a single script recursively and return both text and block details
 */
function parseScriptWithBlocks(script: Script): { text: string; blocks: BlockText[] } {
  let currentId: string | undefined = script.startId;
  let output = "";
  const blocks: BlockText[] = [];

  while (currentId) {
    const block: any = script.blocks[currentId];
    if (script.elseClause) {
      output += `${"\t".repeat(script.depth)}else\n`;
    }

    let info = `${some(block.inputs)} ${some(block.fields)} ${some(block.mutation)}`;
    info = info.trim();

    // Replace all block IDs with "id" for consistent diffing
    const blockIds = Object.keys(script.blocks);
    for (const key of blockIds) {
      // Escape special regex characters in the key
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      info = info.replace(new RegExp(`"${escapedKey}"`, 'g'), '"id"');
    }

    const blockText = `${"\t".repeat(script.depth + 1)}${block.opcode} ${info}\n`;
    output += blockText;

    // Create BlockText object
    const trimmedText = blockText.trim();
    const blockFingerprint = generateFingerprint(trimmedText);
    
    // Filter out undefined values from original block to avoid "undefined" in JSON output
    const filteredOriginal = JSON.parse(JSON.stringify(block));
    
    blocks.push({
      text: trimmedText,
      fingerprint: blockFingerprint,
      depth: script.depth + 1,
      original: filteredOriginal
    });

    // Handle condition inputs
    if (block.inputs && block.inputs.CONDITION) {
      const condition = block.inputs.CONDITION;
      if (Array.isArray(condition) && typeof condition[1] === "string") {
        output = output.trimEnd();
        const conditionResult = parseScriptWithBlocks({
          blocks: script.blocks,
          startId: condition[1],
          depth: 0,
          elseClause: false
        });
        output += conditionResult.text;
        blocks.push(...conditionResult.blocks);
      }
    }

    // Handle SUBSTACK inputs (nested blocks)
    if (block.inputs && block.inputs.SUBSTACK) {
      const substack = block.inputs.SUBSTACK;
      if (Array.isArray(substack) && typeof substack[1] === "string") {
        const substackResult = parseScriptWithBlocks({
          blocks: script.blocks,
          startId: substack[1],
          depth: script.depth + 1,
          elseClause: false
        });
        output += substackResult.text;
        blocks.push(...substackResult.blocks);
      }
    }

    // Handle SUBSTACK2 inputs (else clauses)
    if (block.inputs && block.inputs.SUBSTACK2) {
      const substack2 = block.inputs.SUBSTACK2;
      if (Array.isArray(substack2) && typeof substack2[1] === "string") {
        const substackResult = parseScriptWithBlocks({
          blocks: script.blocks,
          startId: substack2[1],
          depth: script.depth + 1,
          elseClause: true
        });
        output += substackResult.text;
        blocks.push(...substackResult.blocks);
      }
    }

    // Move to next block in sequence
    currentId = block.next;
  }

  return { text: output, blocks };
}

/**
 * Parse a single script recursively
 */
export function parseScript(script: Script): string {
  return parseScriptWithBlocks(script).text;
}

/**
 * Parse all scripts in a sprite and return ScriptText objects
 */
export function parseSpriteScripts(sprite: Sprite): ScriptText[] {
  const scripts: ScriptText[] = [];
  
  for (const topId of sprite.topIds) {
    const scriptResult = parseScriptWithBlocks({
      blocks: sprite.blocks,
      startId: topId,
      depth: -1,
      elseClause: false
    });
    
    const scriptText = scriptResult.text.trim();
    const scriptFingerprint = generateFingerprint(scriptText);
    
    scripts.push({
      text: scriptText,
      fingerprint: scriptFingerprint,
      blocks: scriptResult.blocks,
      original: sprite.blocks,
      topId
    });
  }
  
  // Sort scripts by fingerprint for consistent diffing
  scripts.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  
  return scripts;
}

/**
 * Parse all scripts in a sprite and return standardized text
 */
export function parseSprite(sprite: Sprite): string {
  const scripts = parseSpriteScripts(sprite);
  return scripts.map(script => script.text).join("\n").trimEnd();
}

/**
 * Extract top-level block IDs from blocks
 */
export function getTopLevelIds(blocks: Record<string, any>): string[] {
  return Object.entries(blocks)
    .filter(([_, block]) => block.topLevel)
    .map(([id, _]) => id);
}
