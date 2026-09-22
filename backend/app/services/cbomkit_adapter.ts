import { CryptoAsset } from '../models/crypto_asset';
import { Cbom } from '../models/cbom';
import { Analysis } from '../models/analysis';
import { CryptavistaClassifier } from './cryptavista_classifier';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import axios from 'axios';

export class CbomkitAdapter {

  /**
   * Extracts the clean human-readable asset name from a CBOM component.
   * CBOMKit sometimes generates names like "secret-key@<uuid>" or "key@<uuid>".
   * We strip the "@<uuid>" suffix so the user sees just "secret-key", "key", etc.
   */
  static cleanAssetName(rawName: string | undefined, bomRef: string): string {
    if (!rawName) return bomRef;
    const cleaned = rawName.replace(/@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '');
    return cleaned.trim() || bomRef;
  }

  /**
   * Extract the display-friendly location from a full path + line.
   * e.g. "src/main/java/pt/tecnico/crypto/CryptoDemo.java" + line 86
   *   → "CryptoDemo.java:86"
   */
  static formatLocation(fullPath: string | null | undefined, line: number | null | undefined): string {
    if (!fullPath) return '-';
    const basename = path.basename(fullPath);
    return line ? `${basename}:${line}` : basename;
  }

  // CBOMKit Compliance Constants (Source of truth from CBOMKit UI engine)
  static readonly ASYMMETRIC_PRIMITIVES = ['signature', 'key-agree', 'kem', 'pke'];
  static readonly UNKNOWN_PRIMITIVES = ['unknown', 'other'];
  static readonly QUANTUM_SAFE_NAMES = [
    'ml-kem', 'ml-dsa', 'slh-dsa', 'pqxdh', 'bike', 'mceliece', 
    'frodokem', 'hqc', 'kyber', 'ntru', 'crystals', 'falcon', 
    'mayo', 'sphincs', 'xmss', 'lms'
  ];
  static readonly QUANTUM_SAFE_OIDS = [
    '1.3.6.1.4.1.2.267.12.4.4', '1.3.6.1.4.1.2.267.12.6.5', '1.3.6.1.4.1.2.267.12.8.7',
    '1.3.9999.6.4.16', '1.3.9999.6.7.16', '1.3.9999.6.4.13', '1.3.9999.6.7.13',
    '1.3.9999.6.5.12', '1.3.9999.6.8.12', '1.3.9999.6.5.10', '1.3.9999.6.8.10',
    '1.3.9999.6.6.12', '1.3.9999.6.9.12', '1.3.9999.6.6.10', '1.3.9999.6.9.10',
    '1.3.6.1.4.1.22554.5.6.1', '1.3.6.1.4.1.22554.5.6.2', '1.3.6.1.4.1.22554.5.6.3'
  ];

  /**
   * Deterministic local classifier fallback (matches CBOMKit decision tree if service is unreachable)
   */
  static classifyCbomComponent(component: any): { levelId: number; label: string; rawResult: string; isQuantumSafe: boolean | null } {
    const l = component.cryptoProperties;
    if (l) {
      const a = l.algorithmProperties;
      if (a) {
        const d = a.nistQuantumSecurityLevel;
        if (d && d > 0) return { levelId: 3, label: 'Quantum Safe', rawResult: 'quantum-safe', isQuantumSafe: true };
        const p = (a.primitive || '').toLowerCase();
        if (p) {
          if (!this.ASYMMETRIC_PRIMITIVES.includes(p) && !this.UNKNOWN_PRIMITIVES.includes(p)) {
            return { levelId: 4, label: 'Not Applicable', rawResult: 'na', isQuantumSafe: null };
          }
          const name = component.name;
          const r = l.oid;
          if (r && this.QUANTUM_SAFE_OIDS.includes(r)) return { levelId: 3, label: 'Quantum Safe', rawResult: 'quantum-safe', isQuantumSafe: true };
          if (name) {
            const lower = name.toLowerCase();
            if (this.QUANTUM_SAFE_NAMES.some(n => lower.includes(n))) return { levelId: 3, label: 'Quantum Safe', rawResult: 'quantum-safe', isQuantumSafe: true };
          }
          if (this.ASYMMETRIC_PRIMITIVES.includes(p)) {
            return { levelId: 1, label: 'Not Quantum Safe', rawResult: 'quantum-vulnerable', isQuantumSafe: false };
          }
          return { levelId: 2, label: 'Unknown', rawResult: 'unknown', isQuantumSafe: null };
        }
        return { levelId: 2, label: 'Unknown', rawResult: 'unknown', isQuantumSafe: null };
      }
      return { levelId: 2, label: 'Unknown', rawResult: 'unknown', isQuantumSafe: null };
    }
    return { levelId: 2, label: 'Unknown', rawResult: 'unknown', isQuantumSafe: null };
  }

