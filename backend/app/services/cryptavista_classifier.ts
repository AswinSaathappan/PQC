import { RecommendationAdvisor, AssetClassificationEvidence } from './recommendation_advisor';

export type CryptavistaRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'CONTEXT_DEPENDENT';
export type CryptavistaQuantumClass = 'QUANTUM_SAFE' | 'QUANTUM_RESISTANT' | 'NOT_QUANTUM_SAFE' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'CONTEXT_DEPENDENT';

export interface CryptavistaClassificationResult {
  cryptavistaQuantumRisk: CryptavistaRiskLevel;
  cryptavistaQuantumClassification: CryptavistaQuantumClass;
  cryptavistaScore: number | null;
  cryptavistaReason: string;
  cryptavistaEvidence: string[];
}

export interface AssetResolutionContext {
  componentName?: string;
  bomRef?: string;
  cryptoProperties?: any;
  assetType?: string;
  primitive?: string;
  algorithmName?: string;
  associatedAlgorithm?: string;
  relatedCryptoMaterial?: string;
  oid?: string;
  detectionContext?: string;
  sourceLocation?: string;
  dependencies?: string[];
  parentComponent?: any;
}

export class CryptavistaClassifier {

  /**
   * Deterministic matching for standardized algorithms and known variants.
   */
  public static matchDeterministicAlgorithm(
    name: string,
    keySizeEvidence?: number | string | null
  ): {
    matched: boolean;
    quantumRisk: CryptavistaRiskLevel;
    quantumClassification: CryptavistaQuantumClass;
    score: number | null;
    reason: string;
  } | null {
    if (!name) return null;
    const clean = name.trim();
    const upper = clean.toUpperCase();

    // 1. Standardized Post-Quantum Cryptography (PQC)
    // Standards: FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA)
    if (
      upper.includes('ML-KEM-512') || upper.includes('MLKEM-512') || upper.includes('MLKEM512') ||
      upper.includes('ML-KEM-768') || upper.includes('MLKEM-768') || upper.includes('MLKEM768') ||
      upper.includes('ML-KEM-1024') || upper.includes('MLKEM-1024') || upper.includes('MLKEM1024') ||
      upper === 'ML-KEM' || upper === 'MLKEM'
    ) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_SAFE',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) and Quantum Safe based on NIST standardized lattice-based key-encapsulation (FIPS 203).`
      };
    }

    if (
      upper.includes('ML-DSA-44') || upper.includes('MLDSA-44') || upper.includes('MLDSA44') ||
      upper.includes('ML-DSA-65') || upper.includes('MLDSA-65') || upper.includes('MLDSA65') ||
      upper.includes('ML-DSA-87') || upper.includes('MLDSA-87') || upper.includes('MLDSA87') ||
      upper === 'ML-DSA' || upper === 'MLDSA'
    ) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_SAFE',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) and Quantum Safe based on NIST standardized digital signatures (FIPS 204).`
      };
    }

    if (upper.includes('SLH-DSA') || upper.includes('SLHDSA')) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_SAFE',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) and Quantum Safe based on NIST standardized stateless hash-based digital signatures (FIPS 205).`
      };
    }

    // 2. Classical Public-Key Mechanisms (Vulnerable to Shor's algorithm)
    // RSA, DSA, DH, Diffie-Hellman, ECDH, ECDSA, ECC, Ed25519, Ed448, X25519, X448
    const classicalPublicKeys = [
      'RSA', 'RSA-1024', 'RSA-2048', 'RSA-3072', 'RSA-4096',
      'DSA', 'DH', 'DIFFIE-HELLMAN', 'DIFFIE_HELLMAN',
      'ECDH', 'ECDSA', 'ECC',
      'ED25519', 'ED448', 'X25519', 'X448'
    ];

    const isClassicalPub = classicalPublicKeys.some(cpk => {
      if (upper === cpk) return true;
      // Match with word boundary / separator
      const re = new RegExp(`(^|[^A-Z0-9])${cpk}([^A-Z0-9]|$)`, 'i');
      return re.test(upper);
    });

    if (isClassicalPub) {
      return {
        matched: true,
        quantumRisk: 'HIGH',
        quantumClassification: 'NOT_QUANTUM_SAFE',
        score: 100,
        reason: `CRYPTAVISTA classifies ${clean} as High Quantum Risk (100) based on Shor's algorithm, which polynomial-time solves discrete logarithm and integer factorization problems.`
      };
    }

    // 3. Symmetric Ciphers & Hashes
    // AES-128 variants -> MEDIUM / 60
    if (
      upper.includes('AES-128-GCM') || upper.includes('AES128-GCM') || upper.includes('AES-128/GCM') ||
      upper.includes('AES-128-CBC') || upper.includes('AES128-CBC') || upper.includes('AES-128/CBC') ||
      upper.includes('AES-128-ECB') || upper.includes('AES128-ECB') || upper.includes('AES-128/ECB') ||
      upper.includes('AES-128') || upper.includes('AES128')
    ) {
      return {
        matched: true,
        quantumRisk: 'MEDIUM',
        quantumClassification: 'QUANTUM_RESISTANT',
        score: 60,
        reason: `CRYPTAVISTA classifies ${clean} as Medium Quantum Risk (60) based on NIST's analysis of symmetric cryptography and quantum attacks (Grover's algorithm reduces effective security to 64 bits).`
      };
    }

    // AES-192 variants -> LOW / 20
    if (
      upper.includes('AES-192') || upper.includes('AES192')
    ) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_RESISTANT',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) based on NIST's analysis of symmetric cryptography and quantum attacks.`
      };
    }

    // AES-256 variants -> LOW / 20
    if (
      upper.includes('AES-256-GCM') || upper.includes('AES256-GCM') || upper.includes('AES-256/GCM') ||
      upper.includes('AES-256-CBC') || upper.includes('AES256-CBC') || upper.includes('AES-256/CBC') ||
      upper.includes('AES-256-ECB') || upper.includes('AES256-ECB') || upper.includes('AES-256/ECB') ||
      upper.includes('AES-256') || upper.includes('AES256')
    ) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_RESISTANT',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) based on NIST's analysis of symmetric cryptography and quantum attacks. NIST recommends AES-256-GCM as an authenticated-encryption option.`
      };
    }

    // AES variants without explicit key length in name (e.g. AES-GCM, AES):
    // Verify actual key size from evidence before assigning risk score. Do not infer key size from name alone.
    const normKeySize = keySizeEvidence !== undefined && keySizeEvidence !== null ? String(keySizeEvidence).trim() : '';
    if (upper === 'AES-GCM' || upper === 'AES' || upper.startsWith('AES-') || upper.startsWith('AES/')) {
      if (normKeySize === '256' || normKeySize === '256-bit' || normKeySize === '256BITS') {
        return {
          matched: true,
          quantumRisk: 'LOW',
          quantumClassification: 'QUANTUM_RESISTANT',
          score: 20,
          reason: `CRYPTAVISTA classifies ${clean} with verified 256-bit key (from CBOM evidence: parameterSetIdentifier=${normKeySize}) as Low Quantum Risk (20) based on NIST's analysis of symmetric cryptography and quantum attacks. AES-256 provides 128-bit quantum security against Grover's algorithm.`
        };
      }
      if (normKeySize === '128' || normKeySize === '128-bit' || normKeySize === '128BITS') {
        return {
          matched: true,
          quantumRisk: 'MEDIUM',
          quantumClassification: 'QUANTUM_RESISTANT',
          score: 60,
          reason: `CRYPTAVISTA classifies ${clean} with verified 128-bit key (from CBOM evidence: parameterSetIdentifier=${normKeySize}) as Medium Quantum Risk (60) based on NIST's analysis of symmetric cryptography and quantum attacks (Grover's algorithm reduces effective security to 64 bits).`
        };
      }
      if (normKeySize === '192' || normKeySize === '192-bit') {
        return {
          matched: true,
          quantumRisk: 'LOW',
          quantumClassification: 'QUANTUM_RESISTANT',
          score: 20,
          reason: `CRYPTAVISTA classifies ${clean} with verified 192-bit key (from CBOM evidence: parameterSetIdentifier=${normKeySize}) as Low Quantum Risk (20) based on NIST's analysis of symmetric cryptography.`
        };
      }

      // Default to MEDIUM only if key size is not specified in available evidence
      return {
        matched: true,
        quantumRisk: 'MEDIUM',
        quantumClassification: 'QUANTUM_RESISTANT',
        score: 60,
        reason: `CRYPTAVISTA classifies ${clean} as Medium Quantum Risk (60) based on conservative NIST symmetric risk estimation (key size not specified in available evidence).`
      };
    }

    // Cryptographic Hashes: SHA-256, SHA-384, SHA-512, SHA-3-256, SHA-3-384, SHA-3-512 -> LOW / 20
    if (
      upper.includes('SHA-256') || upper.includes('SHA256') ||
      upper.includes('SHA-384') || upper.includes('SHA384') ||
      upper.includes('SHA-512') || upper.includes('SHA512') ||
      upper.includes('SHA-3-256') || upper.includes('SHA3-256') || upper.includes('SHA3_256') ||
      upper.includes('SHA-3-384') || upper.includes('SHA3-384') || upper.includes('SHA3_384') ||
      upper.includes('SHA-3-512') || upper.includes('SHA3-512') || upper.includes('SHA3_512') ||
      upper.includes('SHA3') || upper.includes('SHA-3')
    ) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_RESISTANT',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) based on NIST's analysis of cryptographic hash resistance to quantum collision and preimage attacks.`
      };
    }

    // HMAC variants: HMAC-SHA256, HMAC-SHA512 -> LOW / 20
    if (upper.includes('HMAC')) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_RESISTANT',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) based on NIST's analysis of symmetric message authentication.`
      };
    }

    // ChaCha20, ChaCha20-Poly1305 -> LOW / 20
    if (upper.includes('CHACHA20') || upper.includes('POLY1305')) {
      return {
        matched: true,
        quantumRisk: 'LOW',
        quantumClassification: 'QUANTUM_RESISTANT',
        score: 20,
        reason: `CRYPTAVISTA classifies ${clean} as Low Quantum Risk (20) based on NIST's analysis of 256-bit symmetric stream ciphers.`
      };
    }

    // 4. Legacy / Classically Insecure Symmetric Ciphers (outside quantum threat model)
    const is3Des = upper.includes('3DES') || upper.includes('DES3') || upper.includes('TRIPLEDES');
    const isRc4 = upper.includes('RC4') || upper.includes('ARCFOUR');
    const isDes = !is3Des && (upper === 'DES' || upper.startsWith('DES-') || upper.startsWith('DES/') || upper.endsWith('-DES'));

    if (is3Des || isRc4 || isDes) {
      const cipher = is3Des ? '3DES' : isRc4 ? 'RC4' : 'DES';
      return {
        matched: true,
        quantumRisk: 'NOT_APPLICABLE',
        quantumClassification: 'NOT_APPLICABLE',
        score: null,
        reason: `CRYPTAVISTA evaluates ${clean} as outside the quantum threat model; vulnerable to deprecation under classical cryptanalysis. Migration to AES-GCM or ChaCha20-Poly1305 is recommended.`
      };
    }

    // 5. Key Derivation Functions (PBKDF2, scrypt, Argon2, HKDF)
    const isPbkdf2 = upper.includes('PBKDF2') || upper.includes('PBKDF');
    if (isPbkdf2) {
      return {
        matched: true,
        quantumRisk: 'CONTEXT_DEPENDENT',
        quantumClassification: 'CONTEXT_DEPENDENT',
        score: null,
        reason: `CRYPTAVISTA classifies ${clean} as context-dependent; security is governed by the configured work factor (iterations), salt randomness, and underlying PRF/hash rather than a Shor-type public-key quantum vulnerability.`
      };
    }

    return null;
  }

  /**
   * Helper to check if a name is a generic key label without algorithm identity.
   */
  public static isGenericKeyLabel(name: string): boolean {
    if (!name) return true;
    const clean = name.trim().toLowerCase();
    const genericTerms = [
      'key', 'secret-key', 'secretkey', 'private-key', 'privatekey', 
      'public-key', 'publickey', 'symmetric-key', 'symmetrickey', 
      'material', 'related-crypto-material'
    ];
    return genericTerms.includes(clean);
  }

  /**
   * Resolves a related crypto material name or key by stripping generic suffixes.
   * e.g. "AES128 secret-key" -> "AES128"
   *      "RSA-2048 private-key" -> "RSA-2048"
   */
  public static extractParentAlgorithmFromKeyName(name: string): string | null {
    if (!name) return null;
    const clean = name.trim();
    const pattern = /^(.+?)[\s\-_]+(secret[\-_]?key|private[\-_]?key|public[\-_]?key|symmetric[\-_]?key|key)$/i;
    const match = clean.match(pattern);
    if (match && match[1]) {
      const parent = match[1].trim();
      if (!this.isGenericKeyLabel(parent)) {
        return parent;
      }
    }
    return null;
  }

  /**
   * Complete multi-stage classification layer.
   * Runs deterministic mapping, 9-step evidence evaluation for Unknowns,
   * explicit related-crypto-material inheritance, and AI fallback.
   */
  public static async classifyAsset(
    originalCbomkitResult: string | undefined, // 'quantum-safe' | 'quantum-vulnerable' | 'na' | 'unknown'
    ctx: AssetResolutionContext,
    skipAi: boolean = false
  ): Promise<CryptavistaClassificationResult> {
    const rawResult = (originalCbomkitResult || 'unknown').toLowerCase().trim();
    const evidenceList: string[] = [];

    // Canonical normalized cbomkit status: 'quantum-safe' | 'quantum-vulnerable' | 'na' | 'unknown'
    let normCbomkitStatus = 'unknown';
    if (rawResult === 'quantum-safe' || rawResult === 'quantum_safe') normCbomkitStatus = 'quantum-safe';
    else if (rawResult === 'quantum-vulnerable' || rawResult === 'quantum_vulnerable') normCbomkitStatus = 'quantum-vulnerable';
    else if (rawResult === 'na' || rawResult === 'not-applicable' || rawResult === 'not applicable') normCbomkitStatus = 'na';

    // Verify actual key size from evidence before assigning risk score (do not infer from name alone)
    const keySizeEvidence =
      ctx.cryptoProperties?.algorithmProperties?.parameterSetIdentifier ||
      ctx.cryptoProperties?.algorithmProperties?.keyLength ||
      ctx.cryptoProperties?.keyLength ||
      (ctx.detectionContext?.match(/(\b128\b|\b192\b|\b256\b|\b512\b|\b1024\b|\b2048\b|\b3072\b|\b4096\b)/)?.[1]);

    // -------------------------------------------------------------
    // RULE SET 1: Recognized PQC Algorithms (Section 5)
    // -------------------------------------------------------------
    const checkNames = [
      ctx.componentName,
      ctx.algorithmName,
      ctx.cryptoProperties?.algorithmProperties?.name,
      ctx.associatedAlgorithm
    ].filter(Boolean) as string[];

    for (const n of checkNames) {
      const match = this.matchDeterministicAlgorithm(n, keySizeEvidence);
      if (match && match.quantumClassification === 'QUANTUM_SAFE') {
        return {
          cryptavistaQuantumRisk: 'LOW',
          cryptavistaQuantumClassification: 'QUANTUM_SAFE',
          cryptavistaScore: 20,
          cryptavistaReason: match.reason,
          cryptavistaEvidence: [`Standardized PQC algorithm recognized from component evidence: ${n}`]
        };
      }
    }

    // -------------------------------------------------------------
    // RULE SET 2: CBOMKit is quantum-vulnerable (Section 4)
    // Classical public-key algorithms: RSA, DSA, DH, ECDH, ECDSA, ECC, etc.
    // -------------------------------------------------------------
    if (normCbomkitStatus === 'quantum-vulnerable') {
      for (const n of checkNames) {
        const match = this.matchDeterministicAlgorithm(n, keySizeEvidence);
        if (match && match.quantumRisk === 'HIGH') {
          return {
            cryptavistaQuantumRisk: 'HIGH',
            cryptavistaQuantumClassification: 'NOT_QUANTUM_SAFE',
            cryptavistaScore: 100,
            cryptavistaReason: match.reason,
            cryptavistaEvidence: [`Classical public-key algorithm identified: ${n}`]
          };
        }
      }

      // Default for quantum-vulnerable asymmetric mechanism
      return {
        cryptavistaQuantumRisk: 'HIGH',
        cryptavistaQuantumClassification: 'NOT_QUANTUM_SAFE',
        cryptavistaScore: 100,
        cryptavistaReason: `CRYPTAVISTA classifies this component as High Quantum Risk (100) based on CBOMKit quantum-vulnerability determination for classical asymmetric cryptography.`,
        cryptavistaEvidence: ['CBOMKit compliance determination: quantum-vulnerable']
      };
    }

    // -------------------------------------------------------------
    // RULE SET 3: When CBOMKit = "na" (Section 3)
    // DO NOT leave the asset unclassified automatically. Run deterministic mapping.
    // -------------------------------------------------------------
    if (normCbomkitStatus === 'na') {
      for (const n of checkNames) {
        const match = this.matchDeterministicAlgorithm(n, keySizeEvidence);
        if (match) {
          const evidenceStr = keySizeEvidence 
            ? `Deterministic CRYPTAVISTA mapping applied for symmetric/hash primitive: ${n} (verified ${keySizeEvidence}-bit key from evidence)`
            : `Deterministic CRYPTAVISTA mapping applied for symmetric/hash primitive: ${n}`;
          return {
            cryptavistaQuantumRisk: match.quantumRisk,
            cryptavistaQuantumClassification: match.quantumClassification,
            cryptavistaScore: match.score,
            cryptavistaReason: match.reason,
            cryptavistaEvidence: [evidenceStr]
          };
        }
      }
    }

    // -------------------------------------------------------------
    // RULE SET 4: UNKNOWN CBOMKit results (Section 6, 7, 13)
    // 9-Step deterministic evidence evaluation:
    // 1. Exact asset/algorithm name
    // 2. Normalized algorithm name
    // 3. cryptoProperties.algorithmName
    // 4. primitive
    // 5. assetType
    // 6. associated algorithm
    // 7. related crypto material (parent inheritance)
    // 8. OID if available
    // 9. actual source/detection context
    // -------------------------------------------------------------

    // Step 1: Exact asset/algorithm name
    if (ctx.componentName && !this.isGenericKeyLabel(ctx.componentName)) {
      const match = this.matchDeterministicAlgorithm(ctx.componentName, keySizeEvidence);
      if (match) {
        evidenceList.push(`Step 1: Exact asset name matched ${ctx.componentName}`);
        return {
          cryptavistaQuantumRisk: match.quantumRisk,
          cryptavistaQuantumClassification: match.quantumClassification,
          cryptavistaScore: match.score,
          cryptavistaReason: match.reason,
          cryptavistaEvidence: evidenceList
        };
      }
    }

    // Step 2: Normalized algorithm name
    if (ctx.algorithmName && !this.isGenericKeyLabel(ctx.algorithmName)) {
      const match = this.matchDeterministicAlgorithm(ctx.algorithmName, keySizeEvidence);
      if (match) {
        evidenceList.push(`Step 2: Normalized algorithm name matched ${ctx.algorithmName}`);
        return {
          cryptavistaQuantumRisk: match.quantumRisk,
          cryptavistaQuantumClassification: match.quantumClassification,
          cryptavistaScore: match.score,
          cryptavistaReason: match.reason,
          cryptavistaEvidence: evidenceList
        };
      }
    }

    // Step 3: cryptoProperties.algorithmName / algorithmProperties.name
    const propAlgo = ctx.cryptoProperties?.algorithmProperties?.name || ctx.cryptoProperties?.algorithmName;
    if (propAlgo && !this.isGenericKeyLabel(propAlgo)) {
      const match = this.matchDeterministicAlgorithm(propAlgo, keySizeEvidence);
      if (match) {
        evidenceList.push(`Step 3: cryptoProperties.algorithmName matched ${propAlgo}`);
        return {
          cryptavistaQuantumRisk: match.quantumRisk,
          cryptavistaQuantumClassification: match.quantumClassification,
          cryptavistaScore: match.score,
          cryptavistaReason: match.reason,
          cryptavistaEvidence: evidenceList
        };
      }
    }

    // Step 6 & 7: Related Crypto Material & Associated Algorithm Inheritance (Section 7)
    // Explicit parent relationship supported by CBOM data:
    // AES128 secret-key -> inherit AES128 -> MEDIUM / 60
    // AES128-ECB-PKCS5 secret-key -> inherit AES128 -> MEDIUM / 60
    // RSA-2048 key / private-key / public-key -> inherit RSA-2048 -> HIGH / 100
    // ML-KEM-768 key -> inherit ML-KEM-768 -> Quantum Safe / LOW / 20
    const candidateRelatedNames = [
      ctx.componentName,
      ctx.relatedCryptoMaterial,
      ctx.associatedAlgorithm
    ].filter(Boolean) as string[];

    for (const cand of candidateRelatedNames) {
      const parentAlg = this.extractParentAlgorithmFromKeyName(cand);
      if (parentAlg) {
        const match = this.matchDeterministicAlgorithm(parentAlg);
        if (match) {
          evidenceList.push(`Step 7: Related crypto material '${cand}' explicitly identifies parent algorithm '${parentAlg}'`);
          return {
            cryptavistaQuantumRisk: match.quantumRisk,
            cryptavistaQuantumClassification: match.quantumClassification,
            cryptavistaScore: match.score,
            cryptavistaReason: `CRYPTAVISTA classifies '${cand}' as ${match.quantumRisk} Quantum Risk (${match.score}) by inheriting risk from parent algorithm ${parentAlg}.`,
            cryptavistaEvidence: evidenceList
          };
        }
      }
    }

    // If explicit parent component exists in dependencies graph
    if (ctx.parentComponent) {
      const parentName = ctx.parentComponent.name || ctx.parentComponent.cryptoProperties?.algorithmProperties?.name;
      if (parentName && !this.isGenericKeyLabel(parentName)) {
        const match = this.matchDeterministicAlgorithm(parentName);
        if (match) {
          evidenceList.push(`Step 6: Associated parent component in CBOM dependency graph: ${parentName}`);
          return {
            cryptavistaQuantumRisk: match.quantumRisk,
            cryptavistaQuantumClassification: match.quantumClassification,
            cryptavistaScore: match.score,
            cryptavistaReason: `CRYPTAVISTA inherits ${match.quantumRisk} Quantum Risk (${match.score}) from associated parent algorithm ${parentName}.`,
            cryptavistaEvidence: evidenceList
          };
        }
      }
    }

    // Step 8: OID if available
    const oid = ctx.oid || ctx.cryptoProperties?.oid;
    if (oid) {
      evidenceList.push(`Step 8: OID inspected: ${oid}`);
      // Known PQC OIDs
      const pqcOids = [
        '1.3.6.1.4.1.2.267.12.4.4', '1.3.6.1.4.1.2.267.12.6.5', '1.3.6.1.4.1.2.267.12.8.7',
        '1.3.9999.6.4.16', '1.3.9999.6.7.16', '1.3.9999.6.4.13', '1.3.9999.6.7.13',
        '1.3.9999.6.5.12', '1.3.9999.6.8.12', '1.3.9999.6.5.10', '1.3.9999.6.8.10',
        '1.3.9999.6.6.12', '1.3.9999.6.9.12', '1.3.9999.6.6.10', '1.3.9999.6.9.10',
        '1.3.6.1.4.1.22554.5.6.1', '1.3.6.1.4.1.22554.5.6.2', '1.3.6.1.4.1.22554.5.6.3'
      ];
      if (pqcOids.includes(oid)) {
        return {
          cryptavistaQuantumRisk: 'LOW',
          cryptavistaQuantumClassification: 'QUANTUM_SAFE',
          cryptavistaScore: 20,
          cryptavistaReason: `CRYPTAVISTA classifies asset as Low Quantum Risk based on standardized post-quantum OID (${oid}).`,
          cryptavistaEvidence: evidenceList
        };
      }
    }

    // Step 4 & 5: Primitive check with safety guard (Section 13)
    // IMPORTANT: Generic asset labels (KEY, SECRET-KEY, etc.) WITHOUT reliable association MUST NOT guess!
    const prim = (ctx.primitive || '').toLowerCase().trim();
    if (prim === 'pke') {
      evidenceList.push('Step 4: Primitive identified as Public Key Encryption (pke)');
      return {
        cryptavistaQuantumRisk: 'HIGH',
        cryptavistaQuantumClassification: 'NOT_QUANTUM_SAFE',
        cryptavistaScore: 100,
        reason: `CRYPTAVISTA classifies classical public-key encryption primitive as High Quantum Risk (100).`,
        cryptavistaEvidence: evidenceList
      } as any;
    }

    // If this is solely a generic key label without established parent algorithm:
    const isSolelyGeneric = this.isGenericKeyLabel(ctx.componentName || '') &&
      (!ctx.algorithmName || this.isGenericKeyLabel(ctx.algorithmName));

    if (isSolelyGeneric) {
      return {
        cryptavistaQuantumRisk: 'UNKNOWN',
        cryptavistaQuantumClassification: 'UNKNOWN',
        cryptavistaScore: null,
        cryptavistaReason: 'Generic key material without verifiable parent algorithm association in CBOM evidence.',
        cryptavistaEvidence: ['Generic key label without reliable algorithm link']
      };
    }

    // -------------------------------------------------------------
    // RULE SET 5: AI Fallback for Unresolved Unknowns (Section 8)
    // -------------------------------------------------------------
    if (!skipAi) {
      try {
        const aiEvidence: AssetClassificationEvidence = {
          algorithmName: ctx.algorithmName || ctx.componentName,
          primitive: ctx.primitive,
          assetType: ctx.assetType,
          cryptoProperties: ctx.cryptoProperties,
          oid: ctx.oid,
          associatedAlgorithm: ctx.associatedAlgorithm,
          relatedCryptoMaterial: ctx.relatedCryptoMaterial,
          detectionContext: ctx.detectionContext,
          sourceLocation: ctx.sourceLocation
        };

        const aiRes = await RecommendationAdvisor.classifyUnknownAssetWithAi(aiEvidence);
        return {
          cryptavistaQuantumRisk: aiRes.quantumRisk,
          cryptavistaQuantumClassification: aiRes.quantumClassification,
          cryptavistaScore: aiRes.score,
          cryptavistaReason: aiRes.reason,
          cryptavistaEvidence: aiRes.evidence && aiRes.evidence.length > 0 ? aiRes.evidence : ['AI fallback evaluation']
        };
      } catch (err) {
        console.warn('[CryptavistaClassifier] AI classification fallback failed:', err);
      }
    }

    // Default Unknown if all deterministic and AI steps yield no conclusive result
    return {
      cryptavistaQuantumRisk: 'UNKNOWN',
      cryptavistaQuantumClassification: 'UNKNOWN',
      cryptavistaScore: null,
      cryptavistaReason: 'Cryptographic primitive or algorithm could not be resolved from CBOM evidence.',
      cryptavistaEvidence: ['Asset evidence inconclusive']
    };
  }
}
