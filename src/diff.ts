import { BlockIR, Diff, DiffItem, DiffType, DiffLocation, ScriptIR, ScriptText, EnhancedDiffResult, DiffSummary, TargetChange, AssetChange } from './types.js';
import { FingerprintGenerator } from './fingerprint.js';
import { ScriptMatchResult, ScriptMatcher } from './matcher.js';
import { parseSprite, parseSpriteScripts, getTopLevelIds, generateFingerprint } from './script-parser.js';
import { diffText, formatDiff, TextDiffResult } from './text-diff.js';

export class BlockDiffEngine {
  /**
   * Generate semantic diff between two Project IRs
   */
  public static generateDiff(oldIR: any, newIR: any): Diff {
    const diff: Diff = { items: [] };
    
    // Match scripts between projects
    const projectMatches = ScriptMatcher.matchProjects(oldIR, newIR);
    
    // Get raw project data for script parsing
    
    for (const projectMatch of projectMatches) {
      const { targetName, result } = projectMatch;
      
      // Get the actual target objects for resource diffing
      const oldTarget = oldIR.targets.find((t: any) => t.name === targetName);
      const newTarget = newIR.targets.find((t: any) => t.name === targetName);
      
      // Note: Script additions/deletions are now handled in the raw target comparison below
      // to ensure we have ScriptText objects with detailed block information
      
      // Diff variables
      if (oldTarget && newTarget) {
        const variableDiff = this.diffVariables(oldTarget.variables, newTarget.variables, targetName);
        diff.items.push(...variableDiff);
        
        // Diff lists
        const listDiff = this.diffLists(oldTarget.lists, newTarget.lists, targetName);
        diff.items.push(...listDiff);
        
        // Diff costumes
        const costumeDiff = this.diffCostumes(oldTarget.costumes, newTarget.costumes, targetName);
        diff.items.push(...costumeDiff);
        
        // Diff sounds
        const soundDiff = this.diffSounds(oldTarget.sounds, newTarget.sounds, targetName);
        diff.items.push(...soundDiff);
      }
      
      // Handle script-level diff by directly comparing original block data
      // Find the raw targets from the original projects
      const oldRawTarget = oldIR._rawTargets?.find((t: any) => t.name === targetName);
      const newRawTarget = newIR._rawTargets?.find((t: any) => t.name === targetName);
      
      if (oldRawTarget && newRawTarget) {
        // Both targets exist - compare scripts
        // Extract top-level block IDs from raw blocks
        const oldTopIds = getTopLevelIds(oldRawTarget.blocks);
        const newTopIds = getTopLevelIds(newRawTarget.blocks);
        
        // Parse scripts with detailed block information
        const oldScripts = parseSpriteScripts({ blocks: oldRawTarget.blocks, topIds: oldTopIds });
        const newScripts = parseSpriteScripts({ blocks: newRawTarget.blocks, topIds: newTopIds });
        
        // Match scripts using fingerprints for better accuracy
        const scriptMatches = this.matchScripts(oldScripts, newScripts);
        
        // Handle script modifications with block-level diff
        for (const match of scriptMatches.matchedScripts) {
          const { oldScript, newScript } = match;
          
          // Generate text diff for the script
          const textDiff = diffText(oldScript.text, newScript.text);
          
          // Only add diff item if there are changes
          if (textDiff.added > 0 || textDiff.removed > 0) {
            // Perform block-level diff if needed
            const blockDiff = this.diffBlocks(oldScript, newScript, targetName);
            
            // Add script modification with block changes if available
            diff.items.push({
              type: 'script-modify',
              location: { targetName },
              old: oldScript,
              new: newScript,
              diff: {
                added: textDiff.added,
                removed: textDiff.removed,
                text: formatDiff(textDiff)
              },
              fingerprint: oldScript.fingerprint
            });
            
            // Add block-level changes
            diff.items.push(...blockDiff);
          }
        }
        
        // Handle unmatched scripts
        for (const oldScript of scriptMatches.unmatchedOldScripts) {
          diff.items.push({
            type: 'script-delete',
            location: { targetName },
            old: oldScript,
            fingerprint: oldScript.fingerprint
          });
        }
        
        for (const newScript of scriptMatches.unmatchedNewScripts) {
          diff.items.push({
            type: 'script-add',
            location: { targetName },
            new: newScript,
            fingerprint: newScript.fingerprint
          });
        }
      } else if (oldRawTarget && !newRawTarget) {
        // Target was deleted - all scripts are deleted
        const oldTopIds = getTopLevelIds(oldRawTarget.blocks);
        const oldScripts = parseSpriteScripts({ blocks: oldRawTarget.blocks, topIds: oldTopIds });
        
        for (const oldScript of oldScripts) {
          diff.items.push({
            type: 'script-delete',
            location: { targetName },
            old: oldScript,
            fingerprint: oldScript.fingerprint
          });
        }
      } else if (!oldRawTarget && newRawTarget) {
        // Target was added - all scripts are new
        const newTopIds = getTopLevelIds(newRawTarget.blocks);
        const newScripts = parseSpriteScripts({ blocks: newRawTarget.blocks, topIds: newTopIds });
        
        for (const newScript of newScripts) {
          diff.items.push({
            type: 'script-add',
            location: { targetName },
            new: newScript,
            fingerprint: newScript.fingerprint
          });
        }
      }
    }
    
    return diff;
  }