  /**
   * Send the generated CBOM to CBOMKit's compliance endpoint:
   * POST /api/v1/compliance/check?policyIdentifier=quantum_safe
   */
  static async runComplianceCheck(cbomJson: any): Promise<{
    status: 'completed' | 'failed';
    findingsMap: Map<string, { label: string; rawResult: string; isQuantumSafe: boolean | null; levelId: number; message: string }>;
    rawResponse?: any;
  }> {
    const findingsMap = new Map<string, { label: string; rawResult: string; isQuantumSafe: boolean | null; levelId: number; message: string }>();
    try {
      console.log('[CBOMkit] Calling compliance endpoint: POST /api/v1/compliance/check with policy quantum_safe');
      const res = await axios.post(
        'http://localhost:8081/api/v1/compliance/check?policyIdentifier=quantum_safe',
        cbomJson,
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );

      if (res.status === 200 && res.data && Array.isArray(res.data.findings)) {
        for (const f of res.data.findings) {
          if (!f.bomRef) continue;
          let label = 'Unknown';
          let rawResult = 'unknown';
          let isQuantumSafe: boolean | null = null;
          
          const levelId = f.levelId;
          const resultStr = (f.result || f.status || '').toLowerCase();
          
          if (levelId === 3 || resultStr === 'quantum-safe' || resultStr === 'quantum_safe') {
            label = 'Quantum Safe';
            rawResult = 'quantum-safe';
            isQuantumSafe = true;
          } else if (levelId === 1 || resultStr === 'quantum-vulnerable' || resultStr === 'quantum_vulnerable' || resultStr.includes('not quantum safe')) {
            label = 'Not Quantum Safe';
            rawResult = 'quantum-vulnerable';
            isQuantumSafe = false;
          } else if (levelId === 4 || resultStr === 'na' || resultStr === 'not-applicable' || resultStr === 'not applicable') {
            label = 'Not Applicable';
            rawResult = 'na';
            isQuantumSafe = null;
          } else if (levelId === 2 || resultStr === 'unknown') {
            label = 'Unknown';
            rawResult = 'unknown';
            isQuantumSafe = null;
          }

          findingsMap.set(f.bomRef, {
            label,
            rawResult,
            isQuantumSafe,
            levelId: f.levelId,
            message: f.message || ''
          });
        }
        console.log(`[CBOMkit] Received ${findingsMap.size} compliance findings from CBOMKit`);
        return { status: 'completed', findingsMap, rawResponse: res.data };
      }
    } catch (err) {
      console.warn('[CBOMkit] Compliance check API call failed:', (err as Error).message);
    }
    return { status: 'failed', findingsMap };
  }

