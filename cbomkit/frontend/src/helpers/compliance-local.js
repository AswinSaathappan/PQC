export function getLocalComplianceServiceName() {
    return "Basic Local Compliance Service";
}

export function createLocalComplianceReport(cbom) {
    const COMPLIANCE_SERVICE_NAME = getLocalComplianceServiceName();
    const POLICY_NAME = "CRYPTAVISTA Post-Quantum Cryptography";
    const ASYMMETRIC_PRIMITIVES = ["signature", "key-agree", "kem", "pke"];
    const SYMMETRIC_PRIMITIVES = ["block-cipher", "stream-cipher", "hash", "digest", "mac", "kdf"];
    const PQC_NAMES = ["ml-kem", "ml-dsa", "slh-dsa", "pqxdh", "bike", "mceliece", "frodokem", "hqc", "kyber", "ntru", "crystals", "falcon", "mayo", "sphincs", "xmss", "lms", "dilithium"];
    const CLASSICAL_ASYM_NAMES = ["rsa", "ecc", "ecdsa", "ecdh", "ed25519", "ed448", "x25519", "x448", "dh", "diffie-hellman", "dsa", "elgamal"];
    const SYMMETRIC_NAMES = ["aes", "chacha", "3des", "des", "blowfish", "rc4", "sha-256", "sha-384", "sha-512", "sha-2", "sha-3", "sha1", "sha-1", "md5", "hmac", "pbkdf2", "scrypt", "argon2"];
    const WHITELIST_OIDS = [
        "1.3.6.1.4.1.2.267.12.4.4", "1.3.6.1.4.1.2.267.12.6.5", "1.3.6.1.4.1.2.267.12.8.7", "1.3.9999.6.4.16",
        "1.3.9999.6.7.16", "1.3.9999.6.4.13", "1.3.9999.6.7.13", "1.3.9999.6.5.12", "1.3.9999.6.8.12",
        "1.3.9999.6.5.10", "1.3.9999.6.8.10", "1.3.9999.6.6.12", "1.3.9999.6.9.12", "1.3.9999.6.6.10",
        "1.3.9999.6.9.10", "1.3.6.1.4.1.22554.5.6.1", "1.3.6.1.4.1.22554.5.6.2", "1.3.6.1.4.1.22554.5.6.3"
    ];

    // Standardized 4 Authoritative Post-Quantum Classifications
    const complianceLevels = [
        { id: 1, label: "Quantum Safe", colorHex: "#24a148", icon: "CHECKMARK_SECURE" },
        { id: 2, label: "Quantum-Weakened", colorHex: "#d97706", icon: "WARNING" },
        { id: 3, label: "Quantum Vulnerable", colorHex: "#da1e28", icon: "ERROR" },
        { id: 4, label: "Unknown", description: "Unknown Compliance", colorHex: "#17a9d1", icon: "UNKNOWN" }
    ];

    try {
        const findings = [];
        const components = cbom.components || [];

        components.forEach(component => {
            const bomRef = component["bom-ref"];
            if (!bomRef) {
                throw new Error("Missing bomRef field");
            }

            const type = component.type;
            if (!type || type !== "cryptographic-asset") {
                return;
            }

            const rawName = component.name || "";
            const cleanName = rawName.trim();
            // Parent algorithm extraction for key materials
            const parentMatch = cleanName.match(/^(.+?)[\s\-_]+(secret[\-_]?key|private[\-_]?key|public[\-_]?key|symmetric[\-_]?key|key)$/i);
            const parentAlg = (parentMatch && parentMatch[1] && !['key','secret-key','public-key','private-key','material'].includes(parentMatch[1].toLowerCase().trim())) ? parentMatch[1].trim() : null;
            const checkStr = (cleanName + " " + (parentAlg || "")).toLowerCase();

            const cryptoProperties = component.cryptoProperties;
            if (cryptoProperties) {
                const algorithmProperties = cryptoProperties.algorithmProperties;
                if (algorithmProperties) {
                    const nistQuantumSecurityLevel = algorithmProperties.nistQuantumSecurityLevel;
                    if (nistQuantumSecurityLevel && nistQuantumSecurityLevel > 0) {
                        findings.push({
                            bomRef: bomRef,
                            levelId: 1,
                            message: "Supported post-quantum algorithm with strictly positive NIST quantum security level (Quantum Safe)"
                        });
                        return;
                    }

                    const primitive = (algorithmProperties.primitive || "").toLowerCase();
                    const oid = cryptoProperties.oid;
                    if (oid && WHITELIST_OIDS.includes(oid)) {
                        findings.push({
                            bomRef: bomRef,
                            levelId: 1,
                            message: "The OID of the asset is part of the Quantum Safe OIDs whitelist (Quantum Safe)"
                        });
                        return;
                    }

                    // 1. Post-Quantum Cryptography -> Quantum Safe
                    const matchedPqc = PQC_NAMES.find(p => checkStr.includes(p));
                    if (matchedPqc) {
                        findings.push({
                            bomRef: bomRef,
                            levelId: 1,
                            message: `Recognized post-quantum cryptographic algorithm '${matchedPqc}' (Quantum Safe)`
                        });
                        return;
                    }

                    // 2. Classical Asymmetric -> Quantum Vulnerable (Shor's algorithm)
                    const isClassicalAsym = ASYMMETRIC_PRIMITIVES.includes(primitive) ||
                        CLASSICAL_ASYM_NAMES.some(p => {
                            const re = new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`, 'i');
                            return re.test(checkStr);
                        });

                    if (isClassicalAsym) {
                        findings.push({
                            bomRef: bomRef,
                            levelId: 3,
                            message: "Classical public-key algorithm vulnerable to polynomial-time Shor's cryptanalysis (Quantum Vulnerable)"
                        });
                        return;
                    }

                    // 3. Classical Symmetric & Hash Primitives -> Quantum-Weakened (Grover's algorithm)
                    const isSymmetric = SYMMETRIC_PRIMITIVES.includes(primitive) ||
                        SYMMETRIC_NAMES.some(p => checkStr.includes(p));

                    if (isSymmetric) {
                        findings.push({
                            bomRef: bomRef,
                            levelId: 2,
                            message: "Classical symmetric cryptography or hash function; effective security reduced under quantum search (Quantum-Weakened)"
                        });
                        return;
                    }
                }
            }

            // Fallback: Check if name indicates symmetric or asymmetric even without algorithmProperties
            if (SYMMETRIC_NAMES.some(p => checkStr.includes(p))) {
                findings.push({
                    bomRef: bomRef,
                    levelId: 2,
                    message: "Classical symmetric cryptography or hash function (Quantum-Weakened)"
                });
                return;
            }
            if (CLASSICAL_ASYM_NAMES.some(p => checkStr.includes(p))) {
                findings.push({
                    bomRef: bomRef,
                    levelId: 3,
                    message: "Classical asymmetric cryptography (Quantum Vulnerable)"
                });
                return;
            }

            findings.push({
                bomRef: bomRef,
                levelId: 4,
                message: "Insufficient evidence or unrecognized cryptographic construction (Unknown)"
            });
        });

        const globalComplianceStatus = findings.every(finding => finding.levelId === 1);

        return {
            complianceServiceName: COMPLIANCE_SERVICE_NAME,
            policyName: POLICY_NAME,
            findings: findings,
            complianceLevels: complianceLevels,
            defaultComplianceLevel: 4,
            globalComplianceStatus: globalComplianceStatus,
            error: false
        };
    } catch (e) {
        console.error(e);
        return { error: true };
    }
}
