import * as fs from 'fs/promises';
import * as path from 'path';
import JSZip from 'jszip';
import { RawProject } from './types.js'

export interface ResourceInfo {
  filename: string;
  content: Buffer;
  assetId: string;
  md5ext: string;
}

export class ProjectExtractor {
  /**
   * Extract project.json from a .sb3 file
   */
  public static async extractFromSb3(sb3Path: string): Promise<RawProject> {
    try {
      const data = await fs.readFile(sb3Path);
      const zip = await JSZip.loadAsync(data);
      const projectJsonFile = zip.file('project.json');
      
      if (!projectJsonFile) {
        throw new Error('project.json not found in sb3 file');
      }
      
      const projectJsonContent = await projectJsonFile.async('string');
      return JSON.parse(projectJsonContent) as RawProject;
    } catch (error) {
      throw new Error(`Failed to extract project.json from ${sb3Path}: ${(error as Error).message}`);
    }
  }

  /**
   * Read project.json from an extracted directory
   */
  public static async readFromDirectory(dirPath: string): Promise<RawProject> {
    try {
      const projectJsonPath = path.join(dirPath, 'project.json');
      const data = await fs.readFile(projectJsonPath, 'utf-8');
      return JSON.parse(data) as RawProject;
    } catch (error) {
      throw new Error(`Failed to read project.json from ${dirPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Extract or read project.json based on the path type
   */
  public static async extractProject(projectPath: string): Promise<RawProject> {
    const stats = await fs.stat(projectPath);
    
    if (stats.isDirectory()) {
      return this.readFromDirectory(projectPath);
    } else if (stats.isFile() && projectPath.endsWith('.sb3')) {
      return this.extractFromSb3(projectPath);
    } else {
      throw new Error(`Invalid path: ${projectPath}. Must be a .sb3 file or directory containing project.json`);
    }
  }

  /**
   * Extract all resources from an SB3 file
   */
  public static async extractAllResources(sb3Path: string): Promise<ResourceInfo[]> {
    try {
      const resources: ResourceInfo[] = [];
      const data = await fs.readFile(sb3Path);
      const zip = await JSZip.loadAsync(data);
      
      // Extract project.json first to get resource information
      const projectJsonFile = zip.file('project.json');
      if (!projectJsonFile) {
        throw new Error('project.json not found in sb3 file');
      }
      
      const projectJsonContent = await projectJsonFile.async('string');
      const project = JSON.parse(projectJsonContent) as RawProject;
      
      // Get all asset files mentioned in project.json
      const assetFiles = new Set<string>();
      
      for (const target of project.targets) {
        for (const costume of target.costumes) {
          assetFiles.add(costume.md5ext);
        }
        for (const sound of target.sounds) {
          assetFiles.add(sound.md5ext);
        }
      }
      
      // Extract all asset files
      for (const assetFile of assetFiles) {
        const zipFile = zip.file(assetFile);
        if (zipFile) {
          const content = await zipFile.async('nodebuffer');
          // Extract assetId from filename (md5ext format: assetId.ext)
          const assetId = assetFile.split('.')[0];
          resources.push({
            filename: assetFile,
            content,
            assetId,
            md5ext: assetFile
          });
        }
      }
      
      return resources;
    } catch (error) {
      throw new Error(`Failed to extract resources from ${sb3Path}: ${(error as Error).message}`);
    }
  }

  /**
   * Extract specific resources by md5ext from an SB3 file
   */
  public static async extractResourcesByMd5ext(sb3Path: string, md5extList: string[]): Promise<ResourceInfo[]> {
    try {
      const resources: ResourceInfo[] = [];
      const data = await fs.readFile(sb3Path);
      const zip = await JSZip.loadAsync(data);
      
      for (const md5ext of md5extList) {
        const zipFile = zip.file(md5ext);
        if (zipFile) {
          const content = await zipFile.async('nodebuffer');
          const assetId = md5ext.split('.')[0];
          resources.push({
            filename: md5ext,
            content,
            assetId,
            md5ext
          });
        }
      }
      
      return resources;
    } catch (error) {
      throw new Error(`Failed to extract specific resources from ${sb3Path}: ${(error as Error).message}`);
    }
  }

  /**
   * Create an SB3 file from project.json and resources
   */
  public static async createSb3(projectJson: RawProject, resources: ResourceInfo[], outputPath: string): Promise<void> {
    try {
      const zip = new JSZip();
      
      // Add project.json
      zip.file('project.json', JSON.stringify(projectJson, null, 2));
      
      // Add all resources
      for (const resource of resources) {
        zip.file(resource.md5ext, resource.content);
      }
      
      // Generate and write the SB3 file
      const zipData = await zip.generateAsync({ type: 'nodebuffer' });
      await fs.writeFile(outputPath, zipData);
    } catch (error) {
      throw new Error(`Failed to create SB3 file at ${outputPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Save resources to a directory
   */
  public static async saveResources(resources: ResourceInfo[], directory: string): Promise<void> {
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(directory, { recursive: true });
      
      for (const resource of resources) {
        const resourcePath = path.join(directory, resource.filename);
        await fs.writeFile(resourcePath, resource.content);
      }
    } catch (error) {
      throw new Error(`Failed to save resources to ${directory}: ${(error as Error).message}`);
    }
  }
}
