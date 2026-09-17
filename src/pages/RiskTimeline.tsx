import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { ChevronDown, ChevronRight, Calculator, Loader2 } from "lucide-react";
import axios from "axios";

// Status Badges
const moscaStatusConfig: Record<string, { cls: string }> = {
  Critical: { cls: "bg-red-100 text-red-800 border-red-300" },
  "Very High": { cls: "bg-red-50 text-red-700 border-red-200" },
  High: { cls: "bg-orange-50 text-orange-700 border-orange-200" },
  Medium: { cls: "bg-amber-50 text-amber-700 border-amber-200" },
  Low: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const priorityConfig: Record<string, { cls: string }> = {
  High: { cls: "bg-red-50 text-red-700 border-red-200" },
  Medium: { cls: "bg-amber-50 text-amber-700 border-amber-200" },
  Low: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Minimal: { cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function getMoscaUrgency(margin: number) {
  if (margin <= 0) return { score: 100, text: "Critical" };
  if (margin <= 2) return { score: 75, text: "Very High" };
  if (margin <= 5) return { score: 50, text: "High" };
  if (margin <= 10) return { score: 25, text: "Medium" };
  return { score: 0, text: "Low" };
}

function getFinalPriority(aps: number) {
  if (aps >= 75) return "High";
  if (aps >= 50) return "Medium";
  if (aps >= 25) return "Low";
  return "Minimal";
}

function AppPriorityRow({ app, horizon }: { app: any; horizon: number }) {
  const [expanded, setExpanded] = useState(false);
  
  const X = typeof app.dataProtectionDuration === 'number' ? app.dataProtectionDuration : 5;
  const Y = typeof app.migrationDuration === 'number' ? app.migrationDuration : 2; 
  const Z = horizon;
  
  const timingMargin = Z - (X + Y);
  const mosca = getMoscaUrgency(timingMargin);
  
  const ds = app.dataSensitivityScore || 25;
  const bc = app.businessCriticalityScore || 25;
  
  const aps = (mosca.score + ds + bc) / 3;
  const priorityText = getFinalPriority(aps);
  
  return (
    <>
      <tr 
        className={`border-b border-[#f0f2f5] hover:bg-[#f9fafb] cursor-pointer transition-colors ${expanded ? 'bg-[#f9fafb]' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 w-10">
          <button className="text-[#6b7589] hover:text-[#1a1d23] transition-colors">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="text-[12px] font-bold text-[#1a1d23]">{app.applicationName}</div>
          <div className="text-[10px] text-[#6b7589]">{app.analysisId} · {app.assetCount} assets</div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${moscaStatusConfig[mosca.text]?.cls || moscaStatusConfig['High'].cls}`}>
            {mosca.text} ({mosca.score})
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="text-[11px] font-semibold text-[#1a1d23]">Score: {ds}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-[11px] font-semibold text-[#1a1d23]">Score: {bc}</div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full border w-fit ${priorityConfig[priorityText]?.cls || priorityConfig['Medium'].cls}`}>
              {priorityText}
            </span>
            <span className="text-[11px] font-mono text-[#6b7589] font-semibold">({aps.toFixed(2)})</span>
          </div>
        </td>
      </tr>
      
      {expanded && (
        <tr className="bg-[#fcfcfc] border-b border-[#f0f2f5]">
          <td colSpan={6} className="p-0">
            <div className="px-12 py-5 border-l-[3px] border-[#1e3a5f]">
              <div className="flex gap-8">
                {/* Math Breakdown */}
                <div className="flex-1 max-w-[420px]">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator size={14} className="text-[#1e3a5f]" />
                    <div className="text-[13px] font-bold text-[#1e3a5f]">Application Priority Score Calculation</div>
                  </div>
                  
                  <div className="space-y-2 bg-white p-4 border border-[#dde1e9] rounded-md shadow-sm text-[12px] font-mono text-[#374151]">
                    <div className="flex justify-between">
                      <span>Mosca Urgency Score (M):</span>
                      <span className="font-semibold">{mosca.score} ({mosca.text})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Data Sensitivity Score (D):</span>
                      <span className="font-semibold">{ds}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Business Criticality Score (B):</span>
                      <span className="font-semibold">{bc}</span>
                    </div>
                    
                    <div className="my-2 border-t border-[#f0f2f5]"></div>
                    
                    <div>APS = (Mosca + DataSensitivity + BusinessCriticality) / 3</div>
                    <div className="text-[#1e3a5f] font-semibold">APS = ({mosca.score} + {ds} + {bc}) / 3</div>
                    <div className="text-[13px] font-bold text-[#1a1d23]">APS = {aps.toFixed(2)}</div>
                    
                    <div className="my-2 border-t border-[#f0f2f5]"></div>
                    
                    <div className="flex justify-between font-bold text-[#1a1d23]">
                      <span>Final Application Priority:</span>
                      <span className={priorityConfig[priorityText]?.cls.split(' ')[1] || ""}>{priorityText}</span>
                    </div>
                  </div>
                </div>

                {/* Mosca Details */}
                <div className="flex-1 max-w-[420px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-[13px] font-bold text-[#1e3a5f]">Mosca Framework Variables & Margin</div>
                  </div>
                  
                  <div className="space-y-2 bg-white p-4 border border-[#dde1e9] rounded-md shadow-sm text-[12px] text-[#374151]">
                    <div className="grid grid-cols-[220px_1fr] border-b border-[#f0f2f5] pb-1.5">
                      <span className="text-[#6b7589]">Data Protection Duration (X)</span>
                      <span className="font-bold text-[#1a1d23]">{X} years</span>
                    </div>
                    <div className="grid grid-cols-[220px_1fr] border-b border-[#f0f2f5] py-1.5">
                      <span className="text-[#6b7589]">Migration Duration (Y)</span>
                      <span className="font-bold text-[#1a1d23]">{Y} years</span>
                    </div>
                    <div className="grid grid-cols-[220px_1fr] border-b border-[#f0f2f5] py-1.5">
                      <span className="text-[#6b7589]">Quantum Risk Horizon (Z)</span>
                      <span className="font-bold text-[#1a1d23]">{Z} years</span>
                    </div>
                    <div className="grid grid-cols-[220px_1fr] border-b border-[#f0f2f5] py-1.5">
                      <span className="text-[#6b7589]">Combined Duration (X + Y)</span>
                      <span className="font-bold text-[#1e3a5f]">{X + Y} years</span>
                    </div>
                    <div className="grid grid-cols-[220px_1fr] py-1.5">
                      <span className="font-semibold text-[#1a1d23]">Timing Margin Z - (X + Y)</span>
                      <span className="font-bold text-[#1a1d23]">
                        {timingMargin > 0 ? `+${timingMargin}` : timingMargin} year{Math.abs(timingMargin) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface Props {
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  analyses?: any[];
}

export default function RiskTimeline({ selectedAnalysisId, onSelectAnalysis, analyses = [] }: Props) {
  const [horizonYear, setHorizonYear] = useState(2036);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartFocus, setChartFocus] = useState<'all' | 'top5' | 'selected'>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axios.get("http://localhost:3001/api/analyses/scored/applications");
        setApplications(response.data);
        const currentApp = response.data.find((a: any) => a.analysisId === selectedAnalysisId) || response.data[0];
        if (currentApp) {
          if (currentApp.threatHorizonYear) {
            setHorizonYear(currentApp.threatHorizonYear);
          } else if (currentApp.quantumRiskHorizon) {
            setHorizonYear(2026 + currentApp.quantumRiskHorizon);
          }
        }
      } catch (err) {
        console.error("Failed to load scored applications", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedAnalysisId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f5f6f8]">
        <Loader2 className="animate-spin text-[#1e3a5f]" size={32} />
      </div>
    );
  }

  // Find currently selected application
  const activeApp = applications.find(a => a.analysisId === selectedAnalysisId) || (applications.length > 0 ? applications[0] : null);

  const actX = typeof activeApp?.dataProtectionDuration === 'number' ? activeApp.dataProtectionDuration : 5;
  const actY = typeof activeApp?.migrationDuration === 'number' ? activeApp.migrationDuration : 2;
  const actZ = Math.max(1, horizonYear - 2026);
  const actMargin = actZ - (actX + actY);
  const actMosca = getMoscaUrgency(actMargin);
  const actDS = activeApp?.dataSensitivityScore || 25;
  const actBC = activeApp?.businessCriticalityScore || 25;
  const actAPS = (actMosca.score + actDS + actBC) / 3;
  const actPriority = getFinalPriority(actAPS);

  const dsText = actDS === 100 ? "Highly Confidential" : actDS === 75 ? "Confidential" : actDS === 50 ? "Internal" : "Public";
  const bcText = actBC === 100 ? "Critical" : actBC === 75 ? "High" : actBC === 50 ? "Medium" : "Low";

  // Top applications sorted by urgency/margin for comparison
  const sortedApps = [...applications].sort((a, b) => {
    const aX = typeof a.dataProtectionDuration === 'number' ? a.dataProtectionDuration : 5;
    const aY = typeof a.migrationDuration === 'number' ? a.migrationDuration : 2;
    const bX = typeof b.dataProtectionDuration === 'number' ? b.dataProtectionDuration : 5;
    const bY = typeof b.migrationDuration === 'number' ? b.migrationDuration : 2;
    const aMargin = actZ - (aX + aY);
    const bMargin = actZ - (bX + bY);
    return aMargin - bMargin; // Most urgent (smallest margin) first
  });

  const top5Apps = sortedApps.slice(0, 5);
  if (activeApp && !top5Apps.some(a => a.analysisId === activeApp.analysisId)) {
    top5Apps[top5Apps.length - 1] = activeApp;
  }

  // Name collision avoidance for Recharts category YAxis
  const nameCounts: Record<string, number> = {};
  applications.forEach(a => {
    const n = a.applicationName || a.analysisId || 'App';
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  });

  const allChartData = applications.map((app, idx) => {
    const xVal = typeof app.dataProtectionDuration === 'number' ? app.dataProtectionDuration : 5;
    const yVal = typeof app.migrationDuration === 'number' ? app.migrationDuration : 2;
    const totalVal = xVal + yVal;
    const zVal = actZ;
    const marginVal = zVal - totalVal;
    const rawName = app.applicationName || app.analysisId || `App ${idx + 1}`;
    const displayName = (nameCounts[rawName] > 1 && app.analysisId)
      ? `${rawName} (${app.analysisId.slice(0, 8)})`
      : rawName;

    return {
      name: displayName,
      applicationName: rawName,
      analysisId: app.analysisId,
      X: xVal,
      Y: yVal,
      total: totalVal,
      Z: zVal,
      timingMargin: marginVal,
      isSelected: app.analysisId === activeApp?.analysisId,
    };
  });

  const selectedChartData = activeApp ? [
    {
      name: activeApp.applicationName || activeApp.analysisId || 'Selected App',
      applicationName: activeApp.applicationName || activeApp.analysisId || 'Selected App',
      analysisId: activeApp.analysisId,
      X: actX,
      Y: actY,
      total: actX + actY,
      Z: actZ,
      timingMargin: actMargin,
      isSelected: true,
    }
  ] : [];

  const top5ChartData = top5Apps.map((app, idx) => {
    const xVal = typeof app.dataProtectionDuration === 'number' ? app.dataProtectionDuration : 5;
    const yVal = typeof app.migrationDuration === 'number' ? app.migrationDuration : 2;
    const totalVal = xVal + yVal;
    const zVal = actZ;
    const marginVal = zVal - totalVal;
    const rawName = app.applicationName || app.analysisId || `App ${idx + 1}`;
    const displayName = (nameCounts[rawName] > 1 && app.analysisId)
      ? `${rawName} (${app.analysisId.slice(0, 8)})`
      : rawName;

    return {
      name: displayName,
      applicationName: rawName,
      analysisId: app.analysisId,
      X: xVal,
      Y: yVal,
      total: totalVal,
      Z: zVal,
      timingMargin: marginVal,
      isSelected: app.analysisId === activeApp?.analysisId,
    };
  });

  const activeChartData = chartFocus === 'all'
    ? allChartData
    : chartFocus === 'top5'
    ? top5ChartData
    : selectedChartData;

  const maxVal = Math.max(
    12,
    actZ + 4,
    ...activeChartData.map(d => (d.total || (d.X || 0) + (d.Y || 0)) + 4)
  );

  const chartHeight = chartFocus === 'selected'
    ? 190
    : Math.max(240, activeChartData.length * 44 + 60);

  const barSize = chartFocus === 'selected'
    ? 32
    : activeChartData.length <= 4
    ? 28
    : activeChartData.length <= 8
    ? 22
    : 16;

  const handleHorizonYearChange = async (year: number) => {
    setHorizonYear(year);
    if (activeApp?.analysisId) {
      try {
        await axios.put(`http://localhost:3001/api/analyses/${activeApp.analysisId}/horizon`, {
          threatHorizonYear: year,
          quantumRiskHorizon: Math.max(1, year - 2026),
          migrationDuration: actY
        });
      } catch (e) {
        console.error("Failed to persist horizon update", e);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">
        
        {/* Top bar with Application Selector and Threat Horizon */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-5 py-4 flex items-center justify-between shadow-sm flex-wrap gap-4">
          <div>
            <div className="text-[14px] font-bold text-[#1e3a5f]">Application Migration Priority</div>
            <div className="text-[11px] text-[#6b7589]">Calculates migration urgency from Mosca's theorem (Reference Year: 2026), Data Sensitivity, and Business Criticality.</div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Threat Horizon Year + Derived Z */}
            <div className="flex items-center gap-3 bg-[#f8fafc] border border-[#dde1e9] px-3 py-1.5 rounded-md">
              <div className="text-right">
                <div className="text-[10px] font-bold text-[#6b7589] uppercase tracking-wider">Threat Horizon: <span className="text-[#1e3a5f] font-extrabold text-[12px]">{horizonYear}</span></div>
                <div className="text-[11px] font-bold text-[#1e3a5f]">Z = {actZ} years</div>
              </div>
              <input
                type="range"
                min={2028}
                max={2046}
                value={horizonYear}
                onChange={(e) => handleHorizonYearChange(Number(e.target.value))}
                className="w-28 accent-[#1e3a5f] cursor-pointer"
                title={`Threat Horizon Year: ${horizonYear} (Z = ${actZ} years)`}
              />
            </div>

            {/* Application Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#6b7589]">Application:</span>
              <div className="relative">
                <select
                  value={selectedAnalysisId || ""}
                  onChange={(e) => onSelectAnalysis?.(e.target.value)}
                  className="appearance-none bg-[#f5f6f8] border border-[#dde1e9] text-[#1a1d23] text-[12px] font-bold py-1.5 pl-3 pr-8 rounded-md outline-none focus:border-[#1e3a5f] cursor-pointer"
                >
                  {analyses.map(a => (
                    <option key={a.analysisId} value={a.analysisId}>
                      {a.applicationName} ({a.analysisId})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7589] pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 15: APPLICATION PRIORITY — SHOW ACTUAL VALUES FOR SELECTED APP */}
        {activeApp && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#dde1e9] pb-3 mb-4">
              <div>
                <span className="text-[10px] text-[#6b7589] uppercase tracking-wide font-bold">Selected Application Actual Arithmetic</span>
                <h3 className="text-[15px] font-bold text-[#1e3a5f]">{activeApp.applicationName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#6b7589]">Final Priority:</span>
                <span className={`text-[12px] font-bold px-3 py-1 rounded-full border ${priorityConfig[actPriority]?.cls || priorityConfig['Medium'].cls}`}>
                  {actPriority} (APS: {actAPS.toFixed(2)})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-4">
              <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] text-[#6b7589] uppercase font-bold">Protection Duration (X)</div>
                <div className="text-[14px] font-bold text-[#1a1d23] mt-1">{actX} years</div>
              </div>
              <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] text-[#6b7589] uppercase font-bold">Migration Duration (Y)</div>
                <div className="text-[14px] font-bold text-[#1a1d23] mt-1">{actY} years</div>
              </div>
              <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] text-[#6b7589] uppercase font-bold">Threat Horizon</div>
                <div className="text-[14px] font-bold text-[#1e3a5f] mt-1">{horizonYear}</div>
              </div>
              <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] text-[#6b7589] uppercase font-bold">Quantum Risk Horizon (Z)</div>
                <div className="text-[14px] font-bold text-[#1a1d23] mt-1">{actZ} years</div>
              </div>
              <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-md p-3">
                <div className="text-[10px] text-[#6b7589] uppercase font-bold">Timing Margin Z - (X+Y)</div>
                <div className="text-[14px] font-bold text-[#1e3a5f] mt-1">
                  {actMargin > 0 ? `+${actMargin}` : actMargin} year{Math.abs(actMargin) !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Arithmetic Formula Display */}
            <div className="bg-[#f8fafc] border border-[#cbd5e1] rounded-md p-4 font-mono text-[12px] text-[#1e293b] space-y-1.5">
              <div className="font-bold text-[#1e3a5f] mb-1 font-sans text-[13px]">Step-by-Step Priority Arithmetic:</div>
              <div>Reference Year = 2026 | Threat Horizon Year = {horizonYear} → Z = {horizonYear} - 2026 = {actZ} years</div>
              <div>X + Y = {actX} + {actY} = {actX + actY} years</div>
              <div>Timing Margin = Z - (X + Y) = {actZ} - ({actX} + {actY}) = {actMargin > 0 ? `+${actMargin}` : actMargin} year{Math.abs(actMargin) !== 1 ? 's' : ''}</div>
              <div>Mosca Urgency = {actMosca.text} (Score: {actMosca.score})</div>
              <div>Data Sensitivity = {dsText} (Score: {actDS})</div>
              <div>Business Criticality = {bcText} (Score: {actBC})</div>
              <div className="pt-2 border-t border-[#cbd5e1] font-bold text-[13px] text-[#0f172a]">
                APS = ({actMosca.score} + {actDS} + {actBC}) / 3 = {actAPS.toFixed(2)} → Final Application Priority: {actPriority}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 14: CRYPTAVISTA APPLICATION PRIORITY MAPPING */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm">
          <div className="text-[14px] font-bold text-[#1e3a5f] mb-1">CRYPTAVISTA Application Priority Mapping</div>
          <div className="text-[11px] text-[#6b7589] mb-4">Standardized evaluation matrices used for Application Priority Score (APS) computation. Urgency scores are CRYPTAVISTA-defined metrics derived from the Mosca timing relationship.</div>

          <div className="grid grid-cols-2 gap-5">
            {/* Table 1: Mosca Urgency Mapping */}
            <div className="border border-[#dde1e9] rounded-md overflow-hidden">
              <div className="bg-[#f0f4fa] px-3 py-2 text-[11px] font-bold text-[#1e3a5f] border-b border-[#dde1e9]">
                1. MOSCA URGENCY MAPPING
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-[#f9fafb] border-b border-[#dde1e9] text-[#6b7589]">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Timing Margin Z − (X + Y)</th>
                    <th className="px-3 py-1.5 text-center">Score</th>
                    <th className="px-3 py-1.5 text-left">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  <tr className={actMosca.text === "Critical" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">≤ 0</td><td className="px-3 py-1.5 text-center font-bold">100</td><td className="px-3 py-1.5 text-red-700 font-semibold">Critical</td></tr>
                  <tr className={actMosca.text === "Very High" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">&gt; 0 and ≤ 2</td><td className="px-3 py-1.5 text-center font-bold text-[#1e3a5f]">75</td><td className="px-3 py-1.5 text-red-600 font-semibold">Very High</td></tr>
                  <tr className={actMosca.text === "High" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">&gt; 2 and ≤ 5</td><td className="px-3 py-1.5 text-center font-bold">50</td><td className="px-3 py-1.5 text-orange-600 font-semibold">High</td></tr>
                  <tr className={actMosca.text === "Medium" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">&gt; 5 and ≤ 10</td><td className="px-3 py-1.5 text-center font-bold">25</td><td className="px-3 py-1.5 text-amber-600 font-semibold">Medium</td></tr>
                  <tr className={actMosca.text === "Low" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">&gt; 10</td><td className="px-3 py-1.5 text-center font-bold">0</td><td className="px-3 py-1.5 text-emerald-600 font-semibold">Low</td></tr>
                </tbody>
              </table>
            </div>

            {/* Table 2: Data Sensitivity Mapping */}
            <div className="border border-[#dde1e9] rounded-md overflow-hidden">
              <div className="bg-[#f0f4fa] px-3 py-2 text-[11px] font-bold text-[#1e3a5f] border-b border-[#dde1e9]">
                2. DATA SENSITIVITY MAPPING
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-[#f9fafb] border-b border-[#dde1e9] text-[#6b7589]">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Selection</th>
                    <th className="px-3 py-1.5 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  <tr><td className="px-3 py-1.5">Public</td><td className="px-3 py-1.5 text-center font-bold">25</td></tr>
                  <tr><td className="px-3 py-1.5">Internal</td><td className="px-3 py-1.5 text-center font-bold">50</td></tr>
                  <tr className="bg-blue-50/30"><td className="px-3 py-1.5 font-semibold text-[#1e3a5f]">Confidential</td><td className="px-3 py-1.5 text-center font-bold text-[#1e3a5f]">75</td></tr>
                  <tr><td className="px-3 py-1.5">Highly Confidential</td><td className="px-3 py-1.5 text-center font-bold">100</td></tr>
                </tbody>
              </table>
            </div>

            {/* Table 3: Business Criticality Mapping */}
            <div className="border border-[#dde1e9] rounded-md overflow-hidden">
              <div className="bg-[#f0f4fa] px-3 py-2 text-[11px] font-bold text-[#1e3a5f] border-b border-[#dde1e9]">
                3. BUSINESS CRITICALITY MAPPING
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-[#f9fafb] border-b border-[#dde1e9] text-[#6b7589]">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Selection</th>
                    <th className="px-3 py-1.5 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  <tr><td className="px-3 py-1.5">Low</td><td className="px-3 py-1.5 text-center font-bold">25</td></tr>
                  <tr><td className="px-3 py-1.5">Medium</td><td className="px-3 py-1.5 text-center font-bold">50</td></tr>
                  <tr className="bg-blue-50/30"><td className="px-3 py-1.5 font-semibold text-[#1e3a5f]">High</td><td className="px-3 py-1.5 text-center font-bold text-[#1e3a5f]">75</td></tr>
                  <tr><td className="px-3 py-1.5">Critical</td><td className="px-3 py-1.5 text-center font-bold">100</td></tr>
                </tbody>
              </table>
            </div>

            {/* Table 4: Final Application Priority */}
            <div className="border border-[#dde1e9] rounded-md overflow-hidden">
              <div className="bg-[#f0f4fa] px-3 py-2 text-[11px] font-bold text-[#1e3a5f] border-b border-[#dde1e9]">
                4. FINAL APPLICATION PRIORITY
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-[#f9fafb] border-b border-[#dde1e9] text-[#6b7589]">
                  <tr>
                    <th className="px-3 py-1.5 text-left">APS Range</th>
                    <th className="px-3 py-1.5 text-left">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  <tr className={actPriority === "High" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono font-bold text-[#1e3a5f]">75 – 100</td><td className="px-3 py-1.5 text-red-700 font-bold">High</td></tr>
                  <tr className={actPriority === "Medium" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">50 – 74.99</td><td className="px-3 py-1.5 text-amber-700 font-bold">Medium</td></tr>
                  <tr className={actPriority === "Low" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">25 – 49.99</td><td className="px-3 py-1.5 text-emerald-700 font-bold">Low</td></tr>
                  <tr className={actPriority === "Minimal" ? "bg-blue-50/30" : ""}><td className="px-3 py-1.5 font-mono">0 – 24.99</td><td className="px-3 py-1.5 text-slate-600 font-bold">Minimal</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Chart: Mosca Timeline Comparison */}
        <div className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <div className="text-[14px] font-bold text-[#1a1d23]">
                {chartFocus === 'all'
                  ? "Mosca Timeline Comparison (All Applications)"
                  : chartFocus === 'top5'
                  ? "Mosca Timeline Comparison (Top 5 Critical Apps)"
                  : "Mosca Timeline Comparison (Selected Application Focus)"}
              </div>
              <div className="text-[11px] text-[#6b7589]">
                Comparing Data Protection Duration (X) + Migration Duration (Y) against Quantum Threat Horizon (Z = {actZ} years) across {chartFocus === 'all' ? 'all applications' : chartFocus === 'top5' ? 'top 5 critical applications' : (activeApp?.applicationName || 'selected application')}.
              </div>
            </div>
            
            <div className="flex items-center gap-1 bg-[#f5f6f8] p-1 rounded-md border border-[#dde1e9] text-xs">
              <button
                onClick={() => setChartFocus('all')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  chartFocus === 'all'
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-[#6b7589] hover:text-[#1a1d23]'
                }`}
              >
                All Applications
              </button>
              <button
                onClick={() => setChartFocus('top5')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  chartFocus === 'top5'
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-[#6b7589] hover:text-[#1a1d23]'
                }`}
              >
                Top 5 Critical Apps
              </button>
              <button
                onClick={() => setChartFocus('selected')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  chartFocus === 'selected'
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-[#6b7589] hover:text-[#1a1d23]'
                }`}
              >
                Selected Application Focus
              </button>
            </div>
          </div>

          {/* Quick Metrics Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-[#f8fafc] border border-[#dde1e9] rounded-lg mb-4 text-xs">
            <div>
              <span className="text-[#6b7589] block text-[10px] uppercase font-bold">Data Protection (X)</span>
              <span className="font-bold text-[#1a1d23] text-sm">{actX} years</span>
              <span className="text-[10px] text-[#6b7589] block">Protection period</span>
            </div>
            <div>
              <span className="text-[#6b7589] block text-[10px] uppercase font-bold">Migration Duration (Y)</span>
              <span className="font-bold text-[#d97706] text-sm">{actY} years</span>
              <span className="text-[10px] text-[#6b7589] block">Execution transition</span>
            </div>
            <div>
              <span className="text-[#6b7589] block text-[10px] uppercase font-bold">Total Required (X + Y)</span>
              <span className="font-bold text-[#1e3a5f] text-sm">{actX + actY} years</span>
              <span className="text-[10px] text-[#6b7589] block">Target: {2026 + actX + actY}</span>
            </div>
            <div>
              <span className="text-[#6b7589] block text-[10px] uppercase font-bold">Timing Margin Z - (X + Y)</span>
              <span className={`font-bold text-sm ${actMargin <= 0 ? 'text-red-600' : actMargin <= 2 ? 'text-orange-600' : 'text-emerald-600'}`}>
                {actMargin > 0 ? `+${actMargin}` : actMargin} years
              </span>
              <span className="text-[10px] text-[#6b7589] block">{actMosca.text} Urgency</span>
            </div>
          </div>

          {activeChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[#6b7589] text-xs">
              No applications available for Mosca timeline comparison.
            </div>
          ) : (
            <div style={{ height: `${chartHeight}px`, minHeight: `${chartHeight}px` }} className="w-full">
              <ResponsiveContainer width="100%" height={chartHeight} minHeight={chartHeight}>
                <BarChart
                  data={activeChartData}
                  layout="vertical"
                  barSize={barSize}
                  margin={{ top: 20, right: 40, left: 180, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
                  <XAxis type="number" domain={[0, maxVal]} tick={{ fontSize: 11, fill: "#9aa1b1" }} unit=" yr" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={180}
                    tick={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
                    interval={0}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-[#dde1e9] rounded-md shadow-md text-xs space-y-1 z-50">
                          <div className="font-bold text-[#1e3a5f] text-[13px] border-b border-[#dde1e9] pb-1 mb-1.5">
                            {d.applicationName || d.name}
                          </div>
                          <div className="flex justify-between gap-4 text-[#64748b]">
                            <span>Data Protection Duration (X):</span>
                            <span className="font-bold text-[#1a1d23]">{d.X} yr</span>
                          </div>
                          <div className="flex justify-between gap-4 text-[#d97706]">
                            <span>Migration Duration (Y):</span>
                            <span className="font-bold text-[#1a1d23]">{d.Y} yr</span>
                          </div>
                          <div className="flex justify-between gap-4 text-[#1e3a5f] border-t border-[#f0f2f5] pt-1 font-semibold">
                            <span>Total Required Duration (X + Y):</span>
                            <span className="font-bold">{d.total} yr</span>
                          </div>
                          <div className="flex justify-between gap-4 text-[#6b7589]">
                            <span>Quantum Risk Horizon (Z):</span>
                            <span className="font-bold text-[#1a1d23]">{d.Z} yr</span>
                          </div>
                          <div className="flex justify-between gap-4 border-t border-[#f0f2f5] pt-1">
                            <span className="font-semibold text-[#1a1d23]">Timing Margin Z - (X + Y):</span>
                            <span className={`font-bold ${d.timingMargin <= 0 ? 'text-red-600' : d.timingMargin <= 2 ? 'text-orange-600' : 'text-emerald-600'}`}>
                              {d.timingMargin > 0 ? `+${d.timingMargin}` : d.timingMargin} yr
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    x={actZ}
                    stroke="#C2413B"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    label={{
                      position: "insideTop",
                      value: `Risk Horizon (Z = ${actZ} yr, ${horizonYear})`,
                      fill: "#C2413B",
                      fontSize: 11,
                      fontWeight: 700,
                      offset: -20,
                    }}
                  />
                  <Bar
                    dataKey="X"
                    stackId="a"
                    fill="#64748b"
                    name="Data Protection (X)"
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry?.analysisId && onSelectAnalysis) {
                        onSelectAnalysis(entry.analysisId);
                      }
                    }}
                  />
                  <Bar
                    dataKey="Y"
                    stackId="a"
                    fill="#f59e0b"
                    name="Migration Duration (Y)"
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry?.analysisId && onSelectAnalysis) {
                        onSelectAnalysis(entry.analysisId);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Summary table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg overflow-x-auto shadow-sm">
          <div className="px-5 py-4 border-b border-[#dde1e9]">
            <div className="text-[13px] font-bold text-[#1a1d23]">All Applications Priority Ranking</div>
            <div className="text-[11px] text-[#6b7589] mt-0.5">Click any row to expand its step-by-step arithmetic breakdown.</div>
          </div>
          <table className="w-full min-w-[800px]">
            <thead className="bg-[#f9fafb] border-b border-[#dde1e9]">
              <tr>
                <th className="px-4 py-2.5 w-10"></th>
                {["Application", "Mosca Urgency (M)", "Data Sensitivity (D)", "Business Criticality (B)", "Overall Priority"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <AppPriorityRow key={app.analysisId} app={app} horizon={actZ} />
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