  /**
   * Generate enhanced diff result with summary and structured changes
   */
  public static generateEnhancedDiff(oldIR: any, newIR: any): EnhancedDiffResult {
    const rawDiff = this.generateDiff(oldIR, newIR);
    
    // Calculate summary
    const summary = this.calculateSummary(rawDiff);
    
    // Structure changes
    const structuredChanges = this.structureChanges(rawDiff);
    
    // Format output
    const formatted = this.formatDiffOutput(rawDiff, summary);
    
    return {
      summary,
      changes: structuredChanges,
      raw: rawDiff,
      formatted
    };
  }

  /**
   * Match scripts between old and new projects using fingerprints
   */
  private static matchScripts(oldScripts: ScriptText[], newScripts: ScriptText[]): {
    matchedScripts: Array<{ oldScript: ScriptText; newScript: ScriptText }>;
    unmatchedOldScripts: ScriptText[];
    unmatchedNewScripts: ScriptText[];
  } {
    const matchedScripts: Array<{ oldScript: ScriptText; newScript: ScriptText }> = [];
    let unmatchedOldScripts: ScriptText[] = [...oldScripts];
    let unmatchedNewScripts: ScriptText[] = [...newScripts];
    
    // Create fingerprint maps for quick lookup
    const oldScriptMap = new Map(oldScripts.map(script => [script.fingerprint, script]));
    const newScriptMap = new Map(newScripts.map(script => [script.fingerprint, script]));
    
    // Match scripts with identical fingerprints first
    for (const [fingerprint, oldScript] of oldScriptMap.entries()) {
      if (newScriptMap.has(fingerprint)) {
        const newScript = newScriptMap.get(fingerprint)!;
        matchedScripts.push({ oldScript, newScript });
        
        // Remove matched scripts from unmatched lists
        unmatchedOldScripts = unmatchedOldScripts.filter(s => s.fingerprint !== fingerprint);
        unmatchedNewScripts = unmatchedNewScripts.filter(s => s.fingerprint !== fingerprint);
        
        // Remove from maps to avoid re-matching
        newScriptMap.delete(fingerprint);
      }
    }
    
    // Try to match similar scripts using text similarity for remaining scripts
    // This is a simplified implementation - could be enhanced with more sophisticated matching
    for (const oldScript of unmatchedOldScripts) {
      // Find the most similar new script
      let bestMatch: ScriptText | null = null;
      let bestSimilarity = 0;
      
      for (const newScript of unmatchedNewScripts) {
        // Calculate similarity (simple length ratio + common substring)
        const minLength = Math.min(oldScript.text.length, newScript.text.length);
        const maxLength = Math.max(oldScript.text.length, newScript.text.length);
        const lengthRatio = minLength / maxLength;
        
        // Simple common substring check
        const hasCommonStart = oldScript.text.substring(0, 20) === newScript.text.substring(0, 20);
        
        if (lengthRatio > 0.7 && hasCommonStart) {
          bestMatch = newScript;
          bestSimilarity = lengthRatio;
          break;
        }
      }
      
      if (bestMatch) {
        matchedScripts.push({ oldScript, newScript: bestMatch });
        unmatchedNewScripts = unmatchedNewScripts.filter(s => s !== bestMatch);
      }
    }
    
    // Remove matched new scripts from unmatched list
    const matchedNewFingerprints = new Set(matchedScripts.map(m => m.newScript.fingerprint));
    const finalUnmatchedNewScripts = unmatchedNewScripts.filter(s => !matchedNewFingerprints.has(s.fingerprint));
    
    // Remove matched old scripts from unmatched list
    const matchedOldFingerprints = new Set(matchedScripts.map(m => m.oldScript.fingerprint));
    const finalUnmatchedOldScripts = unmatchedOldScripts.filter(s => !matchedOldFingerprints.has(s.fingerprint));
    
    return {
      matchedScripts,
      unmatchedOldScripts: finalUnmatchedOldScripts,
      unmatchedNewScripts: finalUnmatchedNewScripts
    };
  }

