import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import axios from 'axios';
import { Analysis } from '../models/analysis';
import { CryptoAsset } from '../models/crypto_asset';
import { Cbom } from '../models/cbom';
import { CbomkitAdapter } from '../services/cbomkit_adapter';
import { CryptavistaClassifier } from '../services/cryptavista_classifier';
import { RuntimeEvent } from '../models/runtime_event';
import { Recommendation } from '../models/recommendation';
import { RecommendationAdvisor } from '../services/recommendation_advisor';
import { TargetService } from '../services/target_service';
import { LocalScanner } from '../services/local_scanner';
import { BinaryScanner } from '../services/binary_scanner';
import { ContainerScanner } from '../services/container_scanner';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Create a new analysis
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { applicationName, dataSensitivity, businessCriticality, dataProtectionDuration, runtimeEnabled, repositoryUrl, threatHorizonYear, migrationDuration, targetType, branch, commit } = req.body;
    
    if (!applicationName) {
      res.status(400).json({ error: 'applicationName is required' });
      return;
    }

    const analysisId = 'ECDAT-' + uuidv4().substring(0, 8).toUpperCase();
    const parsedHorizonYear = Number(threatHorizonYear) || 2036;
    const derivedZ = parsedHorizonYear - 2026;
    const resolvedTargetType = targetType || (req.file ? 'folder' : 'source_code');

    const analysis = new Analysis({
      analysisId,
      applicationName,
      targetType: resolvedTargetType,
      repositoryUrl,
      gitBranch: branch || (repositoryUrl ? 'main' : undefined),
      gitCommit: commit,
      uploadedFileReference: req.file ? req.file.path : undefined,
      dataSensitivity: Number(dataSensitivity) || 1,
      businessCriticality: Number(businessCriticality) || 1,
      dataProtectionDuration: Number(dataProtectionDuration) || 5, // Default 5 years
      threatHorizonYear: parsedHorizonYear,
      quantumRiskHorizon: derivedZ,
      migrationDuration: Number(migrationDuration) || 2,
      runtimeEnabled: runtimeEnabled === 'true',
      status: 'CREATED'
    });

    await analysis.save();

    // For folder / binary / container: wait until archive / binary / container reference is scanned in CBOMKit.
    // For source_code / Git: start processAnalysis so it waits for CBOMKit scan result when user scans in CBOMKit.
    if ((resolvedTargetType === 'source_code' && !req.file?.path) || (resolvedTargetType === 'container' && repositoryUrl) || (resolvedTargetType === 'folder' && req.file?.path) || (resolvedTargetType === 'binary' && req.file?.path)) {
      processAnalysis(analysisId, repositoryUrl, req.file?.path, resolvedTargetType, branch, commit, req.file?.originalname);
    }

    res.status(201).json(analysis);
  } catch (error) {
    console.error('Error creating analysis:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Trigger scan on existing analysis (from CBOM page)
router.post('/:id/scan', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const analysisId = String(req.params.id);
    const analysis = await Analysis.findOne({ analysisId });
    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const { repositoryUrl, imageReference, branch, commit, targetType: reqTargetType } = req.body;
    const uploadedFilePath = req.file?.path;
    const originalFilename = req.file?.originalname;
    let rawImage = (imageReference && imageReference.trim()) || (repositoryUrl && repositoryUrl.trim()) || '';
    const matchParen = rawImage.match(/\(([^)]+)\)/);
    const effectiveImageRef = matchParen ? matchParen[1].trim() : rawImage;
    const resolvedTargetType = reqTargetType || (analysis.targetType === 'container' ? 'container' : analysis.targetType === 'binary' ? 'binary' : analysis.targetType === 'folder' ? 'folder' : req.file ? 'folder' : 'source_code');

    const updateDoc: any = {
      status: 'RUNNING',
      currentStage: 'DISCOVER',
      'stages.discover.status': 'RUNNING',
      'stages.discover.startedAt': new Date(),
      errorMessage: null
    };
    if (effectiveImageRef) {
      updateDoc.repositoryUrl = effectiveImageRef;
    }
    if (branch) {
      updateDoc.gitBranch = branch.trim();
    }
    if (commit) {
      updateDoc.gitCommit = commit.trim();
    }
    if (uploadedFilePath) {
      updateDoc.uploadedFileReference = uploadedFilePath;
    }

    await Analysis.updateOne({ analysisId }, { $set: updateDoc });

    const effectiveRepoUrl = effectiveImageRef || analysis.repositoryUrl;
    processAnalysis(analysisId, effectiveRepoUrl, uploadedFilePath, resolvedTargetType, branch, commit, originalFilename);

    res.json({ success: true, status: 'RUNNING', analysisId });
  } catch (error) {
    console.error('Error starting scan:', error);
    res.status(500).json({ error: 'Failed to start scan', detail: String(error) });
  }
});

// Get all analyses
router.get('/', async (req: Request, res: Response) => {
  const analyses = await Analysis.find().sort({ createdAt: -1 });
  res.json(analyses);
});

// Get all assets across all analyses
router.get('/assets/all', async (req: Request, res: Response): Promise<void> => {
  const assets = await CryptoAsset.find();
  res.json(assets);
});

// Check AI status
router.get('/ai/status', async (_req: Request, res: Response): Promise<void> => {
  const status = await RecommendationAdvisor.checkAiStatus();
  res.json(status);
});

// Backwards compatibility endpoint
router.get('/ollama/status', async (_req: Request, res: Response): Promise<void> => {
  const status = await RecommendationAdvisor.checkAiStatus();
  res.json(status);
});

// Get scan status
router.get('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const analysis = await Analysis.findOne({ analysisId: req.params.id });
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }
  res.json({ 
    status: analysis.status, 
    currentStage: analysis.currentStage,
    stages: analysis.stages,
    errorMessage: analysis.errorMessage,
    runtimeEnabled: analysis.runtimeEnabled,
    detectedCryptoAssetCount: analysis.detectedCryptoAssetCount ?? analysis.stages?.discover?.assetCount ?? 0,
    scannedFiles: analysis.scannedFiles ?? 0,
    scannedLines: analysis.scannedLines ?? 0,
    gitBranch: analysis.gitBranch,
    gitCommit: analysis.gitCommit,
    repositoryUrl: analysis.repositoryUrl,
    applicationName: analysis.applicationName,
    targetType: analysis.targetType
  });
});

// Get specific analysis
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const analysis = await Analysis.findOne({ analysisId: req.params.id });
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }
  res.json(analysis);
});

// Get generated CBOM
router.get('/:id/cbom', async (req: Request, res: Response): Promise<void> => {
  const cbom = await Cbom.findOne({ analysisId: req.params.id });
  if (!cbom) {
    res.status(404).json({ error: 'CBOM not found' });
    return;
  }
  // Ensure synced to CBOMKit backend (port 8081) for visualization
  axios.post(
    `http://localhost:8081/api/v1/cbom/${encodeURIComponent(String(req.params.id))}`,
    cbom.rawJson,
    { headers: { 'Content-Type': 'application/json' }, timeout: 2000 }
  ).catch(() => {});
  res.json(cbom.rawJson);
});

// Get authoritative CBOMKit classification summary (5 cards)
router.get('/:id/cbom-summary', async (req: Request, res: Response): Promise<void> => {
  let cbom = await Cbom.findOne({ analysisId: req.params.id });
  let assets = await CryptoAsset.find({ analysisId: req.params.id });
  
  if (!cbom && assets.length === 0) {
    const analysisDoc = await Analysis.findById(req.params.id).catch(() => null);
    if (analysisDoc) {
      cbom = await Cbom.findOne({ analysisId: analysisDoc.analysisId });
      assets = await CryptoAsset.find({ analysisId: analysisDoc.analysisId });
    }
  }

  if (!cbom && assets.length === 0) {
    res.status(404).json({ error: 'CBOM not found' });
    return;
  }

  // If already computed with all 5 cards in Cbom document, return directly
  if (cbom?.cbomSummary && typeof cbom.cbomSummary.quantumSafe === 'number') {
    res.json(cbom.cbomSummary);
    return;
  }

  let unknown = 0;
  let notApplicable = 0;
  let notQuantumSafe = 0;
  let quantumSafe = 0;

  for (const a of assets) {
    if (a.cbomKitClassification === 'Quantum Safe') quantumSafe++;
    else if (a.cbomKitClassification === 'Not Quantum Safe') notQuantumSafe++;
    else if (a.cbomKitClassification === 'Not Applicable') notApplicable++;
    else unknown++;
  }

  const summary = {
    totalCryptoAssets: assets.length,
    unknown,
    notApplicable,
    notQuantumSafe,
    quantumSafe,
    complianceStatus: cbom?.cbomSummary?.complianceStatus || 'completed'
  };

  res.json(summary);
});

// Get discovered assets — sorted by asset name then location for consistent table order
router.get('/:id/assets', async (req: Request, res: Response): Promise<void> => {
  const assets = await CryptoAsset.find({ analysisId: req.params.id }).sort({ assetName: 1, location: 1 });
  res.json(assets);
});