  /**
   * Process an official CycloneDX CBOM JSON.
   */
  static async processOfficialCbom(analysisId: string, cbomJson: any, isPartial = false): Promise<number> {
    console.log(`[CBOMkit] Processing CBOM for ${analysisId}${isPartial ? ' (incremental partial)' : ''}`);

    // Persist the raw CBOM JSON
    await Cbom.updateOne(
      { analysisId },
      { $set: { cbomId: uuidv4(), rawJson: cbomJson } },
      { upsert: true }
    );

    // Step 1: Run quantum_safe compliance check on CBOMKit endpoint (skipped during incremental progress to prevent HTTP overhead)
    const complianceResult: {
      status: 'completed' | 'failed';
      findingsMap: Map<string, { label: string; rawResult: string; isQuantumSafe: boolean | null; levelId: number; message: string }>;
      rawResponse?: any;
    } = isPartial
      ? { status: 'completed', findingsMap: new Map(), rawResponse: undefined }
      : await this.runComplianceCheck(cbomJson);

    const allComponents: any[] = cbomJson.components || [];
    const compMap = new Map<string, any>();
    for (const comp of allComponents) {
      if (comp['bom-ref']) {
        compMap.set(comp['bom-ref'], comp);
      }
    }

    const dependencies: any[] = cbomJson.dependencies || [];
    const dependsOnMap = new Map<string, Set<string>>();
    const dependedByMap = new Map<string, Set<string>>();
    const allComponentRefs = new Set<string>();

    for (const d of dependencies) {
      allComponentRefs.add(d.ref);
      if (!dependsOnMap.has(d.ref)) dependsOnMap.set(d.ref, new Set());
      for (const req of (d.dependsOn || [])) {
        allComponentRefs.add(req);
        dependsOnMap.get(d.ref)!.add(req);
        if (!dependedByMap.has(req)) dependedByMap.set(req, new Set());
        dependedByMap.get(req)!.add(d.ref);
      }
    }

    const cryptoComponents = allComponents.filter(
      (c: any) => c.type === 'cryptographic-asset' || c.cryptoProperties !== undefined
    );

    const totalComponents = allComponentRefs.size > 0 ? allComponentRefs.size : (cryptoComponents.length || 1);

    // Precalculate dependency metrics
    const componentDepMetrics = new Map<string, any>();
    for (const c of cryptoComponents) {
      const ref = c['bom-ref'];
      if (!ref) continue;

      const directDependents = new Set<string>();
      const direct = dependedByMap.get(ref);
      if (direct) {
        for (const d of direct) {
          if (d !== ref) {
            directDependents.add(d);
          }
        }
      }

      const visited = new Set<string>();
      const queue = Array.from(directDependents);
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (!visited.has(current) && current !== ref) {
          visited.add(current);
          const nextLevel = dependedByMap.get(current);
          if (nextLevel) {
            for (const n of nextLevel) {
              if (!visited.has(n) && n !== ref) {
                queue.push(n);
              }
            }
          }
        }
      }

      const directCount = directDependents.size;
      const transitiveCount = Math.max(0, visited.size - directCount);
      const affectedCount = visited.size;
      const reach = totalComponents > 0 ? (affectedCount / totalComponents) * 100 : 0;

      componentDepMetrics.set(ref, dependencies.length > 0 ? {
        directDependents: directCount,
        transitiveDependents: transitiveCount,
        affectedComponents: affectedCount,
        totalComponents: totalComponents,
        dependencyReach: Number(reach.toFixed(1)),
        isAvailable: true
      } : {
        directDependents: 0,
        transitiveDependents: 0,
        affectedComponents: 0,
        totalComponents: 0,
        dependencyReach: 0,
        isAvailable: false
      });
    }

    const defaultDepMetrics = {
      directDependents: 0,
      transitiveDependents: 0,
      affectedComponents: 0,
      totalComponents: 0,
      dependencyReach: 0,
      isAvailable: false
    };

    const assetRows: any[] = [];

