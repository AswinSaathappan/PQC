// ── Applications ──────────────────────────────────────────────────────────────
export const applications = [
  {
    id: "banking",
    name: "Digital Banking Platform",
    assets: 18,
    runtimeCoverage: 91,
    dataLifetime: 15,
    dataLifetimeLabel: "Long-term",
    criticality: "Critical",
    sensitivity: "Highly Confidential",
    quantumRisk: "High",
    migrationDuration: 4,
    primaryAlgorithms: ["RSA-2048", "AES-256-GCM", "TLS 1.2", "ECDSA P-256"],
    description: "Core retail banking services — account management, payments, and transaction processing.",
  },
  {
    id: "healthcare",
    name: "Healthcare Records System",
    assets: 14,
    runtimeCoverage: 78,
    dataLifetime: 25,
    dataLifetimeLabel: "Extended-term",
    criticality: "Critical",
    sensitivity: "Highly Confidential",
    quantumRisk: "High",
    migrationDuration: 5,
    primaryAlgorithms: ["RSA-4096", "ECC P-384", "AES-256", "TLS 1.3"],
    description: "Patient health records management, clinical data exchange, and HIPAA-regulated storage.",
  },
  {
    id: "ecommerce",
    name: "E-Commerce Platform",
    assets: 11,
    runtimeCoverage: 85,
    dataLifetime: 7,
    dataLifetimeLabel: "Medium-term",
    criticality: "High",
    sensitivity: "Confidential",
    quantumRisk: "Medium",
    migrationDuration: 2,
    primaryAlgorithms: ["ECDSA P-256", "AES-256", "TLS 1.3"],
    description: "Online retail operations, payment processing, and customer account management.",
  },
];

// ── KPIs ──────────────────────────────────────────────────────────────────────
export const kpis = [
  { label: "Applications Analyzed", value: "3", sub: "enterprise workspace" },
  { label: "Crypto Artefacts Discovered", value: "43", sub: "total inventory" },
  { label: "Runtime-Observed Operations", value: "214", sub: "verified in execution" },
  { label: "High Quantum-Risk Assets", value: "12", sub: "require attention" },
  { label: "Critical Business Systems", value: "2", sub: "Banking & Healthcare" },
];

// ── Discovery findings ────────────────────────────────────────────────────────
export const discoveryFindings = [
  { id: 1, artefact: "RSA-2048", type: "Algorithm", algorithm: "RSA", version: "PKCS#1 v2.2", mode: "—", protocol: "—", source: "Source Code", location: "banking/auth/rsa.java:142", app: "Digital Banking Platform", confidence: "High" },
  { id: 2, artefact: "AES-256-GCM", type: "Algorithm", algorithm: "AES-256", version: "FIPS 197", mode: "GCM", protocol: "—", source: "Source Code", location: "banking/payment/encrypt.java:88", app: "Digital Banking Platform", confidence: "High" },
  { id: 3, artefact: "ECDSA P-256", type: "Algorithm", algorithm: "ECDSA", version: "FIPS 186-4", mode: "P-256", protocol: "—", source: "Source Code", location: "banking/token/sign.java:34", app: "Digital Banking Platform", confidence: "High" },
  { id: 4, artefact: "TLS 1.2", type: "Protocol", algorithm: "TLS", version: "1.2", mode: "—", protocol: "TLS", source: "Container Image", location: "banking/gateway/Dockerfile", app: "Digital Banking Platform", confidence: "High" },
  { id: 5, artefact: "HMAC-SHA256", type: "Algorithm", algorithm: "HMAC", version: "RFC 2104", mode: "SHA-256", protocol: "—", source: "Source Code", location: "banking/session/hmac.java:19", app: "Digital Banking Platform", confidence: "High" },
  { id: 6, artefact: "RSA-4096", type: "Algorithm", algorithm: "RSA", version: "PKCS#1 v2.2", mode: "4096-bit", protocol: "—", source: "Source Code", location: "health/auth/PatientAuth.cs:67", app: "Healthcare Records System", confidence: "High" },
  { id: 7, artefact: "ECC P-384", type: "Algorithm", algorithm: "ECC", version: "FIPS 186-4", mode: "P-384", protocol: "—", source: "Source Code", location: "health/crypto/KeyExchange.cs:112", app: "Healthcare Records System", confidence: "High" },
  { id: 8, artefact: "AES-256-GCM", type: "Algorithm", algorithm: "AES-256", version: "FIPS 197", mode: "GCM", protocol: "—", source: "Source Code", location: "health/records/Encryptor.cs:88", app: "Healthcare Records System", confidence: "High" },
  { id: 9, artefact: "TLS 1.3", type: "Protocol", algorithm: "TLS", version: "1.3", mode: "—", protocol: "TLS", source: "Container Image", location: "health/api/Dockerfile", app: "Healthcare Records System", confidence: "High" },
  { id: 10, artefact: "SHA-512", type: "Algorithm", algorithm: "SHA-512", version: "FIPS 180-4", mode: "—", protocol: "—", source: "Source Code", location: "health/integrity/Hash.cs:45", app: "Healthcare Records System", confidence: "High" },
  { id: 11, artefact: "ECDSA P-256", type: "Algorithm", algorithm: "ECDSA", version: "FIPS 186-4", mode: "P-256", protocol: "—", source: "Source Code", location: "ecom/orders/sign.ts:88", app: "E-Commerce Platform", confidence: "High" },
  { id: 12, artefact: "ECDH P-256", type: "Algorithm", algorithm: "ECDH", version: "RFC 8031", mode: "P-256", protocol: "—", source: "Source Code", location: "ecom/checkout/keyex.ts:33", app: "E-Commerce Platform", confidence: "High" },
  { id: 13, artefact: "AES-256", type: "Algorithm", algorithm: "AES-256", version: "FIPS 197", mode: "CBC", protocol: "—", source: "Source Code", location: "ecom/payments/store.ts:12", app: "E-Commerce Platform", confidence: "High" },
  { id: 14, artefact: "TLS 1.3", type: "Protocol", algorithm: "TLS", version: "1.3", mode: "—", protocol: "TLS", source: "Container Image", location: "ecom/cdn/Dockerfile", app: "E-Commerce Platform", confidence: "High" },
];

