#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
// Use .js extensions for relative imports (required for ESM)
import { ProjectExtractor } from './extractor.js';
import { ProjectParser } from './parser.js';
import { BlockNormalizer } from './normalizer.js';
import { BlockIRBuilder } from './ir.js';
import { FingerprintGenerator } from './fingerprint.js';
import { BlockDiffEngine } from './diff.js';
import { ScratchBlocksConverter } from './scratchblocks.js';
import { ResourceInfo } from './extractor.js';
import { colorizeCli } from './colorize.js';

// Re-export all modules for library usage
export * from './types.js';
export { ProjectExtractor } from './extractor.js';
export { ProjectParser } from './parser.js';
export { BlockNormalizer } from './normalizer.js';
export { BlockIRBuilder } from './ir.js';
export { FingerprintGenerator } from './fingerprint.js';
export { BlockDiffEngine } from './diff.js';
export { ScratchBlocksConverter } from './scratchblocks.js';
export { colorizeCli } from './colorize.js';

// Main API function for programmatic usage
export async function compareSb3Projects(oldPath: string, newPath: string, options?: {
  outputDiff?: string;
  outputResources?: string;
  showPreview?: boolean;
  color?: boolean;
  detailed?: boolean;
}) {
  const opts = {
    outputDiff: options?.outputDiff,
    outputResources: options?.outputResources,
    showPreview: options?.showPreview ?? false,
    color: options?.color ?? undefined,
    detailed: options?.detailed ?? true
  };
  
  // Extract projects
  const oldRaw = await ProjectExtractor.extractProject(oldPath);
  const newRaw = await ProjectExtractor.extractProject(newPath);
  
  // Parse projects
  const oldParsed = ProjectParser.parse(oldRaw);
  const newParsed = ProjectParser.parse(newRaw);
  
  // Normalize blocks
  const oldNormalized = BlockNormalizer.normalize(oldParsed);
  const newNormalized = BlockNormalizer.normalize(newParsed);
  
  // Build Block IR
  const oldIR = BlockIRBuilder.buildIR(oldNormalized);
  const newIR = BlockIRBuilder.buildIR(newNormalized);
  
  // Attach raw project targets to IR for script diffing
  (oldIR as any)._rawTargets = oldRaw.targets;
  (newIR as any)._rawTargets = newRaw.targets;
  
  // Generate fingerprints
  FingerprintGenerator.generateFingerprints(oldIR);
  FingerprintGenerator.generateFingerprints(newIR);
  
  // Generate semantic diff
  const enhancedDiff = BlockDiffEngine.generateEnhancedDiff(oldIR, newIR);
  
  // Output diff JSON if requested
  if (opts.outputDiff) {
    await fs.writeFile(opts.outputDiff, JSON.stringify(enhancedDiff.raw, null, 2), 'utf-8');
  }
  
  // Handle resource extraction if requested
  if (opts.outputResources) {
    await handleResourceExtraction(oldPath, newPath, enhancedDiff, opts.outputResources);
  }
  
  return enhancedDiff;
}