  /**
   * Diff blocks between two scripts at the block level
   */
  private static diffBlocks(oldScript: ScriptText, newScript: ScriptText, targetName: string): DiffItem[] {
    const diffItems: DiffItem[] = [];
    
    // Extract block texts for diffing
    const oldBlockTexts = oldScript.blocks.map(block => block.text);
    const newBlockTexts = newScript.blocks.map(block => block.text);
    
    // Use text diff to find block-level changes
    const textDiff = diffText(oldBlockTexts.join('\n'), newBlockTexts.join('\n'));
    
    // For simplicity, we'll add a summary of block changes
    // A more detailed implementation would map each change to specific blocks
    if (textDiff.added > 0 || textDiff.removed > 0) {
      diffItems.push({
        type: 'block-edit',
        location: { targetName },
        diff: {
          added: textDiff.added,
          removed: textDiff.removed,
          text: formatDiff(textDiff)
        },
        fingerprint: oldScript.fingerprint
      });
    }
    
    return diffItems;
  }

  /**
   * Calculate summary statistics from diff
   */
  private static calculateSummary(diff: Diff): DiffSummary {
    const summary: DiffSummary = {
      targetsAdded: 0,
      targetsDeleted: 0,
      scriptsAdded: 0,
      scriptsDeleted: 0,
      scriptsModified: 0,
      blocksAdded: 0,
      blocksDeleted: 0,
      blocksModified: 0,
      variablesAdded: 0,
      variablesDeleted: 0,
      variablesModified: 0,
      listsAdded: 0,
      listsDeleted: 0,
      listsModified: 0,
      costumesAdded: 0,
      costumesDeleted: 0,
      costumesModified: 0,
      soundsAdded: 0,
      soundsDeleted: 0,
      soundsModified: 0
    };
    
    // Count changes by type
    for (const item of diff.items) {
      switch (item.type) {
        case 'script-add':
          summary.scriptsAdded++;
          break;
        case 'script-delete':
          summary.scriptsDeleted++;
          break;
        case 'script-modify':
          summary.scriptsModified++;
          if (item.diff) {
            summary.blocksAdded += item.diff.added;
            summary.blocksDeleted += item.diff.removed;
          }
          break;
        case 'block-add':
          summary.blocksAdded++;
          break;
        case 'block-delete':
          summary.blocksDeleted++;
          break;
        case 'block-edit':
          summary.blocksModified++;
          break;
        case 'variable-add':
          summary.variablesAdded++;
          break;
        case 'variable-delete':
          summary.variablesDeleted++;
          break;
        case 'variable-edit':
          summary.variablesModified++;
          break;
        case 'list-add':
          summary.listsAdded++;
          break;
        case 'list-delete':
          summary.listsDeleted++;
          break;
        case 'list-edit':
          summary.listsModified++;
          break;
        case 'costume-add':
          summary.costumesAdded++;
          break;
        case 'costume-delete':
          summary.costumesDeleted++;
          break;
        case 'costume-edit':
          summary.costumesModified++;
          break;
        case 'sound-add':
          summary.soundsAdded++;
          break;
        case 'sound-delete':
          summary.soundsDeleted++;
          break;
        case 'sound-edit':
          summary.soundsModified++;
          break;
      }
    }
    
    return summary;
  }

