import { useState, useEffect } from "react";
import { Layers, Key, Activity, Server, Target, ShieldCheck, ShieldAlert, AlertTriangle, HelpCircle } from "lucide-react";
import {
  calculateClassificationStats,
  ClassificationStats,
  QUANTUM_RISK_MAPPING,
  MOSCA_URGENCY_MAPPING,
  DATA_SENSITIVITY_MAPPING,
  BUSINESS_CRITICALITY_MAPPING,
  APS_PRIORITY_MAPPING
} from "../utils/quantumClassification";

const kpiIcons = [Layers, Key, Activity, Target, Server];

const RECENT_ANALYSES_GRID_COLUMNS = "minmax(360px, 1fr) repeat(5, minmax(115px, 130px)) minmax(120px, 140px)";

function getAppStageStatuses(analysis: any): {
  discover: string;
  assess: string;
  prioritize: string;
  recommendation: string;
} {
  const appStatus = String(analysis.status || '').trim().toUpperCase();
  const currentStage = String(analysis.currentStage || '').trim().toUpperCase();

  // 1. Discover
  const discRaw = String(analysis.stages?.discover?.status || '').trim().toUpperCase();
  let discover = 'PENDING';
  if (discRaw === 'RUNNING' || (appStatus === 'RUNNING' && (currentStage === 'DISCOVER' || !currentStage))) {
    discover = 'RUNNING';
  } else if (discRaw === 'FAILED' || (appStatus === 'FAILED' && discRaw !== 'COMPLETED')) {
    discover = 'FAILED';
  } else if (discRaw === 'COMPLETED' || appStatus === 'COMPLETED') {
    discover = 'COMPLETED';
  } else if (appStatus === 'RUNNING') {
    discover = 'RUNNING';
  } else if (discRaw) {
    discover = discRaw;
  }

  // 2. Assess
  const assessRaw = String(analysis.stages?.assess?.status || analysis.stages?.assessment?.status || '').trim().toUpperCase();
  let assess = 'PENDING';
  if (assessRaw && assessRaw !== 'WAITING') {
    assess = assessRaw;
  } else if (appStatus === 'RUNNING' && currentStage === 'ASSESS') {
    assess = 'RUNNING';
  } else if (appStatus === 'FAILED') {
    assess = assessRaw || 'FAILED';
  } else if (
    appStatus === 'COMPLETED' &&
    ((analysis.cbomSummary && typeof analysis.cbomSummary.totalCryptoAssets === 'number') ||
      (typeof analysis.detectedCryptoAssetCount === 'number' && analysis.detectedCryptoAssetCount > 0) ||
      discRaw === 'COMPLETED')
  ) {
    assess = 'COMPLETED';
  } else if (assessRaw) {
    assess = assessRaw;
  }

  // 3. Prioritize
  const prioRaw = String(analysis.stages?.prioritize?.status || analysis.stages?.priority?.status || '').trim().toUpperCase();
  let prioritize = 'PENDING';
  if (prioRaw && prioRaw !== 'WAITING') {
    prioritize = prioRaw;
  } else if (appStatus === 'RUNNING' && currentStage === 'PRIORITIZE') {
    prioritize = 'RUNNING';
  } else if (appStatus === 'FAILED') {
    prioritize = prioRaw || 'WAITING';
  } else if (analysis.priorityScore !== undefined || analysis.priorityGrade !== undefined || analysis.priority !== undefined) {
    prioritize = 'COMPLETED';
  } else if (appStatus === 'COMPLETED') {
    prioritize = 'COMPLETED';
  } else if (prioRaw) {
    prioritize = prioRaw;
  }

  // 4. Recommendation
  const recRaw = String(
    analysis.stages?.recommend?.status ||
    analysis.stages?.recommendation?.status ||
    analysis.stages?.recommendations?.status ||
    ''
  ).trim().toUpperCase();
  let recommendation = 'PENDING';
  if (recRaw && recRaw !== 'WAITING') {
    recommendation = recRaw;
  } else if (
    appStatus === 'RUNNING' &&
    (currentStage === 'RECOMMEND' || currentStage === 'RECOMMENDATION')
  ) {
    recommendation = 'RUNNING';
  } else if (appStatus === 'FAILED') {
    recommendation = recRaw || 'WAITING';
  } else if (Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0) {
    recommendation = 'COMPLETED';
  } else if (appStatus === 'COMPLETED') {
    recommendation = 'COMPLETED';
  } else if (recRaw) {
    recommendation = recRaw;
  }

  return { discover, assess, prioritize, recommendation };
}

