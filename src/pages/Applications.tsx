import { useState } from "react";
import { applications } from "../data/mock";
import { Plus, Target, ChevronDown, ChevronRight, CheckCircle, Clock } from "lucide-react";

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

export default function Applications({ onNewAnalysis }: { onNewAnalysis?: () => void }) {
  const [expanded, setExpanded] = useState<string | null>("auth");

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-[#1a1d23]">Applications & Targets</div>
            <div className="text-[11px] text-[#6b7589] mt-0.5">Manage analyzed applications and scan targets</div>
          </div>
          <button onClick={onNewAnalysis} className="flex items-center gap-1.5 text-[12px] text-white bg-[#1e3a5f] px-3 py-1.5 rounded-md hover:bg-[#162e4d] font-medium">
            <Plus size={13} /> New Analysis
          </button>
        </div>

        <div className="space-y-3">
          {applications.map((app) => {
            const isOpen = expanded === app.id;
            return (
              <div key={app.id} className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden">
                <div
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-[#f9fafb] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[11px] font-bold">{app.priority}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#1a1d23]">{app.name}</span>
                      <CheckCircle size={13} className="text-emerald-500" />
                      <span className="text-[10px] text-emerald-600 font-medium">Analysis Complete</span>
                    </div>
                    <div className="text-[11px] text-[#6b7589] mt-0.5">{app.description}</div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] flex-shrink-0">
                    <div className="text-center">
                      <div className="font-bold text-[#1e3a5f] text-[14px]">{app.assets}</div>
                      <div className="text-[#6b7589]">assets</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-[#1a1d23] text-[14px]">{app.runtimeCoverage}%</div>
                      <div className="text-[#6b7589]">runtime</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${riskBadge[app.quantumRisk]}`}>{app.quantumRisk} Risk</span>
                    {isOpen ? <ChevronDown size={14} className="text-[#6b7589]" /> : <ChevronRight size={14} className="text-[#6b7589]" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#f0f2f5] px-5 py-4">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {[
                        { label: "Data Lifetime", value: `${app.dataLifetime} years` },
                        { label: "Business Criticality", value: app.criticality, badge: critBadge[app.criticality] },
                        { label: "Migration Duration", value: `~${app.migrationDuration} years` },
                        { label: "Recommendation", value: app.recommendation },
                      ].map(item => (
                        <div key={item.label} className="bg-[#f5f6f8] rounded-md p-3">
                          <div className="text-[10px] text-[#6b7589] uppercase tracking-wide font-medium mb-1">{item.label}</div>
                          {item.badge
                            ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${item.badge}`}>{item.value}</span>
                            : <div className="text-[12px] font-semibold text-[#1a1d23]">{item.value}</div>}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] text-[#6b7589] uppercase tracking-wide font-medium mb-2">Primary Cryptographic Technologies</div>
                      <div className="flex flex-wrap gap-1.5">
                        {app.primaryAlgorithms.map(alg => (
                          <span key={alg} className="text-[11px] mono bg-white border border-[#dde1e9] text-[#1e3a5f] px-2 py-0.5 rounded font-medium">{alg}</span>
                        ))}
                      </div>
                    </div>

                    {/* Scan targets */}
                    <div className="mt-4">
                      <div className="text-[10px] text-[#6b7589] uppercase tracking-wide font-medium mb-2">Scan Targets</div>
                      <div className="flex gap-2">
                        {["Source Code", "Binaries", "Libraries", "Container Images"].map(t => (
                          <div key={t} className="flex items-center gap-1.5 bg-white border border-[#dde1e9] rounded px-2.5 py-1.5 text-[11px] text-[#1a1d23]">
                            <Target size={11} className="text-[#1e3a5f]" />
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
