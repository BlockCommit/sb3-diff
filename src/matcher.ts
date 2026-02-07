import { ProjectIR, ScriptIR } from './types.js'

export interface ScriptMatchResult {
  matchedScripts: Array<{ old: ScriptIR; new: ScriptIR }>;
  deletedScripts: ScriptIR[];
  addedScripts: ScriptIR[];
}

export class ScriptMatcher {
  /**
   * Match scripts between two Project IRs
   */
  public static matchProjects(oldIR: ProjectIR, newIR: ProjectIR): Array<{ targetName: string; result: ScriptMatchResult }> {
    const results: Array<{ targetName: string; result: ScriptMatchResult }> = [];
    
    // Group targets by name for easier matching
    const oldTargetsMap = new Map<string, typeof oldIR.targets[0]>();
    for (const target of oldIR.targets) {
      oldTargetsMap.set(target.name, target);
    }
    
    const newTargetsMap = new Map<string, typeof newIR.targets[0]>();
    for (const target of newIR.targets) {
      newTargetsMap.set(target.name, target);
    }
    
    // Match targets by name
    const allTargetNames = new Set([...oldTargetsMap.keys(), ...newTargetsMap.keys()]);
    
    for (const targetName of allTargetNames) {
      const oldTarget = oldTargetsMap.get(targetName);
      const newTarget = newTargetsMap.get(targetName);
      
      // Match scripts within the same target
      const matchResult = this.matchScripts(
        oldTarget?.scripts || [],
        newTarget?.scripts || []
      );
      
      results.push({
        targetName,
        result: matchResult
      });
    }
    
    return results;
  }

  /**
   * Match scripts within a single target
   */
  private static matchScripts(oldScripts: ScriptIR[], newScripts: ScriptIR[]): ScriptMatchResult {
    const matchedScripts: Array<{ old: ScriptIR; new: ScriptIR }> = [];
    const deletedScripts: ScriptIR[] = [...oldScripts];
    const addedScripts: ScriptIR[] = [...newScripts];
    
    // Create a map of fingerprints to old scripts for quick lookup
    const oldScriptMap = new Map<string, ScriptIR>();
    for (const script of oldScripts) {
      oldScriptMap.set(script.fingerprint, script);
    }
    
    // Create a map of fingerprints to new scripts for quick lookup
    const newScriptMap = new Map<string, ScriptIR>();
    for (const script of newScripts) {
      newScriptMap.set(script.fingerprint, script);
    }
    
    // Find matched scripts (same fingerprint in both old and new)
    for (const fingerprint of oldScriptMap.keys()) {
      if (newScriptMap.has(fingerprint)) {
        const oldScript = oldScriptMap.get(fingerprint)!;
        const newScript = newScriptMap.get(fingerprint)!;
        
        matchedScripts.push({ old: oldScript, new: newScript });
        
        // Remove from deleted and added lists
        deletedScripts.splice(deletedScripts.indexOf(oldScript), 1);
        addedScripts.splice(addedScripts.indexOf(newScript), 1);
      }
    }
    
    return {
      matchedScripts,
      deletedScripts,
      addedScripts
    };
  }
}
