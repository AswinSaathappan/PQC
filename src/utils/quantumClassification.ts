/**
 * Centralized CRYPTAVISTA Quantum Classification Engine (Single Source of Truth)
 *
 * Exactly four final CRYPTAVISTA classifications:
 * 1. Quantum Safe (PQC: ML-KEM, ML-DSA, SLH-DSA, etc.)
 * 2. Quantum Vulnerable (Classical Asymmetric: RSA, ECDSA, ECDH, DH, DSA, etc.)
 * 3. Quantum-Weakened (Classical Symmetric / Hashes: AES-128, AES-256, SHA, etc.)
 * 4. Unknown (Genuine lack of evidence)
 *
 * "Not Applicable" and "Not Quantum Safe" are strictly eliminated as final classifications.
 */

export type FinalQuantumClassification = 
  | 'Quantum Safe' 
  | 'Quantum Vulnerable' 
  | 'Quantum-Weakened' 
  | 'Unknown';

export type FinalQuantumRisk = 'Low' | 'Medium' | 'High' | 'Unknown' | 'Unknown / Review';

export interface NormalizedCryptographicAsset {
  assetId: string;
  assetName: string;
  assetType: string;
  primitive: string;
  algorithm: string;
  keySize?: number | string;
  purpose: string;
  rawCbomStatus: string;
  quantumClassification: FinalQuantumClassification;
  quantumRisk: FinalQuantumRisk;
  quantumRiskScore: number | null;
  quantumRiskReason: string;
  sourceLocation: string;
  associatedAsset?: string;
  occurrencesCount: number;
  confidence?: string;
  priorityScore?: number | null;
  priorityClassification?: string;
  dependencyImpactScore?: number | null;
  dependencyReach?: number;
  directDependents?: number;
  runtimeStatus?: string;
}

export interface ClassificationStats {
  totalOccurrences: number;
  uniqueAssets: number;
  quantumSafe: number;
  quantumSafePct: string;
  quantumVulnerable: number;
  quantumVulnerablePct: string;
  quantumWeakened: number;
  quantumWeakenedPct: string;
  unknown: number;
  unknownPct: string;
  isConsistent: boolean;
}

/**
 * Authoritative Quantum Risk Score Mapping
 */
export interface QuantumRiskMappingItem {
  classification: FinalQuantumClassification;
  score: number | null;
  riskLevel: 'High' | 'Medium' | 'Low' | 'Unknown / Review';
  description?: string;
}

export const QUANTUM_RISK_MAPPING: QuantumRiskMappingItem[] = [
  { 
    classification: 'Quantum Vulnerable', 
    score: 100, 
    riskLevel: 'High',
    description: 'Classical public-key algorithms exposed to quantum attacks.'
  },
  { 
    classification: 'Quantum-Weakened', 
    score: 60, 
    riskLevel: 'Medium',
    description: 'Reduced effective security for symmetric cryptography under quantum search.'
  },
  { 
    classification: 'Quantum Safe', 
    score: 20, 
    riskLevel: 'Low',
    description: 'Supported post-quantum algorithms designed to resist known quantum attacks.'
  },
  { 
    classification: 'Unknown', 
    score: null, 
    riskLevel: 'Unknown / Review',
    description: 'Unclassified primitives or lack of sufficient evidence.'
  }
];

/**
 * Authoritative Mosca Urgency Score Mapping
 * Timing Margin = Z - (X + Y)
 */
export interface MoscaUrgencyMappingItem {
  condition: string;
  marginRange: string;
  score: number;
  urgency: 'Critical' | 'Very High' | 'High' | 'Medium' | 'Low';
}

export const MOSCA_URGENCY_MAPPING: MoscaUrgencyMappingItem[] = [
  { condition: 'margin <= 0', marginRange: '≤ 0', score: 100, urgency: 'Critical' },
  { condition: 'margin > 0 && margin <= 2', marginRange: '> 0 and ≤ 2', score: 75, urgency: 'Very High' },
  { condition: 'margin > 2 && margin <= 5', marginRange: '> 2 and ≤ 5', score: 50, urgency: 'High' },
  { condition: 'margin > 5 && margin <= 10', marginRange: '> 5 and ≤ 10', score: 25, urgency: 'Medium' },
  { condition: 'margin > 10', marginRange: '> 10', score: 0, urgency: 'Low' }
];

