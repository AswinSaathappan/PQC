import { useState, useEffect } from "react";
import { Plus, Target, Layers } from "lucide-react";

function getAppStageStatuses(app: any): {
  discover: string;
  assess: string;
  prioritize: string;
  recommendation: string;
} {
  const appStatus = String(app.status || '').trim().toUpperCase();
  const currentStage = String(app.currentStage || '').trim().toUpperCase();

  // 1. Discover
  const discRaw = String(app.stages?.discover?.status || '').trim().toUpperCase();
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
  const assessRaw = String(app.stages?.assess?.status || app.stages?.assessment?.status || '').trim().toUpperCase();
  let assess = 'PENDING';
  if (assessRaw && assessRaw !== 'WAITING') {
    assess = assessRaw;
  } else if (appStatus === 'RUNNING' && currentStage === 'ASSESS') {
    assess = 'RUNNING';
  } else if (appStatus === 'FAILED') {
    assess = assessRaw || 'FAILED';
  } else if (
    appStatus === 'COMPLETED' &&
    ((app.cbomSummary && typeof app.cbomSummary.totalCryptoAssets === 'number') ||
      (typeof app.detectedCryptoAssetCount === 'number' && app.detectedCryptoAssetCount > 0) ||
      discRaw === 'COMPLETED')
  ) {
    assess = 'COMPLETED';
  } else if (assessRaw) {
    assess = assessRaw;
  }

  // 3. Prioritize
  const prioRaw = String(app.stages?.prioritize?.status || app.stages?.priority?.status || '').trim().toUpperCase();
  let prioritize = 'PENDING';
  if (prioRaw && prioRaw !== 'WAITING') {
    prioritize = prioRaw;
  } else if (appStatus === 'RUNNING' && currentStage === 'PRIORITIZE') {
    prioritize = 'RUNNING';
  } else if (appStatus === 'FAILED') {
    prioritize = prioRaw || 'WAITING';
  } else if (app.priorityScore !== undefined || app.priorityGrade !== undefined || app.priority !== undefined) {
    prioritize = 'COMPLETED';
  } else if (appStatus === 'COMPLETED') {
    prioritize = 'COMPLETED';
  } else if (prioRaw) {
    prioritize = prioRaw;
  }

  // 4. Recommendation
  const recRaw = String(
    app.stages?.recommend?.status ||
    app.stages?.recommendation?.status ||
    app.stages?.recommendations?.status ||
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
  } else if (Array.isArray(app.recommendations) && app.recommendations.length > 0) {
    recommendation = 'COMPLETED';
  } else if (appStatus === 'COMPLETED') {
    recommendation = 'COMPLETED';
  } else if (recRaw) {
    recommendation = recRaw;
  }

  return { discover, assess, prioritize, recommendation };
}

function getAnalysisStatusDisplay(status: string | undefined): { text: string; colorClass: string } {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'COMPLETED' || s === 'COMPLETE' || s === 'DONE') {
    return { text: 'COMPLETED', colorClass: 'text-emerald-600' };
  }
  if (s === 'FAILED' || s === 'ERROR') {
    return { text: 'FAILED', colorClass: 'text-red-600' };
  }
  if (s === 'RUNNING' || s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
    return { text: 'PROCESSING', colorClass: 'text-orange-600' };
  }
  if (s === 'PENDING') {
    return { text: 'PENDING', colorClass: 'text-[#1a1d23]' };
  }
  return { text: s || 'CREATED', colorClass: 'text-[#1a1d23]' };
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
            {analyses.map(app => {
              const stages = getAppStageStatuses(app);
              const analysisStatus = getAnalysisStatusDisplay(app.status);
              return (
                <div key={app.analysisId} className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden shadow-sm">
                  
                  {/* Header */}
                  <div className="px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors cursor-pointer" onClick={() => {
                    if (onSelectAnalysis) onSelectAnalysis(app.analysisId);
                    try {
                      localStorage.setItem("cryptavista_selected_analysis_id", app.analysisId);
                    } catch {}
                    if (onNavigate) onNavigate(`cbom:${app.analysisId}`);
                  }}>
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <Target size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-[#1a1d23] truncate" title={app.applicationName}>
                          {app.applicationName}
                        </div>
                        <div className="text-[11px] text-[#6b7589] flex items-center gap-2 mt-0.5 truncate">
                          <span>Source Type: {app.targetType === 'folder' ? 'Project Folder' : 'Source Repository'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap flex-shrink-0">
                      {/* 1. Discover */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Discover</div>
                        <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                          {stages.discover}
                        </div>
                      </div>

                      {/* 2. Runtime */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Runtime</div>
                        <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                          {app.runtimeEnabled ? 'ENABLED' : 'DISABLED'}
                        </div>
                      </div>

                      {/* 3. Assess */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Assess</div>
                        <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                          {stages.assess}
                        </div>
                      </div>

                      {/* 4. Prioritize */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Prioritize</div>
                        <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                          {stages.prioritize}
                        </div>
                      </div>

                      {/* 5. Recommendation */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Recommendation</div>
                        <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                          {stages.recommendation}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="hidden sm:block h-6 w-[1px] bg-[#dde1e9]" />

                      {/* 6. Analysis Status */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Analysis Status</div>
                        <div className={`text-[12px] font-semibold mt-0.5 ${analysisStatus.colorClass}`}>
                          {analysisStatus.text}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="hidden sm:block h-6 w-[1px] bg-[#dde1e9]" />

                      {/* 7. Created */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">Created</div>
                        <div className="text-[12px] font-semibold text-[#1a1d23] mt-0.5">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