  /**
   * Structure changes into categories
   */
  private static structureChanges(diff: Diff): EnhancedDiffResult['changes'] {
    const changes: EnhancedDiffResult['changes'] = {
      targets: [],
      scripts: [],
      variables: [],
      lists: [],
      assets: []
    };
    
    // Structure changes by type
    for (const item of diff.items) {
      switch (item.type) {
        case 'script-add':
        case 'script-delete':
        case 'script-modify':
        case 'block-add':
        case 'block-delete':
        case 'block-edit':
        case 'block-move':
          changes.scripts.push(item);
          break;
        case 'variable-add':
        case 'variable-delete':
        case 'variable-edit':
          changes.variables.push(item);
          break;
        case 'list-add':
        case 'list-delete':
        case 'list-edit':
          changes.lists.push(item);
          break;
        case 'costume-add':
        case 'costume-delete':
        case 'costume-edit':
          changes.assets.push({
            type: item.type.split('-')[1] as 'add' | 'delete' | 'modify',
            name: item.new?.name || item.old?.name || 'unknown',
            path: item.new?.md5ext || item.old?.md5ext || 'unknown',
            targetName: item.location.targetName,
            assetType: 'costume'
          });
          break;
        case 'sound-add':
        case 'sound-delete':
        case 'sound-edit':
          changes.assets.push({
            type: item.type.split('-')[1] as 'add' | 'delete' | 'modify',
            name: item.new?.name || item.old?.name || 'unknown',
            path: item.new?.md5ext || item.old?.md5ext || 'unknown',
            targetName: item.location.targetName,
            assetType: 'sound'
          });
          break;
      }
    }
    
    return changes;
  }

