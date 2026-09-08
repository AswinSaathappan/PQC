import { simpleGit } from 'simple-git';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

const SCANS_DIR = path.resolve(__dirname, '../../../scans');

export class TargetService {
  
  static async prepareGitTarget(analysisId: string, repoUrl: string): Promise<string> {
    const targetDir = path.join(SCANS_DIR, analysisId);
    if (!fs.existsSync(SCANS_DIR)) {
      fs.mkdirSync(SCANS_DIR, { recursive: true });
    }
    
    // Clear if exists
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    try {
      const git = simpleGit();
      await git.clone(repoUrl, targetDir);
      return targetDir;
    } catch (error) {
      console.error(`Failed to clone git repository ${repoUrl}:`, error);
      throw new Error(`Git clone failed: ${(error as Error).message}`);
    }
  }

  static async prepareZipTarget(analysisId: string, zipFilePath: string): Promise<string> {
    const targetDir = path.join(SCANS_DIR, analysisId);
    if (!fs.existsSync(SCANS_DIR)) {
      fs.mkdirSync(SCANS_DIR, { recursive: true });
    }

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    try {
      const zip = new AdmZip(zipFilePath);
      
      // Basic Zip Slip prevention check
      const zipEntries = zip.getEntries();
      for (const entry of zipEntries) {
        const entryName = entry.entryName;
        // Simple path traversal check
        if (entryName.includes('..')) {
          throw new Error('Zip Slip vulnerability detected in uploaded archive.');
        }
      }

      zip.extractAllTo(targetDir, true);
      
      // Cleanup the original zip file
      fs.unlinkSync(zipFilePath);
      return targetDir;
    } catch (error) {
      console.error(`Failed to extract zip file ${zipFilePath}:`, error);
      throw new Error(`Zip extraction failed: ${(error as Error).message}`);
    }
  }
}
