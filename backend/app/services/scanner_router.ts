import { LocalScanner } from './local_scanner';
import { CbomkitAdapter } from './cbomkit_adapter';

export class ScannerRouter {
  
  static async routeScan(analysisId: string, targetType: string, targetPath: string): Promise<void> {
    // For Stage 1, all source code targets are routed to CBOMkit
    if (targetType === 'source_code') {
      // For now, we use LocalScanner to generate the mock CBOM JSON simulating CBOMKit
      const cbomJson = await LocalScanner.scanDirectory(targetPath);
      await CbomkitAdapter.processOfficialCbom(analysisId, cbomJson);
    } else {
      throw new Error(`Unsupported target type for Stage 1: ${targetType}`);
    }
  }

}