/**
 * Authoritative Data Sensitivity Score Mapping
 */
export interface DataSensitivityMappingItem {
  sensitivity: 'Public' | 'Internal' | 'Confidential' | 'Highly Confidential';
  score: number;
}

export const DATA_SENSITIVITY_MAPPING: DataSensitivityMappingItem[] = [
  { sensitivity: 'Public', score: 25 },
  { sensitivity: 'Internal', score: 50 },
  { sensitivity: 'Confidential', score: 75 },
  { sensitivity: 'Highly Confidential', score: 100 }
];

/**
 * Authoritative Business Criticality Score Mapping
 */
export interface BusinessCriticalityMappingItem {
  criticality: 'Low' | 'Medium' | 'High' | 'Critical';
  score: number;
}

export const BUSINESS_CRITICALITY_MAPPING: BusinessCriticalityMappingItem[] = [
  { criticality: 'Low', score: 25 },
  { criticality: 'Medium', score: 50 },
  { criticality: 'High', score: 75 },
  { criticality: 'Critical', score: 100 }
];

/**
 * Authoritative Application Priority Score (APS) Priority Mapping
 * APS = (M + D + B) / 3
 */
export interface ApsPriorityMappingItem {
  range: string;
  minScore: number;
  maxScore: number;
  priority: 'High' | 'Medium' | 'Low' | 'Minimal';
  tier: 'P1' | 'P2' | 'P3' | 'P4';
}

export const APS_PRIORITY_MAPPING: ApsPriorityMappingItem[] = [
  { range: '75–100', minScore: 75, maxScore: 100, priority: 'High', tier: 'P1' },
  { range: '50–74.99', minScore: 50, maxScore: 74.99, priority: 'Medium', tier: 'P2' },
  { range: '25–49.99', minScore: 25, maxScore: 49.99, priority: 'Low', tier: 'P3' },
  { range: '0–24.99', minScore: 0, maxScore: 24.99, priority: 'Minimal', tier: 'P4' }
];

const PQC_PATTERNS = [
  'ML-KEM', 'MLKEM', 'ML-DSA', 'MLDSA', 'SLH-DSA', 'SLHDSA',
  'KYBER', 'DILITHIUM', 'FALCON', 'SPHINCS', 'XMSS', 'LMS', 'BIKE', 'HQC'
];

const CLASSICAL_ASYMMETRIC_PATTERNS = [
  'RSA', 'ECDSA', 'ECDH', 'ECC', 'DIFFIE-HELLMAN', 'DIFFIE_HELLMAN',
  'ED25519', 'ED448', 'X25519', 'X448'
];

const SYMMETRIC_PATTERNS = [
  'AES', 'CHACHA20', 'CHACHA', 'POLY1305', '3DES', 'DES', 'BLOWFISH',
  'RC4', 'SHA-256', 'SHA256', 'SHA-512', 'SHA512', 'SHA-384', 'SHA384',
  'SHA3', 'SHA-3', 'SHA1', 'SHA-1', 'MD5', 'HMAC', 'PBKDF2', 'SCRYPT', 'ARGON2'
];

/**
 * Extracts algorithm from key names (e.g. "AES128 secret-key" -> "AES128", "ML-KEM-768 key" -> "ML-KEM-768")
 */
function extractParentAlgorithm(name: string): string | null {
  if (!name) return null;
  const clean = name.trim();
  const pattern = /^(.+?)[\s\-_]+(secret[\-_]?key|private[\-_]?key|public[\-_]?key|symmetric[\-_]?key|key)$/i;
  const match = clean.match(pattern);
  if (match && match[1]) {
    const parent = match[1].trim();
    if (!['key', 'secret-key', 'public-key', 'private-key', 'material'].includes(parent.toLowerCase())) {
      return parent;
    }
  }
  return null;
}

/**
 * Normalizes any asset object from backend or mock into the authoritative CRYPTAVISTA model.
 */
