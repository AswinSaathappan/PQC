import { useState } from "react";
import { classificationData, applications } from "../data/mock";
import { Tags, CheckCircle, AlertCircle } from "lucide-react";

const critBadge: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High: "bg-orange-50 text-orange-700 border border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-slate-100 text-slate-600 border border-slate-200",
};

const runtimeBadge: Record<string, string> = {
  Observed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Not Observed": "bg-slate-100 text-slate-600 border border-slate-200",
  Inconclusive: "bg-amber-50 text-amber-700 border border-amber-200",
};

export default function Classification() {
  const [appFilter, setAppFilter] = useState("All Applications");
  const appOptions = ["All Applications", ...applications.map(a => a.name)];

  const filtered = classificationData.filter(d => appFilter === "All Applications" || d.app === appFilter);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        <div className="flex items-center gap-3 justify-end">
          <select value={appFilter} onChange={e => setAppFilter(e.target.value)} className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 bg-white outline-none text-[#1a1d23]">
            {appOptions.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        <div className="space-y-3">
          {filtered.map((item, i) => (
            <div key={i} className="bg-white border border-[#dde1e9] rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.quantumVuln ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
                  {item.quantumVuln ? <AlertCircle size={18} className="text-red-500" /> : <CheckCircle size={18} className="text-emerald-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#1a1d23]">{item.app}</span>
                    <span className="text-[#6b7589] text-[12px]">·</span>
                    <span className="text-[13px] font-semibold mono text-[#1e3a5f]">{item.artefact}</span>
                    {item.quantumVuln && <span className="text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">Quantum-Vulnerable</span>}
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: "Type", value: item.type },
                      { label: "Data Protection Lifetime", value: item.lifetime, mono: false },
                      { label: "Business Criticality", value: item.criticality, badge: critBadge[item.criticality] },
                      { label: "Sensitive Data", value: item.sensitiveData },
                      { label: "Runtime Evidence", value: item.runtime, badge: runtimeBadge[item.runtime] },
                    ].map(field => (
                      <div key={field.label} className="bg-[#f5f6f8] rounded-md px-3 py-2">
                        <div className="text-[9px] text-[#6b7589] uppercase tracking-wide font-semibold mb-1">{field.label}</div>
                        {field.badge
                          ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${field.badge}`}>{field.value}</span>
                          : <div className={`text-[12px] font-semibold text-[#1a1d23] ${field.mono ? "mono" : ""}`}>{field.value}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
