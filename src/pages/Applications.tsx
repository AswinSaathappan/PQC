import { useState, useEffect } from "react";
import { Plus, Target, CheckCircle, Clock, Layers, AlertCircle } from "lucide-react";

function getAnalysisStatusBadge(status: string | undefined) {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'RUNNING' || s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
        <Clock size={10} /> In Progress
      </span>
    );
  }
  if (s === 'COMPLETED' || s === 'COMPLETE' || s === 'DONE') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
        <CheckCircle size={10} /> Completed
      </span>
    );
  }
  if (s === 'FAILED' || s === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
        <AlertCircle size={10} /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6b7589] bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
      <Clock size={10} /> {s === 'PENDING' ? 'Pending' : 'Created'}
    </span>
  );
}

export default function Applications({ onNewAnalysis, onNavigate, onSelectAnalysis }: { onNewAnalysis?: () => void; onNavigate?: (id: string) => void; onSelectAnalysis?: (id: string) => void }) {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const res = await fetch("http://localhost:3001/api/analyses");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setAnalyses(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch applications:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Poll periodically so running analyses update in real-time when completed
    const interval = setInterval(fetchData, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 bg-[#f5f6f8] flex items-center justify-center">
        <div className="text-gray-500">Loading applications...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-[#1a1d23]">Applications & Targets</div>
            <div className="text-[11px] text-[#6b7589] mt-0.5">Manage analyzed applications and scan targets</div>
          </div>
          <button onClick={onNewAnalysis} className="flex items-center gap-1.5 text-[11px] text-white bg-[#1e3a5f] px-3 py-1.5 rounded-md hover:bg-[#162e4d]">
            <Plus size={14} /> New Analysis
          </button>
        </div>

        {analyses.length === 0 ? (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-12 text-center mt-8">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Layers className="text-gray-400 w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No applications have been analyzed yet.</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
              Start by creating a new analysis to inventory cryptographic assets across your applications and targets.
            </p>
            {onNewAnalysis && (
              <button 
                onClick={onNewAnalysis}
                className="mt-6 px-4 py-2 bg-[#1e3a5f] text-white rounded-md font-medium text-sm hover:bg-[#162e4d]"
              >
                + Start New Analysis
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 mt-6">
            {analyses.map(app => (
              <div key={app.analysisId} className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden shadow-sm">
                
                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors cursor-pointer" onClick={() => {
                  if (onSelectAnalysis) onSelectAnalysis(app.analysisId);
                  try {
                    localStorage.setItem("cryptavista_selected_analysis_id", app.analysisId);
                  } catch {}
                  if (onNavigate) onNavigate(`cbom:${app.analysisId}`);
                }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <Target size={16} />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#1a1d23]">{app.applicationName}</div>
                      <div className="text-[11px] text-[#6b7589] flex items-center gap-2 mt-0.5">
                        <span>Source Type: {app.targetType === 'folder' ? 'Project Folder' : 'Source Repository'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Analysis Status</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {getAnalysisStatusBadge(app.status)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Discovery</div>
                      <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                        {app.stages?.discover?.status || 'PENDING'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Created</div>
                      <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