// ── CBOM matrix ───────────────────────────────────────────────────────────────
export const cbomMatrix = {
  apps: ["Digital Banking Platform", "Healthcare Records System", "E-Commerce Platform"],
  algorithms: ["RSA-2048", "RSA-4096", "ECDSA P-256", "ECC P-384", "AES-256", "TLS 1.3", "TLS 1.2", "SHA-256", "HMAC-SHA256", "SHA-512"],
  matrix: [
    [1, 0, 1, 0, 1, 0, 1, 1, 1, 0], // Banking
    [0, 1, 0, 1, 1, 1, 0, 1, 0, 1], // Healthcare
    [0, 0, 1, 0, 1, 1, 0, 1, 0, 0], // E-Commerce
  ],
};

// ── Runtime events ────────────────────────────────────────────────────────────
export const runtimeEvents = [
  { time: "10:32:14", app: "Digital Banking Platform", component: "Auth Module", operation: "RSA-2048 Signature Verification", algorithm: "RSA-2048", status: "Observed" },
  { time: "10:33:02", app: "Digital Banking Platform", component: "Payment Service", operation: "AES-256-GCM Encrypt", algorithm: "AES-256-GCM", status: "Observed" },
  { time: "10:33:45", app: "Digital Banking Platform", component: "Token Service", operation: "ECDSA P-256 Sign", algorithm: "ECDSA P-256", status: "Observed" },
  { time: "10:34:12", app: "Digital Banking Platform", component: "API Gateway", operation: "TLS 1.2 Handshake", algorithm: "TLS 1.2", status: "Observed" },
  { time: "10:35:01", app: "Healthcare Records System", component: "Patient Auth", operation: "RSA-4096 Sign", algorithm: "RSA-4096", status: "Observed" },
  { time: "10:35:38", app: "Healthcare Records System", component: "Key Exchange", operation: "ECC P-384 KeyEx", algorithm: "ECC P-384", status: "Observed" },
  { time: "10:36:22", app: "Healthcare Records System", component: "Record Encryptor", operation: "AES-256-GCM Encrypt", algorithm: "AES-256-GCM", status: "Observed" },
  { time: "10:37:05", app: "E-Commerce Platform", component: "Order Service", operation: "ECDSA P-256 Sign", algorithm: "ECDSA P-256", status: "Observed" },
  { time: "10:37:48", app: "E-Commerce Platform", component: "Checkout Service", operation: "ECDH P-256 Key Exchange", algorithm: "ECDH P-256", status: "Observed" },
  { time: "10:38:22", app: "E-Commerce Platform", component: "Payment Store", operation: "AES-256 Encrypt", algorithm: "AES-256", status: "Not Observed in Current Execution" },
];