  /**
   * Format diff output for display
   */
  private static formatDiffOutput(diff: Diff, summary: DiffSummary): EnhancedDiffResult['formatted'] {
    // Generate summary string
    const summaryLines: string[] = [
      '📊 Diff Summary',
      '────────────────────────────────────────'
    ];
    
    if (summary.scriptsAdded > 0) summaryLines.push(`➕ scripts: ${summary.scriptsAdded}`);
    if (summary.scriptsDeleted > 0) summaryLines.push(`➖ scripts: ${summary.scriptsDeleted}`);
    if (summary.scriptsModified > 0) summaryLines.push(`🔄 scripts modified: ${summary.scriptsModified}`);
    if (summary.blocksAdded > 0) summaryLines.push(`➕ blocks: ${summary.blocksAdded}`);
    if (summary.blocksDeleted > 0) summaryLines.push(`➖ blocks: ${summary.blocksDeleted}`);
    if (summary.blocksModified > 0) summaryLines.push(`🔄 blocks modified: ${summary.blocksModified}`);
    if (summary.variablesAdded > 0) summaryLines.push(`➕ variables: ${summary.variablesAdded}`);
    if (summary.variablesDeleted > 0) summaryLines.push(`➖ variables: ${summary.variablesDeleted}`);
    if (summary.variablesModified > 0) summaryLines.push(`🔄 variables modified: ${summary.variablesModified}`);
    if (summary.listsAdded > 0) summaryLines.push(`➕ lists: ${summary.listsAdded}`);
    if (summary.listsDeleted > 0) summaryLines.push(`➖ lists: ${summary.listsDeleted}`);
    if (summary.listsModified > 0) summaryLines.push(`🔄 lists modified: ${summary.listsModified}`);
    if (summary.costumesAdded > 0) summaryLines.push(`➕ costumes: ${summary.costumesAdded}`);
    if (summary.costumesDeleted > 0) summaryLines.push(`➖ costumes: ${summary.costumesDeleted}`);
    if (summary.costumesModified > 0) summaryLines.push(`🔄 costumes modified: ${summary.costumesModified}`);
    if (summary.soundsAdded > 0) summaryLines.push(`➕ sounds: ${summary.soundsAdded}`);
    if (summary.soundsDeleted > 0) summaryLines.push(`➖ sounds: ${summary.soundsDeleted}`);
    if (summary.soundsModified > 0) summaryLines.push(`🔄 sounds modified: ${summary.soundsModified}`);
    
    // Generate detailed diff
    const detailedLines: string[] = [
      '\n📋 Detailed Diff',
      '────────────────────────────────────────'
    ];
    
    // Group diff items by target
    const itemsByTarget = diff.items.reduce((acc, item) => {
      const target = item.location.targetName;
      if (!acc[target]) {
        acc[target] = [];
      }
      acc[target].push(item);
      return acc;
    }, {} as Record<string, DiffItem[]>);
    
    for (const [targetName, items] of Object.entries(itemsByTarget)) {
      detailedLines.push(`\n🎯 Target: ${targetName}`);
      detailedLines.push('────────────────────────────────────────');
      
      for (const item of items) {
        const typePrefix = this.getTypePrefix(item.type);
        detailedLines.push(`  ${typePrefix} ${item.type} ${targetName}`);
        
        if (item.diff) {
          const diffLines = item.diff.text.split('\n');
          for (const line of diffLines) {
            detailedLines.push(`    ${line}`);
          }
        }
      }
    }
    
    return {
      summary: summaryLines.join('\n'),
      detailed: detailedLines.join('\n')
    };
  }

  /**
   * Get emoji prefix for diff type
   */
  private static getTypePrefix(type: DiffType): string {
    switch (type) {
      case 'script-add':
      case 'block-add':
      case 'variable-add':
      case 'list-add':
      case 'costume-add':
      case 'sound-add':
        return '➕';
      case 'script-delete':
      case 'block-delete':
      case 'variable-delete':
      case 'list-delete':
      case 'costume-delete':
      case 'sound-delete':
        return '➖';
      case 'script-modify':
      case 'block-edit':
      case 'block-move':
      case 'variable-edit':
      case 'list-edit':
      case 'costume-edit':
      case 'sound-edit':
        return '🔄';
      default:
        return '📝';
    }
  }

