import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, HelpCircle, Loader2, ShieldAlert, ChevronDown, ShieldCheck, Cpu } from "lucide-react";
import axios from "axios";

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

/**
 * Format original CBOMKit classification without altering or replacing it.
 */
function getCbomkitDisplay(asset: AssetRecord): { raw: string; label: string } {
  const raw = (asset.cbomkitClassification || '').toLowerCase().trim();
  if (raw === 'quantum-safe' || raw === 'quantum_safe') {
    return { raw: 'quantum-safe', label: 'Quantum Safe' };
  }
  if (raw === 'quantum-vulnerable' || raw === 'quantum_vulnerable') {
    return { raw: 'quantum-vulnerable', label: 'Not Quantum Safe' };
  }
  if (raw === 'na' || raw === 'not-applicable' || raw === 'not applicable') {
    return { raw: 'na', label: 'Not Applicable' };
  }
  if (raw === 'unknown') {
    return { raw: 'unknown', label: 'Unknown' };
  }

  // Fallback to legacy string if cbomkitClassification was not yet backfilled
  const legacy = asset.cbomKitClassification || '';
  if (legacy.includes('Quantum Safe')) return { raw: 'quantum-safe', label: 'Quantum Safe' };
  if (legacy.includes('Not Quantum Safe')) return { raw: 'quantum-vulnerable', label: 'Not Quantum Safe' };
  if (legacy.includes('Not Applicable')) return { raw: 'na', label: 'Not Applicable' };
  return { raw: 'unknown', label: 'Unknown' };
}

/**
 * Resolves CRYPTAVISTA Quantum Risk with pure deterministic policy fallback
 * in case an asset document in the database was created prior to reprocessing.
 */