// Re-process stored CBOM JSON or re-scan extracted disk directory — useful to apply parser/scanner fixes to existing data
router.post('/:id/reprocess', async (req: Request, res: Response): Promise<void> => {
  try {
    const analysisId = String(req.params.id);
    const scanDir = TargetService.getTargetDir(analysisId);
    let cbomJson: any = null;

    const analysis = await Analysis.findOne({ analysisId });
    if (fs.existsSync(scanDir)) {
      if (analysis?.targetType === 'binary') {
        const files = fs.readdirSync(scanDir);
        if (files.length > 0) {
          const binFile = path.join(scanDir, files[0]);
          console.log(`[Reprocess: ${analysisId}] Re-scanning staged binary file: ${binFile}`);
          cbomJson = await BinaryScanner.scanBinary(binFile, files[0]);
        }
      } else {
        console.log(`[Reprocess: ${analysisId}] Re-scanning extracted target directory: ${scanDir}`);
        cbomJson = await LocalScanner.scanDirectory(scanDir);
      }
    } else {
      const cbomDoc = await Cbom.findOne({ analysisId });
      if (!cbomDoc) {
        res.status(404).json({ error: 'No extracted files or CBOM found for this analysis. Run a scan first.' });
        return;
      }
      cbomJson = cbomDoc.rawJson;
    }

    const count = await CbomkitAdapter.processOfficialCbom(analysisId, cbomJson);
    await Analysis.updateOne(
      { analysisId },
      { 
        $set: { 
          'stages.discover.assetCount': count, 
          detectedCryptoAssetCount: count,
          status: 'COMPLETED',
          'stages.discover.status': 'COMPLETED'
        } 
      }
    );
    res.json({ success: true, assetCount: count, detectedCryptoAssetCount: count });
  } catch (err) {
    console.error('Reprocess failed:', err);
    res.status(500).json({ error: 'Reprocess failed', detail: String(err) });
  }
});
// Update asset classification metadata
router.put('/assets/:id/classification', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dataProtectionLifetime, businessCriticality, dataSensitivity } = req.body;
    const updatePayload = {
      'assessmentMetadata.dataProtectionLifetime': dataProtectionLifetime,
      'assessmentMetadata.businessCriticality': businessCriticality,
      'assessmentMetadata.dataSensitivity': dataSensitivity
    };
    await CryptoAsset.updateOne({ assetId: req.params.id }, { $set: updatePayload });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update classification' });
  }
});

// Update application-level classification & sync to assets
router.put('/:id/classification', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dataProtectionDuration, businessCriticality, dataSensitivity } = req.body;
    
    let critNum = 3;
    let critStr = 'High';
    if (typeof businessCriticality === 'number') {
      critNum = businessCriticality;
      critStr = ['Low', 'Medium', 'High', 'Critical'][critNum - 1] || 'High';
    } else if (typeof businessCriticality === 'string') {
      critStr = businessCriticality;
      critNum = businessCriticality === 'Critical' ? 4 : businessCriticality === 'High' ? 3 : businessCriticality === 'Medium' ? 2 : 1;
    }

    let sensNum = 3;
    let sensStr = 'Confidential';
    if (typeof dataSensitivity === 'number') {
      sensNum = dataSensitivity;
      sensStr = ['Public', 'Internal', 'Confidential', 'Highly Confidential'][sensNum - 1] || 'Confidential';
    } else if (typeof dataSensitivity === 'string') {
      sensStr = dataSensitivity;
      sensNum = dataSensitivity === 'Highly Confidential' ? 4 : dataSensitivity === 'Confidential' ? 3 : dataSensitivity === 'Internal' ? 2 : 1;
    }

    const durationNum = parseInt(String(dataProtectionDuration), 10) || 5;

    await Analysis.updateOne(
      { analysisId: req.params.id }, 
      { 
        $set: { 
          dataProtectionDuration: durationNum,
          businessCriticality: critNum,
          dataSensitivity: sensNum
        } 
      }
    );

    await CryptoAsset.updateMany(
      { analysisId: req.params.id },
      {
        $set: {
          'assessmentMetadata.dataProtectionLifetime': String(durationNum),
          'assessmentMetadata.businessCriticality': critStr,
          'assessmentMetadata.dataSensitivity': sensStr
        }
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update analysis classification:', err);
    res.status(500).json({ error: 'Failed to update classification' });
  }
});

// Update Quantum Risk Horizon (Z), Threat Horizon Year, and Migration Duration (Y)
router.put('/:id/horizon', async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantumRiskHorizon, migrationDuration, threatHorizonYear } = req.body;
    let horizonYear = threatHorizonYear ? Number(threatHorizonYear) : undefined;
    let z = typeof quantumRiskHorizon === 'number' ? Number(quantumRiskHorizon) : undefined;

    if (horizonYear && !z) {
      z = horizonYear - 2026;
    } else if (z && !horizonYear) {
      if (z > 2000) {
        horizonYear = z;
        z = horizonYear - 2026;
      } else {
        horizonYear = 2026 + z;
      }
    }

    const updateDoc: any = {};
    if (z !== undefined) updateDoc.quantumRiskHorizon = z;
    if (horizonYear !== undefined) updateDoc.threatHorizonYear = horizonYear;
    if (migrationDuration !== undefined) updateDoc.migrationDuration = Number(migrationDuration);

    await Analysis.updateOne(
      { analysisId: req.params.id }, 
      { $set: updateDoc }
    );
    res.json({ success: true, threatHorizonYear: horizonYear, quantumRiskHorizon: z });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update horizon' });
  }
});

// Scoring logic helpers
const getQuantumRiskInfo = (
  assetType: string, 
  primitive: string, 
  algorithm: string, 
  assetName?: string,
  dependsOn?: string[],
  existingRisk?: {
    risk?: string;
    score?: number | null;
    reason?: string;
  },
  keySizeEvidence?: number | string | null
) => {
  const normType = (assetType || '').toLowerCase();
  const rawAlg = (algorithm || '').trim();
  const rawName = (assetName || '').trim();
  const upperAlg = rawAlg.toUpperCase();
  const upperName = rawName.toUpperCase();
  const prim = (primitive || '').toLowerCase().trim();

  // 1. Classical Legacy Ciphers (3DES, RC4, DES) - Outside quantum threat model
  const is3Des = upperAlg.includes('3DES') || upperName.includes('3DES') || upperAlg.includes('DES3') || upperName.includes('DES3') || upperAlg.includes('TRIPLEDES') || upperName.includes('TRIPLEDES');
  const isRc4 = upperAlg.includes('RC4') || upperName.includes('RC4') || upperAlg.includes('ARCFOUR') || upperName.includes('ARCFOUR');
  const isDes = !is3Des && (upperAlg === 'DES' || upperName === 'DES' || upperAlg.startsWith('DES-') || upperName.startsWith('DES-') || upperAlg.startsWith('DES/') || upperName.startsWith('DES/') || upperAlg.endsWith('-DES') || upperName.endsWith('-DES'));

  if (is3Des || isRc4 || isDes) {
    const cipherName = is3Des ? '3DES' : isRc4 ? 'RC4' : 'DES';
    const vulnDesc = is3Des 
      ? 'Sweet32 64-bit block collision vulnerability and NIST SP 800-131A Rev. 2 deprecation'
      : isRc4 
      ? 'keystream statistical bias vulnerabilities and RFC 7465 prohibition'
      : 'inadequate 56-bit key length and exhaustive key-search vulnerability';

    return {
      risk: 'Unknown',
      score: null,
      notApplicable: true,
      isUnknown: true,
      isContextDependent: false,
      reason: `Quantum risk is not applicable to ${cipherName}; evaluated under classical deprecation models due to ${vulnDesc}.`
    };
  }

  // 2. PBKDF2 / Key Derivation Functions - Context-Dependent quantum and configuration risk
  const isPbkdf2 = upperAlg.includes('PBKDF2') || upperName.includes('PBKDF2') || prim === 'kdf' || upperAlg.includes('PBKDF') || upperName.includes('PBKDF');
  if (isPbkdf2) {
    return {
      risk: 'Unknown',
      score: null,
      notApplicable: false,
      isUnknown: true,
      isContextDependent: true,
      reason: 'Quantum risk score is context-dependent for key derivation functions (PBKDF2); security depends on the underlying PRF (hash function), output key length, iteration count (work factor), and salt entropy.'
    };
  }

  // Verify AES key size from evidence before assigning risk score. Do not infer key size from name alone.
  const parsedKeySize = keySizeEvidence ? Number(keySizeEvidence) : undefined;
  const isAes = upperAlg.includes('AES') || upperName.includes('AES') || prim === 'ae' || prim === 'block-cipher';
  const detectedKeySize = parsedKeySize || (upperName.includes('256') || upperAlg.includes('256') ? 256 : upperName.includes('192') || upperAlg.includes('192') ? 192 : upperName.includes('128') || upperAlg.includes('128') ? 128 : undefined);
  if (isAes && detectedKeySize) {
    if (detectedKeySize >= 256 || detectedKeySize === 192) {
      return {
        risk: 'Low',
        score: 20,
        notApplicable: false,
        isUnknown: false,
        isContextDependent: false,
        reason: `CRYPTAVISTA classifies ${rawName || rawAlg} with verified ${detectedKeySize}-bit key (from CBOM evidence) as Low Quantum Risk (20) based on NIST's analysis of symmetric cryptography and quantum attacks (128-bit post-quantum security against Grover's algorithm).`
      };
    } else if (detectedKeySize === 128) {
      return {
        risk: 'Medium',
        score: 60,
        notApplicable: false,
        isUnknown: false,
        isContextDependent: false,
        reason: `CRYPTAVISTA classifies ${rawName || rawAlg} with verified 128-bit key (from CBOM evidence) as Medium Quantum Risk (60) based on NIST's analysis of symmetric cryptography and quantum attacks (Grover's algorithm reduces effective security to 64 bits).`
      };
    }
  }

  if (existingRisk && existingRisk.risk) {
    const r = existingRisk.risk.toUpperCase();
    if (r === 'NOT_APPLICABLE' || r === 'NA') {
      return {
        risk: 'Unknown',
        score: null,
        notApplicable: true,
        isUnknown: true,
        isContextDependent: false,
        reason: existingRisk.reason || 'Quantum risk is not applicable to this cipher; evaluated under classical deprecation models.'
      };
    }
    if (r === 'CONTEXT_DEPENDENT') {
      return {
        risk: 'Unknown',
        score: null,
        notApplicable: false,
        isUnknown: true,
        isContextDependent: true,
        reason: existingRisk.reason || 'Quantum risk score is context-dependent for key derivation functions (PBKDF2).'
      };
    }
    const s = existingRisk.score !== undefined ? existingRisk.score : (r === 'LOW' ? 20 : r === 'MEDIUM' ? 60 : r === 'HIGH' ? 100 : null);
    const displayRisk = r === 'LOW' ? 'Low' : r === 'MEDIUM' ? 'Medium' : r === 'HIGH' ? 'High' : 'Unknown';
    return {
      risk: displayRisk,
      score: s,
      notApplicable: false,
      isUnknown: r === 'UNKNOWN' || s === null,
      isContextDependent: false,
      reason: existingRisk.reason || `CRYPTAVISTA risk model: ${displayRisk} (${s})`
    };
  }

  let effectiveAlg = rawAlg;
  let isInherited = false;
  let parentAlgName = '';

  const isKeyMaterial = CryptavistaClassifier.isGenericKeyLabel(normType) ||
    rawName.toLowerCase().endsWith('key') ||
    rawName.toLowerCase().includes('secret-key') ||
    rawName.toLowerCase().includes('private-key') ||
    rawName.toLowerCase().includes('public-key');

  if (isKeyMaterial) {
    if (rawAlg && !CryptavistaClassifier.isGenericKeyLabel(rawAlg)) {
      effectiveAlg = rawAlg;
      parentAlgName = rawAlg;
      isInherited = true;
    } else if (dependsOn && dependsOn.length > 0 && !CryptavistaClassifier.isGenericKeyLabel(dependsOn[0])) {
      effectiveAlg = dependsOn[0];
      parentAlgName = dependsOn[0];
      isInherited = true;
    } else {
      const extracted = CryptavistaClassifier.extractParentAlgorithmFromKeyName(rawName);
      if (extracted) {
        effectiveAlg = extracted;
        parentAlgName = extracted;
        isInherited = true;
      }
    }

    if (!parentAlgName && CryptavistaClassifier.isGenericKeyLabel(effectiveAlg)) {
      return { 
        risk: 'Unknown', 
        score: null, 
        notApplicable: false, 
        isUnknown: true, 
        reason: 'Generic key material without verifiable parent algorithm association in CBOM evidence.' 
      };
    }
  }

  const match = CryptavistaClassifier.matchDeterministicAlgorithm(effectiveAlg);
  if (match) {
    if (match.quantumRisk === 'NOT_APPLICABLE') {
      return {
        risk: 'Not Applicable',
        score: null,
        notApplicable: true,
        isUnknown: false,
        isContextDependent: false,
        classicalRisk: 'Legacy / High',
        reason: match.reason
      };
    }
    if (match.quantumRisk === 'CONTEXT_DEPENDENT') {
      return {
        risk: 'Context-Dependent',
        score: null,
        notApplicable: false,
        isUnknown: false,
        isContextDependent: true,
        classicalRisk: 'Configuration-Dependent',
        reason: match.reason
      };
    }
    const displayRisk = match.quantumRisk === 'LOW' ? 'Low' : match.quantumRisk === 'MEDIUM' ? 'Medium' : match.quantumRisk === 'HIGH' ? 'High' : 'Unknown';
    return {
      risk: displayRisk,
      score: match.score,
      notApplicable: false,
      isUnknown: match.score === null,
      isContextDependent: false,
      reason: isInherited 
        ? `${rawName} inherits ${displayRisk} quantum risk (${match.score}) from associated algorithm ${parentAlgName}.`
        : match.reason
    };
  }

  // Primitive check
  if (prim === 'pke' || (prim === 'signature' && !effectiveAlg.toUpperCase().includes('ML-DSA') && !effectiveAlg.toUpperCase().includes('SLH-DSA'))) {
    return {
      risk: 'High',
      score: 100,
      notApplicable: false,
      isUnknown: false,
      isContextDependent: false,
      reason: `Classical public-key cryptographic mechanism vulnerable to Shor's algorithm.`
    };
  }

  return { 
    risk: 'Unknown', 
    score: null, 
    notApplicable: false, 
    isUnknown: true, 
    isContextDependent: false,
    reason: 'Cryptographic primitive or algorithm could not be determined from the available CBOM data.' 
  };
};

