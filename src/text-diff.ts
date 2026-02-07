// Text-based diff algorithm inspired by git diff
// Uses Myers diff algorithm for line-based comparison

export interface TextDiffResult {
  added: number;
  removed: number;
  changes: Array<{ type: 'add' | 'remove' | 'keep'; line: string; }>;
}

/**
 * Find the longest common subsequence (LCS) between two arrays
 * Returns the edit script (changes needed to convert a to b)
 */
export function myersDiff(a: string[], b: string[]): Array<{ type: 'add' | 'remove' | 'keep'; line: string; }> {
  const N = a.length;
  const M = b.length;
  const MAX = N + M;
  const V = new Map<number, number>();
  const trace = new Map<number, Map<number, number>>();

  V.set(0, 0);

  for (let d = 0; d <= MAX; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      const down = k === -d || (k !== d && V.get(k - 1)! < V.get(k + 1)!);
      
      if (down) {
        // Down move (remove from a)
        x = V.get(k + 1)!;
      } else {
        // Right move (add from b)
        x = V.get(k - 1)! + 1;
      }
      
      let y = x - k;
      
      // Move diagonal as far as possible
      while (x < N && y < M && a[x] === b[y]) {
        x++;
        y++;
      }
      
      V.set(k, x);
      
      if (!trace.has(d)) {
        trace.set(d, new Map());
      }
      trace.get(d)!.set(k, x);
      
      if (x >= N && y >= M) {
        // Reconstruct the edit script
        return reconstructEditScript(a, b, trace, N, M, MAX);
      }
    }
  }
  
  // Fallback - this should never happen if algorithm is correct
  return [];
}

/**
 * Reconstruct the edit script from the trace matrix
 */
function reconstructEditScript(
  a: string[], 
  b: string[], 
  trace: Map<number, Map<number, number>>, 
  N: number, 
  M: number, 
  MAX: number
): Array<{ type: 'add' | 'remove' | 'keep'; line: string; }> {
  const script: Array<{ type: 'add' | 'remove' | 'keep'; line: string; }> = [];
  let x = N;
  let y = M;
  
  for (let d = MAX; d >= 0; d--) {
    const k = x - y;
    const prevK = trace.get(d)!.has(k - 1) ? k - 1 : k + 1;
    const prevX = trace.get(d)!.get(prevK)!;
    const prevY = prevX - prevK;
    
    while (x > prevX && y > prevY) {
      // Diagonal move (common line)
      x--;
      y--;
      script.unshift({ type: 'keep', line: a[x] });
    }
    
    if (x > prevX) {
      // Down move (remove from a)
      x--;
      script.unshift({ type: 'remove', line: a[x] });
    } else if (y > prevY) {
      // Right move (add from b)
      y--;
      script.unshift({ type: 'add', line: b[y] });
    }
    
    if (x === 0 && y === 0) {
      break;
    }
  }
  
  return script;
}

/**
 * Compare two strings and return diff result
 */
export function diffText(oldText: string, newText: string): TextDiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const changes = myersDiff(oldLines, newLines);
  
  let added = 0;
  let removed = 0;
  
  for (const change of changes) {
    if (change.type === 'add') {
      added++;
    } else if (change.type === 'remove') {
      removed++;
    }
  }
  
  return {
    added,
    removed,
    changes
  };
}

/**
 * Format diff result as colored text (similar to git diff)
 */
export function formatDiff(result: TextDiffResult, oldName: string = 'old', newName: string = 'new'): string {
  let output = `diff --git ${oldName} ${newName}\n`;
  output += `--- ${oldName}\n`;
  output += `+++ ${newName}\n`;
  
  let lineNumOld = 1;
  let lineNumNew = 1;
  let group: Array<{ type: 'add' | 'remove' | 'keep'; line: string; }> = [];
  
  function flushGroup() {
    if (group.length === 0) return;
    
    const hasChanges = group.some(c => c.type !== 'keep');
    if (!hasChanges) {
      group = [];
      return;
    }
    
    const firstKeep = group.findIndex(c => c.type === 'keep');
    const lastKeep = [...group].reverse().findIndex(c => c.type === 'keep');
    
    let startOld = lineNumOld;
    let startNew = lineNumNew;
    let oldCount = 0;
    let newCount = 0;
    
    for (const change of group) {
      if (change.type !== 'add') oldCount++;
      if (change.type !== 'remove') newCount++;
    }
    
    output += `@@ -${startOld},${oldCount} +${startNew},${newCount} @@\n`;
    
    for (const change of group) {
      switch (change.type) {
        case 'add':
          output += `+${change.line}\n`;
          lineNumNew++;
          break;
        case 'remove':
          output += `-${change.line}\n`;
          lineNumOld++;
          break;
        case 'keep':
          output += ` ${change.line}\n`;
          lineNumOld++;
          lineNumNew++;
          break;
      }
    }
    
    group = [];
  }
  
  for (const change of result.changes) {
    group.push(change);
    
    // Flush group when we have a keep line after changes
    if (change.type === 'keep' && group.length > 1) {
      flushGroup();
    }
  }
  
  flushGroup();
  
  return output;
}