export function classifyAsset(rawAsset: any): NormalizedCryptographicAsset {
  const assetId = rawAsset.assetId || rawAsset._id || String(Math.random());
  const assetName = rawAsset.assetName || rawAsset.asset || rawAsset.name || 'Unknown';
  const algorithm = rawAsset.algorithm || assetName;
  const assetType = rawAsset.assetType || 'unknown';
  const primitive = rawAsset.primitive || rawAsset.usage || 'unspecified';
  const sourceLocation = rawAsset.sourceLocation || rawAsset.location || (rawAsset.occurrences?.[0]?.location) || '-';

  // Keep original raw CBOM status for traceability
  const rawStatus = (
    rawAsset.cbomkitClassification || 
    rawAsset.cbomKitClassification || 
    rawAsset.rawCbomStatus || 
    'unknown'
  ).toString().trim();

  let rawCbomDisplay = 'Unknown';
  const lowerRaw = rawStatus.toLowerCase();
  if (lowerRaw.includes('safe')) rawCbomDisplay = 'Quantum Safe';
  else if (lowerRaw.includes('vuln') || lowerRaw.includes('not quantum')) rawCbomDisplay = 'Not Quantum Safe';
  else if (lowerRaw === 'na' || lowerRaw.includes('not app') || lowerRaw.includes('not-app')) rawCbomDisplay = 'Not Applicable';

  // Check parent algorithm inheritance
  const parentAlg = extractParentAlgorithm(assetName) || extractParentAlgorithm(algorithm);
  const targetCheck = `${assetName} ${algorithm} ${parentAlg || ''}`.toUpperCase();
  const primLower = primitive.toLowerCase();

  let classification: FinalQuantumClassification = 'Unknown';
  let risk: FinalQuantumRisk = 'Unknown / Review';
  let riskScore: number | null = null;
  let reason = '';

  // 1. PQC Check -> Quantum Safe
  const isPqc = PQC_PATTERNS.some(p => targetCheck.includes(p)) ||
    rawAsset.cryptavistaQuantumClassification === 'QUANTUM_SAFE' ||
    (rawStatus.toLowerCase() === 'quantum-safe' && !CLASSICAL_ASYMMETRIC_PATTERNS.some(p => targetCheck.includes(p)));

  if (isPqc) {
    classification = 'Quantum Safe';
    risk = 'Low';
    riskScore = 20;
    reason = `Recognized standardized post-quantum cryptographic algorithm (${algorithm}). Resilient against known quantum attacks.`;
  }
  // 2. Classical Asymmetric Check -> Quantum Vulnerable (Shor's algorithm)
  else {
    const isAsym = 
      CLASSICAL_ASYMMETRIC_PATTERNS.some(p => {
        const re = new RegExp(`(^|[^A-Z0-9])${p}([^A-Z0-9]|$)`, 'i');
        return re.test(targetCheck);
      }) ||
      primLower === 'pke' || 
      primLower === 'signature' || 
      primLower === 'key-agree' ||
      rawAsset.cryptavistaQuantumClassification === 'NOT_QUANTUM_SAFE' ||
      (lowerRaw.includes('vulner') && !SYMMETRIC_PATTERNS.some(s => targetCheck.includes(s)));

    if (isAsym) {
      classification = 'Quantum Vulnerable';
      risk = 'High';
      riskScore = 100;
      reason = `Classical public-key cryptography (${algorithm}) vulnerable to polynomial-time Shor's quantum cryptanalysis.`;
    }
    // 3. Classical Symmetric & Hashes Check -> Quantum-Weakened (Grover's algorithm)
    else {
      const isSym = 
        SYMMETRIC_PATTERNS.some(p => targetCheck.includes(p)) ||
        primLower === 'block-cipher' || 
        primLower === 'stream-cipher' || 
        primLower === 'hash' || 
        primLower === 'digest' || 
        primLower === 'mac' || 
        primLower === 'kdf' || 
        rawAsset.cryptavistaQuantumClassification === 'QUANTUM_RESISTANT' ||
        lowerRaw === 'na' || 
        lowerRaw.includes('not app') ||
        lowerRaw.includes('not-app');

      if (isSym) {
        classification = 'Quantum-Weakened';
        risk = 'Medium';
        riskScore = 60;
        reason = `Classical symmetric/hash mechanism (${algorithm}) with reduced quantum security margin under Grover's search algorithm.`;
      }
      // 4. Default -> Unknown
      else {
        classification = 'Unknown';
        risk = 'Unknown / Review';
        riskScore = null;
        reason = `Cryptographic construction or primitive could not be conclusively determined from available evidence.`;
      }
    }
  }

  // Resolve purpose
  let purpose = 'Cryptographic Operation';
  if (primLower === 'block-cipher' || primLower === 'stream-cipher' || classification === 'Quantum-Weakened') {
    purpose = 'Symmetric Encryption / Hash';
  } else if (primLower === 'signature' || targetCheck.includes('DSA') || targetCheck.includes('SIGN')) {
    purpose = 'Digital Signature';
  } else if (primLower === 'kem' || primLower === 'pke' || primLower === 'key-agree' || targetCheck.includes('RSA') || targetCheck.includes('DH') || targetCheck.includes('KEM')) {
    purpose = 'Key Establishment';
  }

  const occurrencesCount = rawAsset.occurrencesCount || (rawAsset.occurrences ? Math.max(1, rawAsset.occurrences.length) : 1);

  return {
    assetId,
    assetName,
    assetType,
    primitive,
    algorithm,
    keySize: rawAsset.keySize || rawAsset.version,
    purpose,
    rawCbomStatus: rawCbomDisplay,
    quantumClassification: classification,
    quantumRisk: risk,
    quantumRiskScore: riskScore,
    quantumRiskReason: rawAsset.cryptavistaReason || reason,
    sourceLocation,
    associatedAsset: parentAlg || rawAsset.associatedAlgorithm,
    occurrencesCount,
    confidence: rawAsset.confidence || 'High',
    priorityScore: rawAsset.priorityScore ?? rawAsset.scores?.priorityScore ?? null,
    priorityClassification: rawAsset.priorityClassification || rawAsset.scores?.priorityClassification,
    dependencyImpactScore: rawAsset.dependencyImpactScore ?? rawAsset.scores?.dependencyImpact ?? null,
    dependencyReach: rawAsset.dependencyReach ?? rawAsset.scores?.dependencyReach ?? 0,
    directDependents: rawAsset.directDependents ?? rawAsset.scores?.directDependents ?? 0,
    runtimeStatus: rawAsset.runtimeStatus || (rawAsset.hasRuntimeEvidence ? 'Observed' : 'Static Only')
  };
}