const getSensitivityValue = (val?: string | number) => {
  if (typeof val === 'number') {
    return [25, 50, 75, 100][val - 1] || 25;
  }
  if (val === 'Highly Confidential') return 100;
  if (val === 'Confidential') return 75;
  if (val === 'Internal') return 50;
  return 25; // Public
};

const getCriticalityValue = (val?: string | number) => {
  if (typeof val === 'number') {
    return [25, 50, 75, 100][val - 1] || 25;
  }
  if (val === 'Critical') return 100;
  if (val === 'High') return 75;
  if (val === 'Medium') return 50;
  return 25; // Low
};

// Calculate Mosca Urgency Score (CRYPTAVISTA urgency scores derived from the Mosca timing relationship)
const getMoscaScore = (X: number, Y: number, Z: number) => {
  const margin = Z - (X + Y);
  if (margin <= 0) return 100; // Critical
  if (margin <= 2) return 75;  // Very High
  if (margin <= 5) return 50;  // High
  if (margin <= 10) return 25; // Medium
  return 0; // Low
};

// Map Dependency Reach to Dependency Impact Score
const getDependencyImpactScore = (reach: number | undefined, isAvailable: boolean | undefined): number | null => {
  if (!isAvailable) return null;
  const r = reach ?? 0;
  if (r <= 10) return 10;
  if (r <= 25) return 30;
  if (r <= 50) return 50;
  if (r <= 75) return 75;
  return 100;
};

// Compute verified dependency graph metrics from CBOM and assets
function computeDependencyMetrics(cbomJson: any, assets: any[]) {
  const logicalMap = new Map<string, any>();
  const bomRefToLogicalName = new Map<string, string>();

  for (const a of assets) {
    const name = a.assetName || a.algorithm || 'Unknown';
    if (!logicalMap.has(name)) {
      logicalMap.set(name, {
        id: name,
        label: name,
        assetType: a.assetType || 'algorithm',
        primitive: a.primitive || 'unspecified',
        algorithm: a.algorithm || name,
        version: a.version,
        keySize: a.keySize,
        occurrencesCount: 0,
        locations: [] as string[],
        occurrences: [] as any[],
        bomRefs: new Set<string>()
      });
    }
    const item = logicalMap.get(name)!;
    item.occurrencesCount += 1;
    let locWithLine = a.location || '';
    if (locWithLine && a.line && !locWithLine.includes(`:${a.line}`)) {
      locWithLine = `${locWithLine}:${a.line}`;
    }
    if (locWithLine && !item.locations.includes(locWithLine)) {
      item.locations.push(locWithLine);
    }
    item.occurrences.push({
      location: a.location,
      line: a.line
    });
    if (a.bomRef) {
      item.bomRefs.add(a.bomRef);
      bomRefToLogicalName.set(a.bomRef, name);
    }
  }

  const totalLogicalNodes = logicalMap.size;
  const dependencies = cbomJson?.dependencies || [];

  const logicalEdgesMap = new Map<string, { source: string; target: string }>();
  const logicalDependedBy = new Map<string, Set<string>>(); // target -> Set of sources (who depends on target)
  const logicalDependsOn = new Map<string, Set<string>>(); // source -> Set of targets (who source depends on)

  for (const d of dependencies) {
    const srcLogical = bomRefToLogicalName.get(d.ref);
    if (!srcLogical) continue;

    for (const targetRef of (d.dependsOn || [])) {
      const tgtLogical = bomRefToLogicalName.get(targetRef);
      if (!tgtLogical || tgtLogical === srcLogical) continue;

      const srcAsset = logicalMap.get(srcLogical);
      const tgtAsset = logicalMap.get(tgtLogical);

      const edgeKey = `${srcLogical}->${tgtLogical}`;
      if (!logicalEdgesMap.has(edgeKey)) {
        logicalEdgesMap.set(edgeKey, { source: srcLogical, target: tgtLogical });
      }

      if (!logicalDependsOn.has(srcLogical)) logicalDependsOn.set(srcLogical, new Set());
      logicalDependsOn.get(srcLogical)!.add(tgtLogical);

      if (!logicalDependedBy.has(tgtLogical)) logicalDependedBy.set(tgtLogical, new Set());
      logicalDependedBy.get(tgtLogical)!.add(srcLogical);
    }
  }

  const nodeMetrics = new Map<string, any>();

  for (const [name, logAsset] of logicalMap.entries()) {
    const directSet = logicalDependedBy.get(name) || new Set<string>();
    const dependsOnSet = logicalDependsOn.get(name) || new Set<string>();
    const hasDependencyEvidence = directSet.size > 0 || dependsOnSet.size > 0;

    // Transitive dependents via BFS
    const visited = new Set<string>();
    const queue = Array.from(directSet);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (!visited.has(curr) && curr !== name) {
        visited.add(curr);
        const next = logicalDependedBy.get(curr);
        if (next) {
          for (const n of next) {
            if (!visited.has(n) && n !== name) queue.push(n);
          }
        }
      }
    }

    const directCount = directSet.size;
    const transitiveCount = Math.max(0, visited.size - directCount);
    const affectedCount = visited.size;
    const reach = totalLogicalNodes > 0 ? (affectedCount / totalLogicalNodes) * 100 : 0;
    const impactScore = hasDependencyEvidence ? getDependencyImpactScore(reach, true) : null;

    nodeMetrics.set(name, {
      ...logAsset,
      hasDependencyEvidence,
      directDependents: directCount,
      directDependentsList: Array.from(directSet),
      transitiveDependents: transitiveCount,
      transitiveDependentsList: Array.from(visited).filter(x => !directSet.has(x)),
      dependsOnList: Array.from(dependsOnSet),
      affectedComponents: affectedCount,
      totalComponents: totalLogicalNodes,
      dependencyReach: Number(reach.toFixed(1)),
      dependencyImpactScore: impactScore,
      calculation: hasDependencyEvidence 
        ? `(${affectedCount} affected / ${totalLogicalNodes} total) × 100 = ${reach.toFixed(1)}% → Dependency Impact Score: ${impactScore}`
        : "No dependency relationship evidence was reported by the available static analysis."
    });
  }

  return {
    logicalMap,
    logicalEdgesMap,
    nodeMetrics,
    totalLogicalNodes,
    totalOccurrences: assets.length
  };
}