// ── Classification ────────────────────────────────────────────────────────────
export const classificationData = [
  { app: "Digital Banking Platform", artefact: "RSA-2048", type: "Public-Key Cryptography", lifetime: "15 Years", criticality: "Critical", sensitiveData: "High", runtime: "Observed", quantumVuln: true },
  { app: "Digital Banking Platform", artefact: "ECDSA P-256", type: "Digital Signature", lifetime: "15 Years", criticality: "Critical", sensitiveData: "High", runtime: "Observed", quantumVuln: true },
  { app: "Digital Banking Platform", artefact: "TLS 1.2", type: "Transport Protocol", lifetime: "15 Years", criticality: "High", sensitiveData: "Medium", runtime: "Observed", quantumVuln: true },
  { app: "Digital Banking Platform", artefact: "AES-256-GCM", type: "Symmetric Encryption", lifetime: "15 Years", criticality: "Critical", sensitiveData: "High", runtime: "Observed", quantumVuln: false },
  { app: "Healthcare Records System", artefact: "RSA-4096", type: "Public-Key Cryptography", lifetime: "25 Years", criticality: "Critical", sensitiveData: "High", runtime: "Observed", quantumVuln: true },
  { app: "Healthcare Records System", artefact: "ECC P-384", type: "Key Exchange", lifetime: "25 Years", criticality: "Critical", sensitiveData: "High", runtime: "Observed", quantumVuln: true },
  { app: "Healthcare Records System", artefact: "TLS 1.3", type: "Transport Protocol", lifetime: "25 Years", criticality: "High", sensitiveData: "Medium", runtime: "Observed", quantumVuln: true },
  { app: "Healthcare Records System", artefact: "AES-256-GCM", type: "Symmetric Encryption", lifetime: "25 Years", criticality: "Critical", sensitiveData: "High", runtime: "Observed", quantumVuln: false },
  { app: "E-Commerce Platform", artefact: "ECDSA P-256", type: "Digital Signature", lifetime: "7 Years", criticality: "High", sensitiveData: "Medium", runtime: "Observed", quantumVuln: true },
  { app: "E-Commerce Platform", artefact: "ECDH P-256", type: "Key Exchange", lifetime: "7 Years", criticality: "High", sensitiveData: "Medium", runtime: "Observed", quantumVuln: true },
  { app: "E-Commerce Platform", artefact: "AES-256", type: "Symmetric Encryption", lifetime: "7 Years", criticality: "High", sensitiveData: "Medium", runtime: "Not Observed", quantumVuln: false },
];

// ── Per-app cryptographic asset priority data ─────────────────────────────────
// Priority is within each application's own cryptographic assets — not cross-app ranking.
export interface AssetPriority {
  rank: number;
  asset: string;
  component: string;
  quantumRisk: number;      // 0–100
  dataLifetime: number;     // 0–100 normalized
  criticality: number;      // 0–100
  depImpact: number;        // 0–100
  migrationComplexity: number; // 0–100
  score: number;            // 0–100
  urgency: "Urgent" | "Monitor" | "Lower";
  quantumVuln: boolean;
}

