import { Shield, Search, Plus, ArrowRight, Layers, Key, Activity, AlertTriangle, Server } from "lucide-react";
import { applications, kpis } from "../data/mock";

const riskBadge: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High: "bg-red-50 text-red-700 border border-red-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Lower: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const critBadge: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High: "bg-orange-50 text-orange-700 border border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-slate-100 text-slate-600 border border-slate-200",
};

const recBadge: Record<string, string> = {
  "Evaluate Hybrid Cryptography": "bg-red-50 text-red-700",
  "Evaluate PQC Transition": "bg-orange-50 text-orange-700",
  "Monitor and Reassess": "bg-blue-50 text-blue-700",
  "Lower Current Priority": "bg-slate-50 text-slate-600",
};

const kpiIcons = [Layers, Key, Activity, AlertTriangle, Server];

const pipeline = [
  { label: "DISCOVER", sub: "Artefact discovery" },
  { label: "VERIFY", sub: "Runtime evidence" },
  { label: "ASSESS", sub: "Quantum risk" },
  { label: "PRIORITIZE", sub: "Decision ranking" },
  { label: "RECOMMEND", sub: "PQC / Hybrid" },
];

interface Props { onNavigate: (id: string) => void; }

export default function Overview({ onNavigate }: Props) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* Hero */}
        <div className="bg-[#1e3a5f] rounded-lg px-7 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={15} className="text-[#0d7a6b]" />
              <span className="text-white/40 text-[10px] font-medium tracking-widest uppercase">Enterprise Cryptographic Discovery & Analysis Tool</span>
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">Enterprise Cryptographic Overview</h1>
            <p className="text-blue-200/55 text-[12px] mt-1">Discover, verify and assess cryptography across your enterprise.</p>
          </div>
          {/* Pipeline strip */}
          <div className="flex items-center gap-1">
            {pipeline.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1">
                <div className="text-center px-3 py-2 bg-white/5 rounded">
                  <div className="text-white text-[10px] font-bold tracking-wide">{s.label}</div>
                  <div className="text-blue-200/40 text-[9px] mt-0.5">{s.sub}</div>
                </div>
                {i < pipeline.length - 1 && <ArrowRight size={11} className="text-white/20 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-5 gap-4">
          {kpis.map((kpi, i) => {
            const Icon = kpiIcons[i];
            return (
              <div key={i} className="bg-white border border-[#dde1e9] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#6b7589] font-medium uppercase tracking-wide leading-tight">{kpi.label}</span>
                  <Icon size={13} className="text-[#1e3a5f]/30 flex-shrink-0" />
                </div>
                <div className="text-2xl font-bold text-[#1a1d23] tracking-tight">{kpi.value}</div>
                <div className="text-[10px] text-[#6b7589] mt-0.5">{kpi.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Application Portfolio */}
        <div className="bg-white border border-[#dde1e9] rounded-lg">
          <div className="px-5 py-4 border-b border-[#dde1e9] flex items-center justify-between">
            <div>
              <div className="text-[14px] font-bold text-[#1a1d23]">Application Portfolio</div>
              <div className="text-[11px] text-[#6b7589] mt-0.5">All analyzed enterprise applications — click a row to explore its full analysis</div>
            </div>
            <button onClick={() => onNavigate("applications")} className="flex items-center gap-1.5 text-[11px] text-[#1e3a5f] border border-[#1e3a5f]/30 px-3 py-1.5 rounded-md hover:bg-[#1e3a5f]/5 font-medium">
              <Plus size={12} /> New Analysis
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#dde1e9] bg-[#f9fafb]">
                {["Application", "Crypto Assets", "Runtime Evidence", "Data Lifetime", "Business Criticality", "Quantum Risk", "Recommendation"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}
                  onClick={() => onNavigate("applications")}
                  className="border-b border-[#f0f2f5] hover:bg-blue-50/40 cursor-pointer transition-colors group">
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-semibold text-[#1a1d23] group-hover:text-[#1e3a5f] transition-colors">{app.name}</div>
                    <div className="text-[10px] text-[#6b7589] mt-0.5 max-w-[220px] truncate">{app.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-bold text-[#1e3a5f]">{app.assets}</div>
                    <div className="text-[10px] text-[#6b7589]">artefacts</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#eef0f3] rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full bg-[#0d7a6b]" style={{ width: `${app.runtimeCoverage}%` }} />
                      </div>
                      <span className="text-[12px] font-medium text-[#1a1d23]">{app.runtimeCoverage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-medium text-[#1a1d23]">{app.dataLifetime} yr</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${critBadge[app.criticality]}`}>{app.criticality}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${riskBadge[app.quantumRisk]}`}>{app.quantumRisk}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-1 rounded ${recBadge[app.recommendation] || "bg-slate-50 text-slate-600"}`}>{app.recommendation}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
