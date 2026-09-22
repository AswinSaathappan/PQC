import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';

export interface Occurrence {
  line: number;
  location: string;
  additionalContext?: string;
}

export interface Component {
  name: string;
  type: string;
  "bom-ref": string;
  evidence: {
    occurrences: Occurrence[];
  };
  cryptoProperties: {
    oid?: string;
    assetType: string;
    algorithmProperties?: {
      primitive?: string;
      cryptoFunctions?: string[];
      parameterSetIdentifier?: string;
      curve?: string;
      mode?: string;
      padding?: string;
      nistQuantumSecurityLevel?: number;
    };
    relatedCryptoMaterialProperties?: {
      type?: string;
      size?: number;
    };
  };
}

export interface Cbom {
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: {
      services: { name: string; provider: { name: string } }[];
    };
    component?: {
      name: string;
      type: string;
      "bom-ref": string;
    };
  };
  components: Component[];
  dependencies: { ref: string; dependsOn: string[] }[];
  scannedFiles?: number;
  scannedLines?: number;
}

export interface CryptoSignature {
  name: string;
  primitive: string;
  assetType?: string;
  oid?: string;
  cryptoFunctions?: string[];
  parameterSetIdentifier?: string;
  curve?: string;
  mode?: string;
  padding?: string;
  nistQuantumSecurityLevel?: number;
  patterns: (string | RegExp)[];
}

