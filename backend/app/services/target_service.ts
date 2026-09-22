import { simpleGit } from 'simple-git';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SCANS_DIR = path.resolve(__dirname, '../../../scans');

export class TargetService {
  
  static getTargetDir(analysisId: string): string {
    return path.join(SCANS_DIR, analysisId);
  }

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
      if (!zipFilePath || !fs.existsSync(zipFilePath)) {
        throw new Error(`Upload archive not found at path: ${zipFilePath || 'undefined'}`);
      }

      const zip = new AdmZip(zipFilePath);
      const zipEntries = zip.getEntries();
      if (zipEntries.length === 0) {
        throw new Error('Uploaded archive is empty.');
      }
      
      // Zip Slip prevention check
      for (const entry of zipEntries) {
        const entryName = entry.entryName;
        if (entryName.includes('..') || path.isAbsolute(entryName)) {
          throw new Error('Zip Slip vulnerability detected in uploaded archive.');
        }
      }

      zip.extractAllTo(targetDir, true);
      
      // Cleanup the original zip file safely
      try {
        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }
      } catch (cleanupErr) {
        console.warn(`[TargetService] Non-fatal cleanup warning for ${zipFilePath}:`, cleanupErr);
      }
      return targetDir;
    } catch (error) {
      console.error(`Failed to extract zip file ${zipFilePath}:`, error);
      throw new Error(`Zip extraction failed: ${(error as Error).message}`);
    }
  }

  static async prepareBinaryTarget(analysisId: string, binaryFilePath: string, originalFilename?: string): Promise<string> {
    const targetDir = path.join(SCANS_DIR, analysisId);
    if (!fs.existsSync(SCANS_DIR)) {
      fs.mkdirSync(SCANS_DIR, { recursive: true });
    }

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    try {
      if (!binaryFilePath || !fs.existsSync(binaryFilePath)) {
        throw new Error(`Uploaded binary file not found at path: ${binaryFilePath || 'undefined'}`);
      }

      const safeFilename = path.basename(originalFilename || 'binary.bin');
      const destPath = path.join(targetDir, safeFilename);

      fs.copyFileSync(binaryFilePath, destPath);

      // Cleanup original temp file safely
      try {
        if (fs.existsSync(binaryFilePath)) {
          fs.unlinkSync(binaryFilePath);
        }
      } catch (cleanupErr) {
        console.warn(`[TargetService] Non-fatal cleanup warning for ${binaryFilePath}:`, cleanupErr);
      }

      return destPath;
    } catch (error) {
      console.error(`Failed to stage binary file ${binaryFilePath}:`, error);
      throw new Error(`Binary staging failed: ${(error as Error).message}`);
    }
  }

  static async prepareContainerTarget(analysisId: string, imageReference: string): Promise<string> {
    const targetDir = path.join(SCANS_DIR, analysisId);
    if (!fs.existsSync(SCANS_DIR)) {
      fs.mkdirSync(SCANS_DIR, { recursive: true });
    }

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    // 1. Validate image reference strictly
    const trimmed = (imageReference || '').trim();
    if (!trimmed) {
      throw new Error('Container image reference is required.');
    }
    const validImageRefPattern = /^[a-zA-Z0-9_][a-zA-Z0-9_./:-]{0,255}$/;
    if (!validImageRefPattern.test(trimmed) || trimmed.includes('..')) {
      throw new Error(`Invalid container image reference: "${trimmed}". Only alphanumeric characters, dashes, underscores, dots, colons, and slashes are allowed.`);
    }

    // 2. Check Docker availability
    try {
      await execFileAsync('docker', ['--version']);
    } catch (dockerErr) {
      throw new Error('Docker is not available or not running on the host system.');
    }

    // 3. Inspect image; pull safely if not locally present
    try {
      await execFileAsync('docker', ['image', 'inspect', trimmed]);
    } catch {
      console.log(`[TargetService] Image ${trimmed} not cached locally, pulling...`);
      try {
        await execFileAsync('docker', ['pull', trimmed], { timeout: 180000 });
      } catch (pullErr) {
        throw new Error(`Failed to pull container image "${trimmed}": ${(pullErr as Error).message}`);
      }
    }

    // 4. Create stopped temporary container (zero code execution)
    let cid: string | null = null;
    const rootfsTarPath = path.join(targetDir, 'rootfs.tar');

    try {
      const createRes = await execFileAsync('docker', ['create', trimmed]);
      cid = (createRes.stdout || '').trim();
      if (!cid) {
        throw new Error('Docker failed to create a stopped container.');
      }

      console.log(`[TargetService] Created stopped container ${cid.substring(0, 12)} for ${trimmed}`);

      // 5. Export filesystem into rootfs.tar
      await execFileAsync('docker', ['export', cid, '-o', rootfsTarPath], { timeout: 180000 });

      if (!fs.existsSync(rootfsTarPath) || fs.statSync(rootfsTarPath).size === 0) {
        throw new Error('Exported container rootfs archive is empty.');
      }

      console.log(`[TargetService] Successfully exported rootfs tarball to ${rootfsTarPath}`);
      return rootfsTarPath;
    } catch (err) {
      console.error(`[TargetService] Error exporting container rootfs for ${trimmed}:`, err);
      throw new Error(`Container extraction failed: ${(err as Error).message}`);
    } finally {
      // 6. Always clean up temporary stopped container
      if (cid) {
        try {
          await execFileAsync('docker', ['rm', '-f', cid]);
          console.log(`[TargetService] Cleaned up temporary container ${cid.substring(0, 12)}`);
        } catch (rmErr) {
          console.warn(`[TargetService] Warning cleaning up container ${cid}:`, rmErr);
        }
      }
    }
  }
}