export default function Overview({ onNavigate, analyses = [], selectedAnalysisId }: { onNavigate?: (id: string) => void; analyses?: any[]; selectedAnalysisId?: string }) {
  const [totalAssets, setTotalAssets] = useState(0);
  const [localAnalyses, setLocalAnalyses] = useState<any[]>([]);
  const [overviewAssets, setOverviewAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const displayAnalyses = analyses.length > 0 ? analyses : localAnalyses;
  const currentAnalysisId = selectedAnalysisId || (displayAnalyses.length > 0 ? displayAnalyses[0].analysisId : "");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:3001/api/analyses");
        if (res.ok) {
          const analysesData = await res.json();
          setLocalAnalyses(analysesData);
          let total = 0;
          analysesData.forEach((a: any) => {
            total += (typeof a.detectedCryptoAssetCount === 'number' ? a.detectedCryptoAssetCount : (a.stages?.discover?.assetCount || 0));
          });
          setTotalAssets(total);
        }

        // Fetch assets for quantum classification cards
        const targetId = selectedAnalysisId || (analyses[0]?.analysisId);
        const assetsUrl = targetId
          ? `http://localhost:3001/api/analyses/${targetId}/assets`
          : `http://localhost:3001/api/analyses/assets/all`;

        const aRes = await fetch(assetsUrl).catch(() => null);
        if (aRes && aRes.ok) {
          const aData = await aRes.json();
          setOverviewAssets(Array.isArray(aData) ? aData : []);
        }
      } catch (err) {
        console.error("Failed to fetch overview data:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, [selectedAnalysisId, analyses]);

  // Compute authoritative 4-card quantum classification stats
  const quantumStats: ClassificationStats = calculateClassificationStats(overviewAssets);

  const totalFromProps = displayAnalyses.reduce((sum, a) => sum + (typeof a.detectedCryptoAssetCount === 'number' ? a.detectedCryptoAssetCount : (a.stages?.discover?.assetCount || 0)), 0);
  const displayTotalAssets = displayAnalyses.length > 0 ? totalFromProps : totalAssets;

  const totalApplications = displayAnalyses.length;
  const applicationsAnalyzed = displayAnalyses.filter(a => a.stages?.discover?.status === 'COMPLETED').length;

  const kpis = [
    { label: "Total Applications", value: totalApplications.toString() },
    { label: "Applications Analyzed", value: applicationsAnalyzed.toString() },
    { label: "Total Cryptographic Asset Occurrences", value: (quantumStats.totalOccurrences > 0 ? quantumStats.totalOccurrences : displayTotalAssets).toString() },
  ];

  const pipelineStages = [
    { key: "discovery", label: "DISCOVER", sub: "Artefact discovery", page: "discovery" },
    { key: "verify", label: "VERIFY", sub: "Runtime evidence", page: "runtime" },
    { key: "assess", label: "ASSESS", sub: "Quantum risk", page: "risktimeline" },
    { key: "prioritize", label: "PRIORITIZE", sub: "Decision ranking", page: "priority" },
    { key: "recommend", label: "RECOMMEND", sub: "PQC / Hybrid", page: "recommendations" }
  ];

  if (loading) {
    return (
      <div className="flex-1 bg-[#f5f6f8] flex items-center justify-center">
        <div className="text-gray-500">Loading enterprise overview...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-6">

        {/* Dark-Blue Hero Banner */}
        <div className="bg-[#1e3a5f] rounded-lg px-5 py-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          {/* Left Side */}
          <div>
            <div className="text-white text-[13px] font-semibold mb-1">
              Enterprise Cryptographic Overview
            </div>
            <div className="text-blue-200/60 text-[11px] max-w-sm">
              Discover, verify and assess cryptography across your enterprise.
            </div>
          </div>

          {/* Right Side - Pipeline */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full xl:w-auto">
            {pipelineStages.map((stage, i) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div
                  onClick={() => onNavigate && onNavigate(stage.page)}
                  className="bg-white/5 rounded-md px-3 py-2 w-32 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <div className="text-white font-semibold mb-0.5 text-[11px] tracking-wider">
                    {stage.label}
                  </div>
                  <div className="text-blue-200/60 text-[11px] leading-tight">
                    {stage.sub}
                  </div>
                </div>
                {i < pipelineStages.length - 1 && (
                  <div className="text-[#4e6a96] px-1 font-bold">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {totalApplications === 0 ? (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Layers className="text-gray-400 w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No analyses available yet</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
              Start by creating a new analysis to inventory cryptographic assets across your applications and targets.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate("newanalysis")}
                className="mt-6 px-4 py-2 bg-[#1e3a5f] text-white rounded-md font-medium text-sm hover:bg-[#162e4d]"
              >
                + Start New Analysis
              </button>
            )}
          </div>
        ) : (
          <>

            {/* Top Operational KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {kpis.map((kpi, i) => {
                const Icon = kpiIcons[i % kpiIcons.length];
                return (
                  <div key={kpi.label} className="bg-white border border-[#dde1e9] rounded-lg p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <Icon size={24} />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#6b7589]">{kpi.label}</div>
                      <div className="text-3xl font-bold text-[#1a1d23] mt-1">{kpi.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Authoritative Quantum Classification Layer (Exact Four Cards) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wider">
                    Post-Quantum Cryptographic Assessment
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Centralized four-category quantum security classification across cryptographic asset occurrences.
                  </p>
                </div>
                <div className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-md">
                  Total: {quantumStats.totalOccurrences} occurrences
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CARD 1: QUANTUM SAFE */}
                <div className="bg-white border border-emerald-200 rounded-lg p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <ShieldCheck size={20} className="shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider">Quantum Safe</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {quantumStats.quantumSafePct}
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-[#1a1d23] mt-1">
                      {loading ? "…" : quantumStats.quantumSafe}
                    </div>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      Post-quantum algorithms designed to resist known quantum attacks.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-100 text-[11px] text-emerald-800 font-medium">
                    <span className="text-gray-400 font-normal">Examples: </span>ML-KEM, ML-DSA, SLH-DSA
                  </div>
                </div>

                {/* CARD 2: QUANTUM VULNERABLE */}
                <div className="bg-white border border-red-200 rounded-lg p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-red-700">
                        <ShieldAlert size={20} className="shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider">Quantum Vulnerable</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        {quantumStats.quantumVulnerablePct}
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-[#1a1d23] mt-1">
                      {loading ? "…" : quantumStats.quantumVulnerable}
                    </div>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      Classical public-key algorithms vulnerable to quantum cryptanalysis.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-red-100 text-[11px] text-red-800 font-medium">
                    <span className="text-gray-400 font-normal">Examples: </span>RSA, ECC, ECDSA, ECDH, DH
                  </div>
                </div>

                {/* CARD 3: QUANTUM-WEAKENED */}
                <div className="bg-white border border-amber-200 rounded-lg p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={20} className="shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider">Quantum-Weakened</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {quantumStats.quantumWeakenedPct}
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-[#1a1d23] mt-1">
                      {loading ? "…" : quantumStats.quantumWeakened}
                    </div>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      Classical symmetric cryptography whose effective security is reduced by quantum search.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-100 text-[11px] text-amber-800 font-medium">
                    <span className="text-gray-400 font-normal">Examples: </span>AES and other supported symmetric primitives.
                  </div>
                </div>

                {/* CARD 4: UNKNOWN */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-slate-700">
                        <HelpCircle size={20} className="shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider">Unknown</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                        {quantumStats.unknownPct}
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-[#1a1d23] mt-1">
                      {loading ? "…" : quantumStats.unknown}
                    </div>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      Insufficient evidence or unrecognized cryptographic construction prevents reliable quantum classification.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
                    <span className="text-gray-400 font-normal">Action: </span>Manual review / deeper evidence required
                  </div>
                </div>
              </div>
            </div>

            {/* CRYPTAVISTA Assessment Methodology & Scoring */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wider">
                  CRYPTAVISTA Assessment Methodology
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Scoring mappings and formulas used for quantum risk and application migration priority.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. QUANTUM RISK SCORE MAPPING */}
                <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider mb-3">
                      1. Quantum Risk Score Mapping
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f8fafc] text-[#475569] font-semibold border-b border-[#e2e8f0]">
                          <tr>
                            <th className="px-3 py-2">Quantum Classification</th>
                            <th className="px-3 py-2 text-center">Score</th>
                            <th className="px-3 py-2">Risk Level</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {QUANTUM_RISK_MAPPING.map(item => (
                            <tr key={item.classification} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${item.classification === 'Quantum Safe' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                  item.classification === 'Quantum Vulnerable' ? 'bg-red-50 text-red-800 border-red-200' :
                                    item.classification === 'Quantum-Weakened' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                      'bg-slate-50 text-slate-700 border-slate-200'
                                  }`}>
                                  {item.classification}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-[#1e3a5f] font-mono">
                                {item.score !== null && item.score !== undefined ? item.score : "-"}
                              </td>
                              <td className="px-3 py-2 text-[#475569] font-medium">
                                {item.riskLevel}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 pt-2.5 border-t border-gray-100 leading-relaxed">
                    Quantum Vulnerable represents classical public-key algorithms exposed to quantum attacks. Quantum-Weakened represents reduced effective security for symmetric cryptography under quantum search. Quantum Safe represents supported post-quantum algorithms. Unknown represents unclassified primitives with no numeric score assigned.
                  </p>
                </div>

                {/* 2. MOSCA TIMING MODEL */}
                <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider mb-3">
                      2. Mosca Timing Model
                    </h4>
                    <div className="space-y-1.5 text-xs text-gray-700">
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="font-semibold text-[#1e3a5f]">X</span>
                        <span className="text-gray-600">Data Protection Lifetime</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="font-semibold text-[#1e3a5f]">Y</span>
                        <span className="text-gray-600">Migration Duration</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="font-semibold text-[#1e3a5f]">Z</span>
                        <span className="text-gray-600">Quantum Risk Horizon</span>
                      </div>
                    </div>

                    <div className="bg-[#f0f5fc] border border-[#d3e2f5] rounded-md p-2.5 mt-3 text-center">
                      <div className="text-[11px] text-[#475569] font-medium mb-0.5">Fundamental Relationship</div>
                      <div className="font-mono text-sm font-bold text-[#1e3a5f]">Timing Margin = Z − (X + Y)</div>
                    </div>

                    <p className="text-[11px] text-gray-500 mt-2.5 leading-relaxed">
                      The Mosca model compares how long protected data must remain secure and how long migration may take against the expected quantum-risk horizon.
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 bg-slate-50/80 rounded p-2.5 text-[11px] text-gray-600 border border-slate-200">
                    <div className="font-bold text-gray-700 mb-1 text-[10px] uppercase tracking-wide">Illustrative Mosca Example:</div>
                    <div className="font-mono text-[11px] space-y-0.5 text-gray-700">
                      <div>X = 5 years, Y = 2 years, Z = 10 years</div>
                      <div>Timing Margin: Z − (X + Y) = 10 − (5 + 2) = <strong className="text-[#1e3a5f]">+3 years</strong></div>
                      <div className="text-emerald-700 font-sans mt-0.5 font-medium">+3 years → Score 50 → High</div>
                    </div>
                  </div>
                </div>

                {/* 3. MOSCA URGENCY SCORE */}
                <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider mb-3">
                      3. Mosca Urgency Score
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f8fafc] text-[#475569] font-semibold border-b border-[#e2e8f0]">
                          <tr>
                            <th className="px-3 py-2">Timing Margin Z − (X + Y)</th>
                            <th className="px-3 py-2 text-center">Score</th>
                            <th className="px-3 py-2">Urgency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {MOSCA_URGENCY_MAPPING.map(item => (
                            <tr key={item.marginRange} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2 font-mono text-[#1a1d23]">
                                {item.marginRange}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-[#1e3a5f] font-mono">
                                {item.score}
                              </td>
                              <td className="px-3 py-2 font-semibold">
                                <span className={`px-2 py-0.5 rounded text-[11px] ${item.urgency === 'Critical' ? 'bg-red-100 text-red-800' :
                                  item.urgency === 'Very High' ? 'bg-orange-100 text-orange-800' :
                                    item.urgency === 'High' ? 'bg-amber-100 text-amber-800' :
                                      item.urgency === 'Medium' ? 'bg-blue-100 text-blue-800' :
                                        'bg-emerald-100 text-emerald-800'
                                  }`}>
                                  {item.urgency}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 pt-2.5 border-t border-gray-100 leading-relaxed">
                    Evaluated dynamically against application configuration parameters to derive urgency (M).
                  </p>
                </div>

                {/* 4. DATA SENSITIVITY SCORE */}
                <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider mb-3">
                      4. Data Sensitivity Score
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f8fafc] text-[#475569] font-semibold border-b border-[#e2e8f0]">
                          <tr>
                            <th className="px-3 py-2">Data Sensitivity</th>
                            <th className="px-3 py-2 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {DATA_SENSITIVITY_MAPPING.map(item => (
                            <tr key={item.sensitivity} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2 font-medium text-[#1a1d23]">
                                {item.sensitivity}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-[#1e3a5f] font-mono">
                                {item.score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 pt-2.5 border-t border-gray-100 leading-relaxed">
                    Higher sensitivity receives a higher score because the impact of future cryptographic compromise is greater.
                  </p>
                </div>

                {/* 5. BUSINESS CRITICALITY SCORE */}
                <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider mb-3">
                      5. Business Criticality Score
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f8fafc] text-[#475569] font-semibold border-b border-[#e2e8f0]">
                          <tr>
                            <th className="px-3 py-2">Business Criticality</th>
                            <th className="px-3 py-2 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {BUSINESS_CRITICALITY_MAPPING.map(item => (
                            <tr key={item.criticality} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2 font-medium text-[#1a1d23]">
                                {item.criticality}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-[#1e3a5f] font-mono">
                                {item.score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 pt-2.5 border-t border-gray-100 leading-relaxed">
                    Higher business criticality results in a higher migration priority score.
                  </p>
                </div>

                {/* 6. APPLICATION PRIORITY SCORE */}
                <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider mb-3">
                      6. Application Priority Score
                    </h4>
                    <div className="bg-[#f0f5fc] border border-[#d3e2f5] rounded-md p-2.5 mb-3 text-center">
                      <div className="font-mono text-sm font-bold text-[#1e3a5f]">APS = (M + D + B) / 3</div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        Where: M = Mosca Urgency Score · D = Data Sensitivity Score · B = Business Criticality Score
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f8fafc] text-[#475569] font-semibold border-b border-[#e2e8f0]">
                          <tr>
                            <th className="px-3 py-2">APS Range</th>
                            <th className="px-3 py-2">Priority</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {APS_PRIORITY_MAPPING.map(item => (
                            <tr key={item.range} className="hover:bg-gray-50/60">
                              <td className="px-3 py-2 font-mono text-[#1a1d23]">
                                {item.range}
                              </td>
                              <td className="px-3 py-2 font-semibold">
                                <span className={`px-2 py-0.5 rounded text-[11px] ${item.priority === 'High' ? 'bg-red-100 text-red-800' :
                                  item.priority === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                    item.priority === 'Low' ? 'bg-blue-100 text-blue-800' :
                                      'bg-slate-100 text-slate-700'
                                  }`}>
                                  {item.priority}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3 pt-2.5 border-t border-gray-100 leading-relaxed">
                    APS integrates temporal urgency, regulatory exposure, and operational significance into a single metric.
                  </p>
                </div>
              </div>

              {/* Component Priority Score & Application Priority Score Illustrative Examples */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* COMPONENT PRIORITY SCORE */}
                <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#1e3a5f]"></span>
                        <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">
                          Component Priority Score
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        Component-Level Priority
                      </span>
                    </div>

                    <div className="bg-[#f0f5fc] border border-[#d3e2f5] rounded-md p-3 mb-3 text-center">
                      <div className="font-mono text-xs sm:text-sm font-bold text-[#1e3a5f]">
                        CPS = (Quantum Risk Score + Dependency Impact Score) / 2
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                      Component Priority Score combines the quantum risk of a cryptographic asset with its dependency impact to determine its component-level priority.
                    </p>

                    <div className="bg-[#f8fafc] border border-slate-200 rounded-md p-3 text-xs">
                      <div className="font-bold text-gray-700 mb-1.5 text-[10px] uppercase tracking-wide">
                        Example:
                      </div>
                      <div className="font-mono text-xs text-gray-700 space-y-1">
                        <div>Quantum Risk Score = <span className="font-bold text-[#1e3a5f]">60</span></div>
                        <div>Dependency Impact Score = <span className="font-bold text-[#1e3a5f]">30</span></div>
                        <div className="pt-1.5 mt-1 border-t border-slate-200 text-[#1e3a5f]">
                          CPS = (60 + 30) / 2 = <strong className="text-sm">45</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* APPLICATION PRIORITY SCORE - Illustrative Example */}
                <div className="bg-[#f8fafc] border border-blue-200/80 rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">
                          Application Priority Score - Illustrative Example
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">
                        Application-Level Priority
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
                      <div className="bg-white border border-[#dde1e9] rounded p-2.5 text-center sm:text-left">
                        <div className="text-gray-500 text-[10px]">Mosca Urgency (M)</div>
                        <div className="font-mono text-base font-bold text-[#1e3a5f] mt-0.5">50</div>
                      </div>
                      <div className="bg-white border border-[#dde1e9] rounded p-2.5 text-center sm:text-left">
                        <div className="text-gray-500 text-[10px]">Data Sensitivity (D)</div>
                        <div className="font-mono text-base font-bold text-[#1e3a5f] mt-0.5">50</div>
                      </div>
                      <div className="bg-white border border-[#dde1e9] rounded p-2.5 text-center sm:text-left">
                        <div className="text-gray-500 text-[10px]">Business Criticality (B)</div>
                        <div className="font-mono text-base font-bold text-[#1e3a5f] mt-0.5">50</div>
                      </div>
                    </div>

                    <div className="bg-white border border-[#dde1e9] rounded-md p-3 text-xs">
                      <div className="font-mono text-xs text-[#1e3a5f] mb-1.5">
                        APS = (50 + 50 + 50) / 3 = <span className="font-bold text-sm">50</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
                        <span className="text-gray-500 text-[11px]">Final Application Priority:</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Medium
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 italic mt-3 pt-2 border-t border-blue-100">
                    This illustrative example demonstrates how the formula combines scores. It does not represent this application's actual score.
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis List */}
            <div className="bg-white border border-[#dde1e9] rounded-lg shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#dde1e9]">
                <h3 className="text-[14px] font-semibold text-[#1a1d23]">Recent Analyses</h3>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[1055px]">
                  {/* Fixed Grid Header */}
                  <div
                    className="grid items-center px-5 py-3 bg-[#f8fafc] border-b border-[#dde1e9] text-[11px] font-semibold text-[#6b7589] uppercase tracking-wider"
                    style={{ gridTemplateColumns: RECENT_ANALYSES_GRID_COLUMNS }}
                  >
                    <div className="text-left">Application / Analysis</div>
                    <div className="text-center">DISCOVER</div>
                    <div className="text-center">RUNTIME</div>
                    <div className="text-center">ASSESS</div>
                    <div className="text-center">PRIORITIZE</div>
                    <div className="text-center">RECOMMENDATION</div>
                    <div></div>
                  </div>

                  {/* Fixed Grid Rows */}
                  <div className="divide-y divide-gray-100">
                    {displayAnalyses.map(analysis => {
                      const stages = getAppStageStatuses(analysis);
                      return (
                        <div
                          key={analysis.analysisId}
                          className="grid items-center px-5 py-3.5 hover:bg-gray-50/80 transition-colors min-h-[68px]"
                          style={{ gridTemplateColumns: RECENT_ANALYSES_GRID_COLUMNS }}
                        >
                          {/* 1. Application / Analysis */}
                          <div className="min-w-0 pr-4">
                            <div className="font-semibold text-gray-900 truncate" title={analysis.applicationName}>
                              {analysis.applicationName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              ID: {analysis.analysisId} • Created: {new Date(analysis.createdAt).toLocaleDateString()}
                            </div>
                          </div>

                          {/* 2. Discover */}
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Discover</div>
                            <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                              {stages.discover}
                            </div>
                          </div>

                          {/* 3. Runtime */}
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Runtime</div>
                            <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                              {analysis.runtimeEnabled === true ? 'ENABLED' : 'DISABLED'}
                            </div>
                          </div>

                          {/* 4. Assess */}
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Assess</div>
                            <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                              {stages.assess}
                            </div>
                          </div>

                          {/* 5. Prioritize */}
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Prioritize</div>
                            <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                              {stages.prioritize}
                            </div>
                          </div>

                          {/* 6. Recommendation */}
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Recommendation</div>
                            <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                              {stages.recommendation}
                            </div>
                          </div>

                          {/* 7. Action */}
                          <div className="flex items-center justify-end text-sm">
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate(`cbom:${analysis.analysisId}`)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm whitespace-nowrap cursor-pointer transition-colors"
                              >
                                View CBOM &rarr;
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
