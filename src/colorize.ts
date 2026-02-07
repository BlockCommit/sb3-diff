import chalk from 'chalk';
import { Diff, DiffItem, DiffType } from './types.js';

/**
 * Color scheme for different diff types
 */
const COLOR_SCHEME = {
  // Add types - green
  'script-add': chalk.green,
  'block-add': chalk.green,
  'variable-add': chalk.green,
  'list-add': chalk.green,
  'costume-add': chalk.green,
  'sound-add': chalk.green,
  
  // Delete types - red
  'script-delete': chalk.red,
  'block-delete': chalk.red,
  'variable-delete': chalk.red,
  'list-delete': chalk.red,
  'costume-delete': chalk.red,
  'sound-delete': chalk.red,
  
  // Edit types - yellow
  'block-edit': chalk.yellow,
  'block-move': chalk.yellow,
  'variable-edit': chalk.yellow,
  'list-edit': chalk.yellow,
  'costume-edit': chalk.yellow,
  'sound-edit': chalk.yellow,
  'script-modify': chalk.yellow
};

/**
 * Apply color to text based on diff type
 */
const applyColor = (text: string, type: DiffType, useColor: boolean): string => {
  if (!useColor) {
    return text;
  }
  const colorFn = COLOR_SCHEME[type] || chalk.white;
  return colorFn(text);
};

/**
 * Get a symbol for a diff type
 */
const getSymbolForType = (type: DiffType): string => {
  switch (type.split('-')[1]) {
    case 'add':
      return '➕';
    case 'delete':
      return '➖';
    case 'edit':
      return '✏️';
    case 'move':
      return '🔀';
    default:
      return '📌';
  }
};

/**
 * Format a single diff item
 */
const formatDiffItem = (item: DiffItem, useColor: boolean): string => {
  const symbol = getSymbolForType(item.type);
  
  // Format location information
  const locationStr = item.location.targetName;
  const formattedLocation = useColor ? chalk.cyan(locationStr) : locationStr;
  const locationParts = [formattedLocation];
  if (item.location.scriptIndex !== undefined) {
    locationParts.push(`script: ${item.location.scriptIndex}`);
  }
  if (item.location.blockPath) {
    locationParts.push(`block: ${item.location.blockPath}`);
  }
  const locationInfo = locationParts.join(', ');
  
  // Format diff type
  const typeText = `${symbol} ${item.type}`;
  const typeStr = applyColor(typeText, item.type, useColor);
  
  // Format content
  let contentStr = '';
  
  if (item.type.endsWith('-delete')) {
    const content = `- ${JSON.stringify(item.old, null, 2)}`;
    contentStr = useColor ? chalk.red(content) : content;
  } else if (item.type.endsWith('-add')) {
    const content = `+ ${JSON.stringify(item.new, null, 2)}`;
    contentStr = useColor ? chalk.green(content) : content;
  } else if (item.type.endsWith('-edit')) {
    const oldContent = `- ${JSON.stringify(item.old, null, 2)}`;
    const newContent = `+ ${JSON.stringify(item.new, null, 2)}`;
    const formattedOld = useColor ? chalk.red(oldContent) : oldContent;
    const formattedNew = useColor ? chalk.green(newContent) : newContent;
    contentStr = `${formattedOld}\n${formattedNew}`;
  } else if (item.type.endsWith('-move')) {
    const content = `↳ Moved block`;
    contentStr = useColor ? chalk.yellow(content) : content;
  } else if (item.type === 'script-modify') {
    // Handle script-modify type with text diff
    const diffText = item.diff?.text || '';
    contentStr = useColor ? chalk.yellow(diffText) : diffText;
  }
  
  // Format fingerprint if present
  const fingerprintStr = item.fingerprint ? ` [${useColor ? chalk.gray(item.fingerprint) : item.fingerprint}]` : '';
  
  return `${typeStr} ${locationInfo}${fingerprintStr}\n${contentStr}`;
};

/**
 * Generate a diff summary
 */
