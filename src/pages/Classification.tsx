import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, HelpCircle, Loader2, ShieldAlert, ChevronDown, ShieldCheck, Cpu } from "lucide-react";
import axios from "axios";
import { classifyAsset } from "../utils/quantumClassification";

export interface AssetRecord {
  assetId: string;
  assetName: string;
  assetType?: string;
  primitive?: string;
  algorithm?: string;
  location?: string;
  keySize?: number | string;
  mode?: string;
  version?: string;
  cbomkitClassification?: string;
  cbomKitClassification?: string;
  cryptavistaQuantumRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'CONTEXT_DEPENDENT';
  cryptavistaQuantumClassification?: 'QUANTUM_SAFE' | 'QUANTUM_RESISTANT' | 'NOT_QUANTUM_SAFE' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'CONTEXT_DEPENDENT';
  cryptavistaScore?: number | null;
  cryptavistaReason?: string;
  cryptavistaEvidence?: string[];
}

const RISK_CONFIG: Record<string, { label: string; hex: string; bg: string; text: string; border: string }> = {
  LOW: {
    label: "Low",
    hex: "#16A34A",
    bg: "bg-[#16A34A]/10",
    text: "text-[#16A34A]",
    border: "border-[#16A34A]/30"
  },
  MEDIUM: {
    label: "Medium",
    hex: "#D97706",
    bg: "bg-[#D97706]/10",
    text: "text-[#D97706]",
    border: "border-[#D97706]/30"
  },
  HIGH: {
    label: "High",
    hex: "#DC2626",
    bg: "bg-[#DC2626]/10",
    text: "text-[#DC2626]",
    border: "border-[#DC2626]/30"
  },
  UNKNOWN: {
    label: "Unknown",
    hex: "#64748B",
    bg: "bg-[#64748B]/10",
    text: "text-[#64748B]",
    border: "border-[#64748B]/30"
  },
};



interface Props {
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  analyses?: any[];
  refreshAnalyses?: () => void;
}

