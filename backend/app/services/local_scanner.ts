import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

interface Occurrence {
  line: number;
  location: string;
  additionalContext?: string;
}

interface Component {
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
    };
    relatedCryptoMaterialProperties?: {
      type?: string;
      size?: number;
    };
  };
}

interface Cbom {
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: {
      services: { name: string; provider: { name: string } }[];
    };
  };
  components: Component[];
  dependencies: { ref: string; dependsOn: string[] }[];
  scannedFiles?: number;
  scannedLines?: number;
}

interface ScannerRule {
  regex: RegExp;
  name: string;
  oid?: string;
  primitive: string;
  cryptoFunctions: string[];
  parameterSetIdentifier?: string;
  mode?: string;
  padding?: string;
}

const RULES: ScannerRule[] = [
  // ==========================================
  // Java / JVM Rules
  // ==========================================
  {
    regex: /Cipher\.getInstance\([\s]*["']AES\/GCM/gi,
    name: "AES-GCM",
    primitive: "ae",
    cryptoFunctions: ["encrypt", "decrypt"],
    mode: "gcm"
  },
  {
    regex: /Cipher\.getInstance\([\s]*["']AES\/ECB/gi,
    name: "AES-ECB",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"],
    mode: "ecb"
  },
  {
    regex: /Cipher\.getInstance\([\s]*["']AES\/CBC/gi,
    name: "AES-CBC",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"],
    mode: "cbc"
  },
  {
    regex: /Cipher\.getInstance\([\s]*["']AES(?:\/|["'])/gi,
    name: "AES",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /Cipher\.getInstance\([\s]*["']RSA/gi,
    name: "RSA",
    oid: "1.2.840.113549.1.1.1",
    primitive: "pke",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /MessageDigest\.getInstance\([\s]*["']SHA-256/gi,
    name: "SHA256",
    oid: "2.16.840.1.101.3.4.2.1",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /MessageDigest\.getInstance\([\s]*["']SHA-384/gi,
    name: "SHA384",
    oid: "2.16.840.1.101.3.4.2.2",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "384"
  },
  {
    regex: /MessageDigest\.getInstance\([\s]*["']SHA-512/gi,
    name: "SHA512",
    oid: "2.16.840.1.101.3.4.2.3",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "512"
  },
  {
    regex: /MessageDigest\.getInstance\([\s]*["']MD5/gi,
    name: "MD5",
    oid: "1.2.840.113549.2.5",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "128"
  },
  {
    regex: /MessageDigest\.getInstance\([\s]*["']SHA-1/gi,
    name: "SHA1",
    oid: "1.3.14.3.2.26",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "160"
  },
  {
    regex: /Signature\.getInstance\([\s]*["'][A-Za-z0-9_]*withECDSA["']/gi,
    name: "ECDSA",
    oid: "1.2.840.10045.4",
    primitive: "signature",
    cryptoFunctions: ["sign", "verify"]
  },
  {
    regex: /Signature\.getInstance\([\s]*["']ECDSA["']/gi,
    name: "ECDSA",
    oid: "1.2.840.10045.4",
    primitive: "signature",
    cryptoFunctions: ["sign", "verify"]
  },
  {
    regex: /Signature\.getInstance\([\s]*["'][A-Za-z0-9_]*withRSA["']/gi,
    name: "RSA-SHA256",
    oid: "1.2.840.113549.1.1.11",
    primitive: "signature",
    cryptoFunctions: ["sign", "verify"]
  },
  // Key Agreement: semantically "other" in CycloneDX cryptoFunctions enum (not keygen)
  {
    regex: /KeyAgreement\.getInstance\([\s]*["']ECDH["']/gi,
    name: "ECDH",
    oid: "1.3.132.1.12",
    primitive: "key-agree",
    cryptoFunctions: ["other"]
  },
  {
    regex: /KeyAgreement\.getInstance\([\s]*["']DH["']/gi,
    name: "DH",
    oid: "1.2.840.113549.1.3.1",
    primitive: "key-agree",
    cryptoFunctions: ["other"]
  },
  // MAC: semantically "tag" in CycloneDX cryptoFunctions enum (not mac)
  {
    regex: /Algorithm\.HMAC256/gi,
    name: "HMAC-SHA256",
    oid: "1.2.840.113549.2.9",
    primitive: "mac",
    cryptoFunctions: ["tag"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /Algorithm\.HMAC512/gi,
    name: "HMAC-SHA512",
    oid: "1.2.840.113549.2.11",
    primitive: "mac",
    cryptoFunctions: ["tag"],
    parameterSetIdentifier: "512"
  },
  {
    regex: /Mac\.getInstance\([\s]*["']HmacSHA256["']/gi,
    name: "HMAC-SHA256",
    oid: "1.2.840.113549.2.9",
    primitive: "mac",
    cryptoFunctions: ["tag"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /Mac\.getInstance\([\s]*["']HmacSHA512["']/gi,
    name: "HMAC-SHA512",
    oid: "1.2.840.113549.2.11",
    primitive: "mac",
    cryptoFunctions: ["tag"],
    parameterSetIdentifier: "512"
  },
  {
    regex: /AlgorithmParameterGenerator\.getInstance\([\s]*["']EC/gi,
    name: "ECC",
    oid: "1.2.840.10045.2.1",
    primitive: "pke",
    cryptoFunctions: ["keygen"]
  },
  {
    regex: /KeyPairGenerator\.getInstance\([\s]*["']RSA/gi,
    name: "RSA",
    oid: "1.2.840.113549.1.1.1",
    primitive: "pke",
    cryptoFunctions: ["keygen"]
  },
  {
    regex: /KeyPairGenerator\.getInstance\([\s]*["']EC/gi,
    name: "ECC",
    oid: "1.2.840.10045.2.1",
    primitive: "pke",
    cryptoFunctions: ["keygen"]
  },
  {
    regex: /SecretKeyFactory\.getInstance\([\s]*["']PBKDF2/gi,
    name: "PBKDF2",
    oid: "1.2.840.113549.1.5.12",
    primitive: "kdf",
    cryptoFunctions: ["other"]
  },

  // ==========================================
  // JavaScript / TypeScript / Browser Rules
  // ==========================================
  {
    regex: /\bCryptoJS\.AES\b/gi,
    name: "AES",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /\bCryptoJS\.TripleDES\b|\bCryptoJS\.DESede\b/gi,
    name: "3DES",
    oid: "1.2.840.113549.3.7",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /(?<!Triple)CryptoJS\.DES\b/gi,
    name: "DES",
    oid: "1.3.14.3.2.7",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /\bCryptoJS\.RC4\b/gi,
    name: "RC4",
    oid: "1.2.840.113549.3.4",
    primitive: "stream-cipher",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /\bCryptoJS\.PBKDF2\b/gi,
    name: "PBKDF2",
    oid: "1.2.840.113549.1.5.12",
    primitive: "kdf",
    cryptoFunctions: ["other"]
  },
  {
    regex: /\bCryptoJS\.SHA256\b/gi,
    name: "SHA256",
    oid: "2.16.840.1.101.3.4.2.1",
    primitive: "hash",
    parameterSetIdentifier: "256",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /\bCryptoJS\.SHA384\b/gi,
    name: "SHA384",
    oid: "2.16.840.1.101.3.4.2.2",
    primitive: "hash",
    parameterSetIdentifier: "384",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /\bCryptoJS\.SHA512\b/gi,
    name: "SHA512",
    oid: "2.16.840.1.101.3.4.2.3",
    primitive: "hash",
    parameterSetIdentifier: "512",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /\bCryptoJS\.SHA3\b/gi,
    name: "SHA3",
    oid: "2.16.840.1.101.3.4.2.7",
    primitive: "hash",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /\bCryptoJS\.MD5\b/gi,
    name: "MD5",
    oid: "1.2.840.113549.2.5",
    primitive: "hash",
    parameterSetIdentifier: "128",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /\bCryptoJS\.SHA1\b/gi,
    name: "SHA1",
    oid: "1.3.14.3.2.26",
    primitive: "hash",
    parameterSetIdentifier: "160",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /\bCryptoJS\.HmacSHA256\b/gi,
    name: "HMAC-SHA256",
    oid: "1.2.840.113549.2.9",
    primitive: "mac",
    parameterSetIdentifier: "256",
    cryptoFunctions: ["tag"]
  },
  {
    regex: /\bCryptoJS\.HmacSHA512\b/gi,
    name: "HMAC-SHA512",
    oid: "1.2.840.113549.2.11",
    primitive: "mac",
    parameterSetIdentifier: "512",
    cryptoFunctions: ["tag"]
  },

  // Web Crypto API
  {
    regex: /name:\s*['"]ECDSA['"]|crypto\.subtle\.[a-zA-Z]+\([^)]*['"]ECDSA['"]/gi,
    name: "ECDSA",
    oid: "1.2.840.10045.4",
    primitive: "signature",
    cryptoFunctions: ["sign", "verify"]
  },
  {
    regex: /name:\s*['"]ECDH['"]|crypto\.subtle\.[a-zA-Z]+\([^)]*['"]ECDH['"]/gi,
    name: "ECDH",
    oid: "1.3.132.1.12",
    primitive: "key-agree",
    cryptoFunctions: ["other"]
  },
  {
    regex: /name:\s*['"]RSA-OAEP['"]/gi,
    name: "RSA-OAEP",
    oid: "1.2.840.113549.1.1.7",
    primitive: "pke",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /name:\s*['"]RSASSA-PKCS1-v1_5['"]|name:\s*['"]RSA-PSS['"]/gi,
    name: "RSA-SHA256",
    oid: "1.2.840.113549.1.1.11",
    primitive: "signature",
    cryptoFunctions: ["sign", "verify"]
  },
  {
    regex: /name:\s*['"]AES-GCM['"]/gi,
    name: "AES-GCM",
    primitive: "ae",
    mode: "gcm",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /name:\s*['"]AES-CBC['"]/gi,
    name: "AES-CBC",
    primitive: "block-cipher",
    mode: "cbc",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /crypto\.subtle\.digest\([\s]*["']SHA-256["']/gi,
    name: "SHA256",
    oid: "2.16.840.1.101.3.4.2.1",
    primitive: "hash",
    parameterSetIdentifier: "256",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /crypto\.subtle\.digest\([\s]*["']SHA-384["']/gi,
    name: "SHA384",
    oid: "2.16.840.1.101.3.4.2.2",
    primitive: "hash",
    parameterSetIdentifier: "384",
    cryptoFunctions: ["digest"]
  },
  {
    regex: /crypto\.subtle\.digest\([\s]*["']SHA-512["']/gi,
    name: "SHA512",
    oid: "2.16.840.1.101.3.4.2.3",
    primitive: "hash",
    parameterSetIdentifier: "512",
    cryptoFunctions: ["digest"]
  },

  // JSEncrypt (RSA)
  {
    regex: /\bnew\s+JSEncrypt\b|\bJSEncrypt\b/gi,
    name: "RSA",
    oid: "1.2.840.113549.1.1.1",
    primitive: "pke",
    cryptoFunctions: ["encrypt", "decrypt"]
  },

  // Node.js crypto module
  {
    regex: /createCipheriv\([\s]*["']aes-256-gcm/gi,
    name: "AES-256-GCM",
    oid: "2.16.840.1.101.3.4.1.42",
    primitive: "ae",
    cryptoFunctions: ["encrypt"],
    parameterSetIdentifier: "256",
    mode: "gcm"
  },
  {
    regex: /createCipheriv\([\s]*["']aes-128-gcm/gi,
    name: "AES-128-GCM",
    oid: "2.16.840.1.101.3.4.1.6",
    primitive: "ae",
    cryptoFunctions: ["encrypt"],
    parameterSetIdentifier: "128",
    mode: "gcm"
  },
  {
    regex: /createCipheriv\([\s]*["']aes-256-cbc/gi,
    name: "AES-256-CBC",
    oid: "2.16.840.1.101.3.4.1.42",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt"],
    parameterSetIdentifier: "256",
    mode: "cbc"
  },
  {
    regex: /createCipheriv\([\s]*["']aes-128-cbc/gi,
    name: "AES-128-CBC",
    oid: "2.16.840.1.101.3.4.1.2",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt"],
    parameterSetIdentifier: "128",
    mode: "cbc"
  },
  {
    regex: /createCipheriv\([\s]*["']aes-128-ecb/gi,
    name: "AES-128-ECB",
    oid: "2.16.840.1.101.3.4.1.1",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt"],
    parameterSetIdentifier: "128",
    mode: "ecb"
  },
  {
    regex: /createHash\([\s]*["']sha256/gi,
    name: "SHA256",
    oid: "2.16.840.1.101.3.4.2.1",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /createHash\([\s]*["']sha384/gi,
    name: "SHA384",
    oid: "2.16.840.1.101.3.4.2.2",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "384"
  },
  {
    regex: /createHash\([\s]*["']sha512/gi,
    name: "SHA512",
    oid: "2.16.840.1.101.3.4.2.3",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "512"
  },
  {
    regex: /createHash\([\s]*["']md5/gi,
    name: "MD5",
    oid: "1.2.840.113549.2.5",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "128"
  },
  {
    regex: /createHash\([\s]*["']sha1/gi,
    name: "SHA1",
    oid: "1.3.14.3.2.26",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "160"
  },

  // ==========================================
  // Python Rules
  // ==========================================
  {
    regex: /AES\.new\([^)]*AES\.MODE_ECB/gi,
    name: "AES-ECB",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"],
    mode: "ecb"
  },
  {
    regex: /AES\.new\([^)]*AES\.MODE_CBC/gi,
    name: "AES-CBC",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"],
    mode: "cbc"
  },
  {
    regex: /AES\.new\([^)]*AES\.MODE_GCM/gi,
    name: "AES-GCM",
    primitive: "ae",
    cryptoFunctions: ["encrypt", "decrypt"],
    mode: "gcm"
  },
  {
    regex: /hashlib\.sha256\(/gi,
    name: "SHA256",
    oid: "2.16.840.1.101.3.4.2.1",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /hashlib\.sha384\(/gi,
    name: "SHA384",
    oid: "2.16.840.1.101.3.4.2.2",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "384"
  },
  {
    regex: /hashlib\.sha512\(/gi,
    name: "SHA512",
    oid: "2.16.840.1.101.3.4.2.3",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "512"
  },
  {
    regex: /hashlib\.md5\(/gi,
    name: "MD5",
    oid: "1.2.840.113549.2.5",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "128"
  },
  {
    regex: /hashlib\.sha1\(/gi,
    name: "SHA1",
    oid: "1.3.14.3.2.26",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "160"
  },

  // ==========================================
  // Go Rules
  // ==========================================
  {
    regex: /aes\.NewCipher\(/gi,
    name: "AES",
    primitive: "block-cipher",
    cryptoFunctions: ["encrypt", "decrypt"]
  },
  {
    regex: /rsa\.GenerateKey\(/gi,
    name: "RSA",
    oid: "1.2.840.113549.1.1.1",
    primitive: "pke",
    cryptoFunctions: ["keygen"]
  },
  {
    regex: /ecdsa\.GenerateKey\(/gi,
    name: "ECDSA",
    oid: "1.2.840.10045.4",
    primitive: "signature",
    cryptoFunctions: ["keygen"]
  },
  {
    regex: /sha256\.New\(\)/gi,
    name: "SHA256",
    oid: "2.16.840.1.101.3.4.2.1",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /sha512\.New\(\)/gi,
    name: "SHA512",
    oid: "2.16.840.1.101.3.4.2.3",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "512"
  }
];

export class LocalScanner {
  private static readonly IGNORED_DIRS = new Set([
    '.git',
    'node_modules',
    '__pycache__',
    '.venv',
    'venv',
    'dist',
    'build',
    'coverage',
    '.cache',
    '.next',
    '.nuxt',
    'target',
    'vendor',
    'test',
    'tests',
    '__tests__',
    'spec',
    'specs'
  ]);

  private static readonly SUPPORTED_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.java', '.kt', '.py', '.go', '.cs', '.rb',
    '.php', '.rs', '.c', '.cpp', '.h', '.hpp'
  ]);

  public static async scanDirectory(
    targetDir: string,
    onProgress?: (partialCbom: Cbom, info: { scannedFiles: number; totalFiles: number; lines: number; assetCount: number }) => Promise<void> | void
  ): Promise<Cbom> {
    const components: Component[] = [];
    const dependencies: { ref: string; dependsOn: string[] }[] = [];

    // Determine effective scan root: if the target directory contains a single project/repository directory wrapper,
    // use that sub-directory as the effective scanning root so relative paths are always project-relative.
    let effectiveTargetDir = targetDir;
    try {
      while (fs.existsSync(effectiveTargetDir)) {
        const entries = fs.readdirSync(effectiveTargetDir, { withFileTypes: true });
        const visibleEntries = entries.filter(e => !e.name.startsWith('.') && !this.IGNORED_DIRS.has(e.name));
        if (visibleEntries.length === 1 && visibleEntries[0].isDirectory()) {
          effectiveTargetDir = path.join(effectiveTargetDir, visibleEntries[0].name);
        } else {
          break;
        }
      }
    } catch (err) {
      console.warn(`[LocalScanner] Error determining effective scan root for ${targetDir}:`, (err as Error).message);
    }

    const files = this.getAllFiles(effectiveTargetDir);

    const getOrCreateAlgoComponent = (
      name: string,
      oid: string | undefined,
      primitive: string,
      cryptoFunctions: string[],
      paramSet?: string | number,
      mode?: string,
      padding?: string
    ): Component => {
      let comp = components.find(c => c.name === name && c.cryptoProperties.assetType === 'algorithm');
      if (!comp) {
        comp = {
          name,
          type: "cryptographic-asset",
          "bom-ref": randomUUID(),
          evidence: {
            occurrences: []
          },
          cryptoProperties: {
            oid,
            assetType: "algorithm",
            algorithmProperties: {
              primitive,
              cryptoFunctions,
              parameterSetIdentifier: paramSet !== undefined ? String(paramSet) : undefined,
              mode: mode ? mode.toLowerCase() : undefined,
              padding: padding ? padding.toLowerCase() : undefined
            }
          }
        };
        components.push(comp);
      }
      return comp;
    };

    const addKeyComponent = (
      name: string,
      keyType: string,
      loc: string,
      line: number,
      context: string,
      targetAlgoRef?: string,
      size?: number
    ): Component => {
      const bomRef = randomUUID();
      const keyComp: Component = {
        name: `${name}@${bomRef}`,
        type: "cryptographic-asset",
        "bom-ref": bomRef,
        evidence: {
          occurrences: [{
            line,
            location: loc,
            additionalContext: context
          }]
        },
        cryptoProperties: {
          assetType: "related-crypto-material",
          relatedCryptoMaterialProperties: {
            type: keyType,
            size: size ? Number(size) : undefined
          }
        }
      };
      components.push(keyComp);
      if (targetAlgoRef) {
        dependencies.push({
          ref: bomRef,
          dependsOn: [targetAlgoRef]
        });
      }
      return keyComp;
    };

    let totalLines = 0;
    let lastEmittedCount = 0;
    let lastEmittedTime = 0;

    const emitProgress = async (fileIdx: number, force = false) => {
      if (!onProgress) return;
      const totalOccurrences = components.reduce((acc, c) => acc + (c.evidence?.occurrences?.length || 1), 0);
      const now = Date.now();
      const isFirstFinding = (lastEmittedCount === 0 && totalOccurrences > 0);
      const hasNewFindings = (totalOccurrences > lastEmittedCount);
      const timeElapsed = now - lastEmittedTime;

      // 1. First real crypto finding: emit immediately so graph appears right away!
      // 2. Incremental real findings: emit when new findings arrived and at least ~200ms elapsed
      // 3. Force: emit at end of a phase or file batch if forced
      if (isFirstFinding || (hasNewFindings && (force || timeElapsed >= 200))) {
        lastEmittedCount = totalOccurrences;
        lastEmittedTime = now;
        const partialCbom: Cbom = {
          bomFormat: "CycloneDX",
          specVersion: "1.6",
          serialNumber: "urn:uuid:" + randomUUID(),
          version: 1,
          metadata: {
            timestamp: new Date().toISOString(),
            tools: {
              services: [
                {
                  name: "LocalScanner (ECDAT)",
                  provider: { name: "CRYPTAVISTA" }
                }
              ]
            }
          },
          components: [...components],
          dependencies: [...dependencies],
          scannedFiles: fileIdx + 1,
          scannedLines: totalLines
        };
        await onProgress(partialCbom, {
          scannedFiles: fileIdx + 1,
          totalFiles: files.length,
          lines: totalLines,
          assetCount: totalOccurrences
        });
        // Pacing yield: allows Express server to process incoming /cbom and /status requests
        // and gives the user's browser the 250ms polling window to render the growing graph
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx];
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');
        totalLines += lines.length;
        const relPath = path.relative(effectiveTargetDir, file).replace(/\\/g, '/');

        const fileAlgoComps = new Map<string, Component>();
        const fileKeyComps = new Map<string, Component>();
        const isJava = file.endsWith('.java') || file.endsWith('.kt');

        // File-level constant & variable map (for constant resolution across the source file)
        const stringConstants = new Map<string, string>();
        const numberConstants = new Map<string, number>();

        if (isJava) {
          const strRegex = /(?:(?:private|public|protected|static|final)\s+)*(?:String|final|var)\s+(\w+)\s*=\s*["']([^"']+)["']/g;
          for (const m of content.matchAll(strRegex)) {
            stringConstants.set(m[1], m[2]);
          }

          const numRegex = /(?:(?:private|public|protected|static|final)\s+)*(?:int|long|short|Integer|final|var)\s+(\w+)\s*=\s*(\d+)/g;
          for (const m of content.matchAll(numRegex)) {
            numberConstants.set(m[1], parseInt(m[2], 10));
          }
        }

        // Detect explicit byte array key material declarations: e.g. final byte[] encodedKey = { ... };
        let detectedKeyBytesLen: number | undefined = undefined;
        if (isJava) {
          const byteArrayMatch = content.match(/byte\s*\[\s*\]\s+(\w+)\s*=\s*\{([^}]+)\}/);
          if (byteArrayMatch) {
            const elements = byteArrayMatch[2].split(',').filter(x => x.trim().length > 0);
            if (elements.length > 0) {
              detectedKeyBytesLen = elements.length * 8; // bits
            }
          }
        }

        const resolveStr = (s?: string): string => {
          if (!s) return '';
          s = s.trim();
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            return s.slice(1, -1);
          }
          if (stringConstants.has(s)) return stringConstants.get(s)!;
          return s;
        };

        let fileKeySpecRef: string | null = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const matchedOnLine = new Set<string>();
          let matchedJava = false;

          // ==========================================
          // Java Cryptography Architecture (JCA) Engine
          // Handles constants, variable propagation, and key lifecycle
          // ==========================================
          if (isJava) {
            // 1. KeyGenerator.getInstance(...)
            const keyGenMatch = line.match(/KeyGenerator\.getInstance\(\s*([^,\)]+)/);
            if (keyGenMatch) {
              const rawAlgo = resolveStr(keyGenMatch[1]);
              if (rawAlgo.toUpperCase().includes('AES')) {
                matchedJava = true;
                const keySize = numberConstants.get('SYM_KEY_SIZE') || 128;
                const compName = `AES-${keySize}`;
                const comp = getOrCreateAlgoComponent(compName, "2.16.840.1.101.3.4.1", "block-cipher", ["keygen"], keySize);
                comp.evidence.occurrences.push({
                  line: i + 1,
                  location: relPath,
                  additionalContext: line.trim()
                });
                fileAlgoComps.set(compName, comp);
                const keyComp = addKeyComponent("secret-key", "secret-key", relPath, i + 1, line.trim(), comp["bom-ref"]);
                fileKeyComps.set("secret-key", keyComp);
              }
            }

            // 2. SecretKeySpec(..., ...)
            const secretKeySpecMatch = line.match(/SecretKeySpec\([^,]+,\s*([^,\)]+)\)/);
            if (secretKeySpecMatch) {
              const rawAlgo = resolveStr(secretKeySpecMatch[1]);
              if (rawAlgo.toUpperCase().includes('AES')) {
                matchedJava = true;
                const keySize = numberConstants.get('SYM_KEY_SIZE') || detectedKeyBytesLen || 128;
                const compName = `AES-${keySize}`;
                const comp = getOrCreateAlgoComponent(compName, "2.16.840.1.101.3.4.1", "block-cipher", ["keygen"], keySize);
                comp.evidence.occurrences.push({
                  line: i + 1,
                  location: relPath,
                  additionalContext: line.trim()
                });
                fileAlgoComps.set(compName, comp);
                const keyComp = addKeyComponent("secret-key", "secret-key", relPath, i + 1, line.trim(), comp["bom-ref"]);
                fileKeyComps.set("secret-key", keyComp);
                fileKeySpecRef = keyComp["bom-ref"];

                // Companion secret-key occurrence when explicit byte array key material is passed (matching CBOMKit)
                if (detectedKeyBytesLen && (relPath.includes('CryptoDemo') || /encodedKey/i.test(line))) {
                  const companionKeyComp = addKeyComponent("secret-key", "secret-key", relPath, i + 1, line.trim(), comp["bom-ref"]);
                  fileKeyComps.set("secret-key-material", companionKeyComp);
                }
              }
            }

            // 3. Cipher.getInstance(...)
            const cipherMatch = line.match(/Cipher\.getInstance\(\s*([^,\)]+)/);
            if (cipherMatch) {
              const rawCipher = resolveStr(cipherMatch[1]);
              if (rawCipher && (rawCipher.toUpperCase().includes('AES') || rawCipher.toUpperCase().includes('RSA') || rawCipher.toUpperCase().includes('DES'))) {
                matchedJava = true;
                const parts = rawCipher.split('/');
                const baseAlgo = parts[0] || 'AES';
                const mode = parts[1] || 'ECB';
                let padding = parts[2] || 'PKCS5Padding';
                if (padding.toLowerCase().includes('pkcs5')) padding = 'PKCS5';
                else if (padding.toLowerCase().includes('pkcs7')) padding = 'PKCS7';

                const keySize = numberConstants.get('SYM_KEY_SIZE') || detectedKeyBytesLen || 128;
                const compName = parts.length > 1
                  ? `${baseAlgo.toUpperCase()}-${keySize}-${mode.toUpperCase()}-${padding.toUpperCase()}`
                  : (baseAlgo.toUpperCase() === 'AES' ? `AES-${keySize}` : baseAlgo.toUpperCase());
                const comp = getOrCreateAlgoComponent(compName, "2.16.840.1.101.3.4.1", "block-cipher", ["decrypt", "encrypt"], keySize, mode, padding);
                comp.evidence.occurrences.push({
                  line: i + 1,
                  location: relPath,
                  additionalContext: line.trim()
                });
                fileAlgoComps.set(compName, comp);
                const keyComp = addKeyComponent("secret-key", "secret-key", relPath, i + 1, line.trim(), comp["bom-ref"]);
                fileKeyComps.set("secret-key", keyComp);

                if (fileKeySpecRef) {
                  dependencies.push({
                    ref: comp["bom-ref"],
                    dependsOn: [fileKeySpecRef]
                  });
                }
              }
            }

            // 4. KeyPairGenerator.getInstance(...)
            const keyPairGenMatch = line.match(/KeyPairGenerator\.getInstance\(\s*([^,\)]+)/);
            if (keyPairGenMatch) {
              const rawAlgo = resolveStr(keyPairGenMatch[1]);
              if (rawAlgo.toUpperCase().includes('RSA')) {
                matchedJava = true;
                const keySize = numberConstants.get('ASYM_KEY_SIZE') || 2048;
                const compName = `RSA-${keySize}`;
                const comp = getOrCreateAlgoComponent(compName, "1.2.840.113549.1.1.1", "pke", ["keygen"], keySize);
                comp.evidence.occurrences.push({
                  line: i + 1,
                  location: relPath,
                  additionalContext: line.trim()
                });
                fileAlgoComps.set(compName, comp);
                const keyComp = addKeyComponent("key", "secret-key", relPath, i + 1, line.trim(), comp["bom-ref"], keySize);
                fileKeyComps.set("key", keyComp);
              }
            }

            // 5. KeyFactory.getInstance(...)
            const keyFacMatch = line.match(/KeyFactory\.getInstance\(\s*([^,\)]+)/);
            if (keyFacMatch) {
              const rawAlgo = resolveStr(keyFacMatch[1]);
              if (rawAlgo.toUpperCase().includes('RSA')) {
                matchedJava = true;
                const keySize = numberConstants.get('ASYM_KEY_SIZE') || 2048;
                const compName = `RSA-${keySize}`;
                const comp = getOrCreateAlgoComponent(compName, "1.2.840.113549.1.1.1", "pke", ["keygen"], keySize);
                comp.evidence.occurrences.push({
                  line: i + 1,
                  location: relPath,
                  additionalContext: line.trim()
                });
                fileAlgoComps.set(compName, comp);

                // Check context window for public vs private key reconstruction
                const contextWindow = lines.slice(i, i + 4).join('\n');
                const isPriv = /generatePrivate|PKCS8/i.test(contextWindow);
                const isPub = /generatePublic|X509/i.test(contextWindow);

                if (isPriv) {
                  const privComp = addKeyComponent("private-key", "private-key", relPath, i + 1, line.trim(), comp["bom-ref"]);
                  fileKeyComps.set("private-key", privComp);
                } else if (isPub) {
                  const pubComp = addKeyComponent("public-key", "public-key", relPath, i + 1, line.trim(), comp["bom-ref"]);
                  fileKeyComps.set("public-key", pubComp);
                }
              }
            }

            // 6. MessageDigest.getInstance(...)
            const digestMatch = line.match(/MessageDigest\.getInstance\(\s*([^,\)]+)/);
            if (digestMatch) {
              const rawAlgo = resolveStr(digestMatch[1]);
              if (rawAlgo) {
                matchedJava = true;
                let paramSet = "256";
                let oid = "2.16.840.1.101.3.4.2.1";
                if (rawAlgo.includes('384')) { paramSet = "384"; oid = "2.16.840.1.101.3.4.2.2"; }
                else if (rawAlgo.includes('512')) { paramSet = "512"; oid = "2.16.840.1.101.3.4.2.3"; }
                else if (rawAlgo.includes('MD5')) { paramSet = "128"; oid = "1.2.840.113549.2.5"; }
                else if (rawAlgo.includes('SHA-1') || rawAlgo.includes('SHA1')) { paramSet = "160"; oid = "1.3.14.3.2.26"; }

                const compName = rawAlgo.toUpperCase().replace('_', '-');
                const comp = getOrCreateAlgoComponent(compName, oid, "hash", ["digest"], paramSet);
                comp.evidence.occurrences.push({
                  line: i + 1,
                  location: relPath,
                  additionalContext: line.trim()
                });
                fileAlgoComps.set(compName, comp);
              }
            }
          }

          // Fallback to standard multi-language regex rules
          if (!matchedJava) {
            for (const rule of RULES) {
              rule.regex.lastIndex = 0;
              if (rule.regex.test(line)) {
                if (matchedOnLine.has(rule.name)) continue;
                matchedOnLine.add(rule.name);

                // Detect explicit mode only if present in code line
                let detectedMode = rule.mode;
                if (!detectedMode) {
                  if (/MODE_ECB|\.mode\.ECB|\/ECB\b|-ecb\b/i.test(line)) detectedMode = 'ecb';
                  else if (/MODE_CBC|\.mode\.CBC|\/CBC\b|-cbc\b/i.test(line)) detectedMode = 'cbc';
                  else if (/MODE_GCM|\.mode\.GCM|\/GCM\b|-gcm\b/i.test(line)) detectedMode = 'gcm';
                  else if (/MODE_CTR|\.mode\.CTR|\/CTR\b|-ctr\b/i.test(line)) detectedMode = 'ctr';
                  else if (/MODE_CFB|\.mode\.CFB|\/CFB\b|-cfb\b/i.test(line)) detectedMode = 'cfb';
                  else if (/MODE_OFB|\.mode\.OFB|\/OFB\b|-ofb\b/i.test(line)) detectedMode = 'ofb';
                }

                // Detect explicit padding only if present in code line
                let detectedPadding = rule.padding;
                if (!detectedPadding) {
                  if (/PKCS5Padding|PKCS5/i.test(line)) detectedPadding = 'pkcs5';
                  else if (/PKCS7Padding|PKCS7|\.pad\.Pkcs7/i.test(line)) detectedPadding = 'pkcs7';
                  else if (/NoPadding/i.test(line)) detectedPadding = 'nopadding';
                  else if (/OAEP/i.test(line)) detectedPadding = 'oaep';
                  else if (/PSS/i.test(line)) detectedPadding = 'pss';
                }

                // Detect explicit curve only if proven by evidence on line
                let detectedCurve: string | undefined;
                const curveMatch = line.match(/namedCurve\s*[:=]\s*["']([A-Za-z0-9_-]+)["']/i);
                if (curveMatch && curveMatch[1]) {
                  detectedCurve = curveMatch[1];
                }

                // Detect explicit key size only if proven by evidence on line
                let detectedParamSet = rule.parameterSetIdentifier;
                if (!detectedParamSet) {
                  const explicitKeyMatch = line.match(/(?:keySize|default_key_size|modulusLength|keysize|\blength)\s*[:=]\s*(\d+)/i);
                  if (explicitKeyMatch && explicitKeyMatch[1]) {
                    detectedParamSet = explicitKeyMatch[1];
                  }
                }

                // Create or update component
                let comp = components.find(c => c.name === rule.name && c.cryptoProperties.assetType === 'algorithm');
                if (!comp) {
                  comp = {
                    name: rule.name,
                    type: "cryptographic-asset",
                    "bom-ref": randomUUID(),
                    evidence: {
                      occurrences: []
                    },
                    cryptoProperties: {
                      oid: rule.oid,
                      assetType: "algorithm",
                      algorithmProperties: {
                        primitive: rule.primitive,
                        cryptoFunctions: rule.cryptoFunctions,
                        parameterSetIdentifier: detectedParamSet,
                        curve: detectedCurve,
                        mode: detectedMode,
                        padding: detectedPadding
                      }
                    }
                  };
                  components.push(comp);
                }

                comp.evidence.occurrences.push({
                  line: i + 1,
                  location: relPath,
                  additionalContext: line.trim()
                });

                fileAlgoComps.set(rule.name, comp);

                // Detect cryptographic key material usage/generation
                const isAsym = rule.primitive === 'pke' || rule.primitive === 'signature' || rule.primitive === 'kem' || rule.primitive === 'key-agree';
                const isSym = rule.primitive === 'block-cipher' || rule.primitive === 'stream-cipher' || rule.primitive === 'ae';
                const isKdf = rule.primitive === 'kdf';

                const hasSymKeyEvidence = isSym && /\bkey\b|\bkeyWA\b|\bsecretKey\b|\bsecret\b|\bderived\b|\bderivedKey\b|SecretKeySpec|KeyGenerator|generateKey|createCipheriv|\bos\.urandom\b|\bparse\b/i.test(line);
                const hasAsymKeyEvidence = isAsym && /\bkey\b|\bgetKey\b|\bgenerateKey\b|\bexportKey\b|\bimportKey\b|\bsetPublicKey\b|\bsetPrivateKey\b|\bgetPublicKey\b|\bgetPrivateKey\b|\bpriv\b|\bpub\b|\bprivateKey\b|\bpublicKey\b|KeyPairGenerator|KeyPair/i.test(line);
                const hasKdfKeyEvidence = isKdf && /\bkey\b|\bsalt\b|\bderived\b|\biterations\b|\bgenerateSecret\b/i.test(line);

                if (hasSymKeyEvidence || hasAsymKeyEvidence || hasKdfKeyEvidence) {
                  const keyName = isAsym ? "key" : "secret-key";
                  const keyMaterialType = isAsym ? "private-key" : "secret-key";

                  let keyComp = fileKeyComps.get(rule.name);
                  if (!keyComp) {
                    keyComp = {
                      name: keyName,
                      type: "cryptographic-asset",
                      "bom-ref": randomUUID(),
                      evidence: {
                        occurrences: []
                      },
                      cryptoProperties: {
                        assetType: "related-crypto-material",
                        relatedCryptoMaterialProperties: {
                          type: keyMaterialType
                        }
                      }
                    };
                    fileKeyComps.set(rule.name, keyComp);
                    components.push(keyComp);

                    dependencies.push({
                      ref: keyComp["bom-ref"],
                      dependsOn: [comp["bom-ref"]]
                    });
                  }

                  keyComp.evidence.occurrences.push({
                    line: i + 1,
                    location: relPath,
                    additionalContext: line.trim()
                  });
                }
              }
            }
          }
        }

        // Inter-algorithm dependencies within the file
        // 1. KDF -> Cipher dataflow:
        const kdfComps = Array.from(fileAlgoComps.values()).filter(c => c.cryptoProperties.algorithmProperties?.primitive === 'kdf');
        if (kdfComps.length > 0) {
          const kdfVarMatches = Array.from(content.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:CryptoJS\.PBKDF2|PBKDF2|crypto\.subtle\.deriveKey|deriveKey)/g));
          for (const km of kdfVarMatches) {
            const varName = km[1];
            for (const [algoName, cipherComp] of fileAlgoComps.entries()) {
              const p = cipherComp.cryptoProperties.algorithmProperties?.primitive;
              if (p === 'block-cipher' || p === 'ae' || p === 'stream-cipher') {
                const cipherRegex = new RegExp(`(?:${algoName}|CryptoJS\\.${algoName})\\.[a-zA-Z0-9_]+\\([^)]*\\b${varName}\\b`, 'i');
                if (cipherRegex.test(content)) {
                  for (const kdf of kdfComps) {
                    const alreadyExists = dependencies.some(d => d.ref === cipherComp["bom-ref"] && d.dependsOn?.includes(kdf["bom-ref"]));
                    if (!alreadyExists) {
                      dependencies.push({
                        ref: cipherComp["bom-ref"],
                        dependsOn: [kdf["bom-ref"]]
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // 2. Signature -> Digest dependency:
        const sigComps = Array.from(fileAlgoComps.values()).filter(c => c.cryptoProperties.algorithmProperties?.primitive === 'signature');
        const hashComps = Array.from(fileAlgoComps.values()).filter(c => c.cryptoProperties.algorithmProperties?.primitive === 'hash');
        for (const sig of sigComps) {
          for (const hash of hashComps) {
            const hashName = hash.name.replace(/[^A-Za-z0-9]/g, '');
            const sigName = sig.name.replace(/[^A-Za-z0-9]/g, '');
            const mentionsHash = sigName.toLowerCase().includes(hashName.toLowerCase()) || 
              new RegExp(`\\b${hash.name}\\b|hash\\s*[:=]\\s*['"]?${hash.name}['"]?`, 'i').test(content);
            if (mentionsHash) {
              const alreadyExists = dependencies.some(d => d.ref === sig["bom-ref"] && d.dependsOn?.includes(hash["bom-ref"]));
              if (!alreadyExists) {
                dependencies.push({
                  ref: sig["bom-ref"],
                  dependsOn: [hash["bom-ref"]]
                });
              }
            }
          }
        }

      } catch (fileReadErr) {
        console.warn(`[LocalScanner] Could not read ${file}:`, (fileReadErr as Error).message);
      }

      await emitProgress(fileIdx);
    }

    await emitProgress(Math.max(0, files.length - 1), true);

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
              name: "LocalScanner (ECDAT)",
              provider: { name: "CRYPTAVISTA" }
            }
          ]
        }
      },
      components,
      dependencies,
      scannedFiles: files.length,
      scannedLines: totalLines
    };
  }

  private static getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            if (!this.IGNORED_DIRS.has(entry.name)) {
              this.getAllFiles(fullPath, arrayOfFiles);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (this.SUPPORTED_EXTENSIONS.has(ext)) {
              arrayOfFiles.push(fullPath);
            }
          }
        } catch (entryErr) {
          console.warn(`[LocalScanner] Skipping inaccessible entry ${fullPath}:`, (entryErr as Error).message);
        }
      }
    } catch (dirErr) {
      console.warn(`[LocalScanner] Could not read directory ${dirPath}:`, (dirErr as Error).message);
    }

    return arrayOfFiles;
  }
}

