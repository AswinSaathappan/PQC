import React, { useState, useEffect } from "react";
import axios from "axios";
import { Download, ChevronDown, ChevronRight, Activity, ShieldAlert, CheckCircle2, Loader2, Info } from "lucide-react";
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
  Legend
} from "recharts";

interface Props {
  selectedAnalysisId?: string;
  analyses?: any[];
  onSelectAnalysis?: (id: string) => void;
}

export default function Report({ selectedAnalysisId, analyses = [], onSelectAnalysis }: Props) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const effectiveAnalysisId = selectedAnalysisId || analyses[0]?.analysisId;

  useEffect(() => {
    async function fetchReportData() {
      if (effectiveAnalysisId) {
        setLoading(true);
        try {
          const [summaryRes, scoredRes] = await Promise.all([
            axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/summary`).catch(() => null),
            axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/scored-assets`).catch(() => null)
          ]);
          if (summaryRes?.data) setSummaryData(summaryRes.data);
          if (scoredRes?.data) setAssets(scoredRes.data);
          setExpandedAsset(null);
        } catch (err) {
          console.error("Failed to load report data", err);
        } finally {
          setLoading(false);
        }
      } else {
        setAssets([]);
        setSummaryData(null);
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

  const priorityChartData = React.useMemo(() => {
    if (!data || data.discoveredAssets.length === 0) return [];
    return data.discoveredAssets.map(a => ({
      name: a.asset,
      priorityScore: a.priorityScore,
      quantumRiskScore: a.riskScore,
      quantumRisk: a.quantumRisk
    }));
  }, [data]);

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

      // 1. Cover
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
      
      // 1. Exec Summary
      let y = 20;
      y = addHeading("1. EXECUTIVE SUMMARY", y);
      y = addText(`Total Cryptographic Asset Occurrences: ${data.totalOccurrences}`, y);
      const numericScored = data.discoveredAssets.filter(a => a.priorityScore !== null).length;
      const nonNumeric = data.discoveredAssets.filter(a => a.priorityScore === null).length;
      y = addText(`Total Unique Logical Assets: ${data.uniqueLogicalAssetsCount} (${numericScored} Numeric Priority-Scored, ${nonNumeric} Non-Numeric / Evidence-Required)`, y);
      y = addText(`Quantum-Vulnerable Assets: ${data.discoveredAssets.filter(a => a.quantumRisk === "High").length}`, y);
      y = addText(`Public-Key Assets: ${data.discoveredAssets.filter(a => a.category === "public_key").length}`, y);
      y = addText(`Symmetric Cryptographic Assets: ${data.discoveredAssets.filter(a => a.category === "symmetric").length}`, y);
      y = addText(`Cryptographic Hash / KDF Assets: ${data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").length}`, y);
      
      if (data.configuration.runtimeEnabled) {
        y = addText(`Runtime Verified Assets: ${data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}`, y);
        y = addText(`Not Runtime Observed Assets: ${data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}`, y);
      } else {
        y = addText(`Runtime Analysis: Disabled`, y);
      }
      y += 10;

      // 2. Cryptographic Risk & Classification Distribution
      y = addHeading("2. CRYPTOGRAPHIC RISK & CLASSIFICATION DISTRIBUTION", y);
      if (data.discoveredAssets.length > 0) {
        const total = data.discoveredAssets.length;
        const highRisk = data.discoveredAssets.filter(a => a.quantumRisk === "High").length;
        const medRisk = data.discoveredAssets.filter(a => a.quantumRisk === "Medium").length;
        const lowRisk = data.discoveredAssets.filter(a => a.quantumRisk === "Low").length;
        const unknownRisk = data.discoveredAssets.filter(a => a.quantumRisk !== "High" && a.quantumRisk !== "Medium" && a.quantumRisk !== "Low").length;
        const pubKey = data.discoveredAssets.filter(a => a.category === "public_key").length;
        const sym = data.discoveredAssets.filter(a => a.category === "symmetric").length;
        const hash = data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").length;

        const highAssets = data.discoveredAssets.filter(a => a.quantumRisk === "High").map(a => a.asset).join(', ') || 'None detected';
        const medAssets = data.discoveredAssets.filter(a => a.quantumRisk === "Medium").map(a => a.asset).join(', ') || 'None detected';
        const lowAssets = data.discoveredAssets.filter(a => a.quantumRisk === "Low").map(a => a.asset).join(', ') || 'None detected';
        const unknownAssets = data.discoveredAssets.filter(a => a.quantumRisk !== "High" && a.quantumRisk !== "Medium" && a.quantumRisk !== "Low").map(a => a.asset).join(', ') || 'None detected';

        const pubKeyAssets = data.discoveredAssets.filter(a => a.category === "public_key").map(a => a.asset).join(', ') || 'None detected';
        const symAssets = data.discoveredAssets.filter(a => a.category === "symmetric").map(a => a.asset).join(', ') || 'None detected';
        const hashAssets = data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").map(a => a.asset).join(', ') || 'None detected';

        const tableBody: string[][] = [
          ['Quantum Risk Distribution', 'High Risk (Shor\'s Vulnerable)', highRisk.toString(), `${((highRisk / total) * 100).toFixed(1)}%`, highAssets],
          ['Quantum Risk Distribution', 'Medium Risk (Grover Reduction)', medRisk.toString(), `${((medRisk / total) * 100).toFixed(1)}%`, medAssets],
          ['Quantum Risk Distribution', 'Low Risk (Quantum-Safe)', lowRisk.toString(), `${((lowRisk / total) * 100).toFixed(1)}%`, lowAssets],
        ];

        if (unknownRisk > 0) {
          tableBody.push(['Quantum Risk Distribution', 'Unknown / Unavailable Risk', unknownRisk.toString(), `${((unknownRisk / total) * 100).toFixed(1)}%`, unknownAssets]);
        }

        tableBody.push(
          ['Cryptographic Purpose', 'Public-Key Cryptography', pubKey.toString(), `${((pubKey / total) * 100).toFixed(1)}%`, pubKeyAssets],
          ['Cryptographic Purpose', 'Symmetric Ciphers', sym.toString(), `${((sym / total) * 100).toFixed(1)}%`, symAssets],
          ['Cryptographic Purpose', 'Cryptographic Hash / KDF', hash.toString(), `${((hash / total) * 100).toFixed(1)}%`, hashAssets]
        );

        autoTable(doc, {
          startY: y,
          head: [['Dimension', 'Classification', 'Asset Count', 'Share (%)', 'Representative Cryptographic Primitives']],
          body: tableBody,
          headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
          theme: 'grid'
        });
        y = (doc as any).lastAutoTable.finalY + 15;
      } else {
        y = addText("No data available", y, true);
        y += 10;
      }

      if (y > 220) { doc.addPage(); y = 20; }

      // 3. CBOM
      y = addHeading("3. DISCOVERY AND CBOM SUMMARY", y);
      autoTable(doc, {
        startY: y,
        head: [['Asset', 'Occurrences', 'Usage', 'Component', 'Source', 'Location']],
        body: data.discoveredAssets.map(a => [
          a.asset || 'Unknown',
          (a.occurrencesCount || 1).toString(),
          a.usage.replace(/_/g, ' '),
          a.component || 'Unknown',
          a.discoverySource || 'Static Source Code',
          a.location || 'Location Not Available'
        ]),
        headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 15;

      if (y > 230) { doc.addPage(); y = 20; }

      // 4. Runtime Evidence
      y = addHeading("4. RUNTIME EVIDENCE SUMMARY", y);
      if (data.configuration.runtimeEnabled) {
        y = addText(`Runtime Verified Assets: ${data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}`, y);
        y = addText(`Assets Not Observed During Monitoring: ${data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}`, y);
        y = addText(`Runtime Events Collected: ${data.configuration.totalEventsCollected?.toLocaleString() || '0'}`, y);
        y = addText(`Monitoring Duration: ${data.configuration.monitoringDuration || 'N/A'}`, y);
        y += 5;
        y = addText("Note: Runtime evidence is verification metadata and does not reduce the theoretical cryptographic risk of an asset.", y, true);
      } else {
        y = addText("Runtime Analysis: Disabled", y, true);
        y = addText("Explanation: Runtime verification was not performed for this analysis. Static discovery findings remain included in the assessment.", y);
      }
      y += 15;

      // 5. App Priority
      if (y > 200) { doc.addPage(); y = 20; }
      y = addHeading("5. APPLICATION-LEVEL PRIORITY ASSESSMENT", y);
      y = addText(`Mosca Urgency (M): ${data.applicationPriority.moscaUrgency?.toFixed(2) ?? '0.00'}`, y);
      y = addText(`Data Sensitivity (D): ${data.applicationPriority.dataSensitivity?.toFixed(2) ?? '0.00'}`, y);
      y = addText(`Business Criticality (B): ${data.applicationPriority.businessCriticality?.toFixed(2) ?? '0.00'}`, y);
      y += 5;
      y = addText(`APS = (${data.applicationPriority.moscaUrgency?.toFixed(2) ?? '0.00'} + ${data.applicationPriority.dataSensitivity?.toFixed(2) ?? '0.00'} + ${data.applicationPriority.businessCriticality?.toFixed(2) ?? '0.00'}) / 3`, y);
      y = addText(`Application Priority Score (APS) = ${data.applicationPriority.aps?.toFixed(2) ?? '0.00'}`, y, true);
      y = addText(`Application Priority = ${data.applicationPriority.overallPriority || 'P4'}`, y, true);
      y += 10;
      y = addText(`Mosca Variables used for Urgency (M):`, y);
      y = addText(`Data Protection Lifetime (X): ${data.applicationPriority.moscaVariables.dataProtectionLifetime} years`, y);
      y = addText(`Migration Duration (Y): ${data.applicationPriority.moscaVariables.migrationDuration} years`, y);
      y = addText(`Quantum Threat Horizon: ${data.applicationPriority.moscaVariables.quantumThreatHorizon} (Calendar Year)`, y);
      y = addText(`Quantum Risk Horizon (Z): ${data.applicationPriority.moscaVariables.quantumRiskHorizon} years`, y);
      const moscaMargin = data.applicationPriority.moscaVariables.timingMargin ?? (data.applicationPriority.moscaVariables.quantumRiskHorizon - (data.applicationPriority.moscaVariables.dataProtectionLifetime + data.applicationPriority.moscaVariables.migrationDuration));
      y = addText(`Mosca Timing Margin (Z - (X + Y)) = ${moscaMargin} years.`, y, true);
      y += 10;

      // 6. Component Priority
      if (y > 200) { doc.addPage(); y = 20; }
      y = addHeading("6. COMPONENT-LEVEL PRIORITY ASSESSMENT", y);
      autoTable(doc, {
        startY: y,
        head: [['Rank', 'Asset', 'Component', 'Quantum Risk', 'Complexity', 'Impact', 'Priority Score']],
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
      y = addText("Note: Runtime evidence is verification metadata only. It is not used to silently modify theoretical risk scores.", y, true);

      // 7. Recommendations
      doc.addPage(); y = 20;
      y = addHeading("7. TECHNICAL MIGRATION RECOMMENDATIONS", y);
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
        y += 10;
      });

      // 8. Roadmap
      if (y > 220) { doc.addPage(); y = 20; }
      y = addHeading("8. MIGRATION ROADMAP", y);
      if (phases.phase1.length > 0) {
        y = addHeading("Phase 1 — Highest Priority Components", y, 2);
        phases.phase1.forEach(a => {
          if (y > 270) { doc.addPage(); y = 20; }
          y = addText(`- ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
        });
        y+=5;
      }
      if (phases.phase2.length > 0) {
        y = addHeading("Phase 2 — Next Priority Components", y, 2);
        phases.phase2.forEach(a => {
          if (y > 270) { doc.addPage(); y = 20; }
          y = addText(`- ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
        });
        y+=5;
      }
      if (phases.phase3.length > 0) {
        y = addHeading("Phase 3 — Low Priority / Monitor", y, 2);
        phases.phase3.forEach(a => {
          if (y > 270) { doc.addPage(); y = 20; }
          y = addText(`- ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
        });
        y+=10;
      }

      // 9. Standards
      if (y > 230) { doc.addPage(); y = 20; }
      y = addHeading("9. STANDARDS AND REFERENCES", y);
      y = addText("NIST FIPS 203 (ML-KEM) - Module-Lattice-Based Key-Encapsulation Mechanism Standard", y);
      y = addText("NIST FIPS 204 (ML-DSA) - Module-Lattice-Based Digital Signature Standard", y);
      y = addText("NIST FIPS 205 (SLH-DSA) - Stateless Hash-Based Digital Signature Standard", y);
      y = addText("NIST SP 800-38D - Galois/Counter Mode (GCM) for Block Cipher Algorithms", y);
      y = addText("NIST FIPS 197 - Advanced Encryption Standard (AES)", y);
      y = addText("NIST FIPS 180-4 / FIPS 202 - Secure Hash Standards (SHA-2, SHA-3)", y);
      y += 15;

      // 10. Final Status
      if (y > 220) { doc.addPage(); y = 20; }
      y = addHeading("10. FINAL REPORT STATUS (OVERALL ASSESSMENT)", y);
      y = addText("Cryptographic Inventory: Complete based on available scan data", y);
      y = addText(`Quantum Risk Exposure: ${data.discoveredAssets.some(a=>a.quantumRisk==="High") ? "High (Vulnerable public-key usage detected)" : "Low"}`, y);
      y = addText(`Runtime Verification: ${data.configuration.runtimeEnabled ? "Enabled" : "Disabled"}`, y);
      y = addText(`Highest Priority Area: ${phases.phase1.length > 0 ? phases.phase1[0].component : "None"}`, y);
      y = addText(`Next Technical Action: ${phases.phase1.length > 0 ? getRecommendation(phases.phase1[0]).approach : "Monitor Standards"}`, y, true);
      y = addText(`CBOM Graph Visualization: ${data.uniqueLogicalAssetsCount} cryptographic asset nodes mapped; 0 verified dependency relationships.`, y);

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
          <p className="text-[#6b7589] text-[13px] mb-4">Select an application from the dropdown to view its assessment report.</p>
          {analyses.length > 0 && onSelectAnalysis && (
            <select
              value=""
              onChange={(e) => onSelectAnalysis(e.target.value)}
              className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 bg-white text-[#1a1d23] font-semibold outline-none"
            >
              <option value="" disabled>Select Application</option>
              {analyses.map(a => (
                <option key={a.analysisId} value={a.analysisId}>{a.applicationName} ({a.analysisId})</option>
              ))}
            </select>
          )}
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
          <p className="text-[#6b7589] text-[13px] mb-4">The discovery scan completed without identifying cryptographic primitives or algorithm calls in this codebase.</p>
          {analyses.length > 1 && onSelectAnalysis && (
            <div className="flex justify-center items-center gap-2">
              <span className="text-xs text-gray-500">Switch Application:</span>
              <select
                value={selectedAnalysisId || ""}
                onChange={(e) => onSelectAnalysis(e.target.value)}
                className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 bg-white text-[#1a1d23] font-semibold outline-none"
              >
                {analyses.map(a => (
                  <option key={a.analysisId} value={a.analysisId}>{a.applicationName} ({a.analysisId})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-12">
        
        {/* REPORT SELECTION */}
        <div>
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-[#1e3a5f] text-2xl font-bold mb-1">Cryptographic Analysis Report</h1>
              <p className="text-gray-500 text-sm">Generated assessment report for the selected application.</p>
            </div>
            <div className="flex items-center gap-3">
              {analyses.length > 1 && onSelectAnalysis && (
                <select
                  value={selectedAnalysisId || ""}
                  onChange={(e) => onSelectAnalysis(e.target.value)}
                  className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-2 bg-slate-50 text-[#1a1d23] font-semibold outline-none"
                >
                  {analyses.map(a => (
                    <option key={a.analysisId} value={a.analysisId}>{a.applicationName} ({a.analysisId})</option>
                  ))}
                </select>
              )}
              <button 
                disabled={isExporting}
                className="flex items-center gap-2 bg-[#1e3a5f] text-white px-5 py-2.5 rounded text-sm font-semibold hover:bg-[#152a44] transition-colors disabled:opacity-60"
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
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">1. Executive Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-6 text-[13px] bg-white border border-gray-200 rounded p-5">
              <div>
                <div className="text-gray-500 mb-1">Total Cryptographic Asset Occurrences</div>
                <div className="font-bold text-xl text-[#1e3a5f]">{data.totalOccurrences}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Total unique logical assets: {data.uniqueLogicalAssetsCount} ({data.discoveredAssets.filter(a => a.priorityScore !== null).length} numeric priority-scored, {data.discoveredAssets.filter(a => a.priorityScore === null).length} non-numeric / evidence-required)
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Quantum-Vulnerable Assets</div>
                <div className="font-bold text-xl text-red-600">{data.discoveredAssets.filter(a => a.quantumRisk === "High").length}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Public-Key Assets</div>
                <div className="font-bold text-xl text-[#1e3a5f]">{data.discoveredAssets.filter(a => a.category === "public_key").length}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Symmetric Cryptographic Assets</div>
                <div className="font-bold text-xl text-[#1e3a5f]">{data.discoveredAssets.filter(a => a.category === "symmetric").length}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Cryptographic Hash / KDF Assets</div>
                <div className="font-bold text-xl text-[#1e3a5f]">{data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").length}</div>
              </div>
              {data.configuration.runtimeEnabled ? (
                <>
                  <div>
                    <div className="text-gray-500 mb-1">Runtime Verified Assets</div>
                    <div className="font-bold text-xl text-emerald-600">{data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Not Runtime Observed Assets</div>
                    <div className="font-bold text-xl text-amber-600">{data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}</div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 md:col-span-5 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <span className="text-gray-500">Runtime Analysis:</span>
                  <span className="font-semibold text-slate-600">Disabled</span>
                </div>
              )}
            </div>
          </section>

          {/* 2. CRYPTOGRAPHIC VISUALIZATIONS & DISTRIBUTION */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">2. Cryptographic Risk & Asset Distribution Charts</h2>
            {data.discoveredAssets.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded p-10 text-center text-gray-500">
                <Activity size={36} className="mx-auto mb-2 text-gray-400 opacity-60" />
                <div className="font-semibold text-base text-gray-700">No data available</div>
                <div className="text-xs text-gray-400 mt-1">No cryptographic assets have been discovered for this application yet.</div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Risk Distribution Chart */}
                  <div className="bg-white border border-gray-200 rounded p-5 shadow-2xs">
                    <div className="font-bold text-sm text-[#1e3a5f] mb-1">Quantum Risk Distribution</div>
                    <div className="text-xs text-gray-500 mb-4">Proportion of assets vulnerable to Shor's (High), Grover's (Medium), or Quantum-Safe (Low).</div>
                    <div style={{ height: "260px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, value }) => `${name.split(' ')[0]}: ${value}`}
                          >
                            {riskChartData.map((entry, index) => (
                              <Cell key={`risk-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any, name: any) => [`${value} assets`, name]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Asset Classification Distribution Chart */}
                  <div className="bg-white border border-gray-200 rounded p-5 shadow-2xs">
                    <div className="font-bold text-sm text-[#1e3a5f] mb-1">Cryptographic Asset Classification</div>
                    <div className="text-xs text-gray-500 mb-4">Breakdown of cryptographic mechanisms by cryptographic purpose.</div>
                    <div style={{ height: "260px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={classChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {classChartData.map((entry, index) => (
                              <Cell key={`class-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any, name: any) => [`${value} assets`, name]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Component Priority & Risk Ranking Chart */}
                <div className="bg-white border border-gray-200 rounded p-5 shadow-2xs">
                  <div className="font-bold text-sm text-[#1e3a5f] mb-1">Cryptographic Asset Priority & Risk Scores</div>
                  <div className="text-xs text-gray-500 mb-4">Component Priority Score (CPS) and Quantum Risk Score per discovered asset.</div>
                  <div style={{ height: "280px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={priorityChartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 11, fill: "#4b5563" }} 
                          angle={-15} 
                          textAnchor="end" 
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7589" }} />
                        <Tooltip formatter={(value: any, name: any) => [`Score: ${value}`, name === "priorityScore" ? "Priority Score (CPS)" : "Quantum Risk Score"]} />
                        <Legend wrapperStyle={{ paddingTop: 10 }} />
                        <Bar dataKey="quantumRiskScore" fill="#ef4444" name="Quantum Risk Score" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="priorityScore" fill="#1e3a5f" name="Priority Score (CPS)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 3. DISCOVERY AND CBOM SUMMARY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">3. Discovery and CBOM Summary</h2>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f5f6f8] text-[#1e3a5f] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Cryptographic Asset</th>
                    <th className="px-4 py-3">Occurrences</th>
                    <th className="px-4 py-3">Algorithm / Version</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Discovery Source</th>
                    <th className="px-4 py-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data.discoveredAssets.map((a, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-semibold text-[#1e3a5f]">{a.asset}</td>
                      <td className="px-4 py-3 font-semibold text-[#1e3a5f]">{a.occurrencesCount || 1}</td>
                      <td className="px-4 py-3 text-gray-700">{a.algorithm} / {a.version}</td>
                      <td className="px-4 py-3 text-gray-700">{a.usage.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-gray-700">{a.component}</td>
                      <td className="px-4 py-3 text-gray-700">{a.discoverySource}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-[11px]">{a.location || "Location Not Available"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. RUNTIME EVIDENCE SUMMARY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">4. Runtime Evidence Summary</h2>
            <div className="bg-white border border-gray-200 rounded p-5 text-[13px]">
              {data.configuration.runtimeEnabled ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-gray-500 mb-1">Runtime Verified Assets</div>
                      <div className="font-bold text-lg text-emerald-600">{data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Assets Not Observed</div>
                      <div className="font-bold text-lg text-amber-600">{data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Runtime Events Collected</div>
                      <div className="font-bold text-lg text-[#1e3a5f]">{data.configuration.totalEventsCollected?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Monitoring Duration</div>
                      <div className="font-bold text-lg text-[#1e3a5f]">{data.configuration.monitoringDuration}</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-l-2 border-slate-300 p-3 text-slate-600 italic">
                    Runtime evidence is verification metadata and does not reduce the theoretical cryptographic risk of an asset.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="font-bold text-lg text-slate-600">Runtime Analysis: Disabled</div>
                  <div className="text-gray-600">
                    Runtime verification was not performed for this analysis. Static discovery findings remain included in the assessment.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 5. APPLICATION PRIORITY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">5. Application-Level Priority Assessment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded p-5 text-[13px]">
                <h3 className="font-bold text-[#1e3a5f] mb-4">Application Priority Calculation</h3>
                <div className="space-y-2 mb-4 text-gray-700">
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Mosca Urgency (M):</span> <span className="font-mono">Score: {data.applicationPriority.moscaUrgency.toFixed(2)}</span></div>
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Data Sensitivity (D):</span> <span className="font-mono">Score: {data.applicationPriority.dataSensitivity.toFixed(2)}</span></div>
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Business Criticality (B):</span> <span className="font-mono">Score: {data.applicationPriority.businessCriticality.toFixed(2)}</span></div>
                </div>
                <div className="bg-slate-50 p-3 rounded font-mono text-center text-gray-600 mb-4">
                  APS = ({data.applicationPriority.moscaUrgency.toFixed(2)} + {data.applicationPriority.dataSensitivity.toFixed(2)} + {data.applicationPriority.businessCriticality.toFixed(2)}) / 3
                </div>
                <div className="text-center">
                  <div className="text-gray-500 mb-1">Application Priority Score = {data.applicationPriority.aps.toFixed(2)}</div>
                  <div className="font-bold text-lg text-[#1e3a5f]">Application Priority = {data.applicationPriority.overallPriority}</div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded p-5 text-[13px]">
                <h3 className="font-bold text-[#1e3a5f] mb-4">Mosca Variables</h3>
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
          </section>

          {/* 6. COMPONENT PRIORITY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">6. Component-Level Priority Assessment</h2>
            <div className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f5f6f8] text-[#1e3a5f] font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Cryptographic Asset</th>
                    <th className="px-4 py-3">Component / Usage</th>
                    <th className="px-4 py-3">Quantum Risk</th>
                    <th className="px-4 py-3 text-center">Score</th>
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
                          <td className="px-4 py-3 text-gray-700">{a.quantumRisk}</td>
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
                                  <div className="text-[10px] text-gray-400 italic mt-1 leading-tight">Runtime evidence is a verification layer and does not modify the priority score.</div>
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
          </section>

          {/* 7. RECOMMENDATIONS */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">7. Technical Migration Recommendations</h2>
            <div className="space-y-6">
              {data.discoveredAssets.map((a, i) => {
                const rec = getRecommendation(a);
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded p-6 shadow-sm">
                    <div className="flex justify-between border-b border-gray-100 pb-3 mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Current Asset</div>
                        <div className="text-lg font-bold text-[#1e3a5f]">{a.asset}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Usage</div>
                        <div className="text-sm font-semibold text-gray-700">{a.usage.replace("_", " ")} ({a.component})</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-[13px]">
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Technical Issue</h4>
                        <p className="text-gray-600 leading-relaxed">{rec.issue}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Recommended Approach</h4>
                        <p className="text-[#1e3a5f] font-semibold leading-relaxed">{rec.approach}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Suggested Target</h4>
                        <p className="text-emerald-700 font-semibold leading-relaxed">{rec.target}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Implementation Guidance</h4>
                        <p className="text-gray-600 leading-relaxed">{rec.guidance}</p>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-gray-100">
                        <span className="font-bold text-gray-800">Standards Reference: </span>
                        <span className="text-gray-600 font-mono text-[12px]">{rec.standard}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 8. ROADMAP */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">8. Migration Roadmap</h2>
            <div className="space-y-4">
              
              <div className="border border-red-200 bg-red-50 rounded p-4">
                <h3 className="font-bold text-red-800 text-[14px] mb-3">Phase 1 — Highest Priority Components</h3>
                <div className="space-y-3">
                  {phases.phase1.map((a,i) => (
                    <div key={i} className="bg-white border border-red-100 rounded p-3 text-[13px] flex flex-col md:flex-row gap-4 justify-between">
                      <div className="font-bold text-red-900 w-1/4">{a.asset}</div>
                      <div className="text-gray-600 w-1/4">{a.component}</div>
                      <div className="text-[#1e3a5f] font-semibold w-1/2">Target: {getRecommendation(a).target}</div>
                    </div>
                  ))}
                  {phases.phase1.length === 0 && <div className="text-sm text-gray-500 italic">No assets in this phase.</div>}
                </div>
              </div>

              <div className="border border-amber-200 bg-amber-50 rounded p-4">
                <h3 className="font-bold text-amber-800 text-[14px] mb-3">Phase 2 — Next Priority Components</h3>
                <div className="space-y-3">
                  {phases.phase2.map((a,i) => (
                    <div key={i} className="bg-white border border-amber-100 rounded p-3 text-[13px] flex flex-col md:flex-row gap-4 justify-between">
                      <div className="font-bold text-amber-900 w-1/4">{a.asset}</div>
                      <div className="text-gray-600 w-1/4">{a.component}</div>
                      <div className="text-[#1e3a5f] font-semibold w-1/2">Target: {getRecommendation(a).target}</div>
                    </div>
                  ))}
                  {phases.phase2.length === 0 && <div className="text-sm text-gray-500 italic">No assets in this phase.</div>}
                </div>
              </div>

              <div className="border border-slate-200 bg-slate-50 rounded p-4">
                <h3 className="font-bold text-slate-800 text-[14px] mb-3">Phase 3 — Low Priority / Monitor</h3>
                <div className="space-y-3">
                  {phases.phase3.map((a,i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded p-3 text-[13px] flex flex-col md:flex-row gap-4 justify-between">
                      <div className="font-bold text-slate-700 w-1/4">{a.asset}</div>
                      <div className="text-gray-600 w-1/4">{a.component}</div>
                      <div className="text-[#1e3a5f] font-semibold w-1/2">Target: {getRecommendation(a).target}</div>
                    </div>
                  ))}
                  {phases.phase3.length === 0 && <div className="text-sm text-gray-500 italic">No assets in this phase.</div>}
                </div>
              </div>

            </div>
          </section>

          {/* 9. STANDARDS */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">9. Standards and References</h2>
            <ul className="list-disc list-inside space-y-2 text-[13px] text-gray-700 bg-white border border-gray-200 rounded p-5">
              <li><span className="font-semibold">NIST FIPS 203 (ML-KEM)</span> - Module-Lattice-Based Key-Encapsulation Mechanism Standard</li>
              <li><span className="font-semibold">NIST FIPS 204 (ML-DSA)</span> - Module-Lattice-Based Digital Signature Standard</li>
              <li><span className="font-semibold">NIST FIPS 205 (SLH-DSA)</span> - Stateless Hash-Based Digital Signature Standard</li>
              <li><span className="font-semibold">NIST SP 800-208</span> - Stateful Hash-Based Signatures</li>
            </ul>
          </section>

          {/* 10. FINAL STATUS */}
          <section className="mb-20">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">10. Final Report Status</h2>
            <div className="bg-[#1e3a5f] text-white rounded p-6 shadow-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Cryptographic Inventory</div>
                <div className="font-semibold text-sm">Complete based on available scan data</div>
              </div>
              <div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Quantum Risk Exposure</div>
                <div className="font-semibold text-sm">{data.discoveredAssets.some(a=>a.quantumRisk==="High") ? "High (Vulnerable public-key usage detected)" : "Low"}</div>
              </div>
              <div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Runtime Verification</div>
                <div className="font-semibold text-sm">{data.configuration.runtimeEnabled ? "Enabled" : "Disabled"}</div>
              </div>
              <div className="lg:col-span-3 pt-4 border-t border-blue-800">
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Highest Priority Area</div>
                <div className="font-semibold text-lg text-white mb-2">{phases.phase1.length > 0 ? phases.phase1[0].component : "None"}</div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Recommended Next Technical Action</div>
                <div className="font-semibold text-emerald-300">{phases.phase1.length > 0 ? getRecommendation(phases.phase1[0]).approach : "Monitor Standards"}</div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}