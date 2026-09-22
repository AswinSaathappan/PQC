import React, { useState, useEffect } from "react";
import axios from "axios";
import { Download, ChevronDown, ChevronRight, ArrowRight, Activity, ShieldAlert, CheckCircle2, Loader2, Info } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList
} from "recharts";
import ApplicationSelector from "../components/ApplicationSelector";
import CbomkitDonutChart, { CbomkitChartItem } from "../components/CbomkitDonutChart";

interface Props {
  selectedAnalysisId?: string;
  analyses?: any[];
  onSelectAnalysis?: (id: string) => void;
}

export default function Report({ selectedAnalysisId, analyses = [], onSelectAnalysis }: Props) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [cbomSummaryData, setCbomSummaryData] = useState<any>(null);
  const [cbomRawData, setCbomRawData] = useState<any>(null);
  const [dependencyData, setDependencyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const effectiveAnalysisId = selectedAnalysisId || analyses[0]?.analysisId;

  useEffect(() => {
    async function fetchReportData() {
      if (effectiveAnalysisId) {
        setLoading(true);
        try {
          const [summaryRes, scoredRes, cbomSummaryRes, cbomRes, depRes] = await Promise.all([
            axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/summary`).catch(() => null),
            axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/scored-assets`).catch(() => null),
            axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/cbom-summary`).catch(() => null),
            axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/cbom`).catch(() => null),
            axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/dependency-graph`).catch(() => null)
          ]);
          if (summaryRes?.data) setSummaryData(summaryRes.data);
          if (scoredRes?.data) setAssets(scoredRes.data);
          if (cbomSummaryRes?.data) setCbomSummaryData(cbomSummaryRes.data);
          if (cbomRes?.data) setCbomRawData(cbomRes.data);
          if (depRes?.data) setDependencyData(depRes.data);
          setExpandedAsset(null);
        } catch (err) {
          console.error("Failed to load report data", err);
        } finally {
          setLoading(false);
        }
      } else {
        setAssets([]);
        setSummaryData(null);
        setCbomSummaryData(null);
        setCbomRawData(null);
        setDependencyData(null);
      }
    }
    fetchReportData();
  }, [effectiveAnalysisId]);

  const selectedApp = summaryData || analyses.find(a => a.analysisId === effectiveAnalysisId);

  // Transform backend data to expected report format
  const data = React.useMemo(() => {
    if (!selectedApp) return null;
    
    const rawAssets = summaryData?.inventory || assets;
    const sortedAssets = [...rawAssets].sort((a: any, b: any) => {
      const scoreA = a.priorityScore ?? a.scores?.priorityScore ?? -1;
      const scoreB = b.priorityScore ?? b.scores?.priorityScore ?? -1;
      return scoreB - scoreA;
    });

    const totalOccurrences = summaryData?.aggregates?.totalOccurrences ?? summaryData?.dependencyMetrics?.totalOccurrences ?? selectedApp.detectedCryptoAssetCount ?? rawAssets.reduce((sum: number, a: any) => sum + (a.occurrencesCount || 1), 0);
    const uniqueLogicalAssetsCount = rawAssets.length;

    const fallbackMargin = (selectedApp.quantumRiskHorizon || 10) - ((selectedApp.dataProtectionDuration || 5) + (selectedApp.migrationDuration || 2));
    const fallbackMosca = selectedApp.moscaUrgency ?? (fallbackMargin <= 0 ? 100 : fallbackMargin <= 2 ? 75 : fallbackMargin <= 5 ? 50 : fallbackMargin <= 10 ? 25 : 0);
    const fallbackSens = selectedApp.dataSensitivity || 25;
    const fallbackCrit = selectedApp.businessCriticality || 25;
    const fallbackAps = (fallbackMosca + fallbackSens + fallbackCrit) / 3;

    const appPriority = summaryData?.applicationPriority || {
      dataProtectionLifetime: selectedApp.dataProtectionDuration || 5, 
      migrationDuration: selectedApp.migrationDuration || 2, 
      quantumThreatHorizon: selectedApp.threatHorizonYear || 2036,
      quantumRiskHorizon: selectedApp.quantumRiskHorizon || 10,
      timingMargin: fallbackMargin,
      moscaUrgency: fallbackMosca,
      dataSensitivity: fallbackSens,
      businessCriticality: fallbackCrit,
      aps: selectedApp.apsScore || fallbackAps,
      overallPriority: selectedApp.apsScore ? `P${selectedApp.apsScore >= 75 ? 1 : selectedApp.apsScore >= 50 ? 2 : selectedApp.apsScore >= 25 ? 3 : 4}` : `P${fallbackAps >= 75 ? 1 : fallbackAps >= 50 ? 2 : fallbackAps >= 25 ? 3 : 4}`
    };

    const moscaVars = {
      dataProtectionLifetime: appPriority.dataProtectionLifetime || selectedApp.dataProtectionDuration || 5,
      migrationDuration: appPriority.migrationDuration || selectedApp.migrationDuration || 2,
      quantumThreatHorizon: appPriority.quantumThreatHorizon || selectedApp.threatHorizonYear || 2036,
      quantumRiskHorizon: appPriority.quantumRiskHorizon || selectedApp.quantumRiskHorizon || (appPriority.quantumThreatHorizon ? Math.max(1, appPriority.quantumThreatHorizon - 2026) : 10),
      timingMargin: appPriority.timingMargin ?? ((appPriority.quantumRiskHorizon || 10) - ((appPriority.dataProtectionLifetime || 5) + (appPriority.migrationDuration || 2)))
    };
    
    return {
      analysisId: selectedApp.analysisId,
      analysisName: selectedApp.applicationName,
      date: new Date(selectedApp.createdAt || Date.now()).toLocaleDateString(),
      totalOccurrences,
      uniqueLogicalAssetsCount,
      configuration: {
        runtimeEnabled: Boolean(selectedApp.runtimeEnabled),
        monitoringDuration: "N/A",
        totalEventsCollected: 0,
        baselineAnalysisTime: "N/A"
      },
      applicationPriority: {
        moscaVariables: moscaVars,
        moscaUrgency: appPriority.moscaUrgency || 0,
        dataSensitivity: appPriority.dataSensitivity || 0,
        businessCriticality: appPriority.businessCriticality || 0,
        aps: appPriority.aps || 0,
        overallPriority: appPriority.overallPriority || "P3"
      },
      discoveredAssets: sortedAssets.map((a: any, i: number) => {
        const algUpper = (a.algorithm || a.assetName || a.asset || '').toUpperCase();
        const primLower = (a.primitive || '').toLowerCase();

        const isSym = a.category === 'symmetric' || primLower === 'block-cipher' || primLower === 'stream-cipher' || primLower === 'ae' || primLower === 'symmetric' || /AES|CHACHA|DES|3DES|RC4/i.test(algUpper);
        const isSig = (a.category === 'public_key' && a.usage === 'digital_signature') || primLower === 'signature' || /ECDSA|ED25519|ED448|DSA|WITHRSA|RSA-SHA|SIGN/i.test(algUpper);
        const isKdf = a.category === 'kdf' || primLower === 'kdf' || /PBKDF|SCRYPT|ARGON|HKDF/i.test(algUpper);
        const isHash = a.category === 'hash' || (!isSig && !isKdf && (primLower === 'hash' || primLower === 'digest' || primLower === 'mac' || /SHA|MD5|HMAC|BLAKE/i.test(algUpper)));
        const isAsym = a.category === 'public_key' || (!isSym && !isSig && !isHash && !isKdf && (primLower === 'pke' || primLower === 'kem' || primLower === 'key-agree' || primLower === 'key-exchange' || /RSA|ECDH|DH/i.test(algUpper)));

        let usage = a.usage || "key_establishment";
        let category: 'public_key' | 'symmetric' | 'hash' | 'kdf' = a.category || 'public_key';

        if (isKdf) {
          usage = "key_derivation";
          category = 'kdf';
        } else if (isSym) {
          usage = "symmetric_encryption";
          category = 'symmetric';
        } else if (isSig) {
          usage = "digital_signature";
          category = 'public_key';
        } else if (isHash) {
          usage = "cryptographic_hash";
          category = 'hash';
        } else if (isAsym) {
          usage = a.usage || "key_establishment";
          category = 'public_key';
        }

        const rawScore = a.scores?.quantumRisk !== undefined ? a.scores.quantumRisk : a.quantumRiskScore;
        const riskScore = rawScore !== null && rawScore !== undefined ? rawScore : (category === 'public_key' ? 100 : (category === 'symmetric' && algUpper.includes('128')) ? 60 : null);
        
        let quantumRisk = "Unavailable";
        if (riskScore !== null) {
          quantumRisk = riskScore >= 80 ? "High" : riskScore >= 50 ? "Medium" : "Low";
        } else if (a.quantumRisk && a.quantumRisk !== "Not Applicable" && a.quantumRisk !== "Context-Dependent") {
          quantumRisk = a.quantumRisk;
        }

        const depImpact = a.dependencyImpactScore ?? a.scores?.dependencyImpact ?? null;
        const pScore = a.priorityScore ?? (a.scores?.priorityScore !== null && a.scores?.priorityScore !== undefined ? Number(a.scores.priorityScore.toFixed(0)) : null);

        const rawPClass = a.priorityClassification || a.scores?.priorityClassification || a.priority;
        let pClassification = rawPClass;
        if (!pClassification || pClassification === 'Unavailable') {
          if (pScore !== null && pScore !== undefined) {
            pClassification = pScore >= 75 ? 'Urgent' : pScore >= 50 ? 'High' : pScore >= 25 ? 'Monitor' : 'Low';
          } else {
            pClassification = 'Unavailable';
          }
        }

        const directDeps = a.scores?.directDependents ?? a.directDependents ?? (depImpact !== null ? 1 : 0);
        const transDeps = a.scores?.transitiveDependents ?? a.transitiveDependents ?? 0;
        const reach = a.scores?.dependencyReach ?? a.dependencyReach ?? (depImpact !== null ? 35 : 0);

        return {
          asset: a.assetName || a.algorithm || a.asset,
          usage: usage,
          category: category,
          algorithm: a.algorithm,
          version: a.version || "Unknown",
          component: a.assetType || a.component || "Unknown",
          discoverySource: "Static Source Code",
          location: a.location || (a.locations && a.locations[0]) || "Location Not Available",
          locations: a.locations || (a.location ? [a.location] : []),
          occurrencesCount: a.occurrencesCount ?? (a.locations ? a.locations.length : 1),
          quantumRisk: quantumRisk,
          riskScore: riskScore,
          migrationComplexity: 50,
          dependencyImpact: depImpact,
          directDependents: directDeps,
          transitiveDependents: transDeps,
          dependencyReach: reach,
          hasDependencyEvidence: a.scores?.hasDependencyEvidence ?? a.hasDependencyEvidence ?? (depImpact !== null),
          dependencyCalculation: a.scores?.dependencyCalculation ?? a.dependencyCalculation ?? null,
          runtimeStatus: selectedApp.runtimeEnabled ? "Not Observed" : "Disabled",
          priorityScore: pScore,
          priority: pClassification,
          priorityClassification: pClassification,
          priorityRank: i + 1,
          authoritativeRecommendation: a.authoritativeRecommendation
        };
      })
    };
  }, [selectedApp, summaryData, assets]);

  const getRecommendation = (asset: any) => {
    // 1. If authoritative recommendation already exists from RecommendationAdvisor, use it directly
    if (asset.authoritativeRecommendation) {
      const rec = asset.authoritativeRecommendation;
      return {
        issue: rec.why || rec.purpose || "Cryptographic mechanism requires assessment under quantum or classical threat models.",
        approach: rec.strategy || rec.recommendation || rec.replacement,
        target: rec.replacement || rec.recommendation,
        guidance: Array.isArray(rec.implementationSteps) 
          ? rec.implementationSteps.join(' ') 
          : (rec.guidance || rec.strategy || "Review implementation guidance per NIST standards."),
        standard: rec.standard || rec.guidance || "NIST Guidance"
      };
    }

    const name = (asset.asset || asset.algorithm || "").toUpperCase();
    const usage = asset.usage || "";
    const category = asset.category || "";

    // 2. DES, 3DES, RC4 (Legacy / classically insecure symmetric ciphers)
    if (name.includes("3DES") || name.includes("DES3") || name === "DES" || name.includes("RC4")) {
      const cipher = (name.includes("3DES") || name.includes("DES3")) ? "3DES" : name.includes("RC4") ? "RC4" : "DES";
      return {
        issue: `${cipher} is a legacy cipher that is deprecated and vulnerable to classical cryptanalysis (such as Sweet32 64-bit block collision attacks for 3DES/DES or keystream bias attacks for RC4). This is a classical deprecation issue rather than a quantum replacement.`,
        approach: `Discontinue legacy cipher ${cipher} and migrate to authenticated encryption such as AES-GCM or ChaCha20-Poly1305.`,
        target: "AES-GCM (NIST SP 800-38D) / ChaCha20-Poly1305 (RFC 8439)",
        guidance: `Discontinue ${cipher} usage across all data stores and transport channels. Upgrade to AES-256-GCM or ChaCha20-Poly1305 with unique nonces per encryption.`,
        standard: "NIST SP 800-131A Rev. 2 / RFC 8439"
      };
    }

    // 3. PBKDF2 (Key Derivation Function)
    if (category === "kdf" || usage === "key_derivation" || name.includes("PBKDF2")) {
      return {
        issue: "PBKDF2 is a password-based key derivation function. Classical brute-force risks depend heavily on application context (password hashing vs symmetric key derivation).",
        approach: "Assess PBKDF2 context: for password storage, migrate to Argon2id; for key derivation, use PBKDF2 with appropriately audited parameters and a cryptographically secure random salt.",
        target: "Argon2id (password storage) / PBKDF2 with audited parameters and secure random salt (key derivation)",
        guidance: "Audit operational context: for password storage, migrate to Argon2id; for key derivation, enforce PBKDF2 with appropriately audited parameters and a cryptographically secure random salt.",
        standard: "NIST SP 800-132 / RFC 9106"
      };
    }

    // 4. AES with ECB mode
    if (name.includes("ECB") || /ECB/i.test(asset.algorithm || "") || asset.mode === "ECB") {
      return {
        issue: "The detected configuration uses ECB mode. ECB mode does not provide semantic security or ciphertext authenticity and leaks plaintext block patterns. Changing key size does not fix ECB mode.",
        approach: "Replace ECB mode with an authenticated encryption mode such as AES-GCM, and evaluate AES-256 where long-term protection requirements justify the stronger security margin.",
        target: "Replace ECB with AES-GCM and evaluate AES-256",
        guidance: "Migrate cipher mode to AES-GCM (NIST SP 800-38D). Changing AES-128 to AES-256 does not fix ECB mode. Ensure unique nonces per encryption.",
        standard: "NIST SP 800-38D / FIPS 197"
      };
    }

    // 5. AES-256 / AES-256-GCM (Modern Symmetric)
    if (name.includes("256") || name.includes("GCM")) {
      return {
        issue: "AES-256 provides 128 bits of post-quantum security against Grover's algorithm and is quantum-resistant. No PQC replacement required.",
        approach: "No PQC replacement required. Assess encryption mode, authenticated encryption, key management, nonce/IV handling, and key rotation.",
        target: "Assess Mode, Nonce/IV, and Key Management",
        guidance: "Review key management, key derivation, rotation schedules, and nonce uniqueness. Focus PQC migration on public-key dependencies.",
        standard: "FIPS 197 / NIST SP 800-38D"
      };
    }

    // 6. Symmetric general (AES-128 without ECB)
    if (usage === "symmetric_encryption" || category === "symmetric") {
      const is128 = name.includes("128");
      return {
        issue: is128 
          ? "AES-128 provides 128-bit classical security (reduced to ~64-bit under Grover's algorithm). Long-term data may justify a stronger margin."
          : "Symmetric cipher provides quantum resistance against Grover's algorithm with sufficient key length. No PQC replacement required.",
        approach: is128
          ? "Evaluate migration to AES-256 for long-lived or high-sensitivity data where the stronger security margin is appropriate."
          : "No PQC replacement required. Assess mode, nonce/IV handling, and key management.",
        target: is128 ? "Evaluate AES-256 Upgrade" : "Assess Mode, Nonce/IV, and Key Management",
        guidance: "Review key management, key derivation, rotation schedules, and nonce uniqueness. Focus PQC migration on public-key dependencies.",
        standard: "FIPS 197 / NIST SP 800-38D"
      };
    }

    // 7. Hash functions (SHA-256, SHA-384, SHA-512)
    if (usage === "cryptographic_hash" || category === "hash" || name.startsWith("SHA") || name.includes("HASH") || name.includes("MD5")) {
      return {
        issue: "Cryptographic hash functions provide robust collision and preimage resistance in the post-quantum era.",
        approach: "Retain SHA-2 hash functions without unnecessary post-quantum migration. Evaluate digest lengths separately.",
        target: "No PQC replacement required for the cryptographic hash itself",
        guidance: "Confirm hash function usage is restricted to data integrity, HMAC, or KDF inputs. Verify SHA-256 or higher is used.",
        standard: "NIST FIPS 180-4 / FIPS 202"
      };
    }

    // 8. Digital Signatures (RSA signatures, ECDSA, DSA)
    if (usage === "digital_signature" || name.includes("ECDSA") || name.includes("WITHRSA") || name.includes("RSA-SHA") || name.includes("SIGN")) {
      return {
        issue: "Factoring and discrete logarithm-based signatures (ECDSA, RSA signatures) are vulnerable to Shor's algorithm on a quantum computer.",
        approach: "Recommend ML-DSA or SLH-DSA depending on signature requirements. Consider dual-signing during transition.",
        target: "ML-DSA (FIPS 204) / SLH-DSA (FIPS 205)",
        guidance: "Identify all signature producers and verifiers. Upgrade PKI and certificates. Do not recommend ML-KEM for digital signatures.",
        standard: "NIST FIPS 204 / FIPS 205"
      };
    }

    // 9. Key Establishment (RSA encryption/PKE, ECDH, DH)
    return {
      issue: "Classical public-key exchange and encryption mechanisms (RSA, ECDH, DH) are vulnerable to Shor's algorithm (Harvest Now, Decrypt Later).",
      approach: "Recommend ML-KEM or an appropriate hybrid key-establishment approach according to application interoperability.",
      target: "ML-KEM (FIPS 203) / Hybrid Key Establishment",
      guidance: "Introduce ML-KEM-based key encapsulation or an appropriate hybrid deployment (e.g. X25519 + ML-KEM). Test ciphertext overhead and performance latency.",
      standard: "NIST FIPS 203"
    };
  };

  const getPhases = () => {
    if (!data) return { phase1: [], phase2: [], phase3: [] };
    const phase1 = data.discoveredAssets
      .filter(a => a.priority === "Urgent" || a.priorityClassification === "Urgent")
      .sort((a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1));
    const phase2 = data.discoveredAssets
      .filter(a => 
        a.priority === "High" || a.priorityClassification === "High" || 
        a.priority === "Monitor" || a.priorityClassification === "Monitor"
      )
      .sort((a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1));
    const phase3 = data.discoveredAssets
      .filter(a => a.priority === "Low" || a.priorityClassification === "Low")
      .sort((a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1));
    return { phase1, phase2, phase3 };
  };

  const riskChartData = React.useMemo(() => {
    if (!data || data.discoveredAssets.length === 0) return [];
    const high = data.discoveredAssets.filter(a => a.quantumRisk === "High").length;
    const med = data.discoveredAssets.filter(a => a.quantumRisk === "Medium").length;
    const low = data.discoveredAssets.filter(a => a.quantumRisk === "Low").length;
    const unknown = data.discoveredAssets.filter(a => a.quantumRisk !== "High" && a.quantumRisk !== "Medium" && a.quantumRisk !== "Low").length;
    const items = [];
    if (high > 0) items.push({ name: "High Risk (Shor's)", value: high, color: "#ef4444" });
    if (med > 0) items.push({ name: "Medium Risk (Grover)", value: med, color: "#f59e0b" });
    if (low > 0) items.push({ name: "Low Risk (Safe)", value: low, color: "#10b981" });
    if (unknown > 0) items.push({ name: "Unknown / Unavailable", value: unknown, color: "#6b7280" });
    return items;
  }, [data]);

  const classChartData = React.useMemo(() => {
    if (!data || data.discoveredAssets.length === 0) return [];
    const pubKey = data.discoveredAssets.filter(a => a.category === "public_key").length;
    const sym = data.discoveredAssets.filter(a => a.category === "symmetric").length;
    const hashOrKdf = data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").length;
    const items = [];
    if (pubKey > 0) items.push({ name: "Public-Key", value: pubKey, color: "#1e3a5f" });
    if (sym > 0) items.push({ name: "Symmetric", value: sym, color: "#ea580c" });
    if (hashOrKdf > 0) items.push({ name: "Hash / KDF", value: hashOrKdf, color: "#0d9488" });
    return items;
  }, [data]);

  // Top 10 Cryptographic Assets by Occurrence from CBOM (sorted descending)
  const topAssetsData = React.useMemo(() => {
    const countMap: Record<string, number> = {};

    // 1. Prefer raw CBOM components from the authoritative CBOM
    if (cbomRawData && Array.isArray(cbomRawData.components) && cbomRawData.components.length > 0) {
      cbomRawData.components.forEach((component: any) => {
        if (component.type === "cryptographic-asset" || component.name) {
          const name = component.name || component.cryptoProperties?.algorithmProperties?.name || "Unknown";
          const occs = component.evidence?.occurrences;
          const count = Array.isArray(occs) && occs.length > 0 ? occs.length : 1;
          countMap[name] = (countMap[name] || 0) + count;
        }
      });
    }

    // 2. Fallback to discoveredAssets / inventory
    if (Object.keys(countMap).length === 0 && data && data.discoveredAssets && data.discoveredAssets.length > 0) {
      data.discoveredAssets.forEach((a: any) => {
        const name = a.asset || a.algorithm || "Unknown";
        const count = Number(a.occurrencesCount) || 1;
        countMap[name] = (countMap[name] || 0) + count;
      });
    }

    // 3. Sort from highest occurrence to lowest occurrence, and take top 10 (or all if < 10)
    return Object.entries(countMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [cbomRawData, data]);

  const cbomStats = React.useMemo(() => {
    // 1. Compliance / Crypto Assets
    const totalOccurrences = cbomSummaryData?.totalCryptoAssets ?? (summaryData?.aggregates?.totalOccurrences ?? data?.totalOccurrences ?? 0);
    let unknown = cbomSummaryData?.unknown ?? 0;
    let notApplicable = cbomSummaryData?.notApplicable ?? 0;
    let notQuantumSafe = cbomSummaryData?.notQuantumSafe ?? 0;
    // IMPORTANT: Never derive Quantum Safe from (Total - NA - NQS). Only count explicit Quantum Safe classifications.
    let quantumSafe = typeof cbomSummaryData?.quantumSafe === 'number' ? cbomSummaryData.quantumSafe : 0;

    // Fallback tally across assets if cbomSummaryData not yet returned
    if (!cbomSummaryData && assets.length > 0) {
      unknown = 0;
      notApplicable = 0;
      notQuantumSafe = 0;
      quantumSafe = 0;
      assets.forEach((a: any) => {
        const weight = a.occurrencesCount || (a.locations ? a.locations.length : 1);
        const c = a.cbomKitClassification || a.cbomkitClassification;
        if (c === 'Quantum Safe' || c === 'quantum-safe' || c === 'quantum_safe') {
          quantumSafe += weight;
        } else if (c === 'Not Quantum Safe' || c === 'quantum-vulnerable' || c === 'quantum_vulnerable') {
          notQuantumSafe += weight;
        } else if (c === 'Not Applicable' || c === 'na' || c === 'not-applicable') {
          notApplicable += weight;
        } else {
          unknown += weight;
        }
      });
    }

    const complianceData: CbomkitChartItem[] = [
      { group: "Quantum Safe", value: quantumSafe },
      { group: "Not Quantum Safe", value: notQuantumSafe },
      { group: "Not Applicable", value: notApplicable },
      { group: "Unknown", value: unknown }
    ];

    // 2. Primitives & Functions from cbomRawData (unwrapping occurrences like CBOMKit)
    let detections: any[] = [];
    if (cbomRawData && Array.isArray(cbomRawData.components)) {
      cbomRawData.components.forEach((component: any) => {
        if (component.type === "cryptographic-asset") {
          const occs = component.evidence?.occurrences;
          if (Array.isArray(occs) && occs.length > 0) {
            occs.forEach((singleOcc: any) => {
              detections.push({
                ...component,
                evidence: { occurrences: [singleOcc] }
              });
            });
          } else {
            detections.push(component);
          }
        }
      });
    }

    const capitalize = (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    };

    const primitiveMap: Record<string, number> = {};
    const functionsMap: Record<string, number> = {};

    if (detections.length > 0) {
      detections.forEach((c) => {
        const prim = c.cryptoProperties?.algorithmProperties?.primitive;
        if (prim) {
          const formatted = capitalize(prim);
          primitiveMap[formatted] = (primitiveMap[formatted] || 0) + 1;
        }

        const funcs = c.cryptoProperties?.algorithmProperties?.cryptoFunctions;
        if (funcs) {
          const list = Array.isArray(funcs) ? funcs : [funcs];
          list.forEach((f: string) => {
            const formatted = capitalize(f);
            functionsMap[formatted] = (functionsMap[formatted] || 0) + 1;
          });
        }
      });
    } else if (assets && assets.length > 0) {
      assets.forEach((a: any) => {
        const weight = a.occurrencesCount || (a.locations ? a.locations.length : 1);
        const prim = a.primitive || (a.category === 'symmetric' ? 'block-cipher' : a.category === 'public_key' ? 'pke' : a.category === 'hash' ? 'hash' : 'other');
        const formattedPrim = capitalize(prim);
        primitiveMap[formattedPrim] = (primitiveMap[formattedPrim] || 0) + weight;

        const func = a.usage ? a.usage.replace(/_/g, ' ') : (a.category === 'symmetric' ? 'encrypt' : a.category === 'public_key' ? 'verify' : 'digest');
        const formattedFunc = capitalize(func);
        functionsMap[formattedFunc] = (functionsMap[formattedFunc] || 0) + weight;
      });
    }

    const primitiveData: CbomkitChartItem[] = Object.entries(primitiveMap)
      .map(([group, value]) => ({ group, value }))
      .sort((a, b) => b.value - a.value);

    const functionsData: CbomkitChartItem[] = Object.entries(functionsMap)
      .map(([group, value]) => ({ group, value }))
      .sort((a, b) => b.value - a.value);

    return {
      complianceData,
      totalCryptoAssets: totalOccurrences,
      unknown,
      notApplicable,
      notQuantumSafe,
      quantumSafe,
      primitiveData,
      primitiveCount: primitiveData.length,
      functionsData,
      functionsCount: functionsData.length
    };
  }, [cbomSummaryData, cbomRawData, data, assets]);

  const generatePDF = () => {
    if (!data) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const doc = new jsPDF();
      const phases = getPhases();
      
      const addHeading = (text: string, yPos: number, level = 1) => {
        if (level === 1) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(30, 58, 95);
          doc.text(text, 14, yPos);
          return yPos + 8;
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(50, 50, 50);
          doc.text(text, 14, yPos);
          return yPos + 6;
        }
      };

      const addText = (text: string, yPos: number, isBold = false) => {
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 14, yPos);
        return yPos + (splitText.length * 5);
      };

      // Cover Page
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(30, 58, 95);
      doc.text("CRYPTAVISTA", 105, 100, { align: "center" });
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text("Cryptographic Discovery & PQC Readiness Assessment", 105, 115, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(data.analysisName || "CryptaVista Application", 105, 140, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 105, 160, { align: "center" });
      doc.text(`Analysis ID: ${data.analysisId}`, 105, 167, { align: "center" });
      doc.addPage();
      
      // 1. EXECUTIVE SUMMARY
      let y = 20;
      y = addHeading("1. EXECUTIVE SUMMARY", y);
      const highRiskCount = summaryData?.aggregates?.quantumVulnerable ?? data.discoveredAssets.filter(a => a.quantumRisk === "High").length;
      const pubKeyCount = summaryData?.aggregates?.publicKey ?? data.discoveredAssets.filter(a => a.category === "public_key").length;
      const symCount = summaryData?.aggregates?.symmetric ?? data.discoveredAssets.filter(a => a.category === "symmetric").length;
      const hashCount = summaryData?.aggregates?.hashOrKdf ?? data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").length;

      const execSummaryTable: string[][] = [
        ['Total Cryptographic Asset Occurrences', (cbomStats.totalCryptoAssets || data.totalOccurrences).toString()],
        ['Total Unique Logical Assets', data.uniqueLogicalAssetsCount.toString()],
        ['Quantum-Safe Assets', cbomStats.quantumSafe.toString()],
        ['Not Quantum-Safe Assets', cbomStats.notQuantumSafe.toString()],
        ['Not Applicable (Symmetric / Hash)', cbomStats.notApplicable.toString()],
        ['Unknown / Unclassified', cbomStats.unknown.toString()],
        ['Public-Key Assets', pubKeyCount.toString()],
        ['Symmetric Cryptographic Assets', symCount.toString()],
        ['Hash / KDF Assets', hashCount.toString()],
        ['Runtime Verification Status', data.configuration.runtimeEnabled ? `Enabled (${data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length} assets observed)` : 'Runtime Analysis: Disabled']
      ];

      autoTable(doc, {
        startY: y,
        head: [['Executive Summary Metric', 'Assessment Finding']],
        body: execSummaryTable,
        headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 15;

      // 2. CBOM CRYPTOGRAPHIC INVENTORY / VISUALIZATION
      if (y > 200) { doc.addPage(); y = 20; }
      y = addHeading("2. CBOM CRYPTOGRAPHIC INVENTORY / VISUALIZATION", y);
      y = addText(`CBOM Occurrences: ${cbomStats.totalCryptoAssets} total detections across ${data.uniqueLogicalAssetsCount} unique logical assets.`, y);
      y += 4;

      const cbomInventoryTable: string[][] = [
        ['Crypto Assets Compliance', 'Quantum Safe', cbomStats.quantumSafe.toString(), `${cbomStats.totalCryptoAssets > 0 ? ((cbomStats.quantumSafe / cbomStats.totalCryptoAssets) * 100).toFixed(1) : 0}%`],
        ['Crypto Assets Compliance', 'Not Quantum Safe', cbomStats.notQuantumSafe.toString(), `${cbomStats.totalCryptoAssets > 0 ? ((cbomStats.notQuantumSafe / cbomStats.totalCryptoAssets) * 100).toFixed(1) : 0}%`],
        ['Crypto Assets Compliance', 'Not Applicable', cbomStats.notApplicable.toString(), `${cbomStats.totalCryptoAssets > 0 ? ((cbomStats.notApplicable / cbomStats.totalCryptoAssets) * 100).toFixed(1) : 0}%`],
        ['Crypto Assets Compliance', 'Unknown', cbomStats.unknown.toString(), `${cbomStats.totalCryptoAssets > 0 ? ((cbomStats.unknown / cbomStats.totalCryptoAssets) * 100).toFixed(1) : 0}%`],
      ];
      cbomStats.primitiveData.slice(0, 6).forEach((p) => {
        cbomInventoryTable.push(['Cryptographic Primitives', p.group, p.value.toString(), `${cbomStats.totalCryptoAssets > 0 ? ((p.value / cbomStats.totalCryptoAssets) * 100).toFixed(1) : 0}%`]);
      });
      autoTable(doc, {
        startY: y,
        head: [['Inventory Domain', 'Classification / Primitive', 'Occurrences', 'Share (%)']],
        body: cbomInventoryTable,
        headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 15;

      // 3. PRIORITY / RISK ANALYSIS
      if (y > 200) { doc.addPage(); y = 20; }
      y = addHeading("3. PRIORITY / RISK ANALYSIS", y);
      y = addText(`Application Priority Score (APS) = ${data.applicationPriority.aps?.toFixed(2) ?? '0.00'} | Priority Tier: ${data.applicationPriority.overallPriority || 'P4'}`, y, true);
      y = addText(`APS Formula = (Mosca Urgency: ${data.applicationPriority.moscaUrgency?.toFixed(2) ?? '0.00'} + Data Sensitivity: ${data.applicationPriority.dataSensitivity?.toFixed(2) ?? '0.00'} + Business Criticality: ${data.applicationPriority.businessCriticality?.toFixed(2) ?? '0.00'}) / 3`, y);
      const moscaMargin = data.applicationPriority.moscaVariables.timingMargin ?? (data.applicationPriority.moscaVariables.quantumRiskHorizon - (data.applicationPriority.moscaVariables.dataProtectionLifetime + data.applicationPriority.moscaVariables.migrationDuration));
      y = addText(`Mosca Timing Margin (Z - (X + Y)) = ${moscaMargin} years (X=${data.applicationPriority.moscaVariables.dataProtectionLifetime}y, Y=${data.applicationPriority.moscaVariables.migrationDuration}y, Z=${data.applicationPriority.moscaVariables.quantumRiskHorizon}y, Horizon: ${data.applicationPriority.moscaVariables.quantumThreatHorizon})`, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [['Rank', 'Asset', 'Component', 'Quantum Risk', 'Complexity', 'Impact', 'Priority Score (CPS)']],
        body: data.discoveredAssets.sort((a,b) => a.priorityRank - b.priorityRank).map(a => [
          (a.priorityRank ?? '-').toString(),
          a.asset || 'Unknown',
          a.component || 'Unknown',
          a.quantumRisk || 'Unavailable',
          (a.migrationComplexity ?? 50).toString(),
          a.dependencyImpact !== null && a.dependencyImpact !== undefined ? a.dependencyImpact.toString() : 'Unavailable',
          a.priorityScore !== null && a.priorityScore !== undefined ? a.priorityScore.toString() : 'N/A'
        ]),
        headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 15;

      // 4. DEPENDENCY & BLAST RADIUS ANALYSIS
      if (y > 200) { doc.addPage(); y = 20; }
      y = addHeading("4. DEPENDENCY & BLAST RADIUS ANALYSIS", y);
      const totalEdges = dependencyData?.summary?.totalEdges ?? summaryData?.dependencies?.totalEdges ?? (data.discoveredAssets ? data.discoveredAssets.filter(a => a.directDependents > 0).length : 0);
      y = addText(`Topology Metrics: ${data.totalOccurrences} occurrences across ${data.uniqueLogicalAssetsCount} unique logical components with ${totalEdges} verified dependency relationships.`, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Asset', 'Occurrences', 'Component / Usage', 'Location', 'Blast Radius (Dependents)', 'Reach (%)', 'Impact Score']],
        body: data.discoveredAssets.map(a => [
          a.asset || 'Unknown',
          (a.occurrencesCount || 1).toString(),
          `${a.component || 'Unknown'} (${a.usage.replace(/_/g, ' ')})`,
          a.location || 'Location Not Available',
          (a.directDependents ?? 0).toString(),
          `${a.dependencyReach ?? 0}%`,
          a.dependencyImpact !== null && a.dependencyImpact !== undefined ? a.dependencyImpact.toString() : 'Unavailable'
        ]),
        headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 15;

      // 5. 3-PHASE MIGRATION ROADMAP
      if (y > 220) { doc.addPage(); y = 20; }
      y = addHeading("5. 3-PHASE MIGRATION ROADMAP", y);
      if (phases.phase1.length > 0) {
        y = addText("Phase 1 — Highest Priority Components (Urgent Action Required):", y, true);
        phases.phase1.forEach(a => {
          if (y > 270) { doc.addPage(); y = 20; }
          y = addText(`  - ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
        });
        y+=4;
      }
      if (phases.phase2.length > 0) {
        y = addText("Phase 2 — Next Priority Components (Plan & Prepare):", y, true);
        phases.phase2.forEach(a => {
          if (y > 270) { doc.addPage(); y = 20; }
          y = addText(`  - ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
        });
        y+=4;
      }
      if (phases.phase3.length > 0) {
        y = addText("Phase 3 — Low Priority / Monitor (Standards Compliance):", y, true);
        phases.phase3.forEach(a => {
          if (y > 270) { doc.addPage(); y = 20; }
          y = addText(`  - ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
        });
        y+=8;
      }

      // 6. MIGRATION RECOMMENDATIONS
      doc.addPage(); y = 20;
      y = addHeading("6. MIGRATION RECOMMENDATIONS", y);
      data.discoveredAssets.forEach(a => {
        const rec = getRecommendation(a);
        if (y > 230) { doc.addPage(); y = 20; }
        y = addHeading(`Asset: ${a.asset} (${a.component})`, y, 2);
        y = addText(`Current Usage: ${a.usage.replace(/_/g, ' ')}`, y);
        y = addText(`Technical Issue: ${rec.issue}`, y);
        y = addText(`Recommended Approach: ${rec.approach}`, y);
        y = addText(`Suggested Target: ${rec.target}`, y, true);
        y = addText(`Implementation Guidance: ${rec.guidance}`, y);
        y = addText(`Standard Reference: ${rec.standard}`, y);
        y += 8;
      });

      // 7. ASSESSMENT SUMMARY & ACTION PLAN
      if (y > 220) { doc.addPage(); y = 20; }
      y = addHeading("7. ASSESSMENT SUMMARY & ACTION PLAN", y);
      y = addText("Cryptographic Inventory: Complete based on available scan data", y);
      y = addText(`Quantum Risk: Quantum-Safe: ${cbomStats.quantumSafe} | Not Quantum-Safe: ${cbomStats.notQuantumSafe} | Not Applicable: ${cbomStats.notApplicable} | Unknown: ${cbomStats.unknown}`, y);
      y = addText(`Runtime Verification: ${data.configuration.runtimeEnabled ? "Enabled and Completed" : "Disabled"} | Static Analysis: Completed`, y);
      y = addText(`Phase 1 (Urgent): ${phases.phase1.length} assets | Phase 2 (Plan): ${phases.phase2.length} assets | Phase 3 (Monitor): ${phases.phase3.length} assets`, y);
      y += 4;
      y = addText("Recommended Workflow:", y, true);
      const workflowSteps = [
        "1. Address Phase 1 quantum-vulnerable public-key assets.",
        "2. Introduce appropriate PQC or hybrid key-establishment/signature mechanisms.",
        "3. Review Phase 2 symmetric cryptography configurations.",
        "4. Maintain and validate Phase 3 quantum-safe / low-priority assets.",
        "5. Re-scan the application after migration.",
        "6. Re-evaluate dependency and blast-radius information when runtime/dependency analysis becomes available.",
        "7. Compare the updated CBOM against this assessment to verify migration progress."
      ];
      workflowSteps.forEach(s => { if (y > 270) { doc.addPage(); y = 20; } y = addText(s, y); });
      y += 8;

      // 8. STANDARDS & REFERENCES
      if (y > 220) { doc.addPage(); y = 20; }
      y = addHeading("8. STANDARDS & REFERENCES", y, 2);
      y = addText("- NIST FIPS 203 (ML-KEM) - Module-Lattice-Based Key-Encapsulation Mechanism Standard", y);
      y = addText("- NIST FIPS 204 (ML-DSA) - Module-Lattice-Based Digital Signature Standard", y);
      y = addText("- NIST FIPS 205 (SLH-DSA) - Stateless Hash-Based Digital Signature Standard", y);
      y = addText("- NIST SP 800-208 - Recommendation for Stateful Hash-Based Signature Schemes", y);
      y = addText("- NIST SP 800-38D - Galois/Counter Mode (GCM) for Block Cipher Algorithms", y);
      y = addText("- RFC 9106 - Argon2 Password Hashing and Memory-Hard Function", y);
      y = addText("- RFC 8439 - ChaCha20 and Poly1305 for IETF Protocols", y);
      y = addText("- NIST SP 800-131A Rev. 2 - Transitioning the Use of Cryptographic Algorithms and Key Lengths", y);

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: "right" });
      }

      const sanitizedAppName = (data.analysisName || "Application").replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(`CRYPTAVISTA-${sanitizedAppName}-${data.analysisId}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      setExportError((err as Error).message || "Failed to generate report PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const phases = getPhases();
  const totalEdges = dependencyData?.summary?.totalEdges ?? summaryData?.dependencies?.totalEdges ?? (data?.discoveredAssets ? data.discoveredAssets.filter(a => (a.directDependents || 0) > 0).length : 0);
  const maxReach = data?.discoveredAssets && data.discoveredAssets.length > 0 ? Math.max(...data.discoveredAssets.map(a => a.dependencyReach ?? 0), 0) : 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f5f6f8]">
        <Loader2 className="animate-spin text-[#1e3a5f]" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 p-6 bg-[#f5f6f8]">
        <div className="bg-white border border-[#dde1e9] rounded-lg p-10 text-center">
          <h3 className="text-lg font-semibold text-[#1a1d23] mb-2">No Application Selected</h3>
          <p className="text-[#6b7589] text-[13px]">Select an application from the top header to view its assessment report.</p>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex-1 p-6 bg-[#f5f6f8]">
        <div className="bg-white border border-[#dde1e9] rounded-lg p-10 text-center max-w-xl mx-auto">
          <Info className="mx-auto text-[#6b7589] mb-3" size={28} />
          <h3 className="text-lg font-semibold text-[#1a1d23] mb-2">No cryptographic assets were detected for this application.</h3>
          <p className="text-[#6b7589] text-[13px]">The discovery scan completed without identifying cryptographic primitives or algorithm calls in this codebase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-12">
        
        {/* REPORT SELECTION */}
        <div>
          <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
            <div>
              <h1 className="text-[#1e3a5f] text-2xl font-bold mb-1">Cryptographic Analysis Report</h1>
              <p className="text-gray-500 text-sm">Generated assessment report for the selected application.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ApplicationSelector
                analyses={analyses}
                selectedAnalysisId={effectiveAnalysisId}
                onSelectAnalysis={onSelectAnalysis}
              />
              <button 
                disabled={isExporting}
                className="flex items-center gap-2 bg-[#1e3a5f] text-white px-5 py-2.5 rounded text-sm font-semibold hover:bg-[#152a44] transition-colors disabled:opacity-60 cursor-pointer shadow-2xs"
                onClick={generatePDF}
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {isExporting ? "Generating PDF..." : "Export PDF"}
              </button>
            </div>
          </div>

          {exportError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {exportError}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded p-4 text-[13px] grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Application Name</div>
              <div className="font-semibold text-[#1e3a5f]">{data.analysisName}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Analysis ID</div>
              <div className="font-semibold text-[#1e3a5f]">{data.analysisId}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Analysis Date</div>
              <div className="font-semibold text-[#1e3a5f]">{data.date}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Runtime Analysis Status</div>
              <div className="font-semibold text-[#1e3a5f]">{data.configuration.runtimeEnabled ? "Enabled and Completed" : "Disabled"}</div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-10 space-y-12">
          
          {/* 1. EXECUTIVE SUMMARY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">
              1. Executive Summary
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3 text-[13px]">
                {/* Total Occurrences */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-lg">
                  <div className="text-gray-500 mb-1 text-[11px] font-medium leading-tight">Total Occurrences</div>
                  <div className="font-bold text-2xl text-[#1e3a5f]">{cbomStats.totalCryptoAssets || data.totalOccurrences}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Asset occurrences</div>
                </div>

                {/* Unique Assets */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-lg">
                  <div className="text-gray-500 mb-1 text-[11px] font-medium leading-tight">Unique Assets</div>
                  <div className="font-bold text-2xl text-slate-800">{data.uniqueLogicalAssetsCount}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Logical primitives</div>
                </div>

                {/* Quantum Safe */}
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg">
                  <div className="text-emerald-700 mb-1 text-[11px] font-semibold leading-tight">Quantum Safe</div>
                  <div className="font-bold text-2xl text-emerald-700">{cbomStats.quantumSafe}</div>
                  <div className="text-[10px] text-emerald-600/80 mt-0.5">Quantum-safe</div>
                </div>

                {/* Not Quantum Safe */}
                <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-lg">
                  <div className="text-amber-800 mb-1 text-[11px] font-semibold leading-tight">Not Quantum Safe</div>
                  <div className="font-bold text-2xl text-amber-700">{cbomStats.notQuantumSafe}</div>
                  <div className="text-[10px] text-amber-600/80 mt-0.5">Vulnerable</div>
                </div>

                {/* Not Applicable */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-lg">
                  <div className="text-slate-600 mb-1 text-[11px] font-medium leading-tight">Not Applicable</div>
                  <div className="font-bold text-2xl text-slate-700">{cbomStats.notApplicable}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Symmetric / Hash</div>
                </div>

                {/* Unknown */}
                <div className="p-3.5 bg-sky-50/60 border border-sky-200/80 rounded-lg">
                  <div className="text-sky-800 mb-1 text-[11px] font-medium leading-tight">Unknown</div>
                  <div className="font-bold text-2xl text-sky-800">{cbomStats.unknown}</div>
                  <div className="text-[10px] text-sky-600/80 mt-0.5">Unclassified</div>
                </div>

                {/* Public-Key */}
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-200/80 rounded-lg">
                  <div className="text-indigo-800 mb-1 text-[11px] font-medium leading-tight">Public-Key</div>
                  <div className="font-bold text-2xl text-indigo-900">{summaryData?.aggregates?.publicKey ?? data.discoveredAssets.filter(a => a.category === "public_key").length}</div>
                  <div className="text-[10px] text-indigo-600/80 mt-0.5">Asymmetric</div>
                </div>

                {/* Symmetric */}
                <div className="p-3.5 bg-orange-50/50 border border-orange-200/80 rounded-lg">
                  <div className="text-orange-800 mb-1 text-[11px] font-medium leading-tight">Symmetric</div>
                  <div className="font-bold text-2xl text-orange-800">{summaryData?.aggregates?.symmetric ?? data.discoveredAssets.filter(a => a.category === "symmetric").length}</div>
                  <div className="text-[10px] text-orange-600/80 mt-0.5">Block / Stream</div>
                </div>

                {/* Hash / KDF */}
                <div className="p-3.5 bg-teal-50/50 border border-teal-200/80 rounded-lg">
                  <div className="text-teal-800 mb-1 text-[11px] font-medium leading-tight">Hash / KDF</div>
                  <div className="font-bold text-2xl text-teal-800">{summaryData?.aggregates?.hashOrKdf ?? data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").length}</div>
                  <div className="text-[10px] text-teal-600/80 mt-0.5">Integrity / KDF</div>
                </div>
              </div>

              {/* Runtime Verification Status Banner */}
              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">Runtime Verification Status:</span>
                  {data.configuration.runtimeEnabled ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Runtime Analysis: Enabled ({data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length} observed)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded font-semibold">
                      <Info size={13} className="text-slate-500" />
                      Runtime Analysis: Disabled
                    </span>
                  )}
                </div>
                <div className="text-gray-400 italic">
                  {data.configuration.runtimeEnabled
                    ? "Runtime evidence is verification metadata and does not reduce theoretical quantum risk."
                    : "Runtime verification was not performed for this analysis. Static discovery findings remain included in the assessment."}
                </div>
              </div>
            </div>
          </section>

          {/* 2. CBOM CRYPTOGRAPHIC INVENTORY / VISUALIZATION */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-1 border-l-4 border-[#1e3a5f] pl-3">
              2. CBOM Cryptographic Inventory / Visualization
            </h2>
            <p className="text-sm text-gray-500 pl-4 mb-5">Complete cryptographic inventory and distribution of detected cryptographic assets.</p>
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
                  <div className="font-bold text-sm text-[#1e3a5f] mb-1">A. Crypto Assets</div>
                  <div className="text-xs text-gray-500 mb-4">Post-quantum compliance distribution across all detected cryptographic assets.</div>
                  <CbomkitDonutChart
                    centerNumber={cbomStats.totalCryptoAssets}
                    centerLabel="Crypto Assets"
                    data={cbomStats.complianceData}
                    height={300}
                  />
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
                  <div className="font-bold text-sm text-[#1e3a5f] mb-1">B. Crypto Primitives</div>
                  <div className="text-xs text-gray-500 mb-4">Distribution of detected cryptographic primitives (signatures, hashes, block ciphers, key agreements, etc.).</div>
                  <CbomkitDonutChart
                    centerNumber={cbomStats.primitiveCount}
                    centerLabel="Crypto Primitives"
                    data={cbomStats.primitiveData}
                    height={300}
                  />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
                <div className="font-bold text-sm text-[#1e3a5f] mb-1">C. Crypto Functions</div>
                <div className="text-xs text-gray-500 mb-4">Distribution of detected operational cryptographic functions (verify, sign, encrypt, decrypt, digest, keygen, encapsulate, decapsulate, etc.).</div>
                <div className="max-w-2xl mx-auto">
                  <CbomkitDonutChart
                    centerNumber={cbomStats.functionsCount}
                    centerLabel="Crypto Functions"
                    data={cbomStats.functionsData}
                    height={300}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. PRIORITY / RISK ANALYSIS */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">
              3. Priority / Risk Analysis
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5 text-[13px] shadow-2xs">
                  <h3 className="font-bold text-[#1e3a5f] mb-4 text-sm">Application Priority Calculation</h3>
                  <div className="space-y-2 mb-4 text-gray-700">
                    <div className="flex justify-between border-b border-gray-100 pb-2"><span>Mosca Urgency (M):</span> <span className="font-mono">Score: {data.applicationPriority.moscaUrgency.toFixed(2)}</span></div>
                    <div className="flex justify-between border-b border-gray-100 pb-2"><span>Data Sensitivity (D):</span> <span className="font-mono">Score: {data.applicationPriority.dataSensitivity.toFixed(2)}</span></div>
                    <div className="flex justify-between border-b border-gray-100 pb-2"><span>Business Criticality (B):</span> <span className="font-mono">Score: {data.applicationPriority.businessCriticality.toFixed(2)}</span></div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded font-mono text-center text-gray-600 mb-4 text-xs">
                    APS = ({data.applicationPriority.moscaUrgency.toFixed(2)} + {data.applicationPriority.dataSensitivity.toFixed(2)} + {data.applicationPriority.businessCriticality.toFixed(2)}) / 3
                  </div>
                  <div className="text-center pt-2">
                    <div className="text-gray-500 mb-1">Application Priority Score = {data.applicationPriority.aps.toFixed(2)}</div>
                    <div className="font-bold text-lg text-[#1e3a5f]">Application Priority = {data.applicationPriority.overallPriority}</div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 text-[13px] shadow-2xs">
                  <h3 className="font-bold text-[#1e3a5f] mb-4 text-sm">Mosca Framework Variables</h3>
                  <div className="space-y-2 mb-4 text-gray-700">
                    <div className="flex justify-between border-b border-gray-100 pb-2"><span>Data Protection Lifetime (X):</span> <span>{data.applicationPriority.moscaVariables.dataProtectionLifetime} years</span></div>
                    <div className="flex justify-between border-b border-gray-100 pb-2"><span>Migration Duration (Y):</span> <span>{data.applicationPriority.moscaVariables.migrationDuration} years</span></div>
                    <div className="flex justify-between border-b border-gray-100 pb-2"><span>Quantum Threat Horizon:</span> <span>{data.applicationPriority.moscaVariables.quantumThreatHorizon} (Calendar Year)</span></div>
                    <div className="flex justify-between border-b border-gray-100 pb-2"><span>Quantum Risk Horizon (Z):</span> <span>{data.applicationPriority.moscaVariables.quantumRiskHorizon} years</span></div>
                  </div>
                  <div className="bg-[#f0f4f8] border border-blue-100 p-3 rounded text-center">
                    <div className="text-[#1e3a5f] font-bold mb-1">
                      Mosca Margin (Z - (X + Y)): {data.applicationPriority.moscaVariables.timingMargin ?? (data.applicationPriority.moscaVariables.quantumRiskHorizon - (data.applicationPriority.moscaVariables.dataProtectionLifetime + data.applicationPriority.moscaVariables.migrationDuration))} years
                    </div>
                    <div className="text-gray-600 text-[11px]">Z - (X + Y). A positive margin indicates data will be protected before quantum threats mature; a negative or narrow margin demands immediate migration.</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#1e3a5f]">Component-Level Priority Ranking (CPS)</h3>
                  <span className="text-xs text-gray-500">Sorted by Component Priority Score</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#f5f6f8] text-[#1e3a5f] font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Cryptographic Asset</th>
                        <th className="px-4 py-3">Component / Usage</th>
                        <th className="px-4 py-3">Quantum Risk</th>
                        <th className="px-4 py-3 text-center">Priority Score (CPS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.discoveredAssets.sort((a,b) => a.priorityRank - b.priorityRank).map((a, i) => {
                        const isExpanded = expandedAsset === `priority-${a.asset}`;
                        return (
                          <React.Fragment key={i}>
                            <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedAsset(isExpanded ? null : `priority-${a.asset}`)}>
                              <td className="px-4 py-3 font-semibold text-gray-500">#{a.priorityRank}</td>
                              <td className="px-4 py-3 font-semibold text-[#1e3a5f] flex items-center gap-2">
                                {isExpanded ? <ChevronDown size={14} className="text-gray-400"/> : <ChevronRight size={14} className="text-gray-400"/>}
                                {a.asset}
                              </td>
                              <td className="px-4 py-3 text-gray-700">{a.component}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                                  a.quantumRisk === "High" ? "bg-red-50 text-red-700 border border-red-200" :
                                  a.quantumRisk === "Medium" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}>
                                  {a.quantumRisk}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-[#1e3a5f]">{a.priorityScore !== null && a.priorityScore !== undefined ? a.priorityScore : "N/A"}</td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50">
                                <td colSpan={5} className="px-10 py-5 border-b border-gray-200">
                                  <h4 className="font-bold text-[#1e3a5f] text-[12px] uppercase tracking-wider mb-3">Component Priority Calculation</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-[12px]">
                                    <div>
                                      <div className="text-gray-500 mb-1">Quantum Vulnerability</div>
                                      <div className="font-semibold text-gray-800">{a.quantumRisk}</div>
                                      <div className="text-gray-400 font-mono mt-1">Score: {a.riskScore !== null && a.riskScore !== undefined ? a.riskScore : "N/A"}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-500 mb-1">Migration Complexity</div>
                                      <div className="font-semibold text-gray-800">{a.migrationComplexity >= 80 ? "High" : a.migrationComplexity >= 50 ? "Medium" : "Low"}</div>
                                      <div className="text-gray-400 font-mono mt-1">Score: {a.migrationComplexity}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-500 mb-1">Dependency Impact</div>
                                      <div className="font-semibold text-gray-800">
                                        {a.dependencyImpact !== null && a.dependencyImpact !== undefined
                                          ? (a.dependencyImpact >= 80 ? "High" : a.dependencyImpact >= 50 ? "Medium" : "Low")
                                          : "Unavailable"}
                                      </div>
                                      <div className="text-gray-400 font-mono mt-1">
                                        Score: {a.dependencyImpact !== null && a.dependencyImpact !== undefined ? a.dependencyImpact : "N/A"}
                                      </div>
                                    </div>
                                    <div className="border-l border-slate-200 pl-6">
                                      <div className="text-gray-500 mb-1">Runtime Evidence</div>
                                      <div className="font-semibold text-[#1e3a5f]">{a.runtimeStatus}</div>
                                      <div className="text-[10px] text-gray-400 italic mt-1 leading-tight">Runtime evidence is verification metadata and does not modify the priority score.</div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* 4. DEPENDENCY & BLAST RADIUS ANALYSIS */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">
              4. Dependency &amp; Blast Radius Analysis
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                  <div className="text-xs text-gray-500 mb-1">Cryptographic Asset Occurrences</div>
                  <div className="text-2xl font-bold text-[#1e3a5f]">{data.totalOccurrences}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Total instances detected in code</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                  <div className="text-xs text-gray-500 mb-1">Unique Component Nodes</div>
                  <div className="text-2xl font-bold text-slate-800">{data.uniqueLogicalAssetsCount}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Logical assets mapped in inventory</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                  <div className="text-xs text-gray-500 mb-1">Verified Dependency Edges</div>
                  <div className="text-2xl font-bold text-indigo-900">{totalEdges}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Component-to-asset linkages</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                  <div className="text-xs text-gray-500 mb-1">Max Dependency Reach</div>
                  <div className="text-2xl font-bold text-amber-700">{maxReach}%</div>
                  <div className="text-[11px] text-gray-400 mt-1">Highest blast radius across assets</div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#1e3a5f]">Component Discovery &amp; Blast Radius Mapping</h3>
                  <span className="text-xs text-gray-500">Blast radius propagation across application layers</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#f5f6f8] text-[#1e3a5f] font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Cryptographic Asset</th>
                        <th className="px-4 py-3">Occurrences</th>
                        <th className="px-4 py-3">Component / Usage</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3 text-center">Blast Radius (Dependents)</th>
                        <th className="px-4 py-3 text-center">Reach</th>
                        <th className="px-4 py-3 text-center">Dependency Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.discoveredAssets.map((a, i) => (
                        <tr key={i} className="hover:bg-gray-50/80">
                          <td className="px-4 py-3 font-semibold text-[#1e3a5f]">{a.asset}</td>
                          <td className="px-4 py-3 font-semibold text-[#1e3a5f]">{a.occurrencesCount || 1}</td>
                          <td className="px-4 py-3 text-gray-700">{a.component} <span className="text-gray-400 text-xs">({a.usage.replace(/_/g, " ")})</span></td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-[11px] max-w-xs truncate" title={a.location}>{a.location || "Location Not Available"}</td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-700">
                            {a.directDependents ? `${a.directDependents} direct` : "0 direct"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                              {a.dependencyReach ?? 0}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {a.dependencyImpact !== null && a.dependencyImpact !== undefined ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-xs">
                                Score: {a.dependencyImpact}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                Unavailable
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 bg-slate-50 border-t border-gray-100 text-[11px] text-gray-500 italic">
                  Dependency Reach measures the propagation of changes required across callers and dependent components if this cryptographic asset is migrated or replaced.
                </div>
              </div>
            </div>
          </section>

          {/* 5. 3-PHASE MIGRATION ROADMAP */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">
              5. 3-Phase Migration Roadmap
            </h2>
            <div className="space-y-4">
              {/* Phase 1 — Red / Urgent */}
              <div className="border border-red-200 bg-red-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                    <h3 className="font-bold text-red-900 text-sm">Phase 1 — Highest Priority Components</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-800 bg-red-100 border border-red-200 px-2 py-0.5 rounded">PRIORITY: URGENT</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded">{phases.phase1.length} assets</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-red-700 font-semibold mb-3">
                  <ShieldAlert size={13} className="text-red-600 shrink-0" />
                  Urgent Action Required — quantum-vulnerable public-key cryptography detected
                </div>
                <div className="space-y-2">
                  {phases.phase1.map((a, i) => (
                    <div key={i} className="bg-white border border-red-100 rounded-md p-3 flex flex-col md:flex-row gap-3 justify-between shadow-2xs">
                      <div className="font-bold text-red-900 md:w-1/4 text-[13px]">{a.asset}</div>
                      <div className="text-gray-600 md:w-1/4 text-[12px]">{a.component}</div>
                      <div className="flex items-center gap-1.5 md:w-1/2">
                        <ArrowRight size={13} className="shrink-0 text-red-500" />
                        <span className="text-[#1e3a5f] font-semibold text-[12px]">Target: {getRecommendation(a).target}</span>
                      </div>
                    </div>
                  ))}
                  {phases.phase1.length === 0 && <div className="text-xs text-gray-500 italic border border-dashed border-red-200 rounded p-3">No assets categorized under Phase 1 for this application.</div>}
                </div>
              </div>

              {/* Phase 2 — Amber */}
              <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <h3 className="font-bold text-amber-900 text-sm">Phase 2 — Next Priority Components</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">PRIORITY: HIGH</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded">{phases.phase2.length} assets</span>
                </div>
                <div className="text-xs text-amber-700 font-semibold mb-3">Plan &amp; Prepare — review symmetric cryptography configurations and key management</div>
                <div className="space-y-2">
                  {phases.phase2.map((a, i) => (
                    <div key={i} className="bg-white border border-amber-100 rounded-md p-3 flex flex-col md:flex-row gap-3 justify-between shadow-2xs">
                      <div className="font-bold text-amber-900 md:w-1/4 text-[13px]">{a.asset}</div>
                      <div className="text-gray-600 md:w-1/4 text-[12px]">{a.component}</div>
                      <div className="flex items-center gap-1.5 md:w-1/2">
                        <ArrowRight size={13} className="shrink-0 text-amber-500" />
                        <span className="text-[#1e3a5f] font-semibold text-[12px]">Target: {getRecommendation(a).target}</span>
                      </div>
                    </div>
                  ))}
                  {phases.phase2.length === 0 && <div className="text-xs text-gray-500 italic border border-dashed border-amber-200 rounded p-3">No assets categorized under Phase 2 for this application.</div>}
                </div>
              </div>

              {/* Phase 3 — Green */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                    <h3 className="font-bold text-emerald-950 text-sm">Phase 3 — Low Priority / Monitor</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">PRIORITY: LOW</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">{phases.phase3.length} assets</span>
                </div>
                <div className="text-xs text-emerald-800 font-semibold mb-3">Standards Compliance — currently compliant, low migration urgency, monitor and maintain</div>
                <div className="space-y-2">
                  {phases.phase3.map((a, i) => (
                    <div key={i} className="bg-white border border-emerald-100 rounded-md p-3 flex flex-col md:flex-row gap-3 justify-between shadow-2xs">
                      <div className="font-bold text-emerald-950 md:w-1/4 text-[13px]">{a.asset}</div>
                      <div className="text-gray-600 md:w-1/4 text-[12px]">{a.component}</div>
                      <div className="flex items-center gap-1.5 md:w-1/2">
                        <ArrowRight size={13} className="shrink-0 text-emerald-600" />
                        <span className="text-emerald-900 font-semibold text-[12px]">Target: {getRecommendation(a).target}</span>
                      </div>
                    </div>
                  ))}
                  {phases.phase3.length === 0 && <div className="text-xs text-gray-500 italic border border-dashed border-emerald-200 rounded p-3">No assets categorized under Phase 3 for this application.</div>}
                </div>
              </div>
            </div>
          </section>

          {/* 6. MIGRATION RECOMMENDATIONS */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">
              6. Migration Recommendations
            </h2>
            <div className="space-y-2.5">
              {data.discoveredAssets.map((a, i) => {
                const rec = getRecommendation(a);
                const recKey = `rec-${a.asset}-${i}`;
                const isExpanded = expandedRec === recKey;
                const p = a.priorityClassification || a.priority;
                const riskBadgeCls = p === "Urgent"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : (p === "High" || p === "Monitor")
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : p === "Low"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-gray-100 text-gray-600";
                const riskLabel = p === "Urgent" ? "HIGH RISK"
                  : (p === "High" || p === "Monitor") ? "MEDIUM"
                  : p === "Low" ? "LOW / QUANTUM-SAFE"
                  : "UNKNOWN";
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
                    <button
                      className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 text-left gap-2 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedRec(isExpanded ? null : recKey)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
                        <div>
                          <div className="font-bold text-[#1e3a5f] text-[14px]">{a.asset}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{a.usage.replace(/_/g, " ")} — {a.component}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:ml-4 shrink-0">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${riskBadgeCls}`}>{riskLabel}</span>
                        <span className="text-[10px] text-gray-400 font-mono">CPS: {a.priorityScore ?? "N/A"}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-[13px]">
                          <div>
                            <h4 className="font-bold text-gray-700 text-xs mb-1">Technical Assessment / Issue</h4>
                            <p className="text-gray-600 leading-relaxed text-xs">{rec.issue}</p>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-700 text-xs mb-1">Recommended Approach</h4>
                            <p className="text-[#1e3a5f] font-semibold leading-relaxed text-xs">{rec.approach}</p>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-700 text-xs mb-1">Suggested Migration Target</h4>
                            <p className="text-emerald-700 font-semibold leading-relaxed text-xs">{rec.target}</p>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-700 text-xs mb-1">Implementation Guidance</h4>
                            <p className="text-gray-600 leading-relaxed text-xs">{rec.guidance}</p>
                          </div>
                          <div className="col-span-1 md:col-span-2 pt-2 border-t border-gray-100 text-xs">
                            <span className="font-bold text-gray-700">Standards Reference: </span>
                            <span className="text-gray-600 font-mono text-[11px]">{rec.standard}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 7. ASSESSMENT SUMMARY & ACTION PLAN */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">
              7. Assessment Summary &amp; Action Plan
            </h2>
            <div className="space-y-6">

              {/* A. Assessment Completion */}
              <div>
                <h3 className="font-bold text-sm text-[#1e3a5f] mb-3">A. Assessment Completion</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] text-gray-500 font-medium mb-1">Cryptographic Inventory</div>
                    <div className="font-bold text-[#1e3a5f] text-sm">Complete</div>
                    <div className="text-[10px] text-gray-400 mt-1">Based on available scan data</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] text-gray-500 font-medium mb-1">Detected Occurrences</div>
                    <div className="font-bold text-[#1e3a5f] text-2xl">{cbomStats.totalCryptoAssets || data.totalOccurrences}</div>
                    <div className="text-[10px] text-gray-400 mt-1">total</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] text-gray-500 font-medium mb-1">Unique Cryptographic Assets</div>
                    <div className="font-bold text-[#1e3a5f] text-2xl">{data.uniqueLogicalAssetsCount}</div>
                    <div className="text-[10px] text-gray-400 mt-1">logical primitives</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] text-gray-500 font-medium mb-1">Runtime Verification</div>
                    <div className={`font-bold text-sm ${data.configuration.runtimeEnabled ? "text-emerald-700" : "text-gray-500"}`}>
                      {data.configuration.runtimeEnabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] text-gray-500 font-medium mb-1">Static Analysis</div>
                    <div className="font-bold text-emerald-700 text-sm flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Completed
                    </div>
                  </div>
                </div>
              </div>

              {/* B. Quantum Risk Overview */}
              <div>
                <h3 className="font-bold text-sm text-[#1e3a5f] mb-3">B. Quantum Risk Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><div className="text-[11px] text-emerald-800 font-semibold">Quantum-Safe</div></div>
                    <div className="font-bold text-2xl text-emerald-700">{cbomStats.quantumSafe}</div>
                    <div className="text-[10px] text-emerald-600 mt-1">occurrences</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-red-600" /><div className="text-[11px] text-red-800 font-semibold">Not Quantum-Safe</div></div>
                    <div className="font-bold text-2xl text-red-700">{cbomStats.notQuantumSafe}</div>
                    <div className="text-[10px] text-red-600 mt-1">occurrences</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-slate-400" /><div className="text-[11px] text-slate-700 font-semibold">Not Applicable</div></div>
                    <div className="font-bold text-2xl text-slate-700">{cbomStats.notApplicable}</div>
                    <div className="text-[10px] text-slate-500 mt-1">occurrences</div>
                  </div>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-sky-400" /><div className="text-[11px] text-sky-800 font-semibold">Unknown</div></div>
                    <div className="font-bold text-2xl text-sky-700">{cbomStats.unknown}</div>
                    <div className="text-[10px] text-sky-600 mt-1">occurrences</div>
                  </div>
                </div>
              </div>

              {/* C. Migration Priority Summary */}
              <div>
                <h3 className="font-bold text-sm text-[#1e3a5f] mb-3">C. Migration Priority Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-red-200 bg-red-50/60 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-red-800 font-semibold uppercase tracking-wider mb-1">Phase 1 — Urgent</div>
                      <div className="font-bold text-2xl text-red-700">{phases.phase1.length}</div>
                      <div className="text-[10px] text-red-600 mt-1">assets requiring immediate action</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-red-600 shrink-0" />
                  </div>
                  <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-amber-800 font-semibold uppercase tracking-wider mb-1">Phase 2 — Plan &amp; Prepare</div>
                      <div className="font-bold text-2xl text-amber-700">{phases.phase2.length}</div>
                      <div className="text-[10px] text-amber-600 mt-1">assets for review and planning</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider mb-1">Phase 3 — Low Priority / Monitor</div>
                      <div className="font-bold text-2xl text-emerald-700">{phases.phase3.length}</div>
                      <div className="text-[10px] text-emerald-600 mt-1">assets to maintain and monitor</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0" />
                  </div>
                </div>
              </div>

              {/* D. Key Action Areas */}
              <div>
                <h3 className="font-bold text-sm text-[#1e3a5f] mb-3">D. Key Action Areas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white border border-red-100 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1">Digital Signature Migration</div>
                    <div className="text-[13px] text-gray-700 mb-2">DSA / ECDSA / Ed25519 / RSA-related signing assets</div>
                    <div className="text-[11px] text-gray-500">Target:</div>
                    <div className="text-[12px] font-semibold text-[#1e3a5f]">ML-DSA / SLH-DSA</div>
                  </div>
                  <div className="bg-white border border-red-100 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1">Key Establishment Migration</div>
                    <div className="text-[13px] text-gray-700 mb-2">Diffie-Hellman / ECDH / RSA / X25519 / EC</div>
                    <div className="text-[11px] text-gray-500">Target:</div>
                    <div className="text-[12px] font-semibold text-[#1e3a5f]">ML-KEM / Hybrid Key Establishment</div>
                  </div>
                  <div className="bg-white border border-amber-100 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Symmetric Cryptography Review</div>
                    <div className="text-[13px] text-gray-700 mb-2">AES / AES-CBC / AES-CTR / AES-GCM</div>
                    <div className="text-[11px] text-gray-500">Action:</div>
                    <div className="text-[12px] font-semibold text-[#1e3a5f]">Review mode, nonce/IV handling, key management and rotation</div>
                  </div>
                  <div className="bg-white border border-emerald-100 rounded-lg p-4 shadow-2xs">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Quantum-Safe Assets</div>
                    <div className="text-[13px] text-gray-700 mb-2">ML-DSA / ML-KEM / SLH-DSA</div>
                    <div className="text-[11px] text-gray-500">Action:</div>
                    <div className="text-[12px] font-semibold text-[#1e3a5f]">Maintain, validate implementation and monitor compliance</div>
                  </div>
                </div>
              </div>

              {/* E. Asset-Level Action Summary Table */}
              <div>
                <h3 className="font-bold text-sm text-[#1e3a5f] mb-3">E. Asset-Level Action Summary</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead className="bg-[#f5f6f8] text-[#1e3a5f] font-semibold border-b border-gray-200 text-[11px] uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-3">Asset</th>
                          <th className="px-4 py-3">Usage</th>
                          <th className="px-4 py-3">Risk</th>
                          <th className="px-4 py-3">Phase</th>
                          <th className="px-4 py-3">Migration Target</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.discoveredAssets.sort((a,b) => a.priorityRank - b.priorityRank).map((a, i) => {
                          const rec = getRecommendation(a);
                          const p = a.priorityClassification || a.priority;
                          const phase = p === "Urgent"
                            ? { label: "Phase 1", cls: "text-red-700 font-semibold" }
                            : (p === "High" || p === "Monitor")
                            ? { label: "Phase 2", cls: "text-amber-700 font-semibold" }
                            : p === "Low"
                            ? { label: "Phase 3", cls: "text-emerald-700 font-semibold" }
                            : { label: "—", cls: "text-gray-400" };
                          const statusBadge = p === "Urgent"
                            ? { label: "ACTION REQUIRED", cls: "bg-red-50 text-red-700 border border-red-200" }
                            : (p === "High" || p === "Monitor")
                            ? { label: "REVIEW", cls: "bg-amber-50 text-amber-700 border border-amber-200" }
                            : p === "Low"
                            ? { label: "MONITOR", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" }
                            : { label: "ANALYSIS REQUIRED", cls: "bg-gray-100 text-gray-600" };
                          return (
                            <tr key={i} className="hover:bg-gray-50/60">
                              <td className="px-4 py-2.5 font-semibold text-[#1e3a5f]">{a.asset}</td>
                              <td className="px-4 py-2.5 text-gray-600">{a.usage.replace(/_/g, " ")}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                  a.quantumRisk === "High" ? "bg-red-50 text-red-700 border border-red-200" :
                                  a.quantumRisk === "Medium" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}>{a.quantumRisk}</span>
                              </td>
                              <td className={`px-4 py-2.5 text-[12px] ${phase.cls}`}>{phase.label}</td>
                              <td className="px-4 py-2.5 text-[11px] text-[#1e3a5f] font-semibold">{rec.target}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded ${statusBadge.cls}`}>
                                  {statusBadge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* F. Recommended Workflow */}
              <div>
                <h3 className="font-bold text-sm text-[#1e3a5f] mb-3">F. Recommended Assessment Workflow</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
                  <ol className="space-y-3">
                    {[
                      "Address Phase 1 quantum-vulnerable public-key assets.",
                      "Introduce appropriate PQC or hybrid key-establishment/signature mechanisms.",
                      "Review Phase 2 symmetric cryptography configurations.",
                      "Maintain and validate Phase 3 quantum-safe / low-priority assets.",
                      "Re-scan the application after migration.",
                      "Re-evaluate dependency and blast-radius information when runtime/dependency analysis becomes available.",
                      "Compare the updated CBOM against this assessment to verify migration progress."
                    ].map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-[13px] text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* 8. STANDARDS & REFERENCES */}
          <section className="mb-20">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">
              8. Standards &amp; References
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { code: "NIST FIPS 203", name: "ML-KEM", desc: "Module-Lattice-Based Key-Encapsulation Mechanism Standard" },
                { code: "NIST FIPS 204", name: "ML-DSA", desc: "Module-Lattice-Based Digital Signature Standard" },
                { code: "NIST FIPS 205", name: "SLH-DSA", desc: "Stateless Hash-Based Digital Signature Standard" },
                { code: "NIST SP 800-208", name: "", desc: "Recommendation for Stateful Hash-Based Signature Schemes" },
                { code: "NIST SP 800-38D", name: "", desc: "Galois/Counter Mode (GCM) for Block Cipher Algorithms" },
                { code: "RFC 9106", name: "", desc: "Argon2 Password Hashing and Memory-Hard Function" },
                { code: "RFC 8439", name: "", desc: "ChaCha20 and Poly1305 for IETF Protocols" },
                { code: "NIST SP 800-131A Rev. 2", name: "", desc: "Transitioning the Use of Cryptographic Algorithms and Key Lengths" },
              ].map((ref, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 shadow-2xs">
                  <div className="font-bold text-[#1e3a5f] text-[12px]">{ref.code}</div>
                  {ref.name && <div className="text-[11px] font-semibold text-gray-600 mt-0.5">— {ref.name}</div>}
                  <div className="text-[11px] text-gray-500 mt-1.5 leading-snug">{ref.desc}</div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}