// Internal function for resource extraction
async function handleResourceExtraction(
  oldPath: string,
  newPath: string,
  enhancedDiff: any,
  outputResources: string
) {
  const oldResources = await ProjectExtractor.extractAllResources(oldPath);
  const newResources = await ProjectExtractor.extractAllResources(newPath);
  
  const oldResourceMap = new Map(oldResources.map(r => [r.md5ext, r]));
  const newResourceMap = new Map(newResources.map(r => [r.md5ext, r]));
  
  const addedCostumes: any[] = [];
  const deletedCostumes: any[] = [];
  const modifiedCostumes: { old: any; new: any }[] = [];
  const addedSounds: any[] = [];
  const deletedSounds: any[] = [];
  const modifiedSounds: { old: any; new: any }[] = [];
  
  for (const item of enhancedDiff.raw.items) {
    switch (item.type) {
      case 'costume-add':
        addedCostumes.push(item.new);
        break;
      case 'costume-delete':
        deletedCostumes.push(item.old);
        break;
      case 'costume-edit':
        modifiedCostumes.push({ old: item.old, new: item.new });
        break;
      case 'sound-add':
        addedSounds.push(item.new);
        break;
      case 'sound-delete':
        deletedSounds.push(item.old);
        break;
      case 'sound-edit':
        modifiedSounds.push({ old: item.old, new: item.new });
        break;
    }
  }
  
  const addedDir = path.join(outputResources, 'added');
  const deletedDir = path.join(outputResources, 'deleted');
  const modifiedDir = path.join(outputResources, 'modified');
  
  if (addedCostumes.length > 0 || addedSounds.length > 0) {
    const addedCostumeResources = addedCostumes
      .map(costume => newResourceMap.get(costume.md5ext))
      .filter((r): r is ResourceInfo => r !== undefined);
    
    const addedSoundResources = addedSounds
      .map(sound => newResourceMap.get(sound.md5ext))
      .filter((r): r is ResourceInfo => r !== undefined);
    
    if (addedCostumeResources.length > 0) {
      const addedCostumesDir = path.join(addedDir, 'costumes');
      await ProjectExtractor.saveResources(addedCostumeResources, addedCostumesDir);
    }
    
    if (addedSoundResources.length > 0) {
      const addedSoundsDir = path.join(addedDir, 'sounds');
      await ProjectExtractor.saveResources(addedSoundResources, addedSoundsDir);
    }
  }
  
  if (modifiedCostumes.length > 0 || modifiedSounds.length > 0) {
    if (modifiedCostumes.length > 0) {
      const oldCostumesDir = path.join(modifiedDir, 'costumes', 'old');
      const newCostumesDir = path.join(modifiedDir, 'costumes', 'new');
      
      const oldCostumeResources = modifiedCostumes
        .map(item => oldResourceMap.get(item.old.md5ext))
        .filter((r): r is ResourceInfo => r !== undefined);
      
      const newCostumeResources = modifiedCostumes
        .map(item => newResourceMap.get(item.new.md5ext))
        .filter((r): r is ResourceInfo => r !== undefined);
      
      await ProjectExtractor.saveResources(oldCostumeResources, oldCostumesDir);
      await ProjectExtractor.saveResources(newCostumeResources, newCostumesDir);
    }
    
    if (modifiedSounds.length > 0) {
      const oldSoundsDir = path.join(modifiedDir, 'sounds', 'old');
      const newSoundsDir = path.join(modifiedDir, 'sounds', 'new');
      
      const oldSoundResources = modifiedSounds
        .map(item => oldResourceMap.get(item.old.md5ext))
        .filter((r): r is ResourceInfo => r !== undefined);
      
      const newSoundResources = modifiedSounds
        .map(item => newResourceMap.get(item.new.md5ext))
        .filter((r): r is ResourceInfo => r !== undefined);
      
      await ProjectExtractor.saveResources(oldSoundResources, oldSoundsDir);
      await ProjectExtractor.saveResources(newSoundResources, newSoundsDir);
    }
  }
}

/**
 * Main function to handle CLI commands
 */
async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }
  
  // Get subcommand
  const subcommand = args[0];
  const subArgs = args.slice(1);
  
  switch (subcommand) {
    case 'diff':
      await handleDiffCommand(subArgs);
      break;
    case 'reconstruct':
      await handleReconstructCommand(subArgs);
      break;
    default:
      console.error(`Unknown command: ${subcommand}`);
      printHelp();
      process.exit(1);
  }
}

/**
 * Print help information
 */
