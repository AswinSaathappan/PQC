import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info
} from "lucide-react";
import axios from "axios";

interface GlobalAnalysis {
  analysisId: string;
  applicationName: string;
  status?: string;
  dataProtectionDuration?: number;
  businessCriticality?: number | string;
  dataSensitivity?: number | string;
  threatHorizonYear?: number;
  quantumRiskHorizon?: number;
  migrationDuration?: number;
}

interface AuthoritativeRecommendation {
  recommendation: string;
  replacement: string;
  standard: string;
  guidance?: string;
  purpose: string;
  why?: string;
  strategy: string;
  implementationSteps: string[];
  validation: string;
  isUnknownUsage?: boolean;
  isSymmetricOrHash?: boolean;
  algorithm?: string;
  mode?: string;
  padding?: string;
}

interface RecommendationItem {
  assetId: string;
  assetName: string;
  algorithm: string;
  mode?: string;
  padding?: string;
  assetType: string;
  primitive: string;
  locations: string[];
  occurrencesCount: number;
  quantumRisk: string;
  quantumRiskScore: number | null;
  quantumRiskReason: string;
  dependencyImpactScore: number | null;
  dependencyImpactText: string;
  priorityScore: number | null;
  isPartial: boolean;
  priorityClassification: string;
  action: string;
  authoritativeRecommendation: AuthoritativeRecommendation;
  aiRecommendation?: {
    explanation: string;
    model: string;
    generatedAt: string;
  } | null;
  hasAiRecommendation: boolean;
}

interface AiStatusInfo {
  connected: boolean;
  available?: boolean;
  service?: string;
  message?: string;
}

interface Props {
  selectedAnalysisId?: string;
  analyses?: GlobalAnalysis[];
  onSelectAnalysis?: (id: string) => void;
}

const riskBadge: Record<string, string> = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Unknown: "bg-gray-50 text-gray-700 border-gray-200",
};

const priorityBadge: Record<string, string> = {
  Urgent: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Monitor: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Unavailable: "bg-gray-50 text-gray-600 border-gray-200"
};