    for (const c of cryptoComponents) {
      const bomRef = c['bom-ref'];
      const cleanName = this.cleanAssetName(c.name, bomRef);
      const assetType = c.cryptoProperties?.assetType || null;
      const primitive = c.cryptoProperties?.algorithmProperties?.primitive || null;

      // Match compliance findings to the generated CBOM components using bom-ref
      let cbomKitClassification = 'Unknown';
      let cbomkitClassification = 'unknown';
      let quantumSafe: boolean | null = null;

      if (complianceResult.status === 'completed' && complianceResult.findingsMap.size > 0) {
        const finding = complianceResult.findingsMap.get(bomRef);
        if (finding) {
          cbomKitClassification = finding.label;
          cbomkitClassification = finding.rawResult;
          quantumSafe = finding.isQuantumSafe;
        } else {
          // If CBOMKit returns no classification for a component, fall back to local rule engine
          const localClass = this.classifyCbomComponent(c);
          cbomKitClassification = localClass.label;
          cbomkitClassification = localClass.rawResult;
          quantumSafe = localClass.isQuantumSafe;
        }
      } else {
        // Fallback to local rule engine if compliance service failed or running incremental partial progress
        const localClass = this.classifyCbomComponent(c);
        cbomKitClassification = localClass.label;
        cbomkitClassification = localClass.rawResult;
        quantumSafe = localClass.isQuantumSafe;
      }

      let resolvedAlgorithm = cleanName;
      let resolvedPrimitive = primitive;
      let displayName = cleanName;

      let linkedAlgoComp: any = null;
      if (assetType === 'related-crypto-material') {
        const deps = dependsOnMap.get(bomRef);
        if (deps) {
          for (const targetRef of deps) {
            const target = compMap.get(targetRef);
            if (target && (target.type === 'cryptographic-asset' || target.cryptoProperties)) {
              if (target.cryptoProperties?.assetType === 'algorithm' || target.cryptoProperties?.algorithmProperties) {
                linkedAlgoComp = target;
                break;
              }
            }
          }
        }
        if (!linkedAlgoComp) {
          const revDeps = dependedByMap.get(bomRef);
          if (revDeps) {
            for (const srcRef of revDeps) {
              const src = compMap.get(srcRef);
              if (src && (src.type === 'cryptographic-asset' || src.cryptoProperties)) {
                if (src.cryptoProperties?.assetType === 'algorithm' || src.cryptoProperties?.algorithmProperties) {
                  linkedAlgoComp = src;
                  break;
                }
              }
            }
          }
        }

        if (linkedAlgoComp) {
          const cleanLinkedName = this.cleanAssetName(linkedAlgoComp.name, linkedAlgoComp['bom-ref']);
          resolvedAlgorithm = cleanLinkedName;
          resolvedPrimitive = linkedAlgoComp.cryptoProperties?.algorithmProperties?.primitive || primitive;
          displayName = `${cleanLinkedName} ${cleanName}`;
        } else {
          resolvedAlgorithm = 'Unknown';
        }
      }

      const depMetrics = componentDepMetrics.get(bomRef) || defaultDepMetrics;
      const occurrences: any[] = c.evidence?.occurrences || [];
      const primaryLoc = occurrences[0]?.location ? this.formatLocation(occurrences[0].location, occurrences[0].line) : undefined;

      // Run CRYPTAVISTA Quantum Risk Classification Layer
      const cryptavistaRes = await CryptavistaClassifier.classifyAsset(cbomkitClassification, {
        componentName: cleanName,
        bomRef,
        cryptoProperties: c.cryptoProperties,
        assetType: assetType || undefined,
        primitive: resolvedPrimitive || primitive || undefined,
        algorithmName: resolvedAlgorithm,
        associatedAlgorithm: linkedAlgoComp ? this.cleanAssetName(linkedAlgoComp.name, linkedAlgoComp['bom-ref']) : undefined,
        relatedCryptoMaterial: displayName,
        oid: c.cryptoProperties?.oid,
        detectionContext: occurrences[0]?.additionalContext,
        sourceLocation: primaryLoc,
        parentComponent: linkedAlgoComp
      }, isPartial);

      // Create an authoritative asset row for each detected occurrence
      if (occurrences.length > 0) {
        for (const occ of occurrences) {
          const formattedLoc = this.formatLocation(occ.location, occ.line);
          const mappedOcc = [{
            location: formattedLoc,
            rawLocation: occ.location,
            line: occ.line,
            offset: occ.offset,
            additionalContext: occ.additionalContext
          }];

          const paramSet = c.cryptoProperties?.algorithmProperties?.parameterSetIdentifier;
          const numericKeySize = paramSet && !isNaN(Number(paramSet)) ? Number(paramSet) : undefined;

          assetRows.push({
            assetId: uuidv4(),
            analysisId,
            assetName: displayName,
            assetType: assetType || 'unknown',
            primitive: resolvedPrimitive || 'unspecified',
            location: formattedLoc,
            line: occ.line ?? null,
            bomRef,
            occurrences: mappedOcc,
            algorithm: resolvedAlgorithm,
            version: paramSet || '-',
            keySize: numericKeySize,
            usage: resolvedPrimitive || 'unspecified',
            discoverySource: 'CBOMkit',
            sourceLocation: formattedLoc,
            confidence: 'High',
            quantumSafe,
            cbomKitClassification,
            cbomkitClassification,
            cryptavistaQuantumRisk: cryptavistaRes.cryptavistaQuantumRisk,
            cryptavistaQuantumClassification: cryptavistaRes.cryptavistaQuantumClassification,
            cryptavistaScore: cryptavistaRes.cryptavistaScore,
            cryptavistaReason: cryptavistaRes.cryptavistaReason,
            cryptavistaEvidence: cryptavistaRes.cryptavistaEvidence,
            dependencyMetrics: depMetrics
          });
        }
      } else {
        const paramSet = c.cryptoProperties?.algorithmProperties?.parameterSetIdentifier;
        const numericKeySize = paramSet && !isNaN(Number(paramSet)) ? Number(paramSet) : undefined;

        assetRows.push({
          assetId: uuidv4(),
          analysisId,
          assetName: displayName,
          assetType: assetType || 'unknown',
          primitive: resolvedPrimitive || 'unspecified',
          location: '-',
          line: null,
          bomRef,
          occurrences: [],
          algorithm: resolvedAlgorithm,
          version: paramSet || '-',
          keySize: numericKeySize,
          usage: resolvedPrimitive || 'unspecified',
          discoverySource: 'CBOMkit',
          sourceLocation: '-',
          confidence: 'High',
          quantumSafe,
          cbomKitClassification,
          cbomkitClassification,
          cryptavistaQuantumRisk: cryptavistaRes.cryptavistaQuantumRisk,
          cryptavistaQuantumClassification: cryptavistaRes.cryptavistaQuantumClassification,
          cryptavistaScore: cryptavistaRes.cryptavistaScore,
          cryptavistaReason: cryptavistaRes.cryptavistaReason,
          cryptavistaEvidence: cryptavistaRes.cryptavistaEvidence,
          dependencyMetrics: depMetrics
        });
      }
    }