function printHelp() {
  console.log('Usage: sb3-diff <command> [options]');
  console.log('\nCommands:');
  console.log('  diff           Compare two SB3 projects and generate diff');
  console.log('  reconstruct    Reconstruct SB3 from base SB3, diff, and resources');
  console.log('\nDiff Options:');
  console.log('  -h, --help                Show this help message');
  console.log('  --output-diff <file>       Output diff JSON to specified file');
  console.log('  --output-resources <dir>   Output new resources to specified directory');
  console.log('  -p, --preview             Show scratchblocks syntax preview');
  console.log('  --color                   Force color output');
  console.log('  --no-color                Disable color output');
  console.log('\nDiff Usage:');
  console.log('  sb3-diff diff <old-project> <new-project> [options]');
  console.log('\nReconstruct Usage:');
  console.log('  sb3-diff reconstruct <base-sb3> <diff-json> <resources-dir> <output-sb3>');
  console.log('\n<project> can be:');
  console.log('  - .sb3 files (will be automatically extracted)');
  console.log('  - Directories containing project.json');
}

/**
 * Handle diff command
 */
async function handleDiffCommand(args: string[]) {
  let oldPath: string | undefined;
  let newPath: string | undefined;
  let outputDiff: string | undefined;
  let outputResources: string | undefined;
  let showPreview = false;
  let color: boolean | undefined;
  let detailed = true;
  
  // Parse options
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    switch (arg) {
      case '--output-diff':
        if (i + 1 < args.length) {
          outputDiff = args[i + 1];
          i += 2;
        } else {
          console.error('Error: --output-diff requires a file path');
          printHelp();
          process.exit(1);
        }
        break;
      case '--output-resources':
        if (i + 1 < args.length) {
          outputResources = args[i + 1];
          i += 2;
        } else {
          console.error('Error: --output-resources requires a directory path');
          printHelp();
          process.exit(1);
        }
        break;
      case '-p':
      case '--preview':
        showPreview = true;
        i++;
        break;
      case '--color':
        color = true;
        i++;
        break;
      case '--no-color':
        color = false;
        i++;
        break;
      case '--detailed':
        detailed = true;
        i++;
        break;
      case '--no-detailed':
        detailed = false;
        i++;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        // Positional arguments
        if (!oldPath) {
          oldPath = arg;
        } else if (!newPath) {
          newPath = arg;
        } else {
          console.error(`Error: Unexpected argument: ${arg}`);
          printHelp();
          process.exit(1);
        }
        i++;
        break;
    }
  }
  
  if (!oldPath || !newPath) {
    console.error('Error: Missing required arguments: <old-project> <new-project>');
    printHelp();
    process.exit(1);
  }
  
  try {
    // Add explicit output at the beginning
    console.log('🔍 Starting SB3 diff process...');
    console.log(`📋 Arguments: oldPath=${oldPath}, newPath=${newPath}`);
    console.log(`📋 Options: outputDiff=${outputDiff}, outputResources=${outputResources}, showPreview=${showPreview}, color=${color}, detailed=${detailed}`);
    
    console.log(`📋 Comparing ${oldPath} with ${newPath}...`);
    
    // Step 1: Extract project.json from both projects with automatic extraction
    console.log('\n1️⃣  Extracting project.json (auto-handling .sb3 files)...');
    const oldRaw = await ProjectExtractor.extractProject(oldPath);
    const newRaw = await ProjectExtractor.extractProject(newPath);
    console.log('   ✅ Project.json extracted successfully');
    console.log(`   📋 Old project targets: ${oldRaw.targets.length}`);
    console.log(`   📋 New project targets: ${newRaw.targets.length}`);
    
    // Step 2: Parse both projects into script trees
    console.log('\n2️⃣  Parsing projects into script trees...');
    const oldParsed = ProjectParser.parse(oldRaw);
    const newParsed = ProjectParser.parse(newRaw);
    
    // Count scripts for user feedback
    const oldScriptCount = oldParsed.targets.reduce((sum, target) => sum + target.scripts.length, 0);
    const newScriptCount = newParsed.targets.reduce((sum, target) => sum + target.scripts.length, 0);
    console.log(`   ✅ Old project: ${oldParsed.targets.length} targets, ${oldScriptCount} scripts`);
    console.log(`   ✅ New project: ${newParsed.targets.length} targets, ${newScriptCount} scripts`);
    
    // Step 3: Normalize blocks
    console.log('\n3️⃣  Normalizing block data...');
    const oldNormalized = BlockNormalizer.normalize(oldParsed);
    const newNormalized = BlockNormalizer.normalize(newParsed);
    console.log('   ✅ Block normalization complete');
    
    // Step 4: Build Block IR
    console.log('\n4️⃣  Building Block IR...');
    const oldIR = BlockIRBuilder.buildIR(oldNormalized);
    const newIR = BlockIRBuilder.buildIR(newNormalized);
    
    // Attach raw project targets to IR for script diffing
    // @ts-ignore - Adding rawTargets property for diff generation
    oldIR._rawTargets = oldRaw.targets;
    // @ts-ignore - Adding rawTargets property for diff generation
    newIR._rawTargets = newRaw.targets;
    
    console.log('   ✅ Block IR construction complete');
    
    // Step 5: Generate fingerprints
    console.log('\n5️⃣  Generating semantic fingerprints...');
    FingerprintGenerator.generateFingerprints(oldIR);
    FingerprintGenerator.generateFingerprints(newIR);
    console.log('   ✅ Fingerprints generated successfully');
    
    // Step 6: Generate semantic diff
        console.log('\n6️⃣  Generating semantic diff...');
        // Use type assertion to handle _rawTargets
        const oldIRT = oldIR as any;
        const newIRT = newIR as any;
        
        // Generate enhanced diff with summary and structured changes
        const enhancedDiff = BlockDiffEngine.generateEnhancedDiff(oldIRT, newIRT);
        console.log(`   ✅ Diff generated with ${enhancedDiff.raw.items.length} changes`);
        
        // Step 7: Display colored diff results
        console.log('\n7️⃣  Semantic Diff Results:');
        
        // Write debug info to file for inspection
        await fs.writeFile('./debug-diff.json', JSON.stringify(enhancedDiff, null, 2), 'utf-8');
        console.log(`📝 Debug info written to debug-diff.json`);
        
        // Write raw diff to separate file
        await fs.writeFile('./debug-raw-diff.json', JSON.stringify(enhancedDiff.raw, null, 2), 'utf-8');
        console.log(`📝 Raw diff written to debug-raw-diff.json`);
        
        // Generate colored output using the enhanced formatted output
        const coloredOutput = enhancedDiff.formatted.summary + '\n' + enhancedDiff.formatted.detailed;
        await fs.writeFile('./debug-output.txt', coloredOutput, 'utf-8');
        console.log(`📝 Colored output written to debug-output.txt`);
        
        // Display colored diff output
        console.log(coloredOutput);
        
        // Also display the original colored CLI output for backward compatibility
        console.log('\n🎨 Original Colored CLI Output:');
        const originalColoredOutput = colorizeCli(enhancedDiff.raw, { detailed, color });
        console.log(originalColoredOutput);
        
        // ScratchBlocks preview
        if (showPreview) {
          console.log('\n🎨 ScratchBlocks Preview:');
          
          // Group diff items by target for preview
          const diffByTarget = enhancedDiff.raw.items.reduce((acc: any, item: any) => {
            const targetName = item.location.targetName;
            if (!acc[targetName]) {
              acc[targetName] = [];
            }
            acc[targetName].push(item);
            return acc;
          }, {} as Record<string, any[]>);
          
          for (const [targetName, items] of Object.entries(diffByTarget)) {
            console.log(`\n📌 Target: ${targetName}`);
            
            for (const item of items as any[]) {
              console.log('\n' + ScratchBlocksConverter.convertDiffItem(item));
            }
          }
        }
        
        // Output diff JSON if requested
        if (outputDiff) {
          await fs.writeFile(outputDiff, JSON.stringify(enhancedDiff.raw, null, 2), 'utf-8');
          console.log(`\n📁 Diff JSON saved to ${outputDiff}`);
        }
        
        // Step 8: Handle resource extraction if requested
        if (outputResources) {
          console.log('\n8️⃣  Extracting resource changes...');
          
          // Extract all resources from both projects
          const oldResources = await ProjectExtractor.extractAllResources(oldPath);
          const newResources = await ProjectExtractor.extractAllResources(newPath);
          
          // Create maps for quick lookup by md5ext
          const oldResourceMap = new Map(oldResources.map(r => [r.md5ext, r]));
          const newResourceMap = new Map(newResources.map(r => [r.md5ext, r]));
          
          // Group diff items by resource type and change type
          const addedCostumes: any[] = [];
          const deletedCostumes: any[] = [];
          const modifiedCostumes: { old: any; new: any }[] = [];
          const addedSounds: any[] = [];
          const deletedSounds: any[] = [];
          const modifiedSounds: { old: any; new: any }[] = [];
          
          // Process diff items to find resource changes
          for (const item of enhancedDiff.raw.items) {
            switch (item.type) {
              case 'costume-add':
                addedCostumes.push(item.new);
                break;
              case 'costume-delete':
                deletedCostumes.push(item.old);
                break;
              case 'costume-edit':
                modifiedCostumes.push({ old: item.old, new: item.new });
                break;
              case 'sound-add':
                addedSounds.push(item.new);
                break;
              case 'sound-delete':
                deletedSounds.push(item.old);
                break;
              case 'sound-edit':
                modifiedSounds.push({ old: item.old, new: item.new });
                break;
            }
          }
      
      console.log(`   ✅ Found ${addedCostumes.length} added costumes, ${deletedCostumes.length} deleted costumes, ${modifiedCostumes.length} modified costumes`);
      console.log(`   ✅ Found ${addedSounds.length} added sounds, ${deletedSounds.length} deleted sounds, ${modifiedSounds.length} modified sounds`);
      
      // Create structured directory structure
      const addedDir = path.join(outputResources, 'added');
      const deletedDir = path.join(outputResources, 'deleted');
      const modifiedDir = path.join(outputResources, 'modified');
      
      // Extract and save added resources
      if (addedCostumes.length > 0 || addedSounds.length > 0) {
        const addedCostumeResources = addedCostumes
          .map(costume => newResourceMap.get(costume.md5ext))
          .filter((r): r is ResourceInfo => r !== undefined);
        
        const addedSoundResources = addedSounds
          .map(sound => newResourceMap.get(sound.md5ext))
          .filter((r): r is ResourceInfo => r !== undefined);
        
        // Save added costumes
        if (addedCostumeResources.length > 0) {
          const addedCostumesDir = path.join(addedDir, 'costumes');
          await ProjectExtractor.saveResources(addedCostumeResources, addedCostumesDir);
        }
        
        // Save added sounds
        if (addedSoundResources.length > 0) {
          const addedSoundsDir = path.join(addedDir, 'sounds');
          await ProjectExtractor.saveResources(addedSoundResources, addedSoundsDir);
        }
      }
      
      // Extract and save modified resources
      if (modifiedCostumes.length > 0 || modifiedSounds.length > 0) {
        // Save modified costumes
        if (modifiedCostumes.length > 0) {
          const oldCostumesDir = path.join(modifiedDir, 'costumes', 'old');
          const newCostumesDir = path.join(modifiedDir, 'costumes', 'new');
          
          const oldCostumeResources = modifiedCostumes
            .map(item => oldResourceMap.get(item.old.md5ext))
            .filter((r): r is ResourceInfo => r !== undefined);
          
          const newCostumeResources = modifiedCostumes
            .map(item => newResourceMap.get(item.new.md5ext))
            .filter((r): r is ResourceInfo => r !== undefined);
          
          await ProjectExtractor.saveResources(oldCostumeResources, oldCostumesDir);
          await ProjectExtractor.saveResources(newCostumeResources, newCostumesDir);
        }
        
        // Save modified sounds
        if (modifiedSounds.length > 0) {
          const oldSoundsDir = path.join(modifiedDir, 'sounds', 'old');
          const newSoundsDir = path.join(modifiedDir, 'sounds', 'new');
          
          const oldSoundResources = modifiedSounds
            .map(item => oldResourceMap.get(item.old.md5ext))
            .filter((r): r is ResourceInfo => r !== undefined);
          
          const newSoundResources = modifiedSounds
            .map(item => newResourceMap.get(item.new.md5ext))
            .filter((r): r is ResourceInfo => r !== undefined);
          
          await ProjectExtractor.saveResources(oldSoundResources, oldSoundsDir);
          await ProjectExtractor.saveResources(newSoundResources, newSoundsDir);
        }
      }
      
      // Log deleted resources (no files to save, just record in diff)
      if (deletedCostumes.length > 0 || deletedSounds.length > 0) {
        console.log('   📋 Deleted resources recorded in diff');
      }
      
      console.log(`   ✅ Resource changes saved to ${outputResources}`);
    }
    
    console.log('\n✅ SB3 diff completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during SB3 diff:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Handle reconstruct command
 */
async function handleReconstructCommand(args: string[]) {
  if (args.length !== 4 && args.length !== 5) {
    console.error('Error: Incorrect number of arguments for reconstruct command');
    console.log('Usage: sb3-diff reconstruct <base-sb3> <diff-json> <resources-dir> <output-sb3> [--reverse]');
    console.log('  --reverse: Reverse the diff (new → old)');
    process.exit(1);
  }
  
  const [baseSb3, diffJson, resourcesDir, outputSb3, reverseFlag] = args;
  const isReverse = reverseFlag === '--reverse';
  
  try {
    console.log(`🔧 ${isReverse ? '反向' : '正向'} Reconstructing ${outputSb3} from ${baseSb3} with diff ${diffJson} and resources ${resourcesDir}...`);
    
    // Step 1: Extract base project.json
    console.log('\n1️⃣  Extracting base project.json...');
    const baseRaw = await ProjectExtractor.extractProject(baseSb3);
    console.log('   ✅ Base project.json extracted successfully');
    
    // Step 2: Read diff JSON
    console.log('\n2️⃣  Reading diff JSON...');
    const diffContent = await fs.readFile(diffJson, 'utf-8');
    const diff = JSON.parse(diffContent);
    console.log(`   ✅ Diff loaded with ${diff.items.length} changes`);
    
    // Step 3: Read resources directory with structured approach
    console.log('\n3️⃣  Reading resources...');
    
    // Read resources from structured directories
    const resourceMap = new Map<string, ResourceInfo>();
    
    // Function to read resources from a directory
    const readResourcesFromDir = async (dir: string) => {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            const content = await fs.readFile(filePath);
            const assetId = file.split('.')[0];
            resourceMap.set(file, {
              filename: file,
              content,
              assetId,
              md5ext: file
            });
          }
        }
      } catch (error) {
        // Directory might not exist, which is okay
      }
    };
    
    // Read resources from all possible directories
    await readResourcesFromDir(resourcesDir);
    await readResourcesFromDir(path.join(resourcesDir, 'added', 'costumes'));
    await readResourcesFromDir(path.join(resourcesDir, 'added', 'sounds'));
    await readResourcesFromDir(path.join(resourcesDir, 'modified', 'costumes', 'old'));
    await readResourcesFromDir(path.join(resourcesDir, 'modified', 'costumes', 'new'));
    await readResourcesFromDir(path.join(resourcesDir, 'modified', 'sounds', 'old'));
    await readResourcesFromDir(path.join(resourcesDir, 'modified', 'sounds', 'new'));
    
    console.log(`   ✅ Loaded ${resourceMap.size} resources`);
    
    // Step 4: Extract all resources from base SB3
    console.log('\n4️⃣  Extracting resources from base SB3...');
    const baseResources = await ProjectExtractor.extractAllResources(baseSb3);
    console.log(`   ✅ Extracted ${baseResources.length} resources from base SB3`);
    
    // Step 5: Apply diff changes to project.json
    console.log('\n5️⃣  Applying diff changes to project.json...');
    
    // Create a copy of the base project
    const newProject = JSON.parse(JSON.stringify(baseRaw));
    
    // Process each diff item
    for (const item of diff.items) {
      // Find the target in the project
      const targetIndex = newProject.targets.findIndex((t: any) => t.name === item.location.targetName);
      if (targetIndex === -1) {
        // Target not found, create it if adding
        if (isReverse ? ['script-delete', 'block-delete', 'costume-delete', 'sound-delete'].includes(item.type) : 
                        ['script-add', 'block-add', 'costume-add', 'sound-add'].includes(item.type)) {
          // Create new target if needed
          newProject.targets.push({
            costumes: [],
            sounds: [],
            scripts: [],
            variables: {},
            lists: {},
            broadcasts: [],
            comments: [],
            currentCostume: 0,
            name: item.location.targetName,
            visible: true,
            x: 0,
            y: 0,
            size: 100,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around'
          });
        }
        continue;
      }
      
      const target = newProject.targets[targetIndex];
      
      // Handle resource changes (costumes and sounds)
      if (item.type.startsWith('costume-') || item.type.startsWith('sound-')) {
        const resourceType = item.type.startsWith('costume') ? 'costumes' : 'sounds';
        const changeType = item.type.split('-')[1];
        
        // Determine which version to use based on reverse flag
        const oldValue = isReverse ? item.new : item.old;
        const newValue = isReverse ? item.old : item.new;
        const actualChangeType = isReverse ? 
          (changeType === 'add' ? 'delete' : changeType === 'delete' ? 'add' : changeType) : 
          changeType;
        
        if (actualChangeType === 'add') {
          // Add resource to target
          target[resourceType].push(newValue);
        } else if (actualChangeType === 'delete') {
          // Delete resource from target
          target[resourceType] = target[resourceType].filter((r: any) => {
            const resourceId = r.assetId || r.md5ext;
            const itemId = (oldValue as any).assetId || (oldValue as any).md5ext;
            return resourceId !== itemId;
          });
        } else if (actualChangeType === 'edit') {
          // Edit resource in target
          const resourceIndex = target[resourceType].findIndex((r: any) => {
            const resourceId = r.assetId || r.md5ext;
            const itemId = (oldValue as any).assetId || (oldValue as any).md5ext;
            return resourceId === itemId;
          });
          
          if (resourceIndex !== -1) {
            target[resourceType][resourceIndex] = newValue;
          }
        }
      }
    }
    
    console.log('   ✅ Applied resource changes to project.json');
    
    // Step 6: Combine resources
    console.log('\n6️⃣  Combining resources...');
    
    // Create a map of base resources
    const combinedResourceMap = new Map(baseResources.map(r => [r.md5ext, r]));
    
    // Add all loaded resources to the map
    for (const resource of resourceMap.values()) {
      combinedResourceMap.set(resource.md5ext, resource);
    }
    
    const combinedResources = Array.from(combinedResourceMap.values());
    console.log(`   ✅ Combined ${combinedResources.length} total resources`);
    
    // Step 7: Create new SB3 file
    console.log('\n7️⃣  Creating new SB3 file...');
    await ProjectExtractor.createSb3(newProject, combinedResources, outputSb3);
    console.log(`   ✅ SB3 file created successfully at ${outputSb3}`);
    
    console.log('\n✅ SB3 reconstruction completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during SB3 reconstruction:', (error as Error).message);
    process.exit(1);
  }
}

// Run main function only if this file is executed directly as a script
// Check if this file is being run directly (not imported as a module)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('index.js') ||
                     process.argv[1]?.endsWith('sb3-diff');

if (isMainModule) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
