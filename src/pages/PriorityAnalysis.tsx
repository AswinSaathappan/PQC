import React, { useState, useEffect, Fragment } from "react";
import { ChevronDown, ChevronRight, Loader2, ShieldAlert, Layers, AlertTriangle } from "lucide-react";
import axios from "axios";

interface GlobalAnalysis {
  analysisId: string;
  applicationName: string;
  status?: string;
}

interface ScoredApplication {
  analysisId: string;
  applicationName: string;
  assetCount: number;
  detectedCryptoAssetCount: number;
  moscaUrgencyScore: number;
  dataSensitivityScore: number;
  businessCriticalityScore: number;
  dataProtectionDuration: number; // X
  migrationDuration: number;      // Y
  threatHorizonYear: number;
  quantumRiskHorizon: number;     // Z
  timingMargin: number;
  priorityScore: number;          // APS
  priorityClassification: string; // High / Medium / Low / Minimal
}

interface ScoredAsset {
  assetId: string;
  assetName: string;
  algorithm: string;
  assetType: string;
  primitive: string;
  location: string;
  locations: string[];
  occurrencesCount: number;
  occurrences: { location: string; line?: number }[];
  scores: {
    quantumRisk: number | null;
    quantumRiskClassification: string;
    quantumRiskText: string;
    quantumRiskReason: string;
    classicalRisk?: string;
    dependencyImpact: number | null;
    dependencyImpactText: string;
    dependencyReach: number;
    directDependents: number;
    directDependentsList: string[];
    transitiveDependents: number;
    transitiveDependentsList: string[];
    affectedComponents: number;
    totalComponents: number;
    hasDependencyEvidence: boolean;
    dependencyCalculation: string;
    priorityScore: number | null;
    isPartial: boolean;
    priorityClassification: string;
    action: string;
    cpsExplanation?: string;
    isUnknown: boolean;
    isNotApplicable: boolean;
    isContextDependent?: boolean;
  };
}

const rankBadge: Record<number, string> = {
  1: "bg-red-100 text-red-800 border border-red-300",
  2: "bg-orange-50 text-orange-700 border border-orange-200",
  3: "bg-amber-50 text-amber-700 border border-amber-200",
  4: "bg-blue-50 text-blue-700 border border-blue-200",
  5: "bg-slate-100 text-slate-700 border border-slate-200",
};

const urgencyBadge: Record<string, string> = {
  Urgent: "bg-red-50 text-red-700 border border-red-200",
  High: "bg-orange-50 text-orange-700 border border-orange-200",
  Monitor: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Unavailable: "bg-slate-100 text-slate-500 border border-slate-200",
};

const apsBadge: Record<string, string> = {
  High: "bg-red-50 text-red-700 border border-red-200 font-bold",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200 font-bold",
  Low: "bg-blue-50 text-blue-700 border border-blue-200 font-bold",
  Minimal: "bg-slate-100 text-slate-600 border border-slate-200 font-bold",
};

interface Props {
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  analyses?: GlobalAnalysis[];
}