export default function Classification({ selectedAnalysisId, onSelectAnalysis, analyses = [] }: Props) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveAnalysisId = selectedAnalysisId || analyses[0]?.analysisId;

  useEffect(() => {
    async function fetchData() {
      if (!effectiveAnalysisId) {
        setAssets([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [asRes, appRes] = await Promise.all([
          axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/assets`),
          axios.get(`http://localhost:3001/api/analyses/${effectiveAnalysisId}`)
        ]);

        if (appRes.data && appRes.data.analysisId === effectiveAnalysisId) {
          setAssets(asRes.data);
        }
      } catch (err) {
        console.error("Failed to load classification data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [effectiveAnalysisId]);

  const currentAnalysis = analyses.find(a => a.analysisId === effectiveAnalysisId);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* Top bar */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-5 py-4 shadow-xs">
          <div>
            <div className="text-[15px] font-bold text-[#1e3a5f]">Cryptographic Asset Classification</div>
            <div className="text-[12px] text-[#6b7589]">
              Dual-layer classification: Original CBOM compliance results paired with the CRYPTAVISTA Quantum Risk model.
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-16 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#1e3a5f]" size={32} />
          </div>
        ) : !effectiveAnalysisId ? (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-10 text-center">
            <h3 className="text-lg font-semibold text-[#1a1d23] mb-2">No Application Selected</h3>
            <p className="text-[#6b7589] text-[13px]">Select an application from the top dropdown to view classification.</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-3 text-[#1e3a5f]">
              <ShieldAlert size={22} />
            </div>
            <h3 className="text-[15px] font-bold text-[#1a1d23] mb-1">Zero Cryptographic Assets Detected</h3>
            <p className="text-[#6b7589] text-[13px] max-w-md mx-auto">No cryptographic assets were detected for this application.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden shadow-xs">
              <div className="bg-[#f0f4fa] px-4 py-3 border-b border-[#dde1e9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-[14px] font-bold text-[#1e3a5f]">{currentAnalysis?.applicationName} Assets</div>
                  <div className="bg-[#1e3a5f]/10 text-[#1e3a5f] px-2 py-0.5 rounded text-[11px] font-semibold">
                    Cryptographic Assets ({assets.length})
                  </div>
                </div>
                <div className="text-[11px] text-[#6b7589] hidden sm:block">
                  Original CBOM classifications are preserved; CRYPTAVISTA adds independent Quantum Risk scoring.
                </div>
              </div>

              <div className="divide-y divide-[#eef0f3]">
                {assets.map((item: AssetRecord, idx: number) => {
                  const norm = classifyAsset(item);
                  const qClass = norm.quantumClassification;
                  const isSafe = qClass === 'Quantum Safe';
                  const isVuln = qClass === 'Quantum Vulnerable';
                  const isWeak = qClass === 'Quantum-Weakened';

                  const badgeClass = isSafe
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : isVuln
                      ? 'bg-red-50 text-red-800 border-red-300'
                      : isWeak
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-slate-50 text-slate-700 border-slate-300';

                  const riskHex = norm.quantumRisk === 'High' ? '#DC2626' : norm.quantumRisk === 'Medium' ? '#D97706' : norm.quantumRisk === 'Low' ? '#16A34A' : '#64748B';

                  return (
                    <div key={norm.assetId || idx} className="bg-white p-5 hover:bg-[#fafbfc] transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
                          style={{
                            backgroundColor: `${riskHex}15`,
                            borderColor: `${riskHex}40`
                          }}
                        >
                          {norm.quantumRisk === 'High' ? (
                            <AlertCircle size={18} style={{ color: riskHex }} />
                          ) : norm.quantumRisk === 'Medium' ? (
                            <AlertTriangle size={18} style={{ color: riskHex }} />
                          ) : norm.quantumRisk === 'Low' ? (
                            <CheckCircle2 size={18} style={{ color: riskHex }} />
                          ) : (
                            <HelpCircle size={18} style={{ color: riskHex }} />
                          )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-w-0">
                          {/* Title line with distinct badges */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-[13px] font-bold text-[#1a1d23]">{currentAnalysis?.applicationName}</span>
                            <span className="text-[#6b7589] text-[12px]">·</span>
                            <span className="text-[13px] font-semibold font-mono text-[#1e3a5f]">{norm.assetName}</span>

                            {/* Authoritative Quantum Classification Badge */}
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                              {isSafe ? (
                                <ShieldCheck size={12} className="text-emerald-600" />
                              ) : isVuln ? (
                                <ShieldAlert size={12} className="text-red-600" />
                              ) : (
                                <AlertTriangle size={12} className="text-amber-600" />
                              )}
                              <span>{qClass}</span>
                            </span>

                            {/* CRYPTAVISTA Quantum Risk Badge */}
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full"
                              style={{
                                color: riskHex,
                                backgroundColor: `${riskHex}12`,
                                borderColor: `${riskHex}40`
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: riskHex }}></span>
                              Quantum Risk: {norm.quantumRisk === 'Unknown' ? 'Unknown / Review' : norm.quantumRisk} {norm.quantumRiskScore !== null ? `(${norm.quantumRiskScore})` : '(-)'}
                            </span>
                          </div>

                          {/* 4 Metadata Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                            {/* Card 1: Asset Type & Primitive */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                Asset Type / Primitive
                              </div>
                              <div className="text-[12px] font-semibold text-[#1a1d23] truncate" title={`${norm.assetType} - ${norm.primitive}`}>
                                {norm.assetType || 'N/A'} <span className="text-[#6b7589] font-normal">· {norm.primitive || '-'}</span>
                              </div>
                            </div>

                            {/* Card 2: Authoritative Classification */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                Quantum Classification
                              </div>
                              <div className="text-[12px] font-bold truncate" style={{ color: isSafe ? '#16A34A' : isVuln ? '#DC2626' : isWeak ? '#D97706' : '#64748B' }}>
                                {qClass}
                              </div>
                            </div>

                            {/* Card 3: CRYPTAVISTA Quantum Risk & Score */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                Quantum Risk & Score
                              </div>
                              <div className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: riskHex }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskHex }}></span>
                                <span>{norm.quantumRisk === 'Unknown' ? 'Unknown / Review' : norm.quantumRisk}</span>
                                <span className="text-[11px] font-semibold text-gray-600">
                                  {norm.quantumRiskScore !== null ? `· Score: ${norm.quantumRiskScore}` : '· Score: -'}
                                </span>
                              </div>
                            </div>

                            {/* Card 4: Location */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                Location
                              </div>
                              <div className="text-[12px] font-semibold text-gray-700 font-mono truncate" title={norm.sourceLocation}>
                                {norm.sourceLocation || '-'}
                              </div>
                            </div>
                          </div>

                          {/* Technical Reason */}
                          {norm.quantumRiskReason && (
                            <div className="mt-2.5 text-[11px] text-[#556070] bg-[#f9fafb] border border-[#eef0f3] rounded px-3 py-1.5 flex items-center gap-1.5">
                              <Cpu size={12} className="text-[#8892a0] shrink-0" />
                              <span className="leading-tight">{norm.quantumRiskReason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