const generateDiffSummary = (diff: Diff, useColor: boolean): string => {
  const summary: Record<string, number> = {};
  
  // Count diff items by type
  for (const item of diff.items) {
    summary[item.type] = (summary[item.type] || 0) + 1;
  }
  
  // Format summary
  const blue = useColor ? chalk.blue : (text: string) => text;
  const gray = useColor ? chalk.gray : (text: string) => text;
  let summaryStr = `${blue('📊 Diff Summary')}\n${gray('────────────────────────────────────────')}\n`;
  
  // Group by change category
  const categories = {
    'add': ['script-add', 'block-add', 'variable-add', 'list-add', 'costume-add', 'sound-add'],
    'delete': ['script-delete', 'block-delete', 'variable-delete', 'list-delete', 'costume-delete', 'sound-delete'],
    'edit': ['block-edit', 'block-move', 'variable-edit', 'list-edit', 'costume-edit', 'sound-edit', 'script-modify']
  };
  
  for (const [category, types] of Object.entries(categories)) {
    for (const type of types) {
      if (summary[type] > 0) {
        const symbol = getSymbolForType(type as DiffType);
        const countText = `${summary[type]}`;
        const coloredCount = applyColor(countText, type as DiffType, useColor);
        summaryStr += `${symbol} ${type}: ${coloredCount}\n`;
      }
    }
  }
  
  return summaryStr;
};

/**
 * Colorize the diff output
 */
export const colorize = (diff: Diff, options: { detailed?: boolean; color?: boolean } = {}): string => {
  const { detailed = true, color = true } = options;
  const useColor = color;
  
  let result = '';
  
  // Add summary
  result += generateDiffSummary(diff, useColor);
  result += '\n';
  
  // Add simple output for testing
  if (diff.items.length === 0) {
    result += 'No changes detected.\n';
  }
  
  if (detailed && diff.items.length > 0) {
    // Add detailed diff
    const blue = useColor ? chalk.blue : (text: string) => text;
    const gray = useColor ? chalk.gray : (text: string) => text;
    const cyan = useColor ? chalk.cyan : (text: string) => text;
    const magenta = useColor ? chalk.magenta : (text: string) => text;
    
    result += `${blue('📋 Detailed Diff')}\n${gray('────────────────────────────────────────')}\n\n`;
    
    // Group diff items by target
    const diffByTarget = diff.items.reduce((acc, item) => {
      const targetName = item.location.targetName;
      if (!acc[targetName]) {
        acc[targetName] = [];
      }
      acc[targetName].push(item);
      return acc;
    }, {} as Record<string, DiffItem[]>);
    
    // Format diff by target
    for (const [targetName, items] of Object.entries(diffByTarget)) {
      result += `${cyan('🎯 Target:')} ${targetName}\n${gray('────────────────────────────────────────')}\n`;
      
      // Group items by script if applicable
      const itemsByScript = items.reduce((acc, item) => {
        const scriptKey = item.location.scriptIndex?.toString() || 'no-script';
        if (!acc[scriptKey]) {
          acc[scriptKey] = [];
        }
        acc[scriptKey].push(item);
        return acc;
      }, {} as Record<string, DiffItem[]>);
      
      for (const [scriptKey, scriptItems] of Object.entries(itemsByScript)) {
        if (scriptKey !== 'no-script') {
          result += `  ${magenta('📝 Script:')} ${scriptKey}\n`;
        }
        
        for (const item of scriptItems) {
          const formattedItem = formatDiffItem(item, useColor);
          const indent = scriptKey !== 'no-script' ? '    ' : '  ';
          result += formattedItem.split('\n').map(line => `${indent}${line}`).join('\n') + '\n';
        }
      }
      
      result += '\n';
    }
  }
  
  return result;
};

/**
 * Colorize helper for CLI output
 */
export const colorizeCli = (diff: Diff, options: { detailed?: boolean; color?: boolean } = {}): string => {
  const { detailed = true, color = true } = options;
  
  return colorize(diff, { detailed, color });
};