export const CRYPTO_SIGNATURES: CryptoSignature[] = [
  // ==========================================
  // Post-Quantum Cryptography (Quantum Safe)
  // ==========================================
  {
    name: "ML-KEM-512",
    primitive: "kem",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.4.1",
    parameterSetIdentifier: "512",
    nistQuantumSecurityLevel: 1,
    cryptoFunctions: ["keygen", "encapsulate", "decapsulate"],
    patterns: [
      /\bML[-_]?KEM[-_]?512\b/i,
      /\bOQS_KEM_ml_kem_512\b/i,
      /\bCRYSTALS[-_]?Kyber[-_]?512\b/i,
      /\bKyber512\b/i,
      "2.16.840.1.101.3.4.4.1"
    ]
  },
  {
    name: "ML-KEM-768",
    primitive: "kem",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.4.2",
    parameterSetIdentifier: "768",
    nistQuantumSecurityLevel: 3,
    cryptoFunctions: ["keygen", "encapsulate", "decapsulate"],
    patterns: [
      /\bML[-_]?KEM[-_]?768\b/i,
      /\bOQS_KEM_ml_kem_768\b/i,
      /\bCRYSTALS[-_]?Kyber[-_]?768\b/i,
      /\bKyber768\b/i,
      "2.16.840.1.101.3.4.4.2"
    ]
  },
  {
    name: "ML-KEM-1024",
    primitive: "kem",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.4.3",
    parameterSetIdentifier: "1024",
    nistQuantumSecurityLevel: 5,
    cryptoFunctions: ["keygen", "encapsulate", "decapsulate"],
    patterns: [
      /\bML[-_]?KEM[-_]?1024\b/i,
      /\bOQS_KEM_ml_kem_1024\b/i,
      /\bCRYSTALS[-_]?Kyber[-_]?1024\b/i,
      /\bKyber1024\b/i,
      "2.16.840.1.101.3.4.4.3"
    ]
  },
  {
    name: "ML-DSA-44",
    primitive: "signature",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.3.1",
    parameterSetIdentifier: "44",
    nistQuantumSecurityLevel: 2,
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bML[-_]?DSA[-_]?44\b/i,
      /\bOQS_SIG_ml_dsa_44\b/i,
      /\bDilithium2\b/i,
      /\bCRYSTALS[-_]?Dilithium2\b/i,
      "2.16.840.1.101.3.4.3.1"
    ]
  },
  {
    name: "ML-DSA-65",
    primitive: "signature",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.3.2",
    parameterSetIdentifier: "65",
    nistQuantumSecurityLevel: 3,
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bML[-_]?DSA[-_]?65\b/i,
      /\bOQS_SIG_ml_dsa_65\b/i,
      /\bDilithium3\b/i,
      /\bCRYSTALS[-_]?Dilithium3\b/i,
      "2.16.840.1.101.3.4.3.2"
    ]
  },
  {
    name: "ML-DSA-87",
    primitive: "signature",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.3.3",
    parameterSetIdentifier: "87",
    nistQuantumSecurityLevel: 5,
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bML[-_]?DSA[-_]?87\b/i,
      /\bOQS_SIG_ml_dsa_87\b/i,
      /\bDilithium5\b/i,
      /\bCRYSTALS[-_]?Dilithium5\b/i,
      "2.16.840.1.101.3.4.3.3"
    ]
  },
  {
    name: "SLH-DSA",
    primitive: "signature",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.3.17",
    nistQuantumSecurityLevel: 1,
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bSLH[-_]?DSA\b/i,
      /\bSPHINCS\+?\b/i,
      /\bOQS_SIG_sphincs\b/i,
      "2.16.840.1.101.3.4.3.17"
    ]
  },
  {
    name: "Falcon-512",
    primitive: "signature",
    assetType: "algorithm",
    parameterSetIdentifier: "512",
    nistQuantumSecurityLevel: 1,
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bFalcon[-_]?512\b/i,
      /\bOQS_SIG_falcon_512\b/i
    ]
  },
  {
    name: "Falcon-1024",
    primitive: "signature",
    assetType: "algorithm",
    parameterSetIdentifier: "1024",
    nistQuantumSecurityLevel: 5,
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bFalcon[-_]?1024\b/i,
      /\bOQS_SIG_falcon_1024\b/i
    ]
  },
  {
    name: "FrodoKEM",
    primitive: "kem",
    assetType: "algorithm",
    cryptoFunctions: ["keygen", "encapsulate", "decapsulate"],
    patterns: [
      /\bFrodoKEM[-_]?(640|976|1344)?\b/i,
      /\bOQS_KEM_frodokem\b/i
    ]
  },
  {
    name: "Classic-McEliece",
    primitive: "kem",
    assetType: "algorithm",
    cryptoFunctions: ["keygen", "encapsulate", "decapsulate"],
    patterns: [
      /\bClassic[-_]?McEliece\b/i,
      /\bOQS_KEM_classic_mceliece\b/i
    ]
  },

  // ==========================================
  // Asymmetric Cryptography (Not Quantum Safe)
  // ==========================================
  {
    name: "RSA",
    primitive: "pke",
    assetType: "algorithm",
    oid: "1.2.840.113549.1.1.1",
    cryptoFunctions: ["encrypt", "decrypt", "sign", "verify"],
    patterns: [
      /\bRSA_generate_key\b/i,
      /\bRSA_new\b/i,
      /\bRSA_public_encrypt\b/i,
      /\bRSA_private_decrypt\b/i,
      /\bRSA_sign\b/i,
      /\bRSA_verify\b/i,
      /\bEVP_PKEY_RSA\b/i,
      /\bBCRYPT_RSA_ALGORITHM\b/i,
      /\bBCRYPT_RSA_SIGN_ALGORITHM\b/i,
      /\bCALG_RSA_KEYX\b/i,
      /\bCALG_RSA_SIGN\b/i,
      /\bRSA\/ECB\/PKCS1Padding\b/i,
      /\bRSA\/ECB\/OAEP\b/i,
      /\bRSAWithSHA256\b/i,
      /\bRSAWithSHA1\b/i,
      "1.2.840.113549.1.1.1",
      "1.2.840.113549.1.1.5",
      "1.2.840.113549.1.1.11"
    ]
  },
  {
    name: "ECDSA",
    primitive: "signature",
    assetType: "algorithm",
    oid: "1.2.840.10045.2.1",
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bECDSA_sign\b/i,
      /\bECDSA_verify\b/i,
      /\bECDSA_do_sign\b/i,
      /\bBCRYPT_ECDSA_P256_ALGORITHM\b/i,
      /\bBCRYPT_ECDSA_P384_ALGORITHM\b/i,
      /\bBCRYPT_ECDSA_P521_ALGORITHM\b/i,
      /\bECDSAWithSHA256\b/i,
      /\bECDSAWithSHA384\b/i,
      "1.2.840.10045.2.1",
      "1.2.840.10045.4.3.2"
    ]
  },
  {
    name: "ECDH",
    primitive: "key-agree",
    assetType: "algorithm",
    oid: "1.3.132.1.12",
    cryptoFunctions: ["key-agree"],
    patterns: [
      /\bECDH_compute_key\b/i,
      /\bBCRYPT_ECDH_P256_ALGORITHM\b/i,
      /\bBCRYPT_ECDH_P384_ALGORITHM\b/i,
      /\bBCRYPT_ECDH_P521_ALGORITHM\b/i,
      /\bEVP_PKEY_ECDH\b/i,
      "1.3.132.1.12"
    ]
  },
  {
    name: "Diffie-Hellman",
    primitive: "key-agree",
    assetType: "algorithm",
    oid: "1.2.840.10046.2.1",
    cryptoFunctions: ["key-agree"],
    patterns: [
      /\bDH_generate_key\b/i,
      /\bDH_compute_key\b/i,
      /\bDH_new\b/i,
      /\bBCRYPT_DH_ALGORITHM\b/i,
      /\bCALG_DH_EPHEM\b/i,
      "1.2.840.10046.2.1"
    ]
  },
  {
    name: "DSA",
    primitive: "signature",
    assetType: "algorithm",
    oid: "1.2.840.10040.4.1",
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bDSA_generate_key\b/i,
      /\bDSA_sign\b/i,
      /\bDSA_verify\b/i,
      /\bDSA_new\b/i,
      /\bBCRYPT_DSA_ALGORITHM\b/i,
      /\bCALG_DSS_SIGN\b/i,
      "1.2.840.10040.4.1"
    ]
  },
  {
    name: "Ed25519",
    primitive: "signature",
    assetType: "algorithm",
    oid: "1.3.101.112",
    cryptoFunctions: ["sign", "verify"],
    patterns: [
      /\bEVP_PKEY_ED25519\b/i,
      /\bED25519_sign\b/i,
      /\bcrypto_sign_ed25519\b/i,
      /\bcrypto_sign_keypair\b/i,
      "1.3.101.112"
    ]
  },
  {
    name: "X25519",
    primitive: "key-agree",
    assetType: "algorithm",
    oid: "1.3.101.110",
    cryptoFunctions: ["key-agree"],
    patterns: [
      /\bEVP_PKEY_X25519\b/i,
      /\bcrypto_box_keypair\b/i,
      /\bcrypto_box_easy\b/i,
      /\bcrypto_scalarmult_curve25519\b/i,
      "1.3.101.110"
    ]
  },
  {
    name: "Elliptic Curve (EC)",
    primitive: "pke",
    assetType: "algorithm",
    cryptoFunctions: ["encrypt", "decrypt", "sign", "verify"],
    patterns: [
      /\bEC_KEY_new\b/i,
      /\bEC_KEY_generate_key\b/i,
      /\bEVP_PKEY_EC\b/i,
      /\bsecp256r1\b/i,
      /\bprime256v1\b/i,
      /\bsecp384r1\b/i,
      /\bsecp521r1\b/i,
      /\bsecp256k1\b/i
    ]
  },

  // ==========================================
  // Symmetric Cryptography (Not Applicable)
  // ==========================================
  {
    name: "AES-GCM",
    primitive: "ae",
    assetType: "algorithm",
    mode: "gcm",
    cryptoFunctions: ["encrypt", "decrypt"],
    patterns: [
      /\bEVP_aes_256_gcm\b/i,
      /\bEVP_aes_128_gcm\b/i,
      /\bAES[-_]?128[-_]?GCM\b/i,
      /\bAES[-_]?256[-_]?GCM\b/i,
      /\bAES\/GCM\b/i,
      /\bBCRYPT_CHAIN_MODE_GCM\b/i,
      /\bcrypto_aead_aes256gcm\b/i
    ]
  },
  {
    name: "AES-CBC",
    primitive: "block-cipher",
    assetType: "algorithm",
    mode: "cbc",
    cryptoFunctions: ["encrypt", "decrypt"],
    patterns: [
      /\bEVP_aes_256_cbc\b/i,
      /\bEVP_aes_128_cbc\b/i,
      /\bAES[-_]?128[-_]?CBC\b/i,
      /\bAES[-_]?256[-_]?CBC\b/i,
      /\bAES\/CBC\b/i,
      /\bBCRYPT_CHAIN_MODE_CBC\b/i
    ]
  },
  {
    name: "AES-CTR",
    primitive: "block-cipher",
    assetType: "algorithm",
    mode: "ctr",
    cryptoFunctions: ["encrypt", "decrypt"],
    patterns: [
      /\bEVP_aes_256_ctr\b/i,
      /\bEVP_aes_128_ctr\b/i,
      /\bAES[-_]?128[-_]?CTR\b/i,
      /\bAES[-_]?256[-_]?CTR\b/i,
      /\bAES\/CTR\b/i
    ]
  },
  {
    name: "AES",
    primitive: "block-cipher",
    assetType: "algorithm",
    cryptoFunctions: ["encrypt", "decrypt"],
    patterns: [
      /\bAES_encrypt\b/i,
      /\bAES_decrypt\b/i,
      /\bAES_set_encrypt_key\b/i,
      /\bAES_set_decrypt_key\b/i,
      /\bBCRYPT_AES_ALGORITHM\b/i,
      /\bCALG_AES\b/i
    ]
  },
  {
    name: "ChaCha20-Poly1305",
    primitive: "ae",
    assetType: "algorithm",
    mode: "poly1305",
    cryptoFunctions: ["encrypt", "decrypt"],
    patterns: [
      /\bEVP_chacha20_poly1305\b/i,
      /\bChaCha20[-_]?Poly1305\b/i,
      /\bcrypto_aead_chacha20poly1305\b/i
    ]
  },
  {
    name: "Triple-DES",
    primitive: "block-cipher",
    assetType: "algorithm",
    cryptoFunctions: ["encrypt", "decrypt"],
    patterns: [
      /\bDES_ede3_cbc_encrypt\b/i,
      /\bBCRYPT_3DES_ALGORITHM\b/i,
      /\bTripleDES\b/i,
      /\bDESede\b/i
    ]
  },

  // ==========================================
  // Hash Functions & MACs (Not Applicable)
  // ==========================================
  {
    name: "SHA-256",
    primitive: "hash",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.2.1",
    cryptoFunctions: ["digest"],
    patterns: [
      /\bSHA256_Init\b/i,
      /\bSHA256_Update\b/i,
      /\bSHA256_Final\b/i,
      /\bEVP_sha256\b/i,
      /\bBCRYPT_SHA256_ALGORITHM\b/i,
      /\bCALG_SHA_256\b/i,
      "2.16.840.1.101.3.4.2.1"
    ]
  },
  {
    name: "SHA-384",
    primitive: "hash",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.2.2",
    cryptoFunctions: ["digest"],
    patterns: [
      /\bSHA384_Init\b/i,
      /\bSHA384_Update\b/i,
      /\bSHA384_Final\b/i,
      /\bEVP_sha384\b/i,
      /\bBCRYPT_SHA384_ALGORITHM\b/i,
      "2.16.840.1.101.3.4.2.2"
    ]
  },
  {
    name: "SHA-512",
    primitive: "hash",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.2.3",
    cryptoFunctions: ["digest"],
    patterns: [
      /\bSHA512_Init\b/i,
      /\bSHA512_Update\b/i,
      /\bSHA512_Final\b/i,
      /\bEVP_sha512\b/i,
      /\bBCRYPT_SHA512_ALGORITHM\b/i,
      "2.16.840.1.101.3.4.2.3"
    ]
  },
  {
    name: "SHA3-256",
    primitive: "hash",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.2.8",
    cryptoFunctions: ["digest"],
    patterns: [
      /\bEVP_sha3_256\b/i,
      /\bSHA3[-_]?256\b/i,
      "2.16.840.1.101.3.4.2.8"
    ]
  },
  {
    name: "SHA3-512",
    primitive: "hash",
    assetType: "algorithm",
    oid: "2.16.840.1.101.3.4.2.10",
    cryptoFunctions: ["digest"],
    patterns: [
      /\bEVP_sha3_512\b/i,
      /\bSHA3[-_]?512\b/i,
      "2.16.840.1.101.3.4.2.10"
    ]
  },
  {
    name: "HMAC-SHA256",
    primitive: "mac",
    assetType: "algorithm",
    oid: "1.2.840.113549.2.9",
    cryptoFunctions: ["tag", "verify"],
    patterns: [
      /\bHMAC_Init_ex\b/i,
      /\bHMAC_Update\b/i,
      /\bHMAC[-_]?SHA256\b/i,
      /\bHmacSHA256\b/i,
      "1.2.840.113549.2.9"
    ]
  },
  {
    name: "SHA-1",
    primitive: "hash",
    assetType: "algorithm",
    oid: "1.3.14.3.2.26",
    cryptoFunctions: ["digest"],
    patterns: [
      /\bSHA1_Init\b/i,
      /\bSHA1_Update\b/i,
      /\bEVP_sha1\b/i,
      /\bBCRYPT_SHA1_ALGORITHM\b/i,
      /\bCALG_SHA1\b/i,
      "1.3.14.3.2.26"
    ]
  },
  {
    name: "MD5",
    primitive: "hash",
    assetType: "algorithm",
    oid: "1.2.840.113549.2.5",
    cryptoFunctions: ["digest"],
    patterns: [
      /\bMD5_Init\b/i,
      /\bMD5_Update\b/i,
      /\bEVP_md5\b/i,
      /\bBCRYPT_MD5_ALGORITHM\b/i,
      /\bCALG_MD5\b/i,
      "1.2.840.113549.2.5"
    ]
  }
];

