import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { BinaryScanner, CryptoSignature, Finding, CRYPTO_SIGNATURES } from './binary_scanner';

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
    certificateProperties?: {
      subject?: string;
      issuer?: string;
      validTo?: string;
      signatureAlgorithm?: string;
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

interface ContainerFinding {
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
  location: string;
  line: number;
  additionalContext?: string;
}

export class ContainerScanner {

  /**
   * Statically scans a container image rootfs tarball without executing any container code.
   * Discovers cryptographic binaries, libraries, certificates, keys, configs, and packages.
   */
  static async scanContainer(
    rootfsTarPath: string,
    imageReference: string,
    onProgress?: (partialCbom: Cbom, info: { assetCount: number; scannedFiles: number; totalFiles: number }) => Promise<void>
  ): Promise<Cbom> {
    if (!fs.existsSync(rootfsTarPath)) {
      throw new Error(`Container rootfs archive does not exist at: ${rootfsTarPath}`);
    }

    const stat = fs.statSync(rootfsTarPath);
    const tarSize = stat.size;
    const fd = fs.openSync(rootfsTarPath, 'r');

    const findings: ContainerFinding[] = [];
    let scannedFilesCount = 0;
    let totalLinesEstimate = 0;

    let lastEmittedCount = 0;
    let lastEmittedTime = 0;

    const emitProgress = async (force: boolean = false) => {
      if (!onProgress) return;
      const now = Date.now();
      const isFirstFinding = (lastEmittedCount === 0 && findings.length > 0);
      const hasNewFindings = (findings.length > lastEmittedCount);
      const timeElapsed = now - lastEmittedTime;

      // 1. First real crypto finding: emit immediately so graph appears right away!
      // 2. Incremental real findings: emit when new findings arrived and at least ~200ms elapsed
      // 3. Force: emit at end of a phase or file batch if forced
      if (isFirstFinding || (hasNewFindings && (force || timeElapsed >= 200))) {
        lastEmittedCount = findings.length;
        lastEmittedTime = now;
        const partial = this.buildCycloneDxCbom(imageReference, [...findings], scannedFilesCount, totalLinesEstimate);
        await onProgress(partial, {
          assetCount: findings.length,
          scannedFiles: scannedFilesCount,
          totalFiles: Math.max(scannedFilesCount, 50)
        });
        // Pacing yield: allows Express server to process incoming /cbom and /status requests
        // and gives the user's browser the 250ms polling window to render the growing graph
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    try {
      let offset = 0;
      const header = Buffer.alloc(512);
      let nextLongName: string | null = null;

      while (offset < tarSize) {
        const bytesRead = fs.readSync(fd, header, 0, 512, offset);
        if (bytesRead < 512) break;

        // Check for 512-byte zero block
        let allZero = true;
        for (let i = 0; i < 512; i++) {
          if (header[i] !== 0) {
            allZero = false;
            break;
          }
        }
        if (allZero) {
          offset += 512;
          continue;
        }

        // Parse tar entry name
        let name = nextLongName || header.toString('utf8', 0, 100).replace(/\0.*$/, '').trim();
        const prefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '').trim();
        if (prefix && !nextLongName) {
          name = prefix + '/' + name;
        }
        nextLongName = null;

        // Normalize relative path safely
        name = name.replace(/\\/g, '/').replace(/^\/+/, '');

        // Parse size
        let size = 0;
        if (header[124] & 0x80) {
          for (let i = 125; i < 136; i++) {
            size = (size * 256) + header[i];
          }
        } else {
          const sizeStr = header.toString('ascii', 124, 136).replace(/\0.*$/, '').trim();
          size = parseInt(sizeStr, 8) || 0;
        }

        const typeFlag = String.fromCharCode(header[156]);
        const contentOffset = offset + 512;
        const padding = (512 - (size % 512)) % 512;
        offset = contentOffset + size + padding;

        if (typeFlag === 'L') {
          // GNU long name
          if (size > 0 && size < 4096) {
            const longBuf = Buffer.alloc(size);
            fs.readSync(fd, longBuf, 0, size, contentOffset);
            nextLongName = longBuf.toString('utf8').replace(/\0.*$/, '').trim();
          }
          continue;
        }

        // Only inspect regular files (type '0', '\0', or empty)
        if (typeFlag !== '0' && typeFlag !== '\0' && typeFlag !== '') {
          continue;
        }

        // Security check: Ignore path traversal or overly huge files (> 35MB)
        if (name.includes('..') || size === 0 || size > 35 * 1024 * 1024) {
          continue;
        }

        scannedFilesCount++;
        totalLinesEstimate += Math.max(1, Math.round(size / 64));

        const lower = name.toLowerCase();

        // 1. Certificates & Keys inspection (.crt, .pem, .key, .pub, /etc/ssl/, /etc/apk/keys/, /etc/pki/, /etc/ssh/)
        const isCertOrKey = lower.endsWith('.crt') || lower.endsWith('.cer') || lower.endsWith('.pem') ||
          lower.endsWith('.key') || lower.endsWith('.pub') ||
          lower.includes('etc/ssl/certs') || lower.includes('etc/apk/keys') || lower.includes('etc/pki');

        if (isCertOrKey) {
          try {
            const fileBuf = Buffer.alloc(Math.min(size, 2 * 1024 * 1024));
            fs.readSync(fd, fileBuf, 0, fileBuf.length, contentOffset);
            await this.scanCertificateOrKeyFile(name, fileBuf, findings);
            await emitProgress();
          } catch (certErr) {
            console.warn(`[ContainerScanner] Note inspecting cert/key ${name}:`, (certErr as Error).message);
          }
          continue;
        }

        // 2. Cryptographic Configuration Files (openssl.cnf, sshd_config, nginx.conf, etc.)
        const isConfigFile = lower.endsWith('.cnf') || lower.endsWith('.conf') || lower.includes('openssl.cnf') || lower.includes('sshd_config');
        if (isConfigFile) {
          try {
            const fileBuf = Buffer.alloc(Math.min(size, 1024 * 1024));
            fs.readSync(fd, fileBuf, 0, fileBuf.length, contentOffset);
            await this.scanConfigFile(name, fileBuf.toString('utf8'), findings);
            await emitProgress();
          } catch (cfgErr) {
            console.warn(`[ContainerScanner] Note inspecting config ${name}:`, (cfgErr as Error).message);
          }
          continue;
        }

        // 3. Package Database manifests (lib/apk/db/installed, var/lib/dpkg/status)
        const isPackageDb = lower === 'lib/apk/db/installed' || lower === 'var/lib/dpkg/status';
        if (isPackageDb) {
          try {
            const fileBuf = Buffer.alloc(Math.min(size, 5 * 1024 * 1024));
            fs.readSync(fd, fileBuf, 0, fileBuf.length, contentOffset);
            await this.scanPackageDatabase(name, fileBuf.toString('utf8'), findings);
            await emitProgress();
          } catch (pkgErr) {
            console.warn(`[ContainerScanner] Note inspecting package db ${name}:`, (pkgErr as Error).message);
          }
          continue;
        }

        // 4. Executables & Shared Libraries
        const isBinary = lower.startsWith('bin/') || lower.startsWith('sbin/') ||
          lower.startsWith('usr/bin/') || lower.startsWith('usr/sbin/') ||
          lower.startsWith('lib/') || lower.startsWith('lib64/') ||
          lower.startsWith('usr/lib/') || lower.startsWith('usr/lib64/') ||
          lower.includes('.so') || lower.endsWith('.dylib') || lower.endsWith('.exe');

        if (isBinary && size <= 20 * 1024 * 1024) {
          // Read header (4 bytes) to check for ELF/PE/Mach-O
          const magicBuf = Buffer.alloc(4);
          fs.readSync(fd, magicBuf, 0, 4, contentOffset);
          const isElf = magicBuf[0] === 0x7F && magicBuf[1] === 0x45 && magicBuf[2] === 0x4C && magicBuf[3] === 0x46;

          if (isElf || lower.includes('libcrypto') || lower.includes('libssl') || lower.includes('busybox') || lower.includes('apk')) {
            try {
              const fileBuf = Buffer.alloc(size);
              fs.readSync(fd, fileBuf, 0, size, contentOffset);

              await BinaryScanner.scanRawBuffer(fileBuf, async (sig: CryptoSignature, off: number, matchText: string, srcType: Finding['sourceType'], sec?: string) => {
                const hexOffset = `0x${off.toString(16).toUpperCase().padStart(8, '0')}`;
                let context = `Offset: ${hexOffset}`;
                if (sec) context += ` | Section: ${sec}`;
                context += ` | Source: ${srcType.toUpperCase()}`;
                if (matchText && matchText !== sig.name) context += ` | Match: "${matchText}"`;

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
                  location: `${name}:${hexOffset}`,
                  line: 1,
                  additionalContext: context
                });

                await emitProgress();
              });

              await emitProgress();
            } catch (binErr) {
              console.warn(`[ContainerScanner] Note inspecting binary ${name}:`, (binErr as Error).message);
            }
          }
        }
      }
    } finally {
      fs.closeSync(fd);
    }

    await emitProgress(true);

    const cbom = this.buildCycloneDxCbom(imageReference, findings, scannedFilesCount, totalLinesEstimate);
    return cbom;
  }

  // ==========================================
  // Certificate & Key Static Inspection
  // ==========================================

  private static async scanCertificateOrKeyFile(
    location: string,
    buffer: Buffer,
    findings: ContainerFinding[]
  ): Promise<void> {
    const text = buffer.toString('utf8');

    // Check for X.509 PEM Certificates
    if (text.includes('-----BEGIN CERTIFICATE-----')) {
      const certBlocks = text.split('-----BEGIN CERTIFICATE-----').slice(1);
      for (let i = 0; i < certBlocks.length; i++) {
        const certPem = '-----BEGIN CERTIFICATE-----' + certBlocks[i].split('-----END CERTIFICATE-----')[0] + '-----END CERTIFICATE-----';
        try {
          const x509 = new crypto.X509Certificate(certPem);
          const pk = x509.publicKey;
          const keyType = (pk.asymmetricKeyType || 'rsa').toLowerCase();
          const details: any = pk.asymmetricKeyDetails || {};

          let algoName = 'RSA';
          let primitive = 'signature';
          let keyLength = details.modulusLength ? String(details.modulusLength) : undefined;
          let curve = details.namedCurve;
          let oid: string | undefined;

          if (keyType === 'rsa') {
            algoName = keyLength ? `RSA-${keyLength}` : 'RSA';
            primitive = 'signature';
            oid = '1.2.840.113549.1.1.1';
          } else if (keyType === 'ec') {
            algoName = curve ? `ECDSA-${curve}` : 'ECDSA';
            primitive = 'signature';
            oid = '1.2.840.10045.2.1';
          } else if (keyType === 'ed25519') {
            algoName = 'Ed25519';
            primitive = 'signature';
            oid = '1.3.101.112';
          }

          findings.push({
            name: algoName,
            primitive,
            assetType: 'certificate',
            oid,
            parameterSetIdentifier: keyLength,
            curve,
            cryptoFunctions: ['verify'],
            location,
            line: i + 1,
            additionalContext: `Issuer: ${x509.issuer.substring(0, 60)} | Subject: ${x509.subject.substring(0, 60)} | Valid to: ${x509.validTo}`
          });
        } catch {
          // Truncated cert block; continue
        }
      }
      return;
    }

    // Check for Public Key (e.g. Alpine /etc/apk/keys/*.rsa.pub or standard PEM public keys)
    if (text.includes('-----BEGIN PUBLIC KEY-----') || text.includes('-----BEGIN RSA PUBLIC KEY-----')) {
      try {
        const pk = crypto.createPublicKey(text);
        const keyType = (pk.asymmetricKeyType || 'rsa').toLowerCase();
        const details: any = pk.asymmetricKeyDetails || {};

        let algoName = 'RSA';
        let keyLength = details.modulusLength ? String(details.modulusLength) : undefined;
        let curve = details.namedCurve;

        if (keyType === 'rsa') {
          algoName = keyLength ? `RSA-${keyLength}` : 'RSA';
        } else if (keyType === 'ec') {
          algoName = curve ? `ECDSA-${curve}` : 'ECDSA';
        } else if (keyType === 'ed25519') {
          algoName = 'Ed25519';
        }

        findings.push({
          name: algoName,
          primitive: 'signature',
          assetType: 'related-crypto-material',
          oid: keyType === 'rsa' ? '1.2.840.113549.1.1.1' : undefined,
          parameterSetIdentifier: keyLength,
          curve,
          cryptoFunctions: ['verify'],
          location,
          line: 1,
          additionalContext: `Public Key (${keyType.toUpperCase()}${keyLength ? ' ' + keyLength + '-bit' : ''})`
        });
      } catch {
        // Fallback for APK public key naming if OpenSSL format differs slightly
        const match = location.match(/(\d+)\.rsa\.pub/i) || text.match(/rsa/i);
        if (match) {
          findings.push({
            name: 'RSA-2048',
            primitive: 'signature',
            assetType: 'related-crypto-material',
            oid: '1.2.840.113549.1.1.1',
            parameterSetIdentifier: '2048',
            cryptoFunctions: ['verify'],
            location,
            line: 1,
            additionalContext: 'Alpine APK Signing RSA Public Key'
          });
        }
      }
    }
  }

  // ==========================================
  // Cryptographic Configuration Static Inspection
  // ==========================================

  private static async scanConfigFile(
    location: string,
    content: string,
    findings: ContainerFinding[]
  ): Promise<void> {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;

      // TLS Protocol Versions
      if (/TLSv1\.3/i.test(line)) {
        findings.push({
          name: 'TLSv1.3',
          primitive: 'protocol',
          assetType: 'protocol',
          cryptoFunctions: ['encrypt', 'decrypt', 'key-agree'],
          location,
          line: i + 1,
          additionalContext: line.substring(0, 100)
        });
      }
      if (/TLSv1\.2/i.test(line)) {
        findings.push({
          name: 'TLSv1.2',
          primitive: 'protocol',
          assetType: 'protocol',
          cryptoFunctions: ['encrypt', 'decrypt', 'key-agree'],
          location,
          line: i + 1,
          additionalContext: line.substring(0, 100)
        });
      }

      // Explicit Cipher Suites
      if (/AES[-_]?256[-_]?GCM/i.test(line)) {
        findings.push({
          name: 'AES-256-GCM',
          primitive: 'ae',
          assetType: 'algorithm',
          parameterSetIdentifier: '256',
          mode: 'gcm',
          cryptoFunctions: ['encrypt', 'decrypt'],
          location,
          line: i + 1,
          additionalContext: line.substring(0, 100)
        });
      } else if (/AES[-_]?128[-_]?GCM/i.test(line)) {
        findings.push({
          name: 'AES-128-GCM',
          primitive: 'ae',
          assetType: 'algorithm',
          parameterSetIdentifier: '128',
          mode: 'gcm',
          cryptoFunctions: ['encrypt', 'decrypt'],
          location,
          line: i + 1,
          additionalContext: line.substring(0, 100)
        });
      }

      if (/CHACHA20[-_]?POLY1305/i.test(line)) {
        findings.push({
          name: 'ChaCha20-Poly1305',
          primitive: 'ae',
          assetType: 'algorithm',
          cryptoFunctions: ['encrypt', 'decrypt'],
          location,
          line: i + 1,
          additionalContext: line.substring(0, 100)
        });
      }

      // Elliptic Curves & Key Agreement
      if (/X25519/i.test(line)) {
        findings.push({
          name: 'X25519',
          primitive: 'key-agree',
          assetType: 'algorithm',
          oid: '1.3.101.110',
          cryptoFunctions: ['key-agree'],
          location,
          line: i + 1,
          additionalContext: line.substring(0, 100)
        });
      }
      if (/prime256v1|secp256r1|P-256/i.test(line)) {
        findings.push({
          name: 'ECDH-P256',
          primitive: 'key-agree',
          assetType: 'algorithm',
          curve: 'secp256r1',
          cryptoFunctions: ['key-agree'],
          location,
          line: i + 1,
          additionalContext: line.substring(0, 100)
        });
      }
    }
  }

  // ==========================================
  // Package Database Static Inspection
  // ==========================================

  private static async scanPackageDatabase(
    location: string,
    content: string,
    findings: ContainerFinding[]
  ): Promise<void> {
    // Check for installed OpenSSL / libcrypto / libssl / GnuTLS packages
    const pkgMatches = content.matchAll(/P:(libcrypto3|libssl3|openssl|gnutls|ca-certificates|mbedtls)[\r\n]+V:([^\r\n]+)/g);
    for (const match of pkgMatches) {
      const pkgName = match[1];
      const pkgVer = match[2];

      if (pkgName === 'openssl' || pkgName === 'libcrypto3') {
        findings.push({
          name: 'OpenSSL Crypto Library',
          primitive: 'library',
          assetType: 'algorithm',
          location,
          line: 1,
          additionalContext: `Package: ${pkgName} ${pkgVer}`
        });
      }
    }
  }

  // ==========================================
  // CycloneDX 1.6 CBOM Builder
  // ==========================================

  private static buildCycloneDxCbom(
    imageReference: string,
    findings: ContainerFinding[],
    scannedFiles: number,
    scannedLines: number
  ): Cbom {
    const grouped = new Map<string, { f: ContainerFinding; occurrences: Occurrence[] }>();

    for (const f of findings) {
      let entry = grouped.get(f.name);
      if (!entry) {
        entry = { f, occurrences: [] };
        grouped.set(f.name, entry);
      }

      if (entry.occurrences.length < 15) {
        const isDup = entry.occurrences.some(o => o.location === f.location && o.line === f.line);
        if (!isDup) {
          entry.occurrences.push({
            line: f.line,
            location: f.location,
            additionalContext: f.additionalContext
          });
        }
      }
    }

    const safeRef = imageReference.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const appRef = `container-image@${safeRef}`;
    const components: Component[] = [];
    const dependsOn: string[] = [];

    for (const [name, { f, occurrences }] of grouped.entries()) {
      const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const bomRef = `crypto-asset@${safeName}`;
      dependsOn.push(bomRef);

      const comp: Component = {
        name,
        type: "cryptographic-asset",
        "bom-ref": bomRef,
        evidence: {
          occurrences: occurrences.length > 0 ? occurrences : [
            {
              line: 1,
              location: imageReference,
              additionalContext: `Discovered in container image ${imageReference}`
            }
          ]
        },
        cryptoProperties: {
          assetType: f.assetType || 'algorithm',
          oid: f.oid,
          algorithmProperties: {
            primitive: f.primitive,
            cryptoFunctions: f.cryptoFunctions,
            parameterSetIdentifier: f.parameterSetIdentifier,
            curve: f.curve,
            mode: f.mode,
            padding: f.padding,
            nistQuantumSecurityLevel: f.nistQuantumSecurityLevel
          }
        }
      };

      components.push(comp);
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
              name: "ContainerScanner (ECDAT)",
              provider: { name: "CRYPTAVISTA" }
            }
          ]
        },
        component: {
          name: imageReference,
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
      scannedFiles: Math.max(1, scannedFiles),
      scannedLines: Math.max(10, scannedLines)
    };
  }
}