/**
 * Calculates authoritative 4-card statistics from asset occurrences (Single Source of Truth).
 * Guarantees: Safe + Vulnerable + Weakened + Unknown === Total Occurrences.
 */
export function calculateClassificationStats(assets: any[]): ClassificationStats {
  if (!assets || assets.length === 0) {
    return {
      totalOccurrences: 0,
      uniqueAssets: 0,
      quantumSafe: 0,
      quantumSafePct: "0.0%",
      quantumVulnerable: 0,
      quantumVulnerablePct: "0.0%",
      quantumWeakened: 0,
      quantumWeakenedPct: "0.0%",
      unknown: 0,
      unknownPct: "0.0%",
      isConsistent: true
    };
  }

  let qs = 0;
  let qv = 0;
  let qw = 0;
  let unk = 0;
  let totalOccurrences = 0;

  const uniqueNames = new Set<string>();

  for (const item of assets) {
    const norm = classifyAsset(item);
    const weight = norm.occurrencesCount || 1;
    totalOccurrences += weight;
    uniqueNames.add(norm.assetName || norm.algorithm);

    switch (norm.quantumClassification) {
      case 'Quantum Safe':
        qs += weight;
        break;
      case 'Quantum Vulnerable':
        qv += weight;
        break;
      case 'Quantum-Weakened':
        qw += weight;
        break;
      case 'Unknown':
      default:
        unk += weight;
        break;
    }
  }

  const calcPct = (count: number) => {
    if (totalOccurrences === 0) return "0.0%";
    return `${((count / totalOccurrences) * 100).toFixed(1)}%`;
  };

  const sum = qs + qv + qw + unk;
  const isConsistent = sum === totalOccurrences;

  return {
    totalOccurrences,
    uniqueAssets: uniqueNames.size,
    quantumSafe: qs,
    quantumSafePct: calcPct(qs),
    quantumVulnerable: qv,
    quantumVulnerablePct: calcPct(qv),
    quantumWeakened: qw,
    quantumWeakenedPct: calcPct(qw),
    unknown: unk,
    unknownPct: calcPct(unk),
    isConsistent
  };
}