function getCryptavistaQuantumRisk(asset: AssetRecord): {
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  score: number | null;
  classification: string;
  reason: string;
} {
  if (asset.cryptavistaQuantumRisk) {
    const rawR = asset.cryptavistaQuantumRisk as string;
    let r: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' = 'UNKNOWN';
    if (rawR === 'LOW' || rawR === 'MEDIUM' || rawR === 'HIGH') {
      r = rawR;
    }
    const s = typeof asset.cryptavistaScore === 'number'
      ? asset.cryptavistaScore
      : (r === 'LOW' ? 20 : r === 'MEDIUM' ? 60 : r === 'HIGH' ? 100 : null);
    const c = asset.cryptavistaQuantumClassification === 'QUANTUM_SAFE'
      ? 'Quantum Safe'
      : asset.cryptavistaQuantumClassification === 'QUANTUM_RESISTANT'
      ? 'Quantum Resistant'
      : asset.cryptavistaQuantumClassification === 'NOT_QUANTUM_SAFE'
      ? 'Not Quantum Safe'
      : 'Unknown';
    return {
      risk: r,
      score: s,
      classification: c,
      reason: asset.cryptavistaReason || ''
    };
  }

  // Pure deterministic client-side evaluation fallback
  const name = (asset.assetName || asset.algorithm || '').toUpperCase();
  const normKeySize = asset.keySize 
    ? Number(asset.keySize) 
    : (asset.version && !isNaN(Number(asset.version)) ? Number(asset.version) : undefined);
  
  if (name.includes('ML-KEM') || name.includes('MLKEM') || name.includes('ML-DSA') || name.includes('SLH-DSA')) {
    return {
      risk: 'LOW',
      score: 20,
      classification: 'Quantum Safe',
      reason: 'CRYPTAVISTA classifies standardized PQC algorithms as Low Quantum Risk (20).'
    };
  }

  if (name.includes('RSA') || name.includes('ECDSA') || name.includes('ECDH') || name.includes('DH') || name.includes('DSA') || name.includes('ECC') || name.includes('ED25519') || name.includes('X25519')) {
    return {
      risk: 'HIGH',
      score: 100,
      classification: 'Not Quantum Safe',
      reason: "Classical public-key mechanism exposed to quantum attacks of the Shor type."
    };
  }

  if (name.includes('AES-128') || name.includes('AES128') || (name.includes('AES') && normKeySize === 128)) {
    return {
      risk: 'MEDIUM',
      score: 60,
      classification: 'Quantum Resistant',
      reason: "CRYPTAVISTA classifies AES-128 as Medium Quantum Risk based on NIST's analysis of symmetric cryptography and quantum attacks."
    };
  }

  if (name.includes('AES-192') || name.includes('AES-256') || name.includes('AES192') || name.includes('AES256') || (name.includes('AES') && (normKeySize === 256 || normKeySize === 192)) || name.includes('SHA256') || name.includes('SHA-256') || name.includes('SHA512') || name.includes('SHA-512') || name.includes('SHA3') || name.includes('HMAC') || name.includes('CHACHA20')) {
    return {
      risk: 'LOW',
      score: 20,
      classification: 'Quantum Resistant',
      reason: "CRYPTAVISTA classifies this primitive as Low Quantum Risk based on NIST's analysis of symmetric cryptography and quantum attacks."
    };
  }

  if (name.includes('AES')) {
    return {
      risk: 'MEDIUM',
      score: 60,
      classification: 'Quantum Resistant',
      reason: "CRYPTAVISTA evaluates unversioned AES as Medium Quantum Risk (60) pending verified 256-bit key evidence."
    };
  }

  return {
    risk: 'UNKNOWN',
    score: null,
    classification: 'Unknown',
    reason: 'Cryptographic primitive or algorithm could not be resolved from CBOM evidence.'
  };
}

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
                  const cbomkit = getCbomkitDisplay(item);
                  const qRiskInfo = getCryptavistaQuantumRisk(item);
                  const riskCfg = RISK_CONFIG[qRiskInfo.risk] || RISK_CONFIG.UNKNOWN;
                  const isPqc = qRiskInfo.classification === 'Quantum Safe';
                  const displayReason = qRiskInfo.reason
                    ? qRiskInfo.reason
                        .replace(/Classical Risk is High\/Legacy; /gi, '')
                        .replace(/classical legacy cipher/gi, 'classical cipher')
                        .replace(/Legacy \/ High/gi, 'Standard')
                    : '';

                  return (
                    <div key={item.assetId || idx} className="bg-white p-5 hover:bg-[#fafbfc] transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
                          style={{
                            backgroundColor: `${riskCfg.hex}15`,
                            borderColor: `${riskCfg.hex}40`
                          }}
                        >
                          {qRiskInfo.risk === 'HIGH' ? (
                            <AlertCircle size={18} style={{ color: riskCfg.hex }} />
                          ) : qRiskInfo.risk === 'MEDIUM' ? (
                            <AlertTriangle size={18} style={{ color: riskCfg.hex }} />
                          ) : qRiskInfo.risk === 'LOW' ? (
                            <CheckCircle2 size={18} style={{ color: riskCfg.hex }} />
                          ) : (
                            <HelpCircle size={18} style={{ color: riskCfg.hex }} />
                          )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-w-0">
                          {/* Title line with distinct badges */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-[13px] font-bold text-[#1a1d23]">{currentAnalysis?.applicationName}</span>
                            <span className="text-[#6b7589] text-[12px]">·</span>
                            <span className="text-[13px] font-semibold font-mono text-[#1e3a5f]">{item.assetName}</span>

                            {/* CBOMKit Original Classification - Neutral Badge */}
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border-slate-300">
                              <span className="text-slate-400 uppercase tracking-wider text-[9px]">CBOM:</span>
                              {cbomkit.label}
                            </span>

                            {/* Recognized PQC Quantum Classification Badge */}
                            {isPqc && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border-emerald-300">
                                <ShieldCheck size={11} className="text-emerald-600" />
                                Quantum Classification: Quantum Safe
                              </span>
                            )}

                            {/* CRYPTAVISTA Quantum Risk Badge */}
                            <span 
                              className="inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full"
                              style={{
                                color: riskCfg.hex,
                                backgroundColor: `${riskCfg.hex}12`,
                                borderColor: `${riskCfg.hex}40`
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: riskCfg.hex }}></span>
                              Quantum Risk: {riskCfg.label} {qRiskInfo.score !== null ? `(${qRiskInfo.score})` : ''}
                            </span>
                          </div>

                          {/* 4 Metadata Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                            {/* Card 1: Asset Type & Primitive */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                Asset Type / Primitive
                              </div>
                              <div className="text-[12px] font-semibold text-[#1a1d23] truncate" title={`${item.assetType} - ${item.primitive}`}>
                                {item.assetType || 'N/A'} <span className="text-[#6b7589] font-normal">· {item.primitive || '-'}</span>
                              </div>
                            </div>

                            {/* Card 2: CBOMKit Original Classification */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                CBOM Classification
                              </div>
                              <div className="text-[12px] font-semibold text-slate-700 truncate" title={cbomkit.label}>
                                {cbomkit.label}
                              </div>
                            </div>

                            {/* Card 3: CRYPTAVISTA Quantum Risk & Score */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                Quantum Risk & Score
                              </div>
                              <div className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: riskCfg.hex }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskCfg.hex }}></span>
                                <span>{riskCfg.label}</span>
                                <span className="text-[11px] font-semibold text-gray-600">
                                  {qRiskInfo.score !== null ? `· Score: ${qRiskInfo.score}` : '· Score: —'}
                                </span>
                              </div>
                            </div>

                            {/* Card 4: Location */}
                            <div className="bg-[#f5f6f8] rounded-md px-3 py-2 border border-[#eaecee]">
                              <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-0.5">
                                Location
                              </div>
                              <div className="text-[12px] font-semibold text-gray-700 font-mono truncate" title={item.location}>
                                {item.location || '-'}
                              </div>
                            </div>
                          </div>

                          {/* Technical Reason */}
                          {displayReason && (
                            <div className="mt-2.5 text-[11px] text-[#556070] bg-[#f9fafb] border border-[#eef0f3] rounded px-3 py-1.5 flex items-center gap-1.5">
                              <Cpu size={12} className="text-[#8892a0] shrink-0" />
                              <span className="leading-tight">{displayReason}</span>
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