export const assetPriorities: Record<string, AssetPriority[]> = {
  banking: [
    { rank: 1, asset: "RSA-2048", component: "Authentication & Key Exchange", quantumRisk: 95, dataLifetime: 90, criticality: 100, depImpact: 88, migrationComplexity: 65, score: 91, urgency: "Urgent", quantumVuln: true },
    { rank: 2, asset: "TLS 1.2", component: "API Gateway Transport", quantumRisk: 80, dataLifetime: 90, criticality: 80, depImpact: 90, migrationComplexity: 40, score: 80, urgency: "Urgent", quantumVuln: true },
    { rank: 3, asset: "ECDSA P-256", component: "Token Signing Service", quantumRisk: 85, dataLifetime: 70, criticality: 80, depImpact: 60, migrationComplexity: 55, score: 72, urgency: "Urgent", quantumVuln: true },
    { rank: 4, asset: "AES-256-GCM", component: "Payment Encryption", quantumRisk: 20, dataLifetime: 90, criticality: 100, depImpact: 45, migrationComplexity: 30, score: 38, urgency: "Monitor", quantumVuln: false },
  ],
  healthcare: [
    { rank: 1, asset: "RSA-4096", component: "Patient Authentication", quantumRisk: 95, dataLifetime: 100, criticality: 100, depImpact: 85, migrationComplexity: 80, score: 95, urgency: "Urgent", quantumVuln: true },
    { rank: 2, asset: "ECC P-384", component: "Secure Key Exchange", quantumRisk: 90, dataLifetime: 100, criticality: 100, depImpact: 75, migrationComplexity: 60, score: 87, urgency: "Urgent", quantumVuln: true },
    { rank: 3, asset: "TLS 1.3", component: "API Transport", quantumRisk: 75, dataLifetime: 100, criticality: 80, depImpact: 80, migrationComplexity: 35, score: 74, urgency: "Urgent", quantumVuln: true },
    { rank: 4, asset: "AES-256-GCM", component: "Record Encryption", quantumRisk: 20, dataLifetime: 100, criticality: 100, depImpact: 40, migrationComplexity: 25, score: 45, urgency: "Monitor", quantumVuln: false },
  ],
  ecommerce: [
    { rank: 1, asset: "ECDSA P-256", component: "Order Signing Service", quantumRisk: 85, dataLifetime: 55, criticality: 80, depImpact: 80, migrationComplexity: 35, score: 73, urgency: "Urgent", quantumVuln: true },
    { rank: 2, asset: "ECDH P-256", component: "Checkout Key Exchange", quantumRisk: 85, dataLifetime: 55, criticality: 80, depImpact: 60, migrationComplexity: 30, score: 65, urgency: "Monitor", quantumVuln: true },
    { rank: 3, asset: "TLS 1.3", component: "CDN / Edge Transport", quantumRisk: 75, dataLifetime: 40, criticality: 80, depImpact: 70, migrationComplexity: 30, score: 57, urgency: "Monitor", quantumVuln: true },
    { rank: 4, asset: "AES-256", component: "Payment Data Storage", quantumRisk: 20, dataLifetime: 55, criticality: 80, depImpact: 35, migrationComplexity: 20, score: 28, urgency: "Lower", quantumVuln: false },
  ],
};

// ── Recommendations ───────────────────────────────────────────────────────────
export const recommendations = [
  {
    app: "Digital Banking Platform",
    asset: "RSA-2048",
    risk: "High",
    dataLifetime: "15 years",
    criticality: "Critical",
    latency: "Low sensitivity",
    cost: "High",
    direction: "Evaluate Hybrid Cryptography",
    reason: "RSA-2048 is vulnerable to Shor's algorithm. Combined with a 15-year data protection lifetime and critical business criticality, this asset requires the earliest migration attention. A hybrid ML-DSA + RSA-2048 approach preserves backward compatibility during phased migration while introducing post-quantum resistance.",
  },
  {
    app: "Digital Banking Platform",
    asset: "TLS 1.2 / ECDSA P-256",
    risk: "High",
    dataLifetime: "15 years",
    criticality: "High",
    latency: "Medium sensitivity",
    cost: "Medium",
    direction: "Evaluate PQC Transition",
    reason: "TLS 1.2 uses a classical key exchange vulnerable to harvest-now-decrypt-later attacks. Upgrading to TLS 1.3 with a hybrid X25519 + ML-KEM key exchange addresses both classical and quantum risks. ECDSA P-256 token signing should transition to ML-DSA.",
  },
  {
    app: "Healthcare Records System",
    asset: "RSA-4096 / ECC P-384",
    risk: "High",
    dataLifetime: "25 years",
    criticality: "Critical",
    latency: "Low sensitivity",
    cost: "High",
    direction: "Evaluate Hybrid Cryptography",
    reason: "Patient health records require the longest data protection and are subject to HIPAA long-term retention. RSA-4096 and ECC P-384 are both vulnerable to Shor's algorithm. A phased migration to ML-DSA (FIPS 204) for signatures and ML-KEM (FIPS 203) for key encapsulation is strongly recommended given the 25-year data exposure window.",
  },
  {
    app: "E-Commerce Platform",
    asset: "ECDSA P-256 / ECDH P-256",
    risk: "Medium",
    dataLifetime: "7 years",
    criticality: "High",
    latency: "Low sensitivity",
    cost: "Medium",
    direction: "Monitor and Reassess",
    reason: "The 7-year data lifetime provides more time for planning but ECC remains quantum-vulnerable. Monitor NIST PQC standard adoption rates and schedule a structured transition to ML-DSA and ML-KEM within the next 3–4 years. The shorter data lifetime reduces immediate urgency compared to banking and healthcare systems.",
  },
];