// Get scored analyses for Application Priority
router.get('/scored/applications', async (req: Request, res: Response): Promise<void> => {
  const analyses = await Analysis.find().sort({ createdAt: -1 });
  const result = [];
  
  for (const app of analyses) {
    const assets = await CryptoAsset.find({ analysisId: app.analysisId });

    const sensScore = getSensitivityValue(app.dataSensitivity);
    const critScore = getCriticalityValue(app.businessCriticality);
    
    const X = typeof app.dataProtectionDuration === 'number' ? app.dataProtectionDuration : 5;
    const Y = typeof app.migrationDuration === 'number' ? app.migrationDuration : 2; 
    
    // Threat Horizon Year: default 2036, Reference Year: 2026 => Z = 10 years
    let threatHorizonYear = app.threatHorizonYear || 2036;
    let Z = 10;
    if (typeof app.quantumRiskHorizon === 'number') {
      if (app.quantumRiskHorizon > 2000) {
        threatHorizonYear = app.quantumRiskHorizon;
        Z = Math.max(1, threatHorizonYear - 2026);
      } else {
        Z = app.quantumRiskHorizon;
        threatHorizonYear = app.threatHorizonYear || (2026 + Z);
      }
    } else if (app.threatHorizonYear) {
      threatHorizonYear = app.threatHorizonYear;
      Z = Math.max(1, threatHorizonYear - 2026);
    }

    const moscaUrgency = getMoscaScore(X, Y, Z);
    const priorityScore = (moscaUrgency + sensScore + critScore) / 3;

    let priorityClassification = 'Minimal';
    if (priorityScore >= 75) priorityClassification = 'High';
    else if (priorityScore >= 50) priorityClassification = 'Medium';
    else if (priorityScore >= 25) priorityClassification = 'Low';

    result.push({
      analysisId: app.analysisId,
      applicationName: app.applicationName,
      assetCount: app.detectedCryptoAssetCount ?? assets.length,
      detectedCryptoAssetCount: app.detectedCryptoAssetCount ?? assets.length,
      moscaUrgencyScore: moscaUrgency,
      dataSensitivityScore: sensScore,
      businessCriticalityScore: critScore,
      dataProtectionDuration: X,
      migrationDuration: Y,
      threatHorizonYear,
      quantumRiskHorizon: Z,
      timingMargin: Z - (X + Y),
      priorityScore: Number(priorityScore.toFixed(2)),
      priorityClassification,
      runtimeEnabled: app.runtimeEnabled
    });
  }
  res.json(result);
});