  /**
   * Diff variables between two targets
   */
  private static diffVariables(
    oldVariables: Record<string, [string, any]>,
    newVariables: Record<string, [string, any]>,
    targetName: string
  ): DiffItem[] {
    const diffItems: DiffItem[] = [];
    
    const oldKeys = new Set(Object.keys(oldVariables));
    const newKeys = new Set(Object.keys(newVariables));
    
    // Check for deleted variables
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        diffItems.push({
          type: 'variable-delete',
          location: { targetName },
          old: oldVariables[key],
          fingerprint: key
        });
      }
    }
    
    // Check for added variables
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        diffItems.push({
          type: 'variable-add',
          location: { targetName },
          new: newVariables[key],
          fingerprint: key
        });
      } else {
        // Check for edited variables
        const oldVar = oldVariables[key];
        const newVar = newVariables[key];
        
        if (JSON.stringify(oldVar) !== JSON.stringify(newVar)) {
          diffItems.push({
            type: 'variable-edit',
            location: { targetName },
            old: oldVar,
            new: newVar,
            fingerprint: key
          });
        }
      }
    }
    
    return diffItems;
  }

  /**
   * Diff lists between two targets
   */
  private static diffLists(
    oldLists: Record<string, [string, any[]]>,
    newLists: Record<string, [string, any[]]>,
    targetName: string
  ): DiffItem[] {
    const diffItems: DiffItem[] = [];
    
    const oldKeys = new Set(Object.keys(oldLists));
    const newKeys = new Set(Object.keys(newLists));
    
    // Check for deleted lists
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        diffItems.push({
          type: 'list-delete',
          location: { targetName },
          old: oldLists[key],
          fingerprint: key
        });
      }
    }
    
    // Check for added lists
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        diffItems.push({
          type: 'list-add',
          location: { targetName },
          new: newLists[key],
          fingerprint: key
        });
      } else {
        // Check for edited lists
        const oldList = oldLists[key];
        const newList = newLists[key];
        
        if (JSON.stringify(oldList) !== JSON.stringify(newList)) {
          diffItems.push({
            type: 'list-edit',
            location: { targetName },
            old: oldList,
            new: newList,
            fingerprint: key
          });
        }
      }
    }
    
    return diffItems;
  }

  /**
   * Diff costumes between two targets
   */
  private static diffCostumes(
    oldCostumes: any[],
    newCostumes: any[],
    targetName: string
  ): DiffItem[] {
    const diffItems: DiffItem[] = [];
    
    // Create maps for easy lookup by assetId or md5ext
    const oldCostumeMap = this.createResourceMap(oldCostumes);
    const newCostumeMap = this.createResourceMap(newCostumes);
    
    // Check for deleted costumes
    for (const [id, costume] of oldCostumeMap.entries()) {
      if (!newCostumeMap.has(id)) {
        diffItems.push({
          type: 'costume-delete',
          location: { targetName },
          old: costume,
          fingerprint: id
        });
      }
    }
    
    // Check for added costumes
    for (const [id, costume] of newCostumeMap.entries()) {
      if (!oldCostumeMap.has(id)) {
        diffItems.push({
          type: 'costume-add',
          location: { targetName },
          new: costume,
          fingerprint: id
        });
      } else {
        // Check for edited costumes
        const oldCostume = oldCostumeMap.get(id);
        if (JSON.stringify(oldCostume) !== JSON.stringify(costume)) {
          diffItems.push({
            type: 'costume-edit',
            location: { targetName },
            old: oldCostume,
            new: costume,
            fingerprint: id
          });
        }
      }
    }
    
    return diffItems;
  }

  /**
   * Diff sounds between two targets
   */
  private static diffSounds(
    oldSounds: any[],
    newSounds: any[],
    targetName: string
  ): DiffItem[] {
    const diffItems: DiffItem[] = [];
    
    // Create maps for easy lookup by assetId or md5ext
    const oldSoundMap = this.createResourceMap(oldSounds);
    const newSoundMap = this.createResourceMap(newSounds);
    
    // Check for deleted sounds
    for (const [id, sound] of oldSoundMap.entries()) {
      if (!newSoundMap.has(id)) {
        diffItems.push({
          type: 'sound-delete',
          location: { targetName },
          old: sound,
          fingerprint: id
        });
      }
    }
    
    // Check for added sounds
    for (const [id, sound] of newSoundMap.entries()) {
      if (!oldSoundMap.has(id)) {
        diffItems.push({
          type: 'sound-add',
          location: { targetName },
          new: sound,
          fingerprint: id
        });
      } else {
        // Check for edited sounds
        const oldSound = oldSoundMap.get(id);
        if (JSON.stringify(oldSound) !== JSON.stringify(sound)) {
          diffItems.push({
            type: 'sound-edit',
            location: { targetName },
            old: oldSound,
            new: sound,
            fingerprint: id
          });
        }
      }
    }
    
    return diffItems;
  }

  /**
   * Create a map of resources by their unique identifier (assetId or md5ext)
   */
  private static createResourceMap(resources: any[]): Map<string, any> {
    const map = new Map();
    
    for (const resource of resources) {
      // Use assetId if available, otherwise md5ext
      const id = resource.assetId || resource.md5ext || Math.random().toString();
      map.set(id, resource);
    }
    
    return map;
  }
}