export default function Recommendations({ selectedAnalysisId: propSelectedId, analyses: propAnalyses = [], onSelectAnalysis }: Props) {
  const [analysesList, setAnalysesList] = useState<GlobalAnalysis[]>(propAnalyses || []);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(propSelectedId || "");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusInfo>({
    connected: false,
    available: false,
    service: "AI Migration Advisor"
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingAsset, setGeneratingAsset] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Load analyses if not passed or empty
  useEffect(() => {
    if (propAnalyses && propAnalyses.length > 0) {
      setAnalysesList(propAnalyses);
      if (!selectedAnalysisId) {
        setSelectedAnalysisId(propSelectedId || propAnalyses[0].analysisId);
      }
    } else {
      async function fetchAnalyses() {
        try {
          const res = await axios.get("http://localhost:3001/api/analyses");
          if (Array.isArray(res.data) && res.data.length > 0) {
            setAnalysesList(res.data);
            if (!selectedAnalysisId) {
              setSelectedAnalysisId(res.data[0].analysisId);
            }
          }
        } catch (err) {
          console.error("Failed to fetch analyses:", err);
        }
      }
      fetchAnalyses();
    }
  }, [propAnalyses]);

  // Sync prop changes
  useEffect(() => {
    if (propSelectedId && propSelectedId !== selectedAnalysisId) {
      setSelectedAnalysisId(propSelectedId);
    }
  }, [propSelectedId]);

  // Check AI advisor status once on mount
  useEffect(() => {
    async function checkAiStatus() {
      try {
        const res = await axios.get("http://localhost:3001/api/analyses/ai/status");
        setAiStatus(res.data);
      } catch (err) {
        setAiStatus({
          connected: false,
          available: false,
          service: "AI Migration Advisor",
          message: "AI explanations are currently unavailable."
        });
      }
    }
    checkAiStatus();
  }, []);

  // Fetch recommendations and application context for selected analysis
  useEffect(() => {
    let isMounted = true;
    async function fetchRecs() {
      if (!selectedAnalysisId) {
        setRecommendations([]);
        setApplicationData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [recsRes, appRes] = await Promise.all([
          axios.get(`http://localhost:3001/api/analyses/${selectedAnalysisId}/recommendations`),
          axios.get(`http://localhost:3001/api/analyses/${selectedAnalysisId}`)
        ]);

        if (isMounted) {
          if (Array.isArray(recsRes.data)) {
            setRecommendations(recsRes.data);
            // Default expand top item
            if (recsRes.data.length > 0) {
              setExpandedRows(new Set([recsRes.data[0].assetName]));
            }
          } else {
            setRecommendations([]);
          }
          setApplicationData(appRes.data || null);
        }
      } catch (err) {
        console.error("Failed to load recommendations", err);
        if (isMounted) {
          setRecommendations([]);
          setApplicationData(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchRecs();
    return () => { isMounted = false; };
  }, [selectedAnalysisId]);

  const handleSelectApp = (id: string) => {
    setSelectedAnalysisId(id);
    if (onSelectAnalysis) onSelectAnalysis(id);
  };

  const toggleRow = (name: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Generate AI Recommendation for a specific asset
  const handleGenerateAI = async (assetName: string, force: boolean = false) => {
    if (!selectedAnalysisId || generatingAsset) return;
    setGeneratingAsset(assetName);
    setGenerationError(prev => ({ ...prev, [assetName]: "" }));

    try {
      const res = await axios.post(
        `http://localhost:3001/api/analyses/${selectedAnalysisId}/recommendations/${encodeURIComponent(assetName)}/generate${force ? "?force=true" : ""}`
      );

      if (res.data?.success && res.data?.aiRecommendation) {
        setRecommendations(prev => prev.map(item => {
          if (item.assetName === assetName) {
            return {
              ...item,
              aiRecommendation: res.data.aiRecommendation,
              hasAiRecommendation: true
            };
          }
          return item;
        }));
      }
    } catch (err: any) {
      console.error("Failed to generate AI recommendation:", err);
      const msg = err.response?.data?.error || "AI explanations are currently unavailable. The authoritative migration recommendation is still available.";
      setGenerationError(prev => ({ ...prev, [assetName]: msg }));
    } finally {
      setGeneratingAsset(null);
    }
  };

  // Application context calculations
  const activeApp = analysesList.find(a => a.analysisId === selectedAnalysisId) || applicationData;
  const X = activeApp?.dataProtectionDuration ?? 5;
  const Y = activeApp?.migrationDuration ?? 2;
  const Z = activeApp?.quantumRiskHorizon ?? (activeApp?.threatHorizonYear ? Math.max(1, activeApp.threatHorizonYear - 2026) : 10);
  const timingMargin = Z - (X + Y);

  // Summary counts
  const totalAssets = recommendations.length;
  const quantumVulnerable = recommendations.filter(r => r.quantumRisk === "High" || r.quantumRisk === "Medium").length;
  const highPriority = recommendations.filter(r => r.priorityClassification === "Urgent" || r.priorityClassification === "High").length;
  const aiGeneratedCount = recommendations.filter(r => r.hasAiRecommendation).length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* 1. Header with Application Selector & AI Status */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-6 py-5 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-md">
                  <Sparkles size={20} />
                </div>
                <h1 className="text-xl font-bold text-[#1a1d23]">Cryptographic Migration Recommendations</h1>
              </div>
              <p className="text-xs text-[#6b7589] mt-1">
                Deterministic authoritative migration recommendations with AI technical explanations and migration roadmaps.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Application Selector */}
              {analysesList.length > 1 ? (
                <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#dde1e9] rounded-md px-3 py-1.5">
                  <span className="text-[11px] font-semibold text-[#6b7589] uppercase tracking-wider">Application:</span>
                  <select
                    value={selectedAnalysisId}
                    onChange={(e) => handleSelectApp(e.target.value)}
                    className="text-xs bg-transparent text-[#1e3a5f] font-bold outline-none cursor-pointer"
                  >
                    {analysesList.map(app => (
                      <option key={app.analysisId} value={app.analysisId}>
                        {app.applicationName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : activeApp ? (
                <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md px-3 py-1.5 text-xs text-[#1e3a5f] font-bold">
                  <span className="text-[11px] font-semibold text-[#6b7589] uppercase tracking-wider mr-1.5">Application:</span>
                  {activeApp.applicationName}
                </div>
              ) : null}

              {/* AI Engine Status Badge */}
              <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#dde1e9] rounded-md px-3 py-1.5">
                <Cpu size={14} className="text-[#1e3a5f]" />
                <div className="text-xs">
                  <span className="text-[11px] font-semibold text-[#6b7589]">AI Migration Advisor: </span>
                  <span className="font-semibold text-gray-800">AI</span>
                </div>
                <div className="flex items-center gap-1 ml-1">
                  <span className={`w-2 h-2 rounded-full ${aiStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                  <span className={`text-[11px] font-bold ${aiStatus.connected ? "text-emerald-700" : "text-gray-500"}`}>
                    {aiStatus.connected ? "Available" : "Offline"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!aiStatus.connected && (
            <div className="mt-3 p-2.5 bg-blue-50/80 border border-blue-200 rounded text-xs text-blue-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info size={15} className="text-blue-700 shrink-0" />
                <span>
                  AI explanations are currently unavailable. Deterministic authoritative migration recommendations remain active. Configure the AI service to enable explanations.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Read-Only Application Context */}
        <div className="bg-[#1e3a5f] text-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-blue-400/30">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
              <Layers size={14} /> Application Context (Read-Only)
            </div>
            <div className="text-[11px] text-blue-200/80">
              Source: Cryptographic Risk & Threat Horizon Analysis
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
            <div>
              <div className="text-blue-200/70 text-[11px]">Protection Duration (X)</div>
              <div className="font-bold text-sm mt-0.5">{X} years</div>
            </div>
            <div>
              <div className="text-blue-200/70 text-[11px]">Migration Duration (Y)</div>
              <div className="font-bold text-sm mt-0.5">{Y} years</div>
            </div>
            <div>
              <div className="text-blue-200/70 text-[11px]">Risk Horizon (Z)</div>
              <div className="font-bold text-sm mt-0.5">{Z} years</div>
            </div>
            <div>
              <div className="text-blue-200/70 text-[11px]">Timing Margin</div>
              <div className="font-bold text-sm mt-0.5">{timingMargin} years</div>
            </div>
            <div>
              <div className="text-blue-200/70 text-[11px]">Application Priority</div>
              <div className="font-bold text-sm mt-0.5 text-blue-100">
                {timingMargin <= 0 ? "Critical (100)" : timingMargin <= 2 ? "High (85.0)" : timingMargin <= 5 ? "Medium (56.7)" : "Low (33.3)"}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Recommendation Summary (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#dde1e9] rounded-lg p-4 shadow-2xs">
            <div className="text-xs font-semibold text-[#6b7589] uppercase tracking-wider">Total Cryptographic Assets</div>
            <div className="text-2xl font-bold text-[#1e3a5f] mt-1.5">{loading ? "—" : totalAssets}</div>
            <div className="text-[11px] text-gray-500 mt-1">Unique logical cryptographic components</div>
          </div>

          <div className="bg-white border border-[#dde1e9] rounded-lg p-4 shadow-2xs">
            <div className="text-xs font-semibold text-[#6b7589] uppercase tracking-wider">Quantum Vulnerable</div>
            <div className="text-2xl font-bold text-red-700 mt-1.5">{loading ? "—" : quantumVulnerable}</div>
            <div className="text-[11px] text-gray-500 mt-1">High or Medium quantum risk assets</div>
          </div>

          <div className="bg-white border border-[#dde1e9] rounded-lg p-4 shadow-2xs">
            <div className="text-xs font-semibold text-[#6b7589] uppercase tracking-wider">High Priority</div>
            <div className="text-2xl font-bold text-orange-700 mt-1.5">{loading ? "—" : highPriority}</div>
            <div className="text-[11px] text-gray-500 mt-1">Urgent or High migration urgency</div>
          </div>

          <div className="bg-white border border-[#dde1e9] rounded-lg p-4 shadow-2xs">
            <div className="text-xs font-semibold text-[#6b7589] uppercase tracking-wider">AI Explanations Generated</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1.5">{loading ? "—" : aiGeneratedCount}</div>
            <div className="text-[11px] text-gray-500 mt-1">Detailed plans via AI Migration Advisor</div>
          </div>
        </div>

        {/* 4. Asset Recommendation List */}
        <div className="bg-white border border-[#dde1e9] rounded-lg shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#f8fafc]">
            <div>
              <h2 className="font-bold text-sm text-[#1e3a5f]">Cryptographic Asset Migration Plans</h2>
              <p className="text-xs text-[#6b7589] mt-0.5">
                Authoritative migration recommendations deterministically mapped from NIST standards. The AI Migration Advisor explains the recommendation and outlines implementation steps.
              </p>
            </div>
            <div className="text-xs text-[#6b7589]">
              {recommendations.length} logical assets
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-[#6b7589]">
              <Loader2 className="animate-spin inline-block mb-2 text-[#1e3a5f]" size={24} />
              <div>Loading migration recommendations…</div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldCheck className="mx-auto text-emerald-600 mb-2" size={32} />
              <div className="text-sm font-semibold text-gray-800">No cryptographic assets detected</div>
              <div className="text-xs text-gray-500 mt-1">No migration actions are required for this application.</div>
            </div>
          ) : (
            <div className="divide-y divide-[#dde1e9]">
              {recommendations.map((item, idx) => {
                const isExpanded = expandedRows.has(item.assetName);
                const isGenerating = generatingAsset === item.assetName;
                const errorMsg = generationError[item.assetName];
                const auth = item.authoritativeRecommendation;

                return (
                  <div key={item.assetId || idx} className="transition-colors">
                    {/* Collapsed Row Summary */}
                    <div
                      onClick={() => toggleRow(item.assetName)}
                      className={`px-6 py-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-blue-50/30 ${isExpanded ? "bg-blue-50/20" : ""
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <button className="text-gray-400 hover:text-[#1e3a5f]">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <div>
                          <div className="font-bold text-sm text-[#1e3a5f]">{item.assetName}</div>
                          <div className="text-[11px] text-[#6b7589] mt-0.5 capitalize flex items-center gap-1.5 flex-wrap">
                            <span>{item.assetType?.replace(/-/g, ' ')}</span>
                            <span>•</span>
                            <span className="uppercase font-mono">{item.primitive}</span>
                            {item.mode && (
                              <>
                                <span>•</span>
                                <span className="font-mono bg-blue-50 text-blue-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                  Mode: {item.mode}
                                </span>
                              </>
                            )}
                            {item.padding && (
                              <>
                                <span>•</span>
                                <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded text-[10px]">
                                  {item.padding}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-center min-w-[80px]">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-[#1e3a5f] font-bold rounded text-xs border border-blue-100">
                          {item.occurrencesCount} {item.occurrencesCount === 1 ? "occurrence" : "occurrences"}
                        </span>
                      </div>

                      <div className="min-w-[120px]">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${riskBadge[item.quantumRisk] || riskBadge.Unknown}`}>
                          {item.quantumRisk} Risk {item.quantumRiskScore !== null ? `(${item.quantumRiskScore})` : ""}
                        </span>
                      </div>

                      <div className="min-w-[100px]">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${priorityBadge[item.priorityClassification] || priorityBadge.Unavailable}`}>
                          {item.priorityClassification}
                        </span>
                      </div>

                      <div className="min-w-[220px] flex-1 max-w-[340px]">
                        <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 truncate">
                          <ArrowRight size={13} className="text-[#1e3a5f] shrink-0" />
                          <span className="truncate">{auth.replacement}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{auth.standard}</div>
                      </div>

                      <div className="min-w-[140px] text-right">
                        {item.hasAiRecommendation ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            <CheckCircle2 size={12} /> AI Plan Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-full">
                            Deterministic Mapped
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Recommendation Card */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 bg-[#f8fafc] border-t border-[#dde1e9] space-y-4">
                        <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-2xs space-y-5">

                          {/* Part A: Asset Details Header */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs pb-4 border-b border-gray-100">
                            <div>
                              <span className="text-[#6b7589] text-[11px] block">Cryptographic Asset</span>
                              <span className="font-bold text-[#1e3a5f] text-sm">{item.assetName}</span>
                            </div>
                            <div>
                              <span className="text-[#6b7589] text-[11px] block">Usage / Purpose</span>
                              <span className="font-semibold text-gray-800">{auth.purpose}</span>
                            </div>
                            <div>
                              <span className="text-[#6b7589] text-[11px] block">Occurrences</span>
                              <span className="font-semibold text-gray-800">{item.occurrencesCount}</span>
                            </div>
                            <div>
                              <span className="text-[#6b7589] text-[11px] block">Quantum Risk</span>
                              <span className={`font-semibold ${item.quantumRisk === "High" ? "text-red-700" : item.quantumRisk === "Medium" ? "text-amber-700" : "text-emerald-700"}`}>
                                {item.quantumRisk} ({item.quantumRiskScore !== null ? item.quantumRiskScore : "—"})
                              </span>
                            </div>
                            <div>
                              <span className="text-[#6b7589] text-[11px] block">Dependency Impact</span>
                              <span className="font-semibold text-gray-800">{item.dependencyImpactText}</span>
                            </div>
                            <div>
                              <span className="text-[#6b7589] text-[11px] block">Component Priority</span>
                              <span className="font-semibold text-gray-800">{item.priorityClassification} {item.priorityScore !== null ? `(CPS ${item.priorityScore})` : ""}</span>
                            </div>
                            <div>
                              <span className="text-[#6b7589] text-[11px] block">Locations ({item.locations.length})</span>
                              <span className="font-mono text-[11px] text-gray-600 truncate block" title={item.locations.join(", ")}>
                                {item.locations[0] || "N/A"}
                              </span>
                            </div>
                          </div>

                          {/* Part B: Authoritative Recommended Replacement Card (Section 11) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e3a5f] flex items-center gap-1.5">
                                  <ShieldCheck size={14} className="text-[#1e3a5f]" />
                                  RECOMMENDED REPLACEMENT (AUTHORITATIVE)
                                </span>
                                <span className="text-[10px] font-mono bg-blue-100 text-[#1e3a5f] px-2 py-0.5 rounded font-bold">
                                  {auth.standard}
                                </span>
                              </div>

                              <div className="text-base font-bold text-[#1a1d23] flex items-start gap-2">
                                <Zap size={16} className="text-blue-700 mt-0.5 shrink-0" />
                                <span>{auth.recommendation || auth.replacement}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-blue-100/80">
                                <div>
                                  <span className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wider block">Standard / Guidance:</span>
                                  <span className="font-mono text-xs text-gray-800 font-semibold">{auth.standard}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wider block">Purpose:</span>
                                  <span className="font-semibold text-gray-800">{auth.purpose}</span>
                                </div>
                              </div>

                              <div className="text-xs text-gray-700 pt-1.5 border-t border-blue-100/80 leading-relaxed">
                                <strong className="text-[#1e3a5f]">Why:</strong> {auth.why || auth.strategy}
                              </div>
                            </div>

                            <div className="border border-[#dde1e9] rounded-lg p-4 bg-white space-y-2.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b7589] flex items-center gap-1.5">
                                <Layers size={13} className="text-[#6b7589]" />
                                Implementation Roadmap
                              </div>
                              <ul className="space-y-1.5 text-xs text-gray-700">
                                {auth.implementationSteps.slice(0, 5).map((step, sIdx) => (
                                  <li key={sIdx} className="flex items-start gap-2">
                                    <span className="font-bold text-[#1e3a5f] text-[11px] shrink-0">{sIdx + 1}.</span>
                                    <span className="leading-tight">{step}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="pt-2 text-[11px] text-[#6b7589] border-t border-gray-100">
                                <strong className="text-gray-700">Validation:</strong> {auth.validation}
                              </div>
                            </div>
                          </div>

                          {/* Part C: AI Migration Advisor */}
                          <div className="border border-[#dde1e9] rounded-lg p-4 bg-[#fafbfc] space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-600" />
                                <div>
                                  <span className="text-xs font-bold text-gray-800">
                                    AI MIGRATION ADVISOR
                                  </span>
                                </div>
                                {item.hasAiRecommendation && (
                                  <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold ml-1">
                                    AI Plan Ready
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  disabled={isGenerating || !aiStatus.connected}
                                  onClick={() => handleGenerateAI(item.assetName, item.hasAiRecommendation)}
                                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${isGenerating
                                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                      : !aiStatus.connected
                                        ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                                        : item.hasAiRecommendation
                                          ? "bg-white border border-[#dde1e9] text-[#1e3a5f] hover:bg-gray-50 shadow-2xs"
                                          : "bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-xs"
                                    }`}
                                  title={!aiStatus.connected ? "AI explanations are currently unavailable." : "Generate AI migration explanation"}
                                >
                                  {isGenerating ? (
                                    <>
                                      <Loader2 size={13} className="animate-spin text-[#1e3a5f]" />
                                      <span>Generating explanation...</span>
                                    </>
                                  ) : item.hasAiRecommendation ? (
                                    <>
                                      <RefreshCw size={12} />
                                      <span>Regenerate AI Explanation</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={13} />
                                      <span>Generate AI Explanation</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {errorMsg && (
                              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                                <AlertTriangle size={14} className="shrink-0" />
                                <span>{errorMsg}</span>
                              </div>
                            )}

                            {item.hasAiRecommendation && item.aiRecommendation?.explanation ? (
                              <div
                                className="p-4 bg-white border border-[#dde1e9] rounded-md space-y-3 text-xs text-gray-800"
                                style={{
                                  height: 'auto',
                                  minHeight: '60px',
                                  overflow: 'visible',
                                  whiteSpace: 'normal',
                                  overflowWrap: 'anywhere',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.6
                                }}
                              >
                                <div
                                  className="text-xs text-gray-800"
                                  style={{
                                    height: 'auto',
                                    overflow: 'visible',
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.6
                                  }}
                                >
                                  {item.aiRecommendation.explanation}
                                </div>
                                <div className="pt-2 text-[10px] text-gray-400 border-t border-gray-100 flex items-center justify-between">
                                  <span>AI explanation generated based on authoritative CRYPTAVISTA data</span>
                                  {item.aiRecommendation.generatedAt && (
                                    <span>{new Date(item.aiRecommendation.generatedAt).toLocaleString()}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-white border border-dashed border-gray-200 rounded-md text-xs text-gray-500 flex items-center justify-between">
                                <span>
                                  {aiStatus.connected
                                    ? "Click 'Generate AI Explanation' to generate technical explanation and migration guidance."
                                    : "AI explanations are currently unavailable. The authoritative migration recommendation is still available."}
                                </span>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