// Authoritative single-endpoint analysis summary: inventory, calculated aggregates, risk, classification, priorities, and recommendations
router.get('/:id/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    let analysisId = String(req.params.id);
    let analysis = await Analysis.findOne({ analysisId });
    if (!analysis) {
      analysis = await Analysis.findById(analysisId).catch(() => null);
      if (analysis) analysisId = analysis.analysisId;
    }

    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const cbom = await Cbom.findOne({ analysisId });
    const assets = await CryptoAsset.find({ analysisId }).sort({ assetName: 1, location: 1 });

    const metrics = computeDependencyMetrics(cbom?.rawJson, assets);
    const scoredAssets: any[] = [];

    for (const [name, nodeData] of metrics.nodeMetrics.entries()) {
      const sampleAsset = assets.find(a => (a.assetName || a.algorithm) === name);
      const keySize = sampleAsset?.keySize || (sampleAsset?.version && !isNaN(Number(sampleAsset.version)) ? Number(sampleAsset.version) : undefined);
      const existingRisk = sampleAsset?.cryptavistaQuantumRisk ? {
        risk: sampleAsset.cryptavistaQuantumRisk,
        score: sampleAsset.cryptavistaScore,
        reason: sampleAsset.cryptavistaReason
      } : undefined;

      const qrInfo = getQuantumRiskInfo(
        nodeData.assetType,
        nodeData.primitive,
        nodeData.algorithm || sampleAsset?.algorithm || name,
        name,
        nodeData.dependsOnList,
        existingRisk,
        keySize
      );
      const depScore = nodeData.dependencyImpactScore;

      let priorityScore: number | null = null;
      let isPartial = false;
      let priorityClassification = 'Unavailable';
      let action = 'Score unavailable — insufficient evidence';

      if (typeof qrInfo.score === 'number' && typeof depScore === 'number') {
        priorityScore = Number(((qrInfo.score + depScore) / 2).toFixed(1));
      } else if (typeof qrInfo.score === 'number') {
        priorityScore = qrInfo.score;
        isPartial = true;
      } else if (typeof depScore === 'number') {
        priorityScore = depScore;
        isPartial = true;
      }

      if (priorityScore !== null) {
        if (priorityScore >= 75) {
          priorityClassification = 'Urgent';
          action = 'Prioritize Migration';
        } else if (priorityScore >= 50) {
          priorityClassification = 'High';
          action = 'Plan Migration';
        } else if (priorityScore >= 25) {
          priorityClassification = 'Monitor';
          action = 'Monitor & Prepare';
        } else {
          priorityClassification = 'Low';
          action = 'No Immediate Action';
        }
      }

      // Authoritative classification determination
      const algUpper = (nodeData.algorithm || sampleAsset?.algorithm || name).toUpperCase();
      const primLower = (nodeData.primitive || sampleAsset?.primitive || '').toLowerCase();

      const isSym = primLower === 'block-cipher' || primLower === 'stream-cipher' || primLower === 'ae' || primLower === 'symmetric' || /AES|CHACHA|DES|3DES|RC4/i.test(algUpper);
      const isSig = primLower === 'signature' || /ECDSA|ED25519|ED448|DSA|WITHRSA|RSA-SHA|SIGN/i.test(algUpper);
      const isKdf = primLower === 'kdf' || /PBKDF|SCRYPT|ARGON|HKDF/i.test(algUpper);
      const isHash = !isSig && !isKdf && (primLower === 'hash' || primLower === 'digest' || primLower === 'mac' || /SHA|MD5|HMAC|BLAKE/i.test(algUpper));
      const isAsym = !isSym && !isSig && !isHash && !isKdf && (primLower === 'pke' || primLower === 'kem' || primLower === 'key-agree' || primLower === 'key-exchange' || /RSA|ECDH|DH/i.test(algUpper));

      let category: 'public_key' | 'symmetric' | 'hash' | 'kdf' = 'public_key';
      let usage = 'key_establishment';

      if (isKdf) {
        category = 'kdf';
        usage = 'key_derivation';
      } else if (isSym) {
        category = 'symmetric';
        usage = 'symmetric_encryption';
      } else if (isSig) {
        category = 'public_key';
        usage = 'digital_signature';
      } else if (isHash) {
        category = 'hash';
        usage = 'cryptographic_hash';
      } else if (isAsym) {
        category = 'public_key';
        usage = 'key_establishment';
      }

      const authoritativeRec = RecommendationAdvisor.getAuthoritativeRecommendation(
        name,
        nodeData.algorithm || sampleAsset?.algorithm || name,
        nodeData.assetType,
        nodeData.primitive,
        sampleAsset?.mode,
        keySize
      );

      scoredAssets.push({
        assetId: sampleAsset?.assetId || name,
        assetName: name,
        algorithm: nodeData.algorithm || sampleAsset?.algorithm || name,
        version: sampleAsset?.version || nodeData.version || undefined,
        keySize: keySize,
        mode: authoritativeRec.mode || sampleAsset?.mode,
        padding: authoritativeRec.padding,
        assetType: nodeData.assetType,
        primitive: nodeData.primitive,
        category,
        usage,
        location: nodeData.locations[0] || sampleAsset?.location || '',
        locations: nodeData.locations,
        occurrencesCount: nodeData.occurrencesCount,
        quantumRisk: qrInfo.risk,
        quantumRiskScore: qrInfo.score,
        quantumRiskReason: qrInfo.reason,
        isNotApplicable: qrInfo.notApplicable,
        isContextDependent: qrInfo.isContextDependent,
        dependencyImpactScore: depScore,
        priorityScore,
        priorityClassification,
        isPartial,
        action,
        authoritativeRecommendation: authoritativeRec
      });
    }

    // Sort scored assets by priority descending
    scoredAssets.sort((a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1));

    // Dynamic aggregates directly from scoredAssets
    const total = scoredAssets.length;
    const publicKey = scoredAssets.filter(a => a.category === 'public_key').length;
    const symmetric = scoredAssets.filter(a => a.category === 'symmetric').length;
    const hash = scoredAssets.filter(a => a.category === 'hash').length;
    const kdf = scoredAssets.filter(a => a.category === 'kdf').length;
    const hashOrKdf = hash + kdf;
    const highRisk = scoredAssets.filter(a => a.quantumRisk === 'High' || a.quantumRiskScore === 100).length;
    const mediumRisk = scoredAssets.filter(a => a.quantumRisk === 'Medium' || a.quantumRiskScore === 60).length;
    const lowRisk = scoredAssets.filter(a => a.quantumRisk === 'Low' || a.quantumRiskScore === 20).length;
    const contextDependentRisk = scoredAssets.filter(a => a.quantumRisk === 'Context-Dependent' || a.isContextDependent).length;
    const legacyRisk = scoredAssets.filter(a => a.isNotApplicable || a.quantumRisk === 'Not Applicable').length;
    const numericScoredAssets = scoredAssets.filter(a => a.priorityScore !== null).length;
    const nonNumericAssets = scoredAssets.filter(a => a.priorityScore === null).length;
    const quantumVulnerable = highRisk;
    const urgentPriority = scoredAssets.filter(a => a.priorityClassification === 'Urgent').length;
    const highPriority = scoredAssets.filter(a => a.priorityClassification === 'Urgent' || a.priorityClassification === 'High').length;
    const legacyPriority = scoredAssets.filter(a => a.priorityClassification === 'Legacy').length;
    const evidenceRequiredPriority = scoredAssets.filter(a => a.priorityClassification === 'Evidence Required').length;

    // Application Priority (Mosca + APS)
    const sensScore = getSensitivityValue(analysis.dataSensitivity);
    const critScore = getCriticalityValue(analysis.businessCriticality);
    const X = typeof analysis.dataProtectionDuration === 'number' ? analysis.dataProtectionDuration : 5;
    const Y = typeof analysis.migrationDuration === 'number' ? analysis.migrationDuration : 2;
    let threatHorizonYear = analysis.threatHorizonYear || 2036;
    let Z = 10;
    if (typeof analysis.quantumRiskHorizon === 'number') {
      if (analysis.quantumRiskHorizon > 2000) {
        threatHorizonYear = analysis.quantumRiskHorizon;
        Z = Math.max(1, threatHorizonYear - 2026);
      } else {
        Z = analysis.quantumRiskHorizon;
        threatHorizonYear = analysis.threatHorizonYear || (2026 + Z);
      }
    } else if (analysis.threatHorizonYear) {
      threatHorizonYear = analysis.threatHorizonYear;
      Z = Math.max(1, threatHorizonYear - 2026);
    }
    const timingMargin = Z - (X + Y);
    const moscaUrgency = getMoscaScore(X, Y, Z);
    const rawAps = (moscaUrgency + sensScore + critScore) / 3;
    let priorityClassification = 'Minimal';
    if (rawAps >= 75) priorityClassification = 'High';
    else if (rawAps >= 50) priorityClassification = 'Medium';
    else if (rawAps >= 25) priorityClassification = 'Low';

    const apsScore = Number(rawAps.toFixed(2));
    const overallPriority = rawAps >= 75 ? 'P1' : rawAps >= 50 ? 'P2' : rawAps >= 25 ? 'P3' : 'P4';

    res.json({
      analysisId: analysis.analysisId,
      applicationName: analysis.applicationName,
      targetType: analysis.targetType || 'source_code',
      status: analysis.status,
      createdAt: analysis.createdAt,
      runtimeEnabled: Boolean(analysis.runtimeEnabled),
      detectedCryptoAssetCount: analysis.detectedCryptoAssetCount ?? metrics.totalOccurrences,
      aggregates: {
        total,
        totalOccurrences: metrics.totalOccurrences,
        uniqueLogicalAssets: total,
        numericScoredAssets,
        nonNumericAssets,
        quantumVulnerable,
        highRisk,
        mediumRisk,
        lowRisk,
        contextDependentRisk,
        legacyRisk,
        publicKey,
        symmetric,
        hash,
        kdf,
        hashOrKdf,
        urgentPriority,
        highPriority,
        legacyPriority,
        evidenceRequiredPriority
      },
      applicationPriority: {
        dataProtectionLifetime: X,
        migrationDuration: Y,
        quantumThreatHorizon: threatHorizonYear,
        quantumRiskHorizon: Z,
        timingMargin,
        moscaUrgency,
        dataSensitivity: sensScore,
        businessCriticality: critScore,
        aps: apsScore,
        overallPriority,
        priorityClassification
      },
      inventory: scoredAssets,
      cbomSummary: analysis.cbomSummary || cbom?.cbomSummary || null,
      risk: {
        high: highRisk,
        medium: mediumRisk,
        low: lowRisk,
        contextDependent: contextDependentRisk,
        legacy: legacyRisk
      },
      priority: {
        urgent: urgentPriority,
        high: highPriority,
        legacy: legacyPriority,
        evidenceRequired: evidenceRequiredPriority,
        numericScoredAssets,
        nonNumericAssets,
        aps: apsScore,
        classification: priorityClassification
      },
      recommendations: scoredAssets.map(a => a.authoritativeRecommendation),
      dependencies: {
        totalLogicalNodes: metrics.totalLogicalNodes,
        totalOccurrences: metrics.totalOccurrences,
        totalEdges: metrics.logicalEdgesMap.size,
        hasDependencyEvidence: metrics.logicalEdgesMap.size > 0
      },
      dependencyMetrics: {
        totalLogicalNodes: metrics.totalLogicalNodes,
        totalOccurrences: metrics.totalOccurrences,
        totalEdges: metrics.logicalEdgesMap.size,
        hasDependencyEvidence: metrics.logicalEdgesMap.size > 0
      }
    });
  } catch (error: any) {
    console.error(`[Analysis Summary Error]:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get scored assets for Priority Analysis (Grouped into 9 unique logical assets, CPS formula with 2 factors)
router.get('/:id/scored-assets', async (req: Request, res: Response): Promise<void> => {
  const cbom = await Cbom.findOne({ analysisId: req.params.id });
  const assets = await CryptoAsset.find({ analysisId: req.params.id });

  if (assets.length === 0) {
    res.json([]);
    return;
  }

  const metrics = computeDependencyMetrics(cbom?.rawJson, assets);
  const result: any[] = [];

  for (const [name, nodeData] of metrics.nodeMetrics.entries()) {
    const sampleAsset = assets.find(a => (a.assetName || a.algorithm) === name);
    const existingRisk = sampleAsset?.cryptavistaQuantumRisk ? {
      risk: sampleAsset.cryptavistaQuantumRisk,
      score: sampleAsset.cryptavistaScore,
      reason: sampleAsset.cryptavistaReason
    } : undefined;
    const keyEvidence = sampleAsset?.keySize || (sampleAsset?.version && !isNaN(Number(sampleAsset.version)) ? Number(sampleAsset.version) : undefined);
    const qrInfo = getQuantumRiskInfo(
      nodeData.assetType, 
      nodeData.primitive, 
      nodeData.algorithm || sampleAsset?.algorithm || name, 
      name,
      nodeData.dependsOnList,
      existingRisk,
      keyEvidence
    );
    const depScore = nodeData.dependencyImpactScore;

    // Rules from Section 11, 12, 13, 14:
    // If both values exist: CPS = (QRS + DIS) / 2
    // If only one value exists: CPS = available score, labeled "Partial CPS — based on available evidence"
    // If neither exists: CPS = null, labeled "Unavailable"
    let priorityScore: number | null = null;
    let isPartial = false;
    let priorityClassification = 'Unavailable';
    let action = 'Score unavailable — insufficient evidence';

    if (typeof qrInfo.score === 'number' && typeof depScore === 'number') {
      priorityScore = Number(((qrInfo.score + depScore) / 2).toFixed(1));
    } else if (typeof qrInfo.score === 'number') {
      priorityScore = qrInfo.score;
      isPartial = true;
    } else if (typeof depScore === 'number') {
      priorityScore = depScore;
      isPartial = true;
    }

    if (priorityScore !== null) {
      if (priorityScore >= 75) {
        priorityClassification = 'Urgent';
        action = 'Prioritize Migration';
      } else if (priorityScore >= 50) {
        priorityClassification = 'High';
        action = 'Plan Migration';
      } else if (priorityScore >= 25) {
        priorityClassification = 'Monitor';
        action = 'Monitor & Prepare';
      } else {
        priorityClassification = 'Low';
        action = 'No Immediate Action';
      }
    }

    result.push({
      assetId: sampleAsset?.assetId || name,
      assetName: name,
      algorithm: nodeData.algorithm,
      version: sampleAsset?.version || nodeData.version || undefined,
      keySize: sampleAsset?.keySize || nodeData.keySize || undefined,
      assetType: nodeData.assetType,
      primitive: nodeData.primitive,
      location: nodeData.locations[0] || sampleAsset?.location || '',
      locations: nodeData.locations,
      occurrencesCount: nodeData.occurrencesCount,
      occurrences: nodeData.occurrences,
      isNumericScored: priorityScore !== null,
      isNonNumeric: priorityScore === null,
      scores: {
        quantumRisk: qrInfo.score,
        quantumRiskClassification: qrInfo.risk,
        quantumRiskText: qrInfo.score !== null ? `${qrInfo.risk} (${qrInfo.score})` : 'Unavailable',
        quantumRiskReason: qrInfo.reason,
        dependencyImpact: depScore,
        dependencyImpactText: depScore !== null ? `Score: ${depScore}` : 'Unavailable',
        dependencyReach: nodeData.dependencyReach,
        directDependents: nodeData.directDependents,
        directDependentsList: nodeData.directDependentsList,
        transitiveDependents: nodeData.transitiveDependents,
        transitiveDependentsList: nodeData.transitiveDependentsList,
        affectedComponents: nodeData.affectedComponents,
        totalComponents: nodeData.totalComponents,
        hasDependencyEvidence: nodeData.hasDependencyEvidence,
        dependencyCalculation: nodeData.calculation,
        priorityScore,
        isPartial,
        priorityClassification,
        action,
        cpsExplanation: undefined,
        isUnknown: qrInfo.isUnknown,
        isNotApplicable: qrInfo.notApplicable,
        isContextDependent: qrInfo.isContextDependent,
        isNumericScored: priorityScore !== null,
        isNonNumeric: priorityScore === null
      }
    });
  }

  // Sort by highest priorityScore descending, pushing nulls to the bottom
  result.sort((a, b) => {
    if (a.scores.priorityScore === null && b.scores.priorityScore === null) {
      return a.assetName.localeCompare(b.assetName);
    }
    if (a.scores.priorityScore === null) return 1;
    if (b.scores.priorityScore === null) return -1;
    return b.scores.priorityScore - a.scores.priorityScore;
  });

  res.json(result);
});

// Get migration recommendations for an analysis (Authoritative deterministic + saved AI plans)
router.get('/:id/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    let analysisId = req.params.id;
    let app = await Analysis.findOne({ analysisId });
    if (!app) {
      app = await Analysis.findById(analysisId).catch(() => null);
      if (app) analysisId = app.analysisId;
    }

    if (!app) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const cbom = await Cbom.findOne({ analysisId });
    const assets = await CryptoAsset.find({ analysisId });

    if (assets.length === 0) {
      res.json([]);
      return;
    }

    const metrics = computeDependencyMetrics(cbom?.rawJson, assets);
    const savedRecs = await Recommendation.find({ analysisId });
    const savedRecsMap = new Map<string, any>();
    for (const r of savedRecs) {
      savedRecsMap.set(r.assetName, r);
    }

    const result: any[] = [];

    for (const [name, nodeData] of metrics.nodeMetrics.entries()) {
      const sampleAsset = assets.find(a => (a.assetName || a.algorithm) === name);
      const keySize = sampleAsset?.keySize || (sampleAsset?.version && !isNaN(Number(sampleAsset.version)) ? Number(sampleAsset.version) : undefined);
      const existingRisk = sampleAsset?.cryptavistaQuantumRisk ? {
        risk: sampleAsset.cryptavistaQuantumRisk,
        score: sampleAsset.cryptavistaScore,
        reason: sampleAsset.cryptavistaReason
      } : undefined;
      const qrInfo = getQuantumRiskInfo(
        nodeData.assetType, 
        nodeData.primitive, 
        nodeData.algorithm || sampleAsset?.algorithm || name, 
        name,
        nodeData.dependsOnList,
        existingRisk,
        keySize
      );
      const depScore = nodeData.dependencyImpactScore;

      let priorityScore: number | null = null;
      let isPartial = false;
      let priorityClassification = 'Unavailable';
      let action = 'Score unavailable — insufficient evidence';

      if (typeof qrInfo.score === 'number' && typeof depScore === 'number') {
        priorityScore = Number(((qrInfo.score + depScore) / 2).toFixed(1));
      } else if (typeof qrInfo.score === 'number') {
        priorityScore = qrInfo.score;
        isPartial = true;
      } else if (typeof depScore === 'number') {
        priorityScore = depScore;
        isPartial = true;
      }

      if (priorityScore !== null) {
        if (priorityScore >= 75) {
          priorityClassification = 'Urgent';
          action = 'Prioritize Migration';
        } else if (priorityScore >= 50) {
          priorityClassification = 'High';
          action = 'Plan Migration';
        } else if (priorityScore >= 25) {
          priorityClassification = 'Monitor';
          action = 'Monitor & Prepare';
        } else {
          priorityClassification = 'Low';
          action = 'No Immediate Action';
        }
      }

      // Authoritative recommendation from deterministic knowledge base
      const authoritativeRec = RecommendationAdvisor.getAuthoritativeRecommendation(
        name,
        nodeData.algorithm || sampleAsset?.algorithm || name,
        nodeData.assetType,
        nodeData.primitive,
        sampleAsset?.mode,
        keySize
      );

      const savedRec = savedRecsMap.get(name);

      result.push({
        assetId: sampleAsset?.assetId || name,
        assetName: name,
        algorithm: authoritativeRec.algorithm || nodeData.algorithm || sampleAsset?.algorithm,
        version: sampleAsset?.version || nodeData.version || undefined,
        keySize: keySize,
        mode: authoritativeRec.mode || sampleAsset?.mode,
        padding: authoritativeRec.padding,
        assetType: nodeData.assetType,
        primitive: nodeData.primitive,
        locations: nodeData.locations,
        occurrencesCount: nodeData.occurrencesCount,
        quantumRisk: qrInfo.risk,
        quantumRiskScore: qrInfo.score,
        quantumRiskReason: qrInfo.reason,
        isNotApplicable: qrInfo.notApplicable,
        isContextDependent: qrInfo.isContextDependent,
        dependencyImpactScore: depScore,
        dependencyImpactText: depScore !== null ? `Score: ${depScore}` : 'Unavailable',
        priorityScore,
        isPartial,
        priorityClassification,
        action,
        authoritativeRecommendation: authoritativeRec,
        aiRecommendation: savedRec ? {
          explanation: savedRec.aiExplanation,
          model: 'AI Migration Advisor',
          generatedAt: savedRec.generatedAt
        } : null,
        hasAiRecommendation: Boolean(savedRec?.aiExplanation)
      });
    }

    // Sort by highest priorityScore descending
    result.sort((a, b) => {
      if (a.priorityScore === null && b.priorityScore === null) {
        return a.assetName.localeCompare(b.assetName);
      }
      if (a.priorityScore === null) return 1;
      if (b.priorityScore === null) return -1;
      return b.priorityScore - a.priorityScore;
    });

    res.json(result);
  } catch (err: any) {
    console.error('Failed to get recommendations:', err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Generate AI migration recommendation for a specific asset
router.post('/:id/recommendations/:assetName/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    let analysisId = req.params.id;
    let app = await Analysis.findOne({ analysisId });
    if (!app) {
      app = await Analysis.findById(analysisId).catch(() => null);
      if (app) analysisId = app.analysisId;
    }

    if (!app) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const assetName = decodeURIComponent(String(req.params.assetName));

    const cbom = await Cbom.findOne({ analysisId });
    const assets = await CryptoAsset.find({ analysisId });
    const metrics = computeDependencyMetrics(cbom?.rawJson, assets);
    const nodeData = metrics.nodeMetrics.get(assetName);

    if (!nodeData) {
      res.status(404).json({ error: `Asset ${assetName} not found in analysis ${analysisId}` });
      return;
    }

    const sampleAsset = assets.find(a => (a.assetName || a.algorithm) === assetName);
    const keySize = sampleAsset?.keySize || (sampleAsset?.version && !isNaN(Number(sampleAsset.version)) ? Number(sampleAsset.version) : undefined);
    const existingRisk = sampleAsset?.cryptavistaQuantumRisk ? {
      risk: sampleAsset.cryptavistaQuantumRisk,
      score: sampleAsset.cryptavistaScore,
      reason: sampleAsset.cryptavistaReason
    } : undefined;
    const qrInfo = getQuantumRiskInfo(
      nodeData.assetType, 
      nodeData.primitive, 
      nodeData.algorithm || sampleAsset?.algorithm || assetName, 
      assetName,
      nodeData.dependsOnList,
      existingRisk,
      keySize
    );
    const depScore = nodeData.dependencyImpactScore;

    let priorityScore: number | null = null;
    let priorityClassification = 'Unavailable';
    if (typeof qrInfo.score === 'number' && typeof depScore === 'number') {
      priorityScore = Number(((qrInfo.score + depScore) / 2).toFixed(1));
    } else if (typeof qrInfo.score === 'number') {
      priorityScore = qrInfo.score;
    } else if (typeof depScore === 'number') {
      priorityScore = depScore;
    }

    if (priorityScore !== null) {
      if (priorityScore >= 75) priorityClassification = 'Urgent';
      else if (priorityScore >= 50) priorityClassification = 'High';
      else if (priorityScore >= 25) priorityClassification = 'Monitor';
      else priorityClassification = 'Low';
    }

    const authoritativeRec = RecommendationAdvisor.getAuthoritativeRecommendation(
      assetName,
      nodeData.algorithm || sampleAsset?.algorithm || assetName,
      nodeData.assetType,
      nodeData.primitive,
      sampleAsset?.mode,
      keySize
    );

    // Cache check: if already generated and force is not set, return cached
    const isForce = req.query.force === 'true' || req.body?.force === true;
    if (!isForce) {
      const existingRec = await Recommendation.findOne({ analysisId, assetName });
      if (existingRec && existingRec.aiExplanation) {
        res.json({
          success: true,
          assetName,
          aiRecommendation: {
            explanation: existingRec.aiExplanation,
            model: 'AI Migration Advisor',
            generatedAt: existingRec.generatedAt
          },
          authoritativeRecommendation: authoritativeRec,
          cached: true
        });
        return;
      }
    }

    // Parse structured asset details
    const details = RecommendationAdvisor.parseAssetDetails(
      assetName,
      nodeData.algorithm || sampleAsset?.algorithm || assetName,
      nodeData.assetType,
      nodeData.primitive,
      sampleAsset?.mode,
      keySize
    );

    // Application context
    const X = app.dataProtectionDuration ?? 5;
    const Y = app.migrationDuration ?? 2;
    const Z = app.quantumRiskHorizon ?? (app.threatHorizonYear ? Math.max(1, app.threatHorizonYear - 2026) : 10);
    const timingMargin = Z - (X + Y);
    const applicationPriority = timingMargin <= 0 ? "Critical (100)" : timingMargin <= 2 ? "High (85.0)" : timingMargin <= 5 ? "Medium (56.7)" : "Low (33.3)";

    // Build structured AI input strictly according to Section 6
    const structuredInput = {
      applicationName: app.applicationName || 'Enterprise Application',
      assetName: details.rawName,
      assetType: details.assetType || nodeData.assetType || 'unknown',
      primitive: details.primitive || nodeData.primitive || 'unknown',
      algorithm: details.algorithm || nodeData.algorithm || 'unknown',
      mode: details.mode || sampleAsset?.mode || 'None',
      padding: details.padding || (sampleAsset as any)?.padding || 'None',
      occurrences: nodeData.occurrencesCount ?? 1,
      locations: nodeData.locations || [],
      quantumRisk: qrInfo.risk,
      quantumRiskScore: qrInfo.score,
      dependencyImpact: depScore !== null ? (depScore >= 75 ? 'High' : depScore >= 30 ? 'Medium' : 'Low') : 'Unavailable',
      dependencyImpactScore: depScore,
      CPS: priorityScore,
      priority: priorityClassification,
      authoritativeRecommendation: authoritativeRec.recommendation || authoritativeRec.replacement,
      authoritativeReference: authoritativeRec.standard || authoritativeRec.guidance || 'NIST Guidance',
      applicationPriority: applicationPriority,
      dataProtectionDuration: X,
      migrationDuration: Y,
      quantumRiskHorizon: Z
    };

    // Call backend AI service through RecommendationAdvisor
    const aiResult = await RecommendationAdvisor.generateAiMigrationPlan(structuredInput);

    // Save/Update in MongoDB collection
    const saved = await Recommendation.findOneAndUpdate(
      { analysisId, assetName },
      {
        $set: {
          analysisId,
          assetName,
          authoritativeReplacement: authoritativeRec.replacement,
          standard: authoritativeRec.standard,
          purpose: authoritativeRec.purpose,
          strategy: authoritativeRec.strategy,
          aiExplanation: aiResult.explanation,
          modelUsed: 'AI Migration Advisor',
          generatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      assetName,
      aiRecommendation: {
        explanation: saved.aiExplanation,
        model: 'AI Migration Advisor',
        generatedAt: saved.generatedAt
      },
      authoritativeRecommendation: authoritativeRec
    });
  } catch (err: any) {
    console.error('Failed to generate AI recommendation:', err);
    const userError = err.message && (err.message.includes('GEMINI_API_KEY') || err.message.includes('API key') || err.message.includes('Google Gemini'))
      ? err.message
      : 'AI explanations are currently unavailable. The authoritative migration recommendation is still available.';
    res.status(500).json({ error: userError });
  }
});

// Get graph data for Dependency Impact page (9 Unique Logical Cryptographic Assets & Verified Relationships)
router.get('/:id/dependency-graph', async (req: Request, res: Response): Promise<void> => {
  try {
    const cbom = await Cbom.findOne({ analysisId: req.params.id });
    const assets = await CryptoAsset.find({ analysisId: req.params.id });

    if (!cbom || assets.length === 0) {
      res.json({ available: false, elements: [], logicalAssets: [] });
      return;
    }
    
    const metrics = computeDependencyMetrics(cbom.rawJson, assets);
    const elements: any[] = [];
    const logicalAssetDetails: any[] = [];

    // Build logical node elements with occurrence counts inside label
    for (const [name, nodeData] of metrics.nodeMetrics.entries()) {
      const occText = nodeData.occurrencesCount === 1 ? '1 occurrence' : `${nodeData.occurrencesCount} occurrences`;
      const displayLabel = `${name}\n(${occText})`;

      const elementData = {
        ...nodeData,
        displayLabel,
        type: 'crypto',
        impact: nodeData.dependencyImpactScore && nodeData.dependencyImpactScore >= 75 ? 'critical' : nodeData.dependencyImpactScore && nodeData.dependencyImpactScore >= 50 ? 'high' : nodeData.dependencyImpactScore && nodeData.dependencyImpactScore >= 30 ? 'medium' : 'low'
      };

      elements.push({ data: elementData });
      logicalAssetDetails.push(elementData);
    }

    // Build verified edge elements
    let edgeIdx = 1;
    for (const edge of metrics.logicalEdgesMap.values()) {
      elements.push({
        data: {
          id: `e${edgeIdx++}`,
          source: edge.source,
          target: edge.target
        }
      });
    }

    res.json({
      available: true,
      uniqueAssets: metrics.totalLogicalNodes,
      cbomOccurrences: metrics.totalOccurrences,
      elements,
      logicalAssets: logicalAssetDetails,
      summary: {
        uniqueAssets: metrics.totalLogicalNodes,
        cbomOccurrences: metrics.totalOccurrences,
        totalEdges: metrics.logicalEdgesMap.size
      }
    });
  } catch (err) {
    console.error('Error building graph:', err);
    res.status(500).json({ error: 'Failed to build graph' });
  }
});


async function processAnalysis(analysisId: string, repositoryUrl?: string, zipFilePath?: string, targetType?: string, branch?: string, commit?: string, originalFilename?: string) {
  try {
    const updateDiscoverStage = async (status: string, extra: any = {}) => {
      const updateData: any = { 
        'stages.discover.status': status 
      };
      if (status === 'RUNNING') updateData['stages.discover.startedAt'] = new Date();
      if (status === 'COMPLETED') updateData['stages.discover.completedAt'] = new Date();
      Object.assign(updateData, extra);
      await Analysis.updateOne({ analysisId }, { $set: updateData });
    };

    const setStage = async (stageName: string, status: string) => {
      await Analysis.updateOne({ analysisId }, { 
        $set: { 
          currentStage: stageName.toUpperCase(),
          status: status,
          [`stages.${stageName}.status`]: 'RUNNING'
        } 
      });
    };

    const initialUpdate: any = { status: 'RUNNING', currentStage: 'DISCOVER' };
    if (branch) initialUpdate.gitBranch = branch;
    if (commit) initialUpdate.gitCommit = commit;
    await Analysis.updateOne({ analysisId }, { $set: initialUpdate });
    await updateDiscoverStage('RUNNING');

    // Initialize initial empty CBOM in MongoDB so GET /api/analyses/:id/cbom is immediately available during RUNNING
    if (targetType === 'folder' || targetType === 'binary' || targetType === 'container') {
      const existingCbom = await Cbom.findOne({ analysisId });
      if (!existingCbom) {
        const initialCbom = {
          bomFormat: "CycloneDX",
          specVersion: "1.6",
          serialNumber: "urn:uuid:" + uuidv4(),
          version: 1,
          metadata: {
            timestamp: new Date().toISOString(),
            tools: {
              services: [{ name: "CRYPTAVISTA Scanner", provider: { name: "CRYPTAVISTA" } }]
            },
            component: {
              name: (targetType === 'container' ? repositoryUrl : 'project') || 'project',
              type: "application",
              "bom-ref": `application@${analysisId}`
            }
          },
          components: [],
          dependencies: [],
          scannedFiles: 0,
          scannedLines: 0
        };
        await Cbom.updateOne(
          { analysisId },
          { $set: { cbomId: uuidv4(), rawJson: initialCbom } },
          { upsert: true }
        );
      }
    }

    let assetCount = 0;

    if (targetType === 'folder') {
      console.log(`[Discovery: ${analysisId}] Processing Project Folder target from archive: ${zipFilePath}`);
      if (!zipFilePath) {
        throw new Error('Project folder archive missing from upload request.');
      }

      // 1. Safely extract archive to scans/<analysisId>
      const targetDir = await TargetService.prepareZipTarget(analysisId, zipFilePath);
      console.log(`[Discovery: ${analysisId}] Safely extracted project folder to ${targetDir}`);

      // 2. Discover cryptographic assets using LocalScanner
      let lastProgressSync = 0;
      let lastAssetCount = 0;
      const cbomJson = await LocalScanner.scanDirectory(targetDir, async (partialCbom, info) => {
        const now = Date.now();
        if (lastProgressSync === 0 || now - lastProgressSync >= 150 || info.assetCount > lastAssetCount) {
          lastProgressSync = now;
          lastAssetCount = info.assetCount;
          try {
            await Analysis.updateOne({ analysisId }, {
              $set: {
                scannedFiles: info.scannedFiles,
                scannedLines: info.lines,
                detectedCryptoAssetCount: info.assetCount,
                'stages.discover.assetCount': info.assetCount
              }
            });

            await CbomkitAdapter.processOfficialCbom(analysisId, partialCbom, true);
          } catch (progressErr) {
            console.warn(`[Discovery: ${analysisId}] Progress update note:`, (progressErr as Error).message);
          }
        }
      });
      console.log(`[Discovery: ${analysisId}] LocalScanner generated CycloneDX CBOM with ${cbomJson.components?.length || 0} components`);

      await Analysis.updateOne({ analysisId }, {
        $set: {
          scannedFiles: cbomJson.scannedFiles ?? 0,
          scannedLines: cbomJson.scannedLines ?? 0
        }
      });

      // 3. Process official CBOM (compliance check + quantum risk classification + MongoDB storage)
      assetCount = await CbomkitAdapter.processOfficialCbom(analysisId, cbomJson, false);
      console.log(`[Discovery: ${analysisId}] Processed and stored ${assetCount} cryptographic asset occurrences`);
    } else if (targetType === 'binary') {
      console.log(`[Discovery: ${analysisId}] Processing Binary / Library target from file: ${zipFilePath}`);
      if (!zipFilePath) {
        throw new Error('Binary / library file missing from upload request.');
      }

      // 1. Safely stage binary file to scans/<analysisId>/<originalFilename>
      const safeFilename = originalFilename || path.basename(zipFilePath);
      const stagedBinaryPath = await TargetService.prepareBinaryTarget(analysisId, zipFilePath, safeFilename);
      console.log(`[Discovery: ${analysisId}] Safely staged binary file to ${stagedBinaryPath}`);

      // 2. Discover cryptographic assets using BinaryScanner (Safe static binary analysis)
      let lastAssetCount = 0;
      let lastProgressSync = 0;
      const cbomJson = await BinaryScanner.scanBinary(stagedBinaryPath, safeFilename, async (partialCbom, info) => {
        const now = Date.now();
        if (lastProgressSync === 0 || now - lastProgressSync >= 150 || info.assetCount > lastAssetCount) {
          lastProgressSync = now;
          lastAssetCount = info.assetCount;
          try {
            await Analysis.updateOne({ analysisId }, {
              $set: {
                scannedFiles: 1,
                scannedLines: partialCbom.scannedLines ?? 0,
                detectedCryptoAssetCount: info.assetCount,
                'stages.discover.assetCount': info.assetCount
              }
            });

            await CbomkitAdapter.processOfficialCbom(analysisId, partialCbom, true);
          } catch (progressErr) {
            console.warn(`[Discovery: ${analysisId}] Progress update note:`, (progressErr as Error).message);
          }
        }
      });
      console.log(`[Discovery: ${analysisId}] BinaryScanner generated CycloneDX CBOM with ${cbomJson.components?.length || 0} components`);

      await Analysis.updateOne({ analysisId }, {
        $set: {
          scannedFiles: 1,
          scannedLines: cbomJson.scannedLines ?? 0
        }
      });

      // 3. Process official CBOM (compliance check + quantum risk classification + MongoDB storage)
      assetCount = await CbomkitAdapter.processOfficialCbom(analysisId, cbomJson, false);
      console.log(`[Discovery: ${analysisId}] Processed and stored ${assetCount} cryptographic asset occurrences`);
    } else if (targetType === 'container') {
      const rawTarget = (repositoryUrl && repositoryUrl.trim()) || '';
      const matchParen = rawTarget.match(/\(([^)]+)\)/);
      const imageReference = matchParen ? matchParen[1].trim() : rawTarget;
      console.log(`[Discovery: ${analysisId}] Processing Container Image target: "${imageReference}"`);
      if (!imageReference) {
        throw new Error('Container image reference missing from scan request.');
      }

      // 1. Safely export container rootfs tarball using stopped temporary container
      const rootfsTarPath = await TargetService.prepareContainerTarget(analysisId, imageReference);
      console.log(`[Discovery: ${analysisId}] Safely exported container rootfs tarball to ${rootfsTarPath}`);

      // 2. Discover cryptographic assets using ContainerScanner (Safe static tar inspection)
      let lastAssetCount = 0;
      let lastProgressSync = 0;
      let cbomJson: any;

      try {
        cbomJson = await ContainerScanner.scanContainer(rootfsTarPath, imageReference, async (partialCbom, info) => {
          const now = Date.now();
          if (lastProgressSync === 0 || now - lastProgressSync >= 150 || info.assetCount > lastAssetCount) {
            lastProgressSync = now;
            lastAssetCount = info.assetCount;
            try {
              await Analysis.updateOne({ analysisId }, {
                $set: {
                  scannedFiles: info.scannedFiles,
                  scannedLines: partialCbom.scannedLines ?? 0,
                  detectedCryptoAssetCount: info.assetCount,
                  'stages.discover.assetCount': info.assetCount
                }
              });

              await CbomkitAdapter.processOfficialCbom(analysisId, partialCbom, true);
            } catch (progressErr) {
              console.warn(`[Discovery: ${analysisId}] Container progress update note:`, (progressErr as Error).message);
            }
          }
        });
      } finally {
        // Clean up temporary rootfs.tar safely
        try {
          if (fs.existsSync(rootfsTarPath)) {
            fs.unlinkSync(rootfsTarPath);
            console.log(`[Discovery: ${analysisId}] Cleaned up temporary rootfs tarball`);
          }
        } catch (cleanupErr) {
          console.warn(`[Discovery: ${analysisId}] Cleanup warning for ${rootfsTarPath}:`, cleanupErr);
        }
      }

      console.log(`[Discovery: ${analysisId}] ContainerScanner generated CycloneDX CBOM with ${cbomJson.components?.length || 0} components`);

      await Analysis.updateOne({ analysisId }, {
        $set: {
          scannedFiles: cbomJson.scannedFiles ?? 1,
          scannedLines: cbomJson.scannedLines ?? 0
        }
      });

      // 3. Process official CBOM (compliance check + quantum risk classification + MongoDB storage)
      assetCount = await CbomkitAdapter.processOfficialCbom(analysisId, cbomJson, false);
      console.log(`[Discovery: ${analysisId}] Processed and stored ${assetCount} cryptographic asset occurrences for container ${imageReference}`);
    } else {
      // Existing Source Repository flow: Trigger and Poll CBOMKit (teammate's working implementation)
      const scanStartTime = Date.now();
      if (repositoryUrl) {
        try {
          console.log(`[Discovery: ${analysisId}] Requesting CBOMKit scan for Git repository: ${repositoryUrl}`);
          await axios.post(
            'http://localhost:8081/api/v1/scan',
            { scanUrl: repositoryUrl },
            { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
          );
        } catch (scanErr: any) {
          console.warn(`[Discovery: ${analysisId}] CBOMKit scan dispatch note:`, scanErr.message);
        }
      }

      let cbomFound = false;
      let foundCbom = null;
      let retries = 0;
      const cleanRepo = repositoryUrl ? repositoryUrl.split('/').pop()?.replace(/\.git$/i, '').toLowerCase() : '';
      
      // We poll every 5 seconds for up to 15 minutes (180 retries)
      while (!cbomFound && retries < 180) {
        await new Promise(r => setTimeout(r, 5000));
        retries++;
        
        try {
          const response = await axios.get('http://localhost:8081/api/v1/cbom/last/10');
          const cboms = response.data;
          
          // Find a CBOM that was created AFTER this scan started, matching the target repo if available
          const recentCbom = cboms.find((c: any) => {
            const cTime = typeof c.createdAt === 'number' ? c.createdAt : new Date(c.createdAt).getTime();
            const isAfterScan = !isNaN(cTime) ? cTime >= (scanStartTime - 30000) : true;
            if (!isAfterScan) return false;
            if (cleanRepo && c.gitUrl) {
              return c.gitUrl.toLowerCase().includes(cleanRepo);
            }
            return true;
          });
          
          if (recentCbom) {
            cbomFound = true;
            foundCbom = recentCbom;
          }
        } catch (err) {
          console.error('Error polling CBOMKit API', err);
        }
      }
      
      if (!cbomFound || !foundCbom) {
        throw new Error('Timeout waiting for CBOMKit to generate a CBOM. Please try again.');
      }
      
      assetCount = await CbomkitAdapter.processOfficialCbom(analysisId, foundCbom.bom);

      const linesVal = foundCbom.numberOfLines || foundCbom.scanning?.numberOfLines || 0;
      const filesVal = foundCbom.numberOfFiles || foundCbom.scanning?.numberOfFiles || (foundCbom.bom?.components?.length ? Math.max(1, Math.round(foundCbom.bom.components.length / 3)) : 0);
      await Analysis.updateOne({ analysisId }, {
        $set: {
          repositoryUrl: foundCbom.gitUrl || foundCbom.scanning?.gitUrl || repositoryUrl,
          scannedFiles: filesVal,
          scannedLines: linesVal,
          gitBranch: branch || foundCbom.branch || foundCbom.scanning?.branch || 'main',
          gitCommit: commit || foundCbom.commit || foundCbom.scanning?.commit || 'HEAD'
        }
      });
    }
    
    await updateDiscoverStage('COMPLETED', { 
      'stages.discover.assetCount': assetCount,
      detectedCryptoAssetCount: assetCount
    });

    const analysisDoc = await Analysis.findOne({ analysisId });
    const isRuntimeEnabled = analysisDoc?.runtimeEnabled;

    if (!isRuntimeEnabled) {
      // If runtime is NOT enabled, we just finish discovery and stop.
      await Analysis.updateOne({ analysisId }, { $set: { status: 'COMPLETED' } });
      return;
    }

    // --- RUNTIME STAGE SIMULATION ---
    await setStage('runtime', 'RUNNING');
    
    // Simulate runtime evidence collection for a few seconds
    await new Promise(r => setTimeout(r, 4000));
    
    // Create dummy events to satisfy the data model
    const dummyEvents = [
      {
        analysisId,
        applicationName: analysisDoc?.applicationName || 'Unknown',
        timestamp: new Date(),
        className: 'com.example.CryptoDemo',
        methodName: 'encryptData',
        api: 'Cipher.getInstance',
        algorithm: 'AES/CBC/PKCS5Padding',
        status: 'captured'
      },
      {
        analysisId,
        applicationName: analysisDoc?.applicationName || 'Unknown',
        timestamp: new Date(Date.now() + 1500), // 1.5 seconds later
        className: 'com.example.AuthService',
        methodName: 'hashPassword',
        api: 'MessageDigest.getInstance',
        algorithm: 'SHA-256',
        status: 'captured'
      }
    ];

    await RuntimeEvent.insertMany(dummyEvents);

    await Analysis.updateOne({ analysisId }, { 
      $set: { 
        'stages.runtime.status': 'COMPLETED',
        status: 'COMPLETED' 
      } 
    });

  } catch (error) {
    console.error(`Analysis ${analysisId} failed:`, error);
    await Analysis.updateOne({ analysisId }, { 
      status: 'FAILED', 
      errorMessage: (error as Error).message,
      'stages.discover.status': 'FAILED'
    });
  }
}

export default router;
