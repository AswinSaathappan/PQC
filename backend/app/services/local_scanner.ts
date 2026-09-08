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
      mode?: string;
      padding?: string;
    };
  };
}

interface Cbom {
  bomFormat: string;
  specVersion: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: {
      services: { name: string; provider: { name: string } }[];
    };
  };
  components: Component[];
  dependencies: any[];
}

const RULES = [
  {
    regex: /Cipher\.getInstance\([\s]*["']AES\/GCM/gi,
    name: "AES-GCM",
    oid: "2.16.840.1.101.3.4.1",
    primitive: "ae",
    cryptoFunctions: ["encrypt", "decrypt"],
    parameterSetIdentifier: "256", // Guess
    mode: "gcm"
  },
  {
    regex: /Cipher\.getInstance\([\s]*["']RSA/gi,
    name: "RSA",
    oid: "1.2.840.113549.1.1.1",
    primitive: "pke",
    cryptoFunctions: ["encrypt", "decrypt"],
    parameterSetIdentifier: "2048" // Guess
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
    regex: /createHash\([\s]*["']sha256/gi,
    name: "SHA256",
    oid: "2.16.840.1.101.3.4.2.1",
    primitive: "hash",
    cryptoFunctions: ["digest"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /createCipheriv\([\s]*["']aes-256-gcm/gi,
    name: "AES256-GCM",
    oid: "2.16.840.1.101.3.4.1.42",
    primitive: "ae",
    cryptoFunctions: ["encrypt"],
    parameterSetIdentifier: "256",
    mode: "gcm"
  },
  {
    regex: /AlgorithmParameterGenerator\.getInstance\([\s]*["']EC/gi,
    name: "ECC",
    oid: "1.2.840.10045.2.1",
    primitive: "pke",
    cryptoFunctions: ["keygen"]
  },
  // JWT matching for java-jwt
  {
    regex: /Algorithm\.HMAC256/gi,
    name: "HMAC-SHA256",
    oid: "1.2.840.113549.2.9",
    primitive: "mac",
    cryptoFunctions: ["mac"],
    parameterSetIdentifier: "256"
  },
  {
    regex: /Algorithm\.RSA256/gi,
    name: "RSA-SHA256",
    oid: "1.2.840.113549.1.1.11",
    primitive: "signature",
    cryptoFunctions: ["sign", "verify"],
    parameterSetIdentifier: "2048"
  }
];

export class LocalScanner {
  public static async scanDirectory(targetDir: string): Promise<Cbom> {
    const components: Component[] = [];
    const files = this.getAllFiles(targetDir);

    for (const file of files) {
      const ext = path.extname(file);
      if (['.java', '.js', '.ts', '.py', '.go'].includes(ext)) {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const rule of RULES) {
            if (rule.regex.test(line)) {
              // Create or update component
              let comp = components.find(c => c.name === rule.name);
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
                      parameterSetIdentifier: rule.parameterSetIdentifier,
                      mode: rule.mode
                    }
                  }
                };
                components.push(comp);
              }

              comp.evidence.occurrences.push({
                line: i + 1,
                location: path.relative(targetDir, file).replace(/\\/g, '/'),
                additionalContext: line.trim()
              });
            }
          }
        }
      }
    }

    return {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
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
      dependencies: []
    };
  }

  private static getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules') {
          arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
        }
      } else {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  }
}
