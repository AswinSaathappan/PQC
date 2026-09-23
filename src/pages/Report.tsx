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
import CbomkitDonutChart, { CbomkitChartItem, CARBON_CATEGORICAL_PALETTE, COMPLIANCE_COLOR_MAP } from "../components/CbomkitDonutChart";
import { classifyAsset, calculateClassificationStats, ClassificationStats } from "../utils/quantumClassification";

function renderDonutChartToImage(options: {
  centerNumber: number | string;
  centerLabel: string;
  data: Array<{ group: string; value: number; color?: string }>;
  colorPalette?: string[];
  colorMap?: Record<string, string>;
  width?: number;
  height?: number;
  title: string;
  subtitle?: string;
  isWide?: boolean;
}): string {
  const width = options.width || (options.isWide ? 1000 : 560);
  const height = options.height || (options.isWide ? 360 : 400);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Fill background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Title
  ctx.fillStyle = "#1e3a5f";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(options.title, 20, 16);

  // Subtitle
  if (options.subtitle) {
    ctx.fillStyle = "#64748b";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(options.subtitle, 20, 40);
  }

  // Divider
  ctx.strokeStyle = "#edf2f7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 62);
  ctx.lineTo(width - 20, 62);
  ctx.stroke();

  const validData = options.data.filter(d => typeof d.value === "number" && d.value > 0);
  const total = validData.reduce((acc, curr) => acc + curr.value, 0);

  // Donut geometry
  const donutCenterX = options.isWide ? 170 : 140;
  const donutCenterY = options.isWide ? 210 : 230;
  const outerRadius = options.isWide ? 100 : 96;
  const innerRadius = outerRadius * 0.68;

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(donutCenterX, donutCenterY, outerRadius, 0, 2 * Math.PI);
    ctx.arc(donutCenterX, donutCenterY, innerRadius, 0, 2 * Math.PI, true);
    ctx.fillStyle = "#f1f5f9";
    ctx.fill();

    ctx.fillStyle = "#1e3a5f";
    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("0", donutCenterX, donutCenterY - 8);

    ctx.fillStyle = "#64748b";
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(options.centerLabel, donutCenterX, donutCenterY + 16);
  } else {
    let startAngle = -Math.PI / 2;
    validData.forEach((item, idx) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      let color = item.color;
      if (!color && options.colorMap && options.colorMap[item.group]) {
        color = options.colorMap[item.group];
      }
      if (!color) {
        const palette = options.colorPalette || CARBON_CATEGORICAL_PALETTE;
        color = palette[idx % palette.length];
      }

      ctx.beginPath();
      ctx.arc(donutCenterX, donutCenterY, outerRadius, startAngle, endAngle);
      ctx.arc(donutCenterX, donutCenterY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // White slice separator
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      startAngle = endAngle;
    });

    // Center text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(String(options.centerNumber), donutCenterX, donutCenterY - 8);

    ctx.fillStyle = "#64748b";
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(options.centerLabel, donutCenterX, donutCenterY + 16);
  }

  // Legend
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  if (options.isWide) {
    // 2-column legend
    const col1X = 350;
    const col2X = 680;
    const itemsPerCol = 6;
    const itemsToDisplay = validData.slice(0, itemsPerCol * 2);

    itemsToDisplay.forEach((item, idx) => {
      const isCol2 = idx >= itemsPerCol;
      const curX = isCol2 ? col2X : col1X;
      const rowIdx = isCol2 ? idx - itemsPerCol : idx;
      const curY = 90 + (rowIdx * 36);

      let color = item.color;
      if (!color && options.colorMap && options.colorMap[item.group]) {
        color = options.colorMap[item.group];
      }
      if (!color) {
        const palette = options.colorPalette || CARBON_CATEGORICAL_PALETTE;
        color = palette[idx % palette.length];
      }
      const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) + "%" : "0%";

      // Color swatch
      ctx.fillStyle = color;
      ctx.fillRect(curX, curY - 7, 13, 13);
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(curX, curY - 7, 13, 13);

      // Label
      ctx.fillStyle = "#1e293b";
      ctx.font = "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      let label = item.group;
      if (label.length > 20) label = label.slice(0, 18) + "…";
      ctx.fillText(label, curX + 22, curY);

      // Value & Percent
      ctx.fillStyle = "#475569";
      ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${item.value} (${pct})`, curX + 190, curY);
    });

    if (validData.length > itemsPerCol * 2) {
      const remaining = validData.length - itemsPerCol * 2;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "italic 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`+ ${remaining} more operational functions`, col2X + 22, 90 + (itemsPerCol * 36));
    }
  } else {
    // 1-column legend
    const legendX = 270;
    const maxItems = 7;
    const itemsToDisplay = validData.slice(0, maxItems);

    itemsToDisplay.forEach((item, idx) => {
      const curY = 92 + (idx * 36);

      let color = item.color;
      if (!color && options.colorMap && options.colorMap[item.group]) {
        color = options.colorMap[item.group];
      }
      if (!color) {
        const palette = options.colorPalette || CARBON_CATEGORICAL_PALETTE;
        color = palette[idx % palette.length];
      }
      const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) + "%" : "0%";

      // Color swatch
      ctx.fillStyle = color;
      ctx.fillRect(legendX, curY - 7, 13, 13);
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, curY - 7, 13, 13);

      // Label
      ctx.fillStyle = "#1e293b";
      ctx.font = "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      let label = item.group;
      if (label.length > 17) label = label.slice(0, 15) + "…";
      ctx.fillText(label, legendX + 22, curY);

      // Value & Percent
      ctx.fillStyle = "#475569";
      ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${item.value} (${pct})`, legendX + 175, curY);
    });

    if (validData.length > maxItems) {
      const remaining = validData.length - maxItems;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "italic 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`+ ${remaining} more items`, legendX + 22, 92 + (maxItems * 36));
    }
  }

  return canvas.toDataURL("image/png");
}

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

  const selectedApp = summaryData || analyses.find((a: any) => a.analysisId === effectiveAnalysisId);

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

        const norm = classifyAsset(a);
        const rawScore = a.scores?.quantumRisk !== undefined ? a.scores.quantumRisk : a.quantumRiskScore;
        const riskScore = norm.quantumClassification === 'Unknown'
          ? null
          : (norm.quantumRiskScore ?? (rawScore !== null && rawScore !== undefined ? rawScore : (category === 'public_key' ? 100 : (category === 'symmetric' && algUpper.includes('128')) ? 60 : null)));

        const quantumRisk = norm.quantumRisk === 'Unknown' ? 'Unknown / Review' : norm.quantumRisk;

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
          asset: norm.assetName,
          usage: usage,
          category: category,
          algorithm: norm.algorithm,
          version: a.version || norm.keySize ? String(norm.keySize) : "Unknown",
          component: norm.assetType,
          discoverySource: "Static Source Code",
          location: norm.sourceLocation || "Location Not Available",
          locations: a.locations || (a.location ? [a.location] : []),
          occurrencesCount: norm.occurrencesCount,
          quantumClassification: norm.quantumClassification,
          rawCbomStatus: norm.rawCbomStatus,
          quantumRisk: quantumRisk,
          riskScore: riskScore,
          quantumRiskReason: norm.quantumRiskReason,
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
    // 1. Authoritative Quantum Classification Stats (Single Source of Truth)
    const assetList = (data && data.discoveredAssets && data.discoveredAssets.length > 0)
      ? data.discoveredAssets
      : (assets && assets.length > 0 ? assets : []);

    const stats = calculateClassificationStats(assetList);
    const totalOccurrences = stats.totalOccurrences || cbomSummaryData?.totalCryptoAssets || (summaryData?.aggregates?.totalOccurrences ?? data?.totalOccurrences ?? 0);
    const quantumSafe = stats.quantumSafe;
    const quantumVulnerable = stats.quantumVulnerable;
    const quantumWeakened = stats.quantumWeakened;
    const unknown = stats.unknown;

    const complianceData: CbomkitChartItem[] = [
      { group: "Quantum Safe", value: quantumSafe },
      { group: "Quantum Vulnerable", value: quantumVulnerable },
      { group: "Quantum-Weakened", value: quantumWeakened },
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
      quantumWeakened,
      quantumVulnerable,
      quantumSafe,
      stats,
      notApplicable: quantumWeakened,
      notQuantumSafe: quantumVulnerable,
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

      // Render existing Report charts to images using exact cbomStats
      const chartAImg = renderDonutChartToImage({
        centerNumber: cbomStats.totalCryptoAssets,
        centerLabel: "Crypto Assets",
        data: cbomStats.complianceData,
        colorMap: COMPLIANCE_COLOR_MAP,
        title: "A. Crypto Assets (PQC Compliance)",
        subtitle: "Post-quantum compliance distribution across all detected cryptographic assets"
      });

      const chartBImg = renderDonutChartToImage({
        centerNumber: cbomStats.primitiveCount,
        centerLabel: "Crypto Primitives",
        data: cbomStats.primitiveData,
        colorPalette: CARBON_CATEGORICAL_PALETTE,
        title: "B. Crypto Primitives",
        subtitle: "Distribution of detected cryptographic primitives"
      });

      const chartCImg = renderDonutChartToImage({
        centerNumber: cbomStats.functionsCount,
        centerLabel: "Crypto Functions",
        data: cbomStats.functionsData,
        colorPalette: CARBON_CATEGORICAL_PALETTE,
        title: "C. Operational Crypto Functions",
        subtitle: "Distribution of detected operational cryptographic functions",
        isWide: true
      });

      const addHeading = (text: string, yPos: number, level = 1) => {
        if (level === 1) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(30, 58, 95);
          doc.text(text, 14, yPos);
          return yPos + 7;
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(50, 50, 50);
          doc.text(text, 14, yPos);
          return yPos + 5;
        }
      };

      const addText = (text: string, yPos: number, isBold = false) => {
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        const splitText = doc.splitTextToSize(text, 182);
        doc.text(splitText, 14, yPos);
        return yPos + (splitText.length * 4.2);
      };

      // ==========================================
      // PAGE 1: COVER & EXECUTIVE SUMMARY
      // ==========================================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 58, 95);
      doc.text("CRYPTAVISTA", 14, 25);

      doc.setFontSize(13);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(70, 70, 70);
      doc.text("Cryptographic Discovery & PQC Readiness Assessment Report", 14, 33);

      doc.setFontSize(9.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Application: ${data.analysisName || "CryptaVista Application"}  |  Analysis ID: ${data.analysisId}  |  Date: ${new Date().toLocaleDateString()}`, 14, 41);
      doc.text(`Runtime Analysis Status: ${data.configuration.runtimeEnabled ? "Enabled and Verified" : "Disabled (Static Analysis Only)"}`, 14, 47);

      doc.setDrawColor(200, 200, 200);
      doc.line(14, 51, 196, 51);

      let y = 58;
      y = addHeading("1. EXECUTIVE SUMMARY", y);
      y = addText("Comprehensive assessment of application cryptographic posture, quantum-vulnerability exposure, and post-quantum migration priority.", y);
      y += 2;

      const pubKeyCount = summaryData?.aggregates?.publicKey ?? data.discoveredAssets.filter(a => a.category === "public_key").length;
      const symCount = summaryData?.aggregates?.symmetric ?? data.discoveredAssets.filter(a => a.category === "symmetric").length;
      const hashCount = summaryData?.aggregates?.hashOrKdf ?? data.discoveredAssets.filter(a => a.category === "hash" || a.category === "kdf").length;

      const execSummaryTable: string[][] = [
        ['Total Cryptographic Asset Occurrences', (cbomStats.totalCryptoAssets || data.totalOccurrences).toString()],
        ['Total Unique Logical Assets', data.uniqueLogicalAssetsCount.toString()],
        ['Quantum Safe (Post-Quantum Resilient)', `${cbomStats.quantumSafe} (${cbomStats.stats.quantumSafePct})`],
        ['Quantum Vulnerable (Classical Asymmetric / Shor\'s)', `${cbomStats.quantumVulnerable} (${cbomStats.stats.quantumVulnerablePct})`],
        ['Quantum-Weakened (Symmetric & Hashes / Grover\'s)', `${cbomStats.quantumWeakened} (${cbomStats.stats.quantumWeakenedPct})`],
        ['Unknown (Unclassified Primitives)', `${cbomStats.unknown} (${cbomStats.stats.unknownPct})`],
        ['Public-Key Cryptography Assets', pubKeyCount.toString()],
        ['Symmetric Cryptography Assets', symCount.toString()],
        ['Cryptographic Hash & KDF Assets', hashCount.toString()],
        ['Application Priority Tier (APS)', `${data.applicationPriority.overallPriority || 'P3'} (APS: ${data.applicationPriority.aps?.toFixed(2) ?? '0.00'})`],
        ['Runtime Verification Evidence', data.configuration.runtimeEnabled ? `Enabled (${data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length} assets observed)` : 'Disabled']
      ];

      autoTable(doc, {
        startY: y,
        head: [['Assessment Metric', 'Executive Finding']],
        body: execSummaryTable,
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 2.8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 2: CBOM CRYPTOGRAPHIC INVENTORY & VISUALIZATION
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("2. CBOM CRYPTOGRAPHIC INVENTORY & VISUALIZATION", y);
      y = addText("Complete cryptographic inventory and distribution of detected cryptographic assets, primitives, and operational functions extracted from static CBOM analysis.", y);
      y += 3;

      if (chartAImg && chartBImg) {
        doc.addImage(chartAImg, "PNG", 14, y, 88, 62);
        doc.addImage(chartBImg, "PNG", 108, y, 88, 62);
        y += 65;
      }
      if (chartCImg) {
        doc.addImage(chartCImg, "PNG", 14, y, 182, 62);
        y += 65;
      }

      autoTable(doc, {
        startY: y,
        head: [['Assessment Dimension', 'Detected Total', 'Distribution Summary', 'PQC Posture & Standard Reference']],
        body: [
          [
            'Crypto Assets (Compliance)',
            `${cbomStats.totalCryptoAssets} occurrences`,
            `Vulnerable: ${cbomStats.quantumVulnerable} (${cbomStats.stats.quantumVulnerablePct}), Safe: ${cbomStats.quantumSafe} (${cbomStats.stats.quantumSafePct}), Weakened: ${cbomStats.quantumWeakened} (${cbomStats.stats.quantumWeakenedPct})`,
            cbomStats.quantumVulnerable > 0 ? 'High quantum exposure - asymmetric migration required' : 'Quantum-safe baseline verified'
          ],
          [
            'Cryptographic Primitives',
            `${cbomStats.primitiveCount} types (${cbomStats.totalCryptoAssets} instances)`,
            cbomStats.primitiveData.slice(0, 3).map(p => `${p.group}: ${p.value}`).join(', ') || 'None',
            'Classification according to CBOM algorithm taxonomy'
          ],
          [
            'Cryptographic Functions',
            `${cbomStats.functionsCount} functional usages`,
            cbomStats.functionsData.slice(0, 3).map(f => `${f.group}: ${f.value}`).join(', ') || 'None',
            'Operational usage distributed across key lifecycle and protocols'
          ]
        ],
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.6 },
        columnStyles: {
          0: { cellWidth: 48, fontStyle: 'bold' },
          1: { cellWidth: 32, halign: 'center' },
          2: { cellWidth: 50 },
          3: { cellWidth: 52 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 3: CRYPTOGRAPHIC ASSET INVENTORY
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("3. CRYPTOGRAPHIC ASSET INVENTORY", y);
      y = addText(`Authoritative inventory of detected cryptographic assets (${cbomStats.totalCryptoAssets} total occurrences across ${data.uniqueLogicalAssetsCount} unique logical primitives) extracted from static analysis and CBOM evidence.`, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [['Asset Name', 'Algorithm', 'Key / Param', 'Primitive', 'Purpose / Usage', 'Source Location', 'Occurrences']],
        body: data.discoveredAssets.map(a => [
          a.asset || 'Unknown',
          a.algorithm || '-',
          a.version && a.version !== 'Unknown' ? String(a.version) : '-',
          a.component || a.category || '-',
          (a.usage || 'unspecified').replace(/_/g, ' '),
          a.location || 'Location Not Available',
          (a.occurrencesCount || 1).toString()
        ]),
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 7.8, cellPadding: 2.2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 26 },
          2: { cellWidth: 20 },
          3: { cellWidth: 26 },
          4: { cellWidth: 32 },
          5: { cellWidth: 34 },
          6: { cellWidth: 16, halign: 'center' }
        },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 4: QUANTUM SECURITY ASSESSMENT
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("4. QUANTUM SECURITY ASSESSMENT", y);
      y = addText("Assessment of cryptographic resilience across the four standardized post-quantum classifications:", y);
      y += 2;

      const classDefinitions = [
        "1. Quantum Safe: Standardized post-quantum cryptographic primitives (ML-KEM, ML-DSA, SLH-DSA, LMS/XMSS) resilient against known quantum cryptanalytic algorithms.",
        "2. Quantum Vulnerable: Classical public-key algorithms (RSA, ECC, ECDSA, ECDH, DH) vulnerable to polynomial-time Shor's algorithm on a cryptanalytically relevant quantum computer (CRQC).",
        "3. Quantum-Weakened: Symmetric ciphers (AES) and cryptographic hashes (SHA) where Grover's algorithm halves effective key strength, managed via parameter selection (e.g., AES-256) rather than algorithmic replacement.",
        "4. Unknown: Primitives or legacy structures where evidence is insufficient to verify post-quantum resistance."
      ];
      classDefinitions.forEach(d => { y = addText(d, y); y += 1; });
      y += 3;

      const complianceTable: string[][] = [
        ['Quantum Safe', cbomStats.quantumSafe.toString(), cbomStats.stats.quantumSafePct, 'Resilient against Shor\'s & Grover\'s quantum algorithms'],
        ['Quantum Vulnerable', cbomStats.quantumVulnerable.toString(), cbomStats.stats.quantumVulnerablePct, 'Completely broken by Shor\'s algorithm on CRQC'],
        ['Quantum-Weakened', cbomStats.quantumWeakened.toString(), cbomStats.stats.quantumWeakenedPct, 'Effective security halved by Grover\'s algorithm (upgrade key length)'],
        ['Unknown', cbomStats.unknown.toString(), cbomStats.stats.unknownPct, 'Insufficient evidence to verify resilience']
      ];

      autoTable(doc, {
        startY: y,
        head: [['Classification', 'Occurrences', 'Share (%)', 'Threat Model / Impact']],
        body: complianceTable,
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.6 },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 96 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      y = addHeading("Cryptographic Primitive Breakdown", y, 2);
      const primTable: string[][] = cbomStats.primitiveData.map(p => [
        p.group,
        p.value.toString(),
        `${cbomStats.totalCryptoAssets > 0 ? ((p.value / cbomStats.totalCryptoAssets) * 100).toFixed(1) : 0}%`
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Cryptographic Primitive', 'Occurrences', 'Share (%)']],
        body: primTable.length > 0 ? primTable : [['No primitives recorded', '-', '-']],
        headStyles: { fillColor: [70, 80, 95], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2.2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 5: QUANTUM RISK ANALYSIS
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("5. QUANTUM RISK ANALYSIS", y);
      y = addText("Detailed risk evaluation per cryptographic asset factoring algorithm vulnerability, key length, and operational deployment context.", y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [['Asset', 'Classification', 'Quantum Risk', 'Risk Rationale', 'Source Location']],
        body: data.discoveredAssets.map(a => [
          a.asset || 'Unknown',
          a.quantumClassification || 'Unknown',
          a.quantumRisk || 'Unavailable',
          a.quantumRiskReason || 'Evaluated against post-quantum threat models.',
          a.location || 'Location Not Available'
        ]),
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 7.8, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 32 },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 62 },
          4: { cellWidth: 36 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 6: APPLICATION PRIORITY & MOSCA ANALYSIS
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("6. APPLICATION PRIORITY & MOSCA ANALYSIS", y);
      const moscaMargin = data.applicationPriority.moscaVariables.timingMargin ?? (data.applicationPriority.moscaVariables.quantumRiskHorizon - (data.applicationPriority.moscaVariables.dataProtectionLifetime + data.applicationPriority.moscaVariables.migrationDuration));

      const moscaTable: string[][] = [
        ['X: Data Protection Lifetime', `${data.applicationPriority.moscaVariables.dataProtectionLifetime} years`],
        ['Y: Migration Duration', `${data.applicationPriority.moscaVariables.migrationDuration} years`],
        ['Z: Quantum Threat Horizon', `${data.applicationPriority.moscaVariables.quantumRiskHorizon} years (${data.applicationPriority.moscaVariables.quantumThreatHorizon})`],
        ['Timing Margin (Z - (X + Y))', `${moscaMargin} years ${moscaMargin < 0 ? '- CRITICAL DEFICIT' : '- Positive margin'}`],
        ['Mosca Urgency Score', data.applicationPriority.moscaUrgency?.toFixed(2) ?? '0.00'],
        ['Data Sensitivity Score', data.applicationPriority.dataSensitivity?.toFixed(2) ?? '0.00'],
        ['Business Criticality Score', data.applicationPriority.businessCriticality?.toFixed(2) ?? '0.00'],
        ['Application Priority Score (APS)', `${data.applicationPriority.aps?.toFixed(2) ?? '0.00'} | Tier: ${data.applicationPriority.overallPriority || 'P3'}`]
      ];

      autoTable(doc, {
        startY: y,
        head: [['Mosca Theorem Parameter', 'Assessed Value']],
        body: moscaTable,
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      y = addHeading("Component-Level Priority Ranking (CPS Table)", y, 2);
      autoTable(doc, {
        startY: y,
        head: [['Rank', 'Asset', 'Component', 'Quantum Risk', 'Complexity', 'Impact', 'Priority Score (CPS)']],
        body: data.discoveredAssets.sort((a, b) => a.priorityRank - b.priorityRank).map(a => [
          (a.priorityRank ?? '-').toString(),
          a.asset || 'Unknown',
          a.component || 'Unknown',
          a.quantumRisk || 'Unavailable',
          (a.migrationComplexity ?? 50).toString(),
          a.dependencyImpact !== null && a.dependencyImpact !== undefined ? a.dependencyImpact.toString() : 'Unavailable',
          a.priorityScore !== null && a.priorityScore !== undefined ? a.priorityScore.toString() : 'N/A'
        ]),
        headStyles: { fillColor: [70, 80, 95], textColor: [255, 255, 255] },
        styles: { fontSize: 7.8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 7: DEPENDENCY & BLAST RADIUS ANALYSIS
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("7. DEPENDENCY & BLAST RADIUS ANALYSIS", y);
      const totalEdges = dependencyData?.summary?.totalEdges ?? summaryData?.dependencies?.totalEdges ?? (data.discoveredAssets ? data.discoveredAssets.filter(a => a.directDependents > 0).length : 0);
      const hasVerifiedDeps = totalEdges > 0 || data.discoveredAssets.some(a => a.hasDependencyEvidence);

      if (hasVerifiedDeps) {
        y = addText(`Topology Metrics: ${data.totalOccurrences} occurrences across ${data.uniqueLogicalAssetsCount} unique logical components with ${totalEdges} verified dependency relationships.`, y);
      } else {
        y = addText("Notice: Insufficient dependency data available for this application. Cryptographic dependencies could not be resolved from static call graphs or runtime telemetry. Static component nodes are cataloged below.", y);
      }
      y += 3;

      // Summary KPI Metrics Table (3 Cards matching UI: Occurrences, Nodes, Edges)
      autoTable(doc, {
        startY: y,
        head: [['Dependency Metric', 'Assessed Value', 'Scope & Architectural Interpretation']],
        body: [
          ['Cryptographic Asset Occurrences', (cbomStats.totalCryptoAssets || data.totalOccurrences).toString(), 'Total cryptographic algorithm instances detected across codebase layers'],
          ['Unique Component Nodes', data.uniqueLogicalAssetsCount.toString(), 'Logical cryptographic components mapped in dependency topology'],
          ['Verified Dependency Edges', totalEdges.toString(), 'Component-to-asset caller linkages verified via call graph analysis']
        ],
        headStyles: { fillColor: [70, 80, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: 'bold' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 97 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      y = addHeading("Component Discovery & Blast Radius Mapping", y, 2);

      autoTable(doc, {
        startY: y,
        head: [['Asset', 'Occurrences', 'Component / Usage', 'Location', 'Blast Radius (Dependents)', 'Impact Score']],
        body: data.discoveredAssets.map(a => [
          a.asset || 'Unknown',
          (a.occurrencesCount || 1).toString(),
          `${a.component || 'Unknown'} (${(a.usage || '').replace(/_/g, ' ')})`,
          a.location || 'Location Not Available',
          hasVerifiedDeps ? (a.directDependents ? `${a.directDependents} direct` : '0 direct') : 'Insufficient data',
          a.dependencyImpact !== null && a.dependencyImpact !== undefined ? `Score: ${a.dependencyImpact}` : 'Unavailable'
        ]),
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 7.8, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 40 },
          3: { cellWidth: 42 },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 20, halign: 'center' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 8: POST-QUANTUM MIGRATION RECOMMENDATIONS
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("8. POST-QUANTUM MIGRATION RECOMMENDATIONS", y);
      y = addText("Phased migration roadmap aligned with NIST Post-Quantum Cryptography standards (FIPS 203, FIPS 204, FIPS 205):", y);
      y += 2;

      y = addText(`Phase 1 - Highest Priority (Urgent Action Required): ${phases.phase1.length} assets`, y, true);
      y = addText("  Focus: Asymmetric Shor-vulnerable public key algorithms (RSA, ECDSA). Replace with ML-KEM, ML-DSA, or SLH-DSA.", y);
      y = addText(`Phase 2 - Next Priority (Plan & Prepare): ${phases.phase2.length} assets`, y, true);
      y = addText("  Focus: High complexity integrations, protocol handshakes, and hybrid transition infrastructure.", y);
      y = addText(`Phase 3 - Low Priority / Monitor (Standards Compliance): ${phases.phase3.length} assets`, y, true);
      y = addText("  Focus: Symmetric ciphers (AES) transition to stronger 256-bit parameters and verify nonce handling. Quantum-safe assets require continuous monitoring.", y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Asset', 'Current Usage', 'Migration Target', 'Implementation Guidance', 'Standard Reference']],
        body: data.discoveredAssets.map(a => {
          const rec = getRecommendation(a);
          return [
            a.asset || 'Unknown',
            (a.usage || '').replace(/_/g, ' '),
            rec.target || 'Assess Configuration',
            rec.guidance || 'Follow NIST implementation recommendations.',
            rec.standard || 'NIST Guidance'
          ];
        }),
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 28 },
          2: { cellWidth: 42 },
          3: { cellWidth: 54 },
          4: { cellWidth: 34 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
      });

      // ==========================================
      // PAGE 9: ASSESSMENT METHODOLOGY & STANDARDS
      // ==========================================
      doc.addPage();
      y = 20;
      y = addHeading("9. ASSESSMENT METHODOLOGY & STANDARDS", y);
      y = addText("CRYPTAVISTA utilizes an 8-stage assessment framework to discover, evaluate, and prioritize cryptographic assets:", y);
      y += 2;

      const methodologySteps = [
        "1. Cryptographic Asset Discovery: Extraction of raw cryptographic assets via static binary and source scanning, runtime telemetry, and external CBOM ingestion.",
        "2. CBOM Generation: Generation and validation of CycloneDX 1.6 Cryptographic Bill of Materials (CBOM).",
        "3. Asset Normalization: Resolution of duplicate occurrences, identification of key material relationships, and normalization into unified cryptographic entities.",
        "4. Algorithm Identification: Parsing primitive types, key lengths, cipher modes, and functional usage contexts.",
        "5. Quantum Classification: Authoritative categorization into Quantum Safe, Quantum Vulnerable, Quantum-Weakened, or Unknown.",
        "6. Quantum Risk Assessment: Evaluating susceptibility to Shor's and Grover's quantum cryptanalysis algorithms against operational threat horizons.",
        "7. Migration Analysis: Rule-based generation of post-quantum remediation paths conforming to NIST FIPS 203, 204, 205 and SP 800 guidelines.",
        "8. Application Prioritization: Calculating the Application Priority Score (APS) using Mosca's theorem and component-level CPS metrics."
      ];
      methodologySteps.forEach(s => { y = addText(s, y); y += 1; });
      y += 3;

      // Prominent methodology note
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(50, 70, 100);
      const noteBox = doc.splitTextToSize("Methodology Note: The raw CBOM provides the cryptographic inventory. CRYPTAVISTA applies an additional application-level quantum-security classification layer. The extended classification does not modify the original CBOM evidence.", 182);
      doc.text(noteBox, 14, y);
      y += (noteBox.length * 4.2) + 5;

      y = addHeading("Applicable Standards & References", y, 2);
      const standardsList = [
        "- NIST FIPS 203 (ML-KEM) - Module-Lattice-Based Key-Encapsulation Mechanism Standard",
        "- NIST FIPS 204 (ML-DSA) - Module-Lattice-Based Digital Signature Standard",
        "- NIST FIPS 205 (SLH-DSA) - Stateless Hash-Based Digital Signature Standard",
        "- NIST SP 800-208 - Recommendation for Stateful Hash-Based Signature Schemes",
        "- NIST SP 800-38D - Galois/Counter Mode (GCM) for Block Cipher Algorithms",
        "- RFC 9106 - Argon2 Password Hashing and Memory-Hard Function",
        "- RFC 8439 - ChaCha20 and Poly1305 for IETF Protocols",
        "- NIST SP 800-131A Rev. 2 - Transitioning the Use of Cryptographic Algorithms and Key Lengths"
      ];
      standardsList.forEach(std => { y = addText(std, y); y += 1; });

      // Page numbering footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`CRYPTAVISTA Assessment Report  |  Page ${i} of ${pageCount}`, 196, 290, { align: "right" });
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
                  <div className="text-[10px] text-emerald-600/80 mt-0.5">{cbomStats.stats.quantumSafePct} · Resilient</div>
                </div>

                {/* Quantum Vulnerable */}
                <div className="p-3.5 bg-red-50/60 border border-red-200/80 rounded-lg">
                  <div className="text-red-800 mb-1 text-[11px] font-semibold leading-tight">Quantum Vulnerable</div>
                  <div className="font-bold text-2xl text-red-700">{cbomStats.quantumVulnerable}</div>
                  <div className="text-[10px] text-red-600/80 mt-0.5">{cbomStats.stats.quantumVulnerablePct} · Vulnerable</div>
                </div>

                {/* Quantum-Weakened */}
                <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-lg">
                  <div className="text-amber-800 mb-1 text-[11px] font-semibold leading-tight">Quantum-Weakened</div>
                  <div className="font-bold text-2xl text-amber-700">{cbomStats.quantumWeakened}</div>
                  <div className="text-[10px] text-amber-600/80 mt-0.5">{cbomStats.stats.quantumWeakenedPct} · Symmetric/Hash</div>
                </div>

                {/* Unknown */}
                <div className="p-3.5 bg-sky-50/60 border border-sky-200/80 rounded-lg">
                  <div className="text-sky-800 mb-1 text-[11px] font-medium leading-tight">Unknown</div>
                  <div className="font-bold text-2xl text-sky-800">{cbomStats.unknown}</div>
                  <div className="text-[10px] text-sky-600/80 mt-0.5">{cbomStats.stats.unknownPct} · Unclassified</div>
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
                      {data.discoveredAssets.sort((a, b) => a.priorityRank - b.priorityRank).map((a, i) => {
                        const isExpanded = expandedAsset === `priority-${a.asset}`;
                        return (
                          <React.Fragment key={i}>
                            <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedAsset(isExpanded ? null : `priority-${a.asset}`)}>
                              <td className="px-4 py-3 font-semibold text-gray-500">#{a.priorityRank}</td>
                              <td className="px-4 py-3 font-semibold text-[#1e3a5f] flex items-center gap-2">
                                {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                {a.asset}
                              </td>
                              <td className="px-4 py-3 text-gray-700">{a.component}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${a.quantumRisk === "High" ? "bg-red-50 text-red-700 border border-red-200" :
                                    a.quantumRisk === "Medium" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                      a.quantumRisk === "Low" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                        "bg-slate-100 text-slate-700 border border-slate-200"
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
                                      <div className="text-gray-400 font-mono mt-1">Score: {a.riskScore !== null && a.riskScore !== undefined ? a.riskScore : "-"}</div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  Blast radius and dependency impact measure the propagation of changes required across callers and dependent components if this cryptographic asset is migrated or replaced.
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
              {/* Phase 1 - Red / Urgent */}
              <div className="border border-red-200 bg-red-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                    <h3 className="font-bold text-red-900 text-sm">Phase 1 - Highest Priority Components</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-800 bg-red-100 border border-red-200 px-2 py-0.5 rounded">PRIORITY: URGENT</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded">{phases.phase1.length} assets</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-red-700 font-semibold mb-3">
                  <ShieldAlert size={13} className="text-red-600 shrink-0" />
                  Urgent Action Required - quantum-vulnerable public-key cryptography detected
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

              {/* Phase 2 - Amber */}
              <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <h3 className="font-bold text-amber-900 text-sm">Phase 2 - Next Priority Components</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">PRIORITY: HIGH</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded">{phases.phase2.length} assets</span>
                </div>
                <div className="text-xs text-amber-700 font-semibold mb-3">Plan &amp; Prepare - review symmetric cryptography configurations and key management</div>
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

              {/* Phase 3 - Green */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                    <h3 className="font-bold text-emerald-950 text-sm">Phase 3 - Low Priority / Monitor</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">PRIORITY: LOW</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">{phases.phase3.length} assets</span>
                </div>
                <div className="text-xs text-emerald-800 font-semibold mb-3">Standards Compliance - currently compliant, low migration urgency, monitor and maintain</div>
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
                          <div className="text-[11px] text-gray-500 mt-0.5">{a.usage.replace(/_/g, " ")} - {a.component}</div>
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
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><div className="text-[11px] text-emerald-800 font-semibold">Quantum Safe</div></div>
                    <div className="font-bold text-2xl text-emerald-700">{cbomStats.quantumSafe}</div>
                    <div className="text-[10px] text-emerald-600 mt-1">{cbomStats.stats.quantumSafePct} · occurrences</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-red-600" /><div className="text-[11px] text-red-800 font-semibold">Quantum Vulnerable</div></div>
                    <div className="font-bold text-2xl text-red-700">{cbomStats.quantumVulnerable}</div>
                    <div className="text-[10px] text-red-600 mt-1">{cbomStats.stats.quantumVulnerablePct} · occurrences</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-amber-500" /><div className="text-[11px] text-amber-800 font-semibold">Quantum-Weakened</div></div>
                    <div className="font-bold text-2xl text-amber-700">{cbomStats.quantumWeakened}</div>
                    <div className="text-[10px] text-amber-600 mt-1">{cbomStats.stats.quantumWeakenedPct} · occurrences</div>
                  </div>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-sky-400" /><div className="text-[11px] text-sky-800 font-semibold">Unknown</div></div>
                    <div className="font-bold text-2xl text-sky-700">{cbomStats.unknown}</div>
                    <div className="text-[10px] text-sky-600 mt-1">{cbomStats.stats.unknownPct} · occurrences</div>
                  </div>
                </div>
              </div>

              {/* C. Migration Priority Summary */}
              <div>
                <h3 className="font-bold text-sm text-[#1e3a5f] mb-3">C. Migration Priority Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-red-200 bg-red-50/60 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-red-800 font-semibold uppercase tracking-wider mb-1">Phase 1 - Urgent</div>
                      <div className="font-bold text-2xl text-red-700">{phases.phase1.length}</div>
                      <div className="text-[10px] text-red-600 mt-1">assets requiring immediate action</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-red-600 shrink-0" />
                  </div>
                  <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-amber-800 font-semibold uppercase tracking-wider mb-1">Phase 2 - Plan &amp; Prepare</div>
                      <div className="font-bold text-2xl text-amber-700">{phases.phase2.length}</div>
                      <div className="text-[10px] text-amber-600 mt-1">assets for review and planning</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider mb-1">Phase 3 - Low Priority / Monitor</div>
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
                        {data.discoveredAssets.sort((a, b) => a.priorityRank - b.priorityRank).map((a, i) => {
                          const rec = getRecommendation(a);
                          const p = a.priorityClassification || a.priority;
                          const phase = p === "Urgent"
                            ? { label: "Phase 1", cls: "text-red-700 font-semibold" }
                            : (p === "High" || p === "Monitor")
                              ? { label: "Phase 2", cls: "text-amber-700 font-semibold" }
                              : p === "Low"
                                ? { label: "Phase 3", cls: "text-emerald-700 font-semibold" }
                                : { label: "-", cls: "text-gray-400" };
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
                                <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded ${a.quantumRisk === "High" ? "bg-red-50 text-red-700 border border-red-200" :
                                    a.quantumRisk === "Medium" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                      a.quantumRisk === "Low" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                        "bg-slate-100 text-slate-700 border border-slate-200"
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
                  {ref.name && <div className="text-[11px] font-semibold text-gray-600 mt-0.5">- {ref.name}</div>}
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