export default function PriorityAnalysis({ selectedAnalysisId, onSelectAnalysis, analyses = [] }: Props) {
  const [scoredApps, setScoredApps] = useState<ScoredApplication[]>([]);
  const [assets, setAssets] = useState<ScoredAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Determine current active application ID
  const effectiveAnalysisId = selectedAnalysisId || analyses[0]?.analysisId;

  // 1. Fetch application-level scored data
  useEffect(() => {
    async function fetchApps() {
      try {
        const res = await axios.get("http://localhost:3001/api/analyses/scored/applications");
        setScoredApps(res.data || []);
      } catch (err) {
        console.error("Failed to load scored applications", err);
      }
    }
    fetchApps();
  }, []);

  // 2. Fetch component assets whenever selected application changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchAssets() {
      if (!effectiveAnalysisId) {
        if (!isCancelled) {
          setAssets([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      // Clear previous application's table immediately
      setAssets([]);
      setExpandedRowIds(new Set());

      try {
        const res = await axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/scored-assets`);
        if (!isCancelled) {
          setAssets(res.data || []);
        }
      } catch (err) {
        console.error("Failed to load scored assets", err);
        if (!isCancelled) {
          setAssets([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchAssets();
    return () => {
      isCancelled = true;
    };
  }, [effectiveAnalysisId]);

  // Active application metadata
  const currentApp = scoredApps.find(a => a.analysisId === effectiveAnalysisId);
  const fallbackApp = analyses.find(a => a.analysisId === effectiveAnalysisId);
  const appDisplayName = currentApp?.applicationName || fallbackApp?.applicationName || "Application";

  // Calculate occurrences summary
  const uniqueAssetsCount = assets.length;
  const cbomOccurrencesCount = assets.reduce((sum, a) => sum + (a.occurrencesCount || 1), 0);
  const numericScoredCount = assets.filter(a => !a.scores.isNotApplicable && !a.scores.isContextDependent && a.scores.priorityScore !== null).length;
  const nonNumericCount = assets.filter(a => a.scores.isNotApplicable || a.scores.isContextDependent || a.scores.priorityScore === null).length;

  const toggleRow = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* 1. Clean Header */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-6 py-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-[#1e3a5f]">Priority Analysis</h1>
            <p className="text-sm text-[#6b7589] mt-0.5">
              Enterprise cryptographic migration priority based on Mosca timing urgency and component risk.
            </p>
          </div>
        </div>

        {/* 2. Application Priority Context (Read-Only) */}
        {currentApp && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#dde1e9]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6b7589]">Application Priority Context</span>
                <span className="text-xs font-semibold text-[#1e3a5f] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                  {currentApp.applicationName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6b7589]">Final Application Priority:</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border ${apsBadge[currentApp.priorityClassification] || apsBadge.Minimal}`}>
                  {currentApp.priorityClassification} ({currentApp.priorityScore.toFixed(1)})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] uppercase font-bold text-[#6b7589]">Protection Duration (X)</div>
                <div className="text-sm font-bold text-[#1a1d23] mt-1">{currentApp.dataProtectionDuration} years</div>
              </div>

              <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] uppercase font-bold text-[#6b7589]">Migration Duration (Y)</div>
                <div className="text-sm font-bold text-[#1a1d23] mt-1">{currentApp.migrationDuration} years</div>
              </div>

              <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] uppercase font-bold text-[#6b7589]">Risk Horizon (Z)</div>
                <div className="text-sm font-bold text-[#1a1d23] mt-1">{currentApp.quantumRiskHorizon} years</div>
                <div className="text-[10px] text-[#6b7589] mt-0.5">Year {currentApp.threatHorizonYear}</div>
              </div>

              <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] uppercase font-bold text-[#6b7589]">Timing Margin</div>
                <div className={`text-sm font-bold mt-1 ${currentApp.timingMargin <= 0 ? 'text-red-600' : 'text-[#1e3a5f]'}`}>
                  {currentApp.timingMargin} years
                </div>
                <div className="text-[10px] text-[#6b7589] mt-0.5">Z - (X + Y)</div>
              </div>

              <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] uppercase font-bold text-[#6b7589]">Mosca Urgency Score</div>
                <div className="text-sm font-bold text-[#1a1d23] mt-1">{currentApp.moscaUrgencyScore} / 100</div>
                <div className="text-[10px] text-[#6b7589] mt-0.5">
                  {currentApp.timingMargin <= 0 ? 'Critical' : currentApp.timingMargin <= 2 ? 'Very High' : currentApp.timingMargin <= 5 ? 'High' : currentApp.timingMargin <= 10 ? 'Medium' : 'Low'}
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] uppercase font-bold text-[#6b7589]">App Priority Score (APS)</div>
                <div className="text-sm font-bold text-[#1e3a5f] mt-1">{currentApp.priorityScore.toFixed(1)}</div>
                <div className="text-[10px] text-[#6b7589] mt-0.5">(Mosca + Sens + Crit) / 3</div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Priority Analysis Table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#dde1e9] flex flex-wrap items-center justify-between gap-2 bg-[#fafbfc]">
            <div>
              <div className="text-sm font-bold text-[#1a1d23]">
                Component Priority Table — {appDisplayName}
              </div>
              <div className="text-xs font-semibold text-[#1e3a5f] mt-0.5">
                Total Cryptographic Asset Occurrences: {cbomOccurrencesCount} • Total Unique Logical Assets: {uniqueAssetsCount} ({numericScoredCount} Numeric Priority-Scored, {nonNumericCount} Non-Numeric / Evidence-Required)
              </div>
            </div>
            <div className="text-[11px] text-[#6b7589]">
              Click any row to view expandable calculation details
            </div>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-[#1e3a5f]" size={32} />
              <div className="text-xs text-[#6b7589]">Loading component priority data…</div>
            </div>
          ) : assets.length === 0 ? (() => {
            const appStatus = (currentApp as any)?.status || (fallbackApp as any)?.status;
            const appError = (currentApp as any)?.errorMessage || (fallbackApp as any)?.errorMessage;

            if (appStatus === 'FAILED') {
              return (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-3 text-red-600">
                    <AlertTriangle size={22} />
                  </div>
                  <h3 className="text-sm font-bold text-red-800 mb-1">Cryptographic Analysis Failed</h3>
                  <p className="text-xs text-[#6b7589] max-w-sm mx-auto mb-3">
                    The cryptographic analysis encountered an error during processing.
                  </p>
                  {appError && (
                    <div className="max-w-md mx-auto text-xs font-mono text-red-700 bg-red-50 p-2.5 rounded border border-red-200 break-all text-left">
                      {appError}
                    </div>
                  )}
                </div>
              );
            }

            if (appStatus === 'RUNNING' || appStatus === 'CREATED') {
              return (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-3 text-[#1e3a5f]">
                    <Loader2 className="animate-spin" size={22} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1e3a5f] mb-1">Cryptographic Analysis in Progress</h3>
                  <p className="text-xs text-[#6b7589] max-w-sm mx-auto">
                    Cryptographic discovery and risk assessment are currently underway. Results will appear here once analysis completes.
                  </p>
                </div>
              );
            }

            return (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-3 text-[#1e3a5f]">
                  <ShieldAlert size={22} />
                </div>
                <h3 className="text-sm font-bold text-[#1a1d23] mb-1">No Cryptographic Assets Detected</h3>
                <p className="text-xs text-[#6b7589] max-w-sm mx-auto">
                  No cryptographic components were discovered for the selected application.
                </p>
              </div>
            );
          })() : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-xs">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-[#dde1e9] text-[11px] font-semibold text-[#6b7589] uppercase tracking-wider">
                    <th className="py-3 px-4 text-left w-12">Rank</th>
                    <th className="py-3 px-4 text-left">Cryptographic Asset</th>
                    <th className="py-3 px-4 text-left">Type / Primitive</th>
                    <th className="py-3 px-4 text-center w-24">Occurrences</th>
                    <th className="py-3 px-4 text-left min-w-[200px]">Locations</th>
                    <th className="py-3 px-4 text-left">Quantum Risk</th>
                    <th className="py-3 px-4 text-left">Dependency Impact</th>
                    <th className="py-3 px-4 text-left">CPS</th>
                    <th className="py-3 px-4 text-left">Priority</th>
                    <th className="py-3 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dde1e9]">
                  {assets.map((a, idx) => {
                    const isExpanded = expandedRowIds.has(a.assetId);
                    const rankNum = idx + 1;
                    const qRiskText = a.scores.quantumRiskText;
                    const depImpactText = a.scores.dependencyImpactText;
                    const isUnavailable = a.scores.priorityScore === null;
                    const isPartial = a.scores.isPartial;

                    const locs = a.locations && a.locations.length > 0 ? a.locations : [a.location || "N/A"];
                    const visibleLocs = locs.slice(0, 2);
                    const remainingLocsCount = locs.length - visibleLocs.length;

                    return (
                      <Fragment key={a.assetId || idx}>
                        <tr
                          onClick={() => toggleRow(a.assetId)}
                          className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${
                            isExpanded ? "bg-blue-50/30" : ""
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown size={14} className="text-[#1e3a5f]" />
                              ) : (
                                <ChevronRight size={14} className="text-gray-400" />
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block ${
                                isUnavailable ? "—" : (rankBadge[rankNum] || rankBadge[5])
                              }`}>
                                {isUnavailable ? "—" : `P${rankNum}`}
                              </span>
                            </div>
                          </td>

                          {/* Cryptographic Asset */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1e3a5f] text-[13px]">{a.assetName}</div>
                          </td>

                          {/* Type / Primitive */}
                          <td className="py-3 px-4 whitespace-nowrap text-gray-700">
                            <div className="capitalize font-medium text-xs text-gray-800">{a.assetType?.replace(/-/g, ' ')}</div>
                            <div className="text-[10px] text-[#6b7589] uppercase tracking-wider font-mono">{a.primitive}</div>
                          </td>

                          {/* Occurrences */}
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-[#1e3a5f] font-bold rounded text-xs border border-blue-100">
                              {a.occurrencesCount}
                            </span>
                          </td>

                          {/* Locations */}
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-700">
                            <div className="space-y-0.5">
                              {visibleLocs.map((loc, lIdx) => (
                                <div key={lIdx} className="truncate max-w-[220px]" title={loc}>
                                  • {loc}
                                </div>
                              ))}
                              {remainingLocsCount > 0 && (
                                <div className="text-[10px] text-blue-600 font-sans font-semibold">
                                  +{remainingLocsCount} more (click to view)
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Quantum Risk */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`font-semibold ${
                              a.scores.quantumRisk === 100 ? 'text-red-700' :
                              a.scores.quantumRisk === 60 ? 'text-amber-700' :
                              (a.scores.quantumRisk === 20 || a.scores.quantumRisk === 15 || a.scores.quantumRisk === 10) ? 'text-emerald-700' : 'text-gray-500'
                            }`}>
                              {qRiskText}
                            </span>
                          </td>

                          {/* Dependency Impact */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`font-semibold ${
                              a.scores.dependencyImpact !== null ? 'text-[#1e3a5f]' : 'text-gray-500 italic'
                            }`}>
                              {depImpactText}
                            </span>
                          </td>

                          {/* CPS */}
                          <td className="py-3 px-4">
                            {isUnavailable ? (
                              <span className="text-[10px] text-gray-400 italic">Unavailable</span>
                            ) : (
                              <div>
                                <span className="font-bold text-[#1a1d23] text-sm">
                                  {a.scores.priorityScore?.toFixed(1)}
                                </span>
                                {isPartial && (
                                  <div className="text-[9px] text-amber-700 font-medium">
                                    Partial CPS — based on available evidence
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyBadge[a.scores.priorityClassification] || urgencyBadge.Unavailable}`}>
                              {a.scores.priorityClassification}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 font-medium text-[#1a1d23] whitespace-nowrap">
                            {a.scores.action}
                          </td>
                        </tr>

                        {/* 4. Expandable Calculation Details */}
                        {isExpanded && (
                          <tr className="bg-[#f8fafc] border-b border-[#dde1e9]">
                            <td colSpan={10} className="p-5">
                              <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-2xs space-y-4">
                                
                                <div className="flex items-center justify-between pb-2 border-b border-[#dde1e9]">
                                  <div className="font-bold text-sm text-[#1e3a5f] flex items-center gap-2">
                                    <Layers size={16} /> Detailed Calculation & Evidence — {a.assetName}
                                  </div>
                                  <div className="text-[11px] text-[#6b7589]">
                                    {a.occurrencesCount} {a.occurrencesCount === 1 ? 'occurrence' : 'occurrences'} across {locs.length} {locs.length === 1 ? 'location' : 'locations'}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  
                                  {/* Section A: Quantum Risk */}
                                  <div className="border border-[#dde1e9] rounded-md p-4 bg-[#fcfdfe] flex flex-col justify-between">
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-2">
                                        Quantum Risk
                                      </div>
                                      <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-[#6b7589]">Classification:</span>
                                          <span className="font-bold text-[#1a1d23]">{a.scores.quantumRiskClassification}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-[#6b7589]">Score:</span>
                                          <span className="font-bold text-[#1a1d23]">
                                            {a.scores.quantumRisk !== null ? a.scores.quantumRisk : "Unavailable"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-[#6b7589] leading-relaxed">
                                      <span className="font-semibold text-gray-700 block mb-0.5">Reason:</span>
                                      {a.scores.quantumRiskReason || `${a.assetName} evaluated against quantum risk criteria.`}
                                    </div>
                                  </div>

                                  {/* Section B: Dependency Impact */}
                                  <div className="border border-[#dde1e9] rounded-md p-4 bg-[#fcfdfe] flex flex-col justify-between">
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-2">
                                        Dependency Impact
                                      </div>
                                      {a.scores.hasDependencyEvidence ? (
                                        <div className="space-y-1.5 text-xs">
                                          <div className="flex justify-between">
                                            <span className="text-[#6b7589]">Direct dependencies:</span>
                                            <span className="font-bold text-[#1a1d23]">{a.scores.directDependents}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-[#6b7589]">Transitive dependencies:</span>
                                            <span className="font-bold text-[#1a1d23]">{a.scores.transitiveDependents}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-[#6b7589]">Dependency Reach:</span>
                                            <span className="font-bold text-[#1a1d23]">{a.scores.dependencyReach}%</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-[#6b7589]">Dependency Impact Score:</span>
                                            <span className="font-bold text-[#1e3a5f]">{a.scores.dependencyImpact}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-[11px] text-gray-500 italic p-2 bg-gray-50 border border-gray-200 rounded">
                                          Dependency impact could not be calculated because dependency relationship evidence is unavailable.
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-gray-100 text-[11px]">
                                      <span className="font-semibold text-gray-700 block mb-0.5">Calculation:</span>
                                      <span className="font-mono text-gray-800 text-[10px]">
                                        {a.scores.dependencyCalculation}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Section C: Component Priority */}
                                  <div className="border border-[#dde1e9] rounded-md p-4 bg-[#fcfdfe] flex flex-col justify-between">
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#1e3a5f] mb-2">
                                        Component Priority
                                      </div>
                                      <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-[#6b7589]">Quantum Risk Score:</span>
                                          <span className="font-bold text-[#1a1d23]">
                                            {a.scores.quantumRisk !== null ? a.scores.quantumRisk : "Unavailable"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-[#6b7589]">Dependency Impact Score:</span>
                                          <span className="font-bold text-[#1a1d23]">
                                            {a.scores.dependencyImpact !== null ? a.scores.dependencyImpact : "Unavailable"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t border-gray-100">
                                          <span className="text-[#6b7589]">Priority:</span>
                                          <span className="font-bold text-[#1e3a5f]">{a.scores.priorityClassification}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-[#6b7589]">Action:</span>
                                          <span className="font-bold text-[#1e3a5f]">{a.scores.action}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-gray-100 text-[11px]">
                                      <span className="font-semibold text-gray-700 block mb-0.5">CPS Formula:</span>
                                      {a.scores.quantumRisk !== null && a.scores.dependencyImpact !== null ? (
                                        <div className="p-1.5 bg-blue-50 border border-blue-100 rounded font-mono text-[10px] text-blue-900">
                                          CPS = ({a.scores.quantumRisk} + {a.scores.dependencyImpact}) / 2 = {a.scores.priorityScore?.toFixed(1)}
                                        </div>
                                      ) : a.scores.priorityScore !== null ? (
                                        <div className="p-1.5 bg-amber-50 border border-amber-100 rounded font-mono text-[10px] text-amber-900">
                                          CPS = {a.scores.priorityScore} (Partial CPS — based on available evidence)
                                        </div>
                                      ) : (
                                        <div className="p-1.5 bg-gray-50 border border-gray-200 rounded font-mono text-[10px] text-gray-600">
                                          CPS = Unavailable
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                </div>

                                {/* Complete Locations List */}
                                <div className="pt-2 border-t border-[#dde1e9]">
                                  <div className="text-[11px] font-semibold text-gray-700 mb-1.5">
                                    All Detection Locations ({locs.length}):
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {locs.map((loc, idx) => (
                                      <span key={idx} className="font-mono text-[11px] bg-[#f8fafc] border border-[#dde1e9] px-2 py-0.5 rounded text-gray-700">
                                        {loc}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