    if (assetRows.length > 0) {
      await CryptoAsset.insertMany(assetRows);
      const insertedIds = assetRows.map(r => r.assetId);
      await CryptoAsset.deleteMany({ analysisId, assetId: { $nin: insertedIds } });
    } else {
      await CryptoAsset.deleteMany({ analysisId });
    }

    // Count ALL occurrences for the 5 summary cards
    let unknownCount = 0;
    let notApplicableCount = 0;
    let notQuantumSafeCount = 0;
    let quantumSafeCount = 0;

    for (const row of assetRows) {
      if (row.cbomKitClassification === 'Quantum Safe') quantumSafeCount++;
      else if (row.cbomKitClassification === 'Not Quantum Safe') notQuantumSafeCount++;
      else if (row.cbomKitClassification === 'Not Applicable') notApplicableCount++;
      else unknownCount++;
    }

    const cbomSummary = {
      totalCryptoAssets: assetRows.length,
      unknown: unknownCount,
      notApplicable: notApplicableCount,
      notQuantumSafe: notQuantumSafeCount,
      quantumSafe: quantumSafeCount,
      complianceStatus: complianceResult.status
    };

    await Cbom.updateOne(
      { analysisId },
      { 
        $set: { 
          cbomSummary,
          complianceResponse: complianceResult.rawResponse || null
        } 
      }
    );

    // Also update Analysis document with authoritative summary and counts
    await Analysis.updateOne(
      { analysisId },
      { 
        $set: { 
          cbomSummary: {
            totalCryptoAssets: assetRows.length,
            unknown: unknownCount,
            notApplicable: notApplicableCount,
            notQuantumSafe: notQuantumSafeCount,
            quantumSafe: quantumSafeCount
          },
          detectedCryptoAssetCount: assetRows.length,
          'stages.discover.assetCount': assetRows.length
        } 
      }
    );

    console.log(`[CBOMkit] Authoritative inventory stored: ${assetRows.length} detected assets for ${analysisId}`);
    console.log(`[CBOMkit] 5-Card Summary -> Total: ${cbomSummary.totalCryptoAssets}, Unknown: ${cbomSummary.unknown}, Not Applicable: ${cbomSummary.notApplicable}, Not Quantum Safe: ${cbomSummary.notQuantumSafe}, Quantum Safe: ${cbomSummary.quantumSafe}`);

    // Step 4: Synchronize authoritative CBOM to CBOMKit backend storage for visualization (on final completion)
    if (!isPartial) {
      try {
        await axios.post(
          `http://localhost:8081/api/v1/cbom/${encodeURIComponent(analysisId)}`,
          cbomJson,
          { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
        );
        console.log(`[CBOMkit] Authoritative CBOM synchronized to CBOMKit backend storage for ${analysisId}`);
      } catch (syncErr) {
        console.warn(`[CBOMkit] Notice: Could not sync CBOM to CBOMKit backend storage for ${analysisId}:`, (syncErr as Error).message);
      }
    }

    return assetRows.length;
  }
}
