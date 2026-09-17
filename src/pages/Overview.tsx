import { useState, useEffect } from "react";
import { Layers, Key, Activity, Server, Target, AlertTriangle } from "lucide-react";

const kpiIcons = [Layers, Key, Activity, Target, Server];

export default function Overview({ onNavigate, analyses = [], selectedAnalysisId }: { onNavigate?: (id: string) => void; analyses?: any[]; selectedAnalysisId?: string }) {
  const [totalAssets, setTotalAssets] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:3001/api/analyses");
        if (res.ok) {
          const analysesData = await res.json();
          let total = 0;
          analysesData.forEach((a: any) => {
            total += (typeof a.detectedCryptoAssetCount === 'number' ? a.detectedCryptoAssetCount : (a.stages?.discover?.assetCount || 0));
          });
          setTotalAssets(total);
        }
      } catch (err) {
        console.error("Failed to fetch overview data:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const totalFromProps = analyses.reduce((sum, a) => sum + (typeof a.detectedCryptoAssetCount === 'number' ? a.detectedCryptoAssetCount : (a.stages?.discover?.assetCount || 0)), 0);
  const displayTotalAssets = analyses.length > 0 ? totalFromProps : totalAssets;

  const selectedApp = analyses.find(a => a.analysisId === selectedAnalysisId);
  const totalApplications = analyses.length;
  const applicationsAnalyzed = analyses.filter(a => a.stages?.discover?.status === 'COMPLETED').length;
  
  const kpis = [
    { label: "Total Applications", value: totalApplications.toString() },
    { label: "Applications Analyzed", value: applicationsAnalyzed.toString() },
    { label: "Total Cryptographic Asset Occurrences", value: displayTotalAssets.toString() },
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

            {/* KPIs */}
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

            {/* Analysis List */}
            <div className="bg-white border border-[#dde1e9] rounded-lg shadow-sm">
              <div className="px-5 py-4 border-b border-[#dde1e9]">
                <h3 className="text-[14px] font-semibold text-[#1a1d23]">Recent Analyses</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {analyses.map(analysis => (
                  <div key={analysis.analysisId} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="font-semibold text-gray-900">{analysis.applicationName}</div>
                      <div className="text-xs text-gray-500 mt-1">ID: {analysis.analysisId} • Created: {new Date(analysis.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        analysis.stages?.discover?.status === 'COMPLETED' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        Discovery: {analysis.stages?.discover?.status || 'PENDING'}
                      </span>
                      {onNavigate && (
                        <button 
                          onClick={() => onNavigate(`cbom:${analysis.analysisId}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          View CBOM &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