export interface Finding {
  name: string;
  primitive: string;
  assetType: string;
  oid?: string;
  cryptoFunctions?: string[];
  parameterSetIdentifier?: string;
  curve?: string;
  mode?: string;
  padding?: string;
  nistQuantumSecurityLevel?: number;
  offset: number;
  matchedText: string;
  section?: string;
  sourceType: 'import' | 'export' | 'symbol' | 'string' | 'bytecode';
}

export class BinaryScanner {

  /**
   * Safely scans a binary or library file without executing any untrusted code.
   * Extracts crypto APIs, imported/exported symbols, OIDs, and algorithms.
   */
  static async scanBinary(
    binaryPath: string,
    originalFilename: string,
    onProgress?: (partialCbom: Cbom, info: { assetCount: number; scannedBytes: number; totalBytes: number }) => Promise<void>
  ): Promise<Cbom> {
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Target binary file does not exist at: ${binaryPath}`);
    }

    const fileStats = fs.statSync(binaryPath);
    const totalBytes = fileStats.size;
    const buffer = fs.readFileSync(binaryPath);
    const displayLocation = path.basename(originalFilename || binaryPath);

    const findings: Finding[] = [];
    const detectedNames = new Set<string>();

    let lastEmittedCount = 0;
    let lastEmittedTime = 0;

    const emitProgress = async (force = false) => {
      if (!onProgress || findings.length === 0) return;
      const now = Date.now();
      const isFirstFinding = (lastEmittedCount === 0 && findings.length > 0);
      const hasNewFindings = (findings.length > lastEmittedCount);
      const timeElapsed = now - lastEmittedTime;

      // 1. First real crypto finding: emit immediately so graph appears right away!
      // 2. Incremental real findings: emit when new findings arrived and at least ~200ms elapsed
      // 3. Force: emit at end of a phase if there are new un-emitted findings
      if (isFirstFinding || (hasNewFindings && (force || timeElapsed >= 200))) {
        lastEmittedCount = findings.length;
        lastEmittedTime = now;
        const partialCbom = this.buildCycloneDxCbom(displayLocation, [...findings], totalBytes);
        await onProgress(partialCbom, {
          assetCount: findings.length,
          scannedBytes: Math.min(totalBytes, Math.max(1, Math.round((findings.length / (findings.length + 5)) * totalBytes))),
          totalBytes
        });
        // Pacing yield: allows Express server to process incoming /cbom and /status requests
        // and gives the user's browser the 250ms polling window to render the growing graph
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    const recordFinding = async (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => {
      findings.push({
        name: sig.name,
        primitive: sig.primitive,
        assetType: sig.assetType || 'algorithm',
        oid: sig.oid,
        cryptoFunctions: sig.cryptoFunctions,
        parameterSetIdentifier: sig.parameterSetIdentifier,
        curve: sig.curve,
        mode: sig.mode,
        padding: sig.padding,
        nistQuantumSecurityLevel: sig.nistQuantumSecurityLevel,
        offset: Math.max(0, offset),
        matchedText: matchedText.substring(0, 100),
        section,
        sourceType
      });
      detectedNames.add(sig.name);
      await emitProgress();
    };

    // 1. Detect format & parse structural symbols/imports/exports safely
    if (this.isJarOrZip(buffer)) {
      console.log(`[BinaryScanner] Detected JAR/ZIP archive: ${displayLocation}`);
      await this.scanJarArchive(binaryPath, recordFinding);
    } else if (this.isPe(buffer)) {
      console.log(`[BinaryScanner] Detected Windows PE binary (EXE/DLL): ${displayLocation}`);
      await this.scanPeBinary(buffer, recordFinding);
    } else if (this.isElf(buffer)) {
      console.log(`[BinaryScanner] Detected Linux ELF binary: ${displayLocation}`);
      await this.scanElfBinary(buffer, recordFinding);
    } else if (this.isMachO(buffer)) {
      console.log(`[BinaryScanner] Detected macOS Mach-O binary: ${displayLocation}`);
      await this.scanMachOBinary(buffer, recordFinding);
    }

    await emitProgress(true);

    // 2. Perform static string & pattern analysis across the binary buffer
    // Scan ASCII and UTF-16LE strings (common in Windows & Linux binaries)
    await this.scanBinaryStrings(buffer, recordFinding);

    await emitProgress(true);

    // 3. Assemble authentic CycloneDX 1.6 CBOM
    const cbom = this.buildCycloneDxCbom(displayLocation, findings, totalBytes);

    if (onProgress) {
      await onProgress(cbom, {
        assetCount: findings.length,
        scannedBytes: totalBytes,
        totalBytes
      });
    }

    return cbom;
  }

  /**
   * Scans a memory buffer using binary format parsers (ELF/PE/Mach-O) and string extraction.
   * Useful for static container scanning without touching disk.
   */
  public static async scanRawBuffer(
    buffer: Buffer,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ): Promise<void> {
    if (this.isElf(buffer)) {
      await this.scanElfBinary(buffer, recordFinding);
    } else if (this.isPe(buffer)) {
      await this.scanPeBinary(buffer, recordFinding);
    } else if (this.isMachO(buffer)) {
      await this.scanMachOBinary(buffer, recordFinding);
    }
    await this.scanBinaryStrings(buffer, recordFinding);
  }

  // ==========================================
  // Format Detection Helpers
  // ==========================================

  private static isJarOrZip(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  private static isPe(buffer: Buffer): boolean {
    if (buffer.length < 64) return false;
    // Check DOS MZ header
    if (buffer[0] !== 0x4D || buffer[1] !== 0x5A) return false;
    const peOffset = buffer.readUInt32LE(0x3C);
    if (peOffset + 4 > buffer.length) return false;
    // Check PE\0\0 signature
    return buffer[peOffset] === 0x50 && buffer[peOffset + 1] === 0x45 && buffer[peOffset + 2] === 0 && buffer[peOffset + 3] === 0;
  }

  private static isElf(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46;
  }

  private static isMachO(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    const magic = buffer.readUInt32BE(0);
    return magic === 0xFEEDFACE || magic === 0xFEEDFACF || magic === 0xCEFAEDFE || magic === 0xCFFAEDFE;
  }

  // ==========================================
  // PE Parser (Windows EXE / DLL)
  // ==========================================

  private static async scanPeBinary(
    buffer: Buffer,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ) {
    try {
      const peOffset = buffer.readUInt32LE(0x3C);
      const coffOffset = peOffset + 4;
      const numSections = buffer.readUInt16LE(coffOffset + 2);
      const sizeOfOptionalHeader = buffer.readUInt16LE(coffOffset + 16);
      const optHeaderOffset = coffOffset + 20;

      const optMagic = buffer.readUInt16LE(optHeaderOffset);
      const is64 = optMagic === 0x20B;

      // Section headers start immediately after optional header
      const sectionTableOffset = optHeaderOffset + sizeOfOptionalHeader;

      interface PeSection {
        name: string;
        vSize: number;
        vAddr: number;
        rawSize: number;
        rawPtr: number;
      }

      const sections: PeSection[] = [];
      for (let i = 0; i < numSections; i++) {
        const secOff = sectionTableOffset + i * 40;
        if (secOff + 40 > buffer.length) break;
        let secName = buffer.toString('utf8', secOff, secOff + 8).replace(/\0+$/, '');
        const vSize = buffer.readUInt32LE(secOff + 8);
        const vAddr = buffer.readUInt32LE(secOff + 12);
        const rawSize = buffer.readUInt32LE(secOff + 16);
        const rawPtr = buffer.readUInt32LE(secOff + 20);
        sections.push({ name: secName, vSize, vAddr, rawSize, rawPtr });
      }

      const rvaToOffset = (rva: number): number | null => {
        for (const sec of sections) {
          if (rva >= sec.vAddr && rva < sec.vAddr + Math.max(sec.vSize, sec.rawSize)) {
            return sec.rawPtr + (rva - sec.vAddr);
          }
        }
        return null;
      };

      // Import Table RVA is located at data directory index 1
      const dataDirOffset = optHeaderOffset + (is64 ? 112 : 96);
      if (dataDirOffset + 16 <= buffer.length) {
        const importRva = buffer.readUInt32LE(dataDirOffset + 8);
        const importSize = buffer.readUInt32LE(dataDirOffset + 12);

        if (importRva > 0 && importSize > 0) {
          const importFileOffset = rvaToOffset(importRva);
          if (importFileOffset && importFileOffset < buffer.length) {
            let descOff = importFileOffset;
            while (descOff + 20 <= buffer.length) {
              const origFirstThunk = buffer.readUInt32LE(descOff);
              const nameRva = buffer.readUInt32LE(descOff + 12);
              const firstThunk = buffer.readUInt32LE(descOff + 16);

              if (origFirstThunk === 0 && nameRva === 0 && firstThunk === 0) break; // NULL descriptor termination

              const nameOffset = rvaToOffset(nameRva);
              let dllName = '';
              if (nameOffset && nameOffset < buffer.length) {
                let end = nameOffset;
                while (end < buffer.length && buffer[end] !== 0) end++;
                dllName = buffer.toString('ascii', nameOffset, end);
              }

              // Match known crypto DLL imports
              const thunkRva = origFirstThunk || firstThunk;
              const thunkFileOffset = rvaToOffset(thunkRva);
              if (thunkFileOffset && thunkFileOffset < buffer.length) {
                let entryOff = thunkFileOffset;
                const ptrSize = is64 ? 8 : 4;
                while (entryOff + ptrSize <= buffer.length) {
                  const entryVal = is64 ? Number(buffer.readBigUInt64LE(entryOff)) : buffer.readUInt32LE(entryOff);
                  if (entryVal === 0) break;

                  // If not an ordinal import (high bit not set)
                  const isOrdinal = is64 ? (entryVal & 0x8000000000000000) !== 0 : (entryVal & 0x80000000) !== 0;
                  if (!isOrdinal) {
                    const hintNameOff = rvaToOffset(entryVal);
                    if (hintNameOff && hintNameOff + 2 < buffer.length) {
                      let strEnd = hintNameOff + 2;
                      while (strEnd < buffer.length && buffer[strEnd] !== 0) strEnd++;
                      const importedFunc = buffer.toString('ascii', hintNameOff + 2, strEnd);

                      await this.matchTextAgainstSignatures(importedFunc, hintNameOff + 2, 'import', `.idata (${dllName})`, recordFinding);
                    }
                  }
                  entryOff += ptrSize;
                }
              }

              descOff += 20;
            }
          }
        }
      }

      // Export Table RVA is located at data directory index 0
      if (dataDirOffset + 8 <= buffer.length) {
        const exportRva = buffer.readUInt32LE(dataDirOffset);
        const exportSize = buffer.readUInt32LE(dataDirOffset + 4);
        if (exportRva > 0 && exportSize > 0) {
          const exportFileOffset = rvaToOffset(exportRva);
          if (exportFileOffset && exportFileOffset + 40 <= buffer.length) {
            const numNames = buffer.readUInt32LE(exportFileOffset + 24);
            const namesRva = buffer.readUInt32LE(exportFileOffset + 32);
            const namesFileOffset = rvaToOffset(namesRva);

            if (namesFileOffset && namesFileOffset < buffer.length) {
              for (let n = 0; n < Math.min(numNames, 5000); n++) {
                const namePtrRva = buffer.readUInt32LE(namesFileOffset + n * 4);
                const nameOff = rvaToOffset(namePtrRva);
                if (nameOff && nameOff < buffer.length) {
                  let end = nameOff;
                  while (end < buffer.length && buffer[end] !== 0) end++;
                  const exportedFunc = buffer.toString('ascii', nameOff, end);
                  await this.matchTextAgainstSignatures(exportedFunc, nameOff, 'export', '.edata', recordFinding);
                }
              }
            }
          }
        }
      }
    } catch (peErr) {
      console.warn('[BinaryScanner] Non-fatal PE parse warning:', (peErr as Error).message);
    }
  }

  // ==========================================
  // ELF Parser (Linux Binaries and .so)
  // ==========================================

  private static async scanElfBinary(
    buffer: Buffer,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ) {
    try {
      const is64 = buffer[4] === 2;
      const isLittle = buffer[5] === 1;

      const read16 = (off: number) => isLittle ? buffer.readUInt16LE(off) : buffer.readUInt16BE(off);
      const read32 = (off: number) => isLittle ? buffer.readUInt32LE(off) : buffer.readUInt32BE(off);
      const read64 = (off: number) => {
        const big = isLittle ? buffer.readBigUInt64LE(off) : buffer.readBigUInt64BE(off);
        return Number(big);
      };

      const shOff = is64 ? read64(40) : read32(32);
      const shEntSize = is64 ? read16(58) : read16(46);
      const shNum = is64 ? read16(60) : read16(48);
      const shStrNdx = is64 ? read16(62) : read16(50);

      if (shOff === 0 || shNum === 0 || shOff + shNum * shEntSize > buffer.length) {
        return;
      }

      interface ElfSection {
        name: string;
        type: number;
        offset: number;
        size: number;
        link: number;
      }

      const rawSections: { nameIdx: number; type: number; offset: number; size: number; link: number }[] = [];
      for (let i = 0; i < shNum; i++) {
        const off = shOff + i * shEntSize;
        const nameIdx = read32(off);
        const type = read32(off + 4);
        const offset = is64 ? read64(off + 24) : read32(off + 16);
        const size = is64 ? read64(off + 32) : read32(off + 20);
        const link = is64 ? read32(off + 40) : read32(off + 24);
        rawSections.push({ nameIdx, type, offset, size, link });
      }

      const strTabSection = rawSections[shStrNdx];
      const getShString = (idx: number): string => {
        if (!strTabSection || strTabSection.offset + idx >= buffer.length) return '';
        let end = strTabSection.offset + idx;
        while (end < buffer.length && buffer[end] !== 0) end++;
        return buffer.toString('utf8', strTabSection.offset + idx, end);
      };

      const sections: ElfSection[] = rawSections.map(s => ({
        name: getShString(s.nameIdx),
        type: s.type,
        offset: s.offset,
        size: s.size,
        link: s.link
      }));

      // Find symbol tables (.dynsym and .symtab)
      for (const sec of sections) {
        // SHT_SYMTAB = 2, SHT_DYNSYM = 11
        if (sec.type === 2 || sec.type === 11) {
          const linkedStrTab = sections[sec.link];
          if (!linkedStrTab) continue;

          const symEntSize = is64 ? 24 : 16;
          const symCount = Math.floor(sec.size / symEntSize);

          for (let s = 0; s < Math.min(symCount, 10000); s++) {
            const symOff = sec.offset + s * symEntSize;
            if (symOff + symEntSize > buffer.length) break;

            const stNameIdx = read32(symOff);
            if (stNameIdx === 0) continue;

            const strStart = linkedStrTab.offset + stNameIdx;
            if (strStart >= buffer.length) continue;

            let strEnd = strStart;
            while (strEnd < buffer.length && buffer[strEnd] !== 0) strEnd++;
            const symName = buffer.toString('utf8', strStart, strEnd);

            await this.matchTextAgainstSignatures(symName, symOff, 'symbol', sec.name, recordFinding);
          }
        }
      }
    } catch (elfErr) {
      console.warn('[BinaryScanner] Non-fatal ELF parse warning:', (elfErr as Error).message);
    }
  }

  // ==========================================
  // Mach-O Parser (macOS Binaries)
  // ==========================================

  private static async scanMachOBinary(
    buffer: Buffer,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ) {
    try {
      const magic = buffer.readUInt32BE(0);
      const is64 = magic === 0xFEEDFACF || magic === 0xCFFAEDFE;
      const isLittle = magic === 0xCEFAEDFE || magic === 0xCFFAEDFE;

      const read32 = (off: number) => isLittle ? buffer.readUInt32LE(off) : buffer.readUInt32BE(off);
      const ncmds = read32(16);

      let cmdOffset = is64 ? 32 : 28;
      for (let i = 0; i < Math.min(ncmds, 128); i++) {
        if (cmdOffset + 8 > buffer.length) break;
        const cmd = read32(cmdOffset);
        const cmdSize = read32(cmdOffset + 4);

        // LC_LOAD_DYLIB = 0xC, LC_LOAD_WEAK_DYLIB = 0x80000018
        if (cmd === 0x0C || cmd === 0x80000018) {
          const strOffset = read32(cmdOffset + 8);
          const libStart = cmdOffset + strOffset;
          if (libStart < buffer.length) {
            let libEnd = libStart;
            while (libEnd < buffer.length && buffer[libEnd] !== 0) libEnd++;
            const dylibName = buffer.toString('utf8', libStart, libEnd);
            await this.matchTextAgainstSignatures(dylibName, libStart, 'import', 'LC_LOAD_DYLIB', recordFinding);
          }
        }

        // LC_SYMTAB = 0x02
        if (cmd === 0x02 && cmdOffset + 24 <= buffer.length) {
          const symOff = read32(cmdOffset + 8);
          const nsyms = read32(cmdOffset + 12);
          const stroff = read32(cmdOffset + 16);
          const nlistSize = is64 ? 16 : 12;

          for (let s = 0; s < Math.min(nsyms, 5000); s++) {
            const entryOff = symOff + s * nlistSize;
            if (entryOff + nlistSize > buffer.length) break;
            const strx = read32(entryOff);
            if (strx === 0) continue;
            const strStart = stroff + strx;
            if (strStart >= buffer.length) continue;
            let strEnd = strStart;
            while (strEnd < buffer.length && buffer[strEnd] !== 0) strEnd++;
            const symName = buffer.toString('utf8', strStart, strEnd).replace(/^_+/, '');
            await this.matchTextAgainstSignatures(symName, entryOff, 'symbol', 'LC_SYMTAB', recordFinding);
          }
        }

        cmdOffset += cmdSize;
      }
    } catch (machErr) {
      console.warn('[BinaryScanner] Non-fatal Mach-O parse warning:', (machErr as Error).message);
    }
  }

  // ==========================================
  // JAR / ZIP Parser (Java Bytecode Archives)
  // ==========================================

  private static async scanJarArchive(
    jarPath: string,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ) {
    try {
      const zip = new AdmZip(jarPath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName;

        if (entryName.endsWith('.class')) {
          const classData = entry.getData();
          await this.scanJavaClassConstantPool(classData, entryName, recordFinding);
        } else if (entryName.endsWith('.properties') || entryName.endsWith('.json') || entryName.endsWith('.xml') || entryName.endsWith('.mf')) {
          const text = entry.getData().toString('utf8');
          const lines = text.split(/\r?\n/);
          for (let idx = 0; idx < lines.length; idx++) {
            await this.matchTextAgainstSignatures(lines[idx], idx + 1, 'bytecode', entryName, recordFinding);
          }
        }
      }
    } catch (zipErr) {
      console.warn('[BinaryScanner] Non-fatal JAR parse warning:', (zipErr as Error).message);
    }
  }

  /**
   * Safely reads the constant pool of a compiled Java .class file
   * (Extracts CONSTANT_Utf8 items without executing JVM bytecode)
   */
  private static async scanJavaClassConstantPool(
    data: Buffer,
    className: string,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ) {
    try {
      if (data.length < 10) return;
      const magic = data.readUInt32BE(0);
      if (magic !== 0xCAFEBABE) return;

      const cpCount = data.readUInt16BE(8);
      let offset = 10;

      for (let i = 1; i < cpCount; i++) {
        if (offset >= data.length) break;
        const tag = data[offset++];
        switch (tag) {
          case 1: { // CONSTANT_Utf8
            if (offset + 2 > data.length) break;
            const strLen = data.readUInt16BE(offset);
            offset += 2;
            if (offset + strLen <= data.length) {
              const strVal = data.toString('utf8', offset, offset + strLen);
              await this.matchTextAgainstSignatures(strVal, offset, 'bytecode', className, recordFinding);
            }
            offset += strLen;
            break;
          }
          case 3: // CONSTANT_Integer
          case 4: // CONSTANT_Float
          case 9: // CONSTANT_Fieldref
          case 10: // CONSTANT_Methodref
          case 11: // CONSTANT_InterfaceMethodref
          case 12: // CONSTANT_NameAndType
          case 18: // CONSTANT_InvokeDynamic
            offset += 4;
            break;
          case 5: // CONSTANT_Long
          case 6: // CONSTANT_Double
            offset += 8;
            i++; // Long and Double take 2 constant pool slots
            break;
          case 7: // CONSTANT_Class
          case 8: // CONSTANT_String
          case 16: // CONSTANT_MethodType
          case 19: // CONSTANT_Module
          case 20: // CONSTANT_Package
            offset += 2;
            break;
          case 15: // CONSTANT_MethodHandle
            offset += 3;
            break;
          default:
            offset++;
            break;
        }
      }
    } catch {
      // Ignore truncated class format
    }
  }

  // ==========================================
  // Binary String & Pattern Scanner
  // ==========================================

  private static async scanBinaryStrings(
    buffer: Buffer,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ) {
    // 1. Scan ASCII strings of length >= 4
    let start = -1;
    let checkedCount = 0;
    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i];
      if (b >= 32 && b <= 126) {
        if (start === -1) start = i;
      } else {
        if (start !== -1) {
          const len = i - start;
          if (len >= 4 && len <= 200) {
            const str = buffer.toString('ascii', start, i);
            await this.matchTextAgainstSignatures(str, start, 'string', undefined, recordFinding);
            checkedCount++;
            if (checkedCount % 20000 === 0) {
              await new Promise(resolve => setImmediate(resolve));
            }
          }
          start = -1;
        }
      }
    }

    // 2. Scan UTF-16LE strings (Windows unicode format: char + \0)
    let u16Start = -1;
    for (let i = 0; i < buffer.length - 1; i += 2) {
      const b0 = buffer[i];
      const b1 = buffer[i + 1];
      if (b1 === 0 && b0 >= 32 && b0 <= 126) {
        if (u16Start === -1) u16Start = i;
      } else {
        if (u16Start !== -1) {
          const len = i - u16Start;
          if (len >= 8 && len <= 400) {
            const str = buffer.toString('utf16le', u16Start, i);
            await this.matchTextAgainstSignatures(str, u16Start, 'string', undefined, recordFinding);
            checkedCount++;
            if (checkedCount % 20000 === 0) {
              await new Promise(resolve => setImmediate(resolve));
            }
          }
          u16Start = -1;
        }
      }
    }
  }

  // ==========================================
  // Match Helper
  // ==========================================

  private static async matchTextAgainstSignatures(
    text: string,
    offset: number,
    sourceType: Finding['sourceType'],
    section: string | undefined,
    recordFinding: (sig: CryptoSignature, offset: number, matchedText: string, sourceType: Finding['sourceType'], section?: string) => Promise<void> | void
  ) {
    if (!text || text.length < 3) return;

    for (const sig of CRYPTO_SIGNATURES) {
      for (const pat of sig.patterns) {
        let matched = false;
        let matchStr = '';

        if (typeof pat === 'string') {
          if (text.includes(pat)) {
            matched = true;
            matchStr = pat;
          }
        } else {
          // RegExp
          const m = text.match(pat);
          if (m) {
            matched = true;
            matchStr = m[0];
          }
        }

        if (matched) {
          await recordFinding(sig, offset, matchStr || text, sourceType, section);
          break; // Found matching signature for this text token
        }
      }
    }
  }

  // ==========================================
  // CycloneDX CBOM Builder
  // ==========================================

  private static buildCycloneDxCbom(
    displayLocation: string,
    findings: Finding[],
    fileSize: number
  ): Cbom {
    // Group findings by unique algorithm name
    const grouped = new Map<string, { sig: Finding; occurrences: Occurrence[] }>();

    for (const f of findings) {
      let entry = grouped.get(f.name);
      if (!entry) {
        entry = { sig: f, occurrences: [] };
        grouped.set(f.name, entry);
      }

      const hexOffset = `0x${f.offset.toString(16).toUpperCase().padStart(8, '0')}`;
      let context = `Offset: ${hexOffset}`;
      if (f.section) {
        context += ` | Section: ${f.section}`;
      }
      context += ` | Source: ${f.sourceType.toUpperCase()}`;
      if (f.matchedText && f.matchedText !== f.name) {
        context += ` | Match: "${f.matchedText}"`;
      }

      // Keep up to 10 unique offset occurrences per algorithm to prevent ballooning
      if (entry.occurrences.length < 10) {
        const isDuplicateOffset = entry.occurrences.some(o => o.additionalContext?.includes(hexOffset));
        if (!isDuplicateOffset) {
          entry.occurrences.push({
            line: 1, // Single binary has no line numbers, byte offset is authoritative
            location: displayLocation,
            additionalContext: context
          });
        }
      }
    }

    const safeAppSlug = displayLocation.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const appRef = `application@${safeAppSlug}`;
    const components: Component[] = [];
    const dependsOn: string[] = [];

    for (const [name, { sig, occurrences }] of grouped.entries()) {
      const safeNameSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const bomRef = `crypto-asset@${safeNameSlug}`;
      dependsOn.push(bomRef);

      const component: Component = {
        name,
        type: "cryptographic-asset",
        "bom-ref": bomRef,
        evidence: {
          occurrences: occurrences.length > 0 ? occurrences : [
            {
              line: 1,
              location: displayLocation,
              additionalContext: `Byte Size: ${fileSize} bytes`
            }
          ]
        },
        cryptoProperties: {
          assetType: sig.assetType || "algorithm",
          oid: sig.oid,
          algorithmProperties: {
            primitive: sig.primitive,
            cryptoFunctions: sig.cryptoFunctions,
            parameterSetIdentifier: sig.parameterSetIdentifier,
            curve: sig.curve,
            mode: sig.mode,
            padding: sig.padding,
            nistQuantumSecurityLevel: sig.nistQuantumSecurityLevel
          }
        }
      };

      components.push(component);
    }

    return {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      serialNumber: "urn:uuid:" + randomUUID(),
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: {
          services: [
            {
              name: "BinaryScanner (ECDAT)",
              provider: { name: "CRYPTAVISTA" }
            }
          ]
        },
        component: {
          name: displayLocation,
          type: "application",
          "bom-ref": appRef
        }
      },
      components,
      dependencies: [
        {
          ref: appRef,
          dependsOn
        }
      ],
      scannedFiles: 1,
      scannedLines: Math.round(fileSize / 64) // Estimated line-equivalent for stats display
    };
  }
}
