import { Download, FileText, Shield, AlertTriangle } from "lucide-react";
import { applications, assetPriorities, recommendations } from "../data/mock";

const riskBadge: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High: "bg-red-50 text-red-700 border border-red-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Lower: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const sections = [
  "Executive Summary", "Applications Analyzed", "Discovery Summary", "Comprehensive CBOM",
  "Runtime Evidence", "Classification", "Quantum Risk Assessment", "Mosca-Based Risk Timeline",
  "Priority Analysis", "PQC / Hybrid Recommendations", "Dependency Impact",
];

export default function Report() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-[#1a1d23]">Analysis Report</div>
            <div className="text-[11px] text-[#6b7589] mt-0.5">Enterprise Q4 2026 · Generated 2 Sep 2026 · 5 Applications · CRYPTAVISTA ECDAT</div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 text-[12px] text-[#6b7589] border border-[#dde1e9] px-3 py-1.5 rounded-md hover:bg-white font-medium">
              <FileText size={13} /> Preview Report
            </button>
            <button className="flex items-center gap-1.5 text-[12px] text-[#6b7589] border border-[#dde1e9] px-3 py-1.5 rounded-md hover:bg-white font-medium">
              <FileText size={13} /> Generate Report
            </button>
            <button className="flex items-center gap-1.5 text-[12px] text-white bg-[#1e3a5f] px-3 py-1.5 rounded-md hover:bg-[#162e4d] font-medium">
              <Download size={13} /> Export PDF
            </button>
          </div>
        </div>

        {/* Section nav */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-3 flex flex-wrap gap-1.5">
          {sections.map((s, i) => (
            <span key={i} className="text-[10px] bg-[#f5f6f8] text-[#6b7589] border border-[#dde1e9] px-2 py-0.5 rounded font-medium">{i + 1}. {s}</span>
          ))}
        </div>

        {/* Report document */}
        <div className="bg-white border border-[#dde1e9] rounded-lg shadow-sm">

          {/* Report header */}
          <div className="bg-[#1e3a5f] rounded-t-lg px-8 py-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-xl tracking-tight">CRYPTAVISTA</div>
                <div className="text-blue-200/50 text-[10px] tracking-widest uppercase">Enterprise Cryptographic Discovery & Analysis Tool</div>
              </div>
            </div>
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Enterprise Cryptographic Security Assessment</div>
            <div className="text-white text-2xl font-bold">Enterprise Q4 2026 Analysis</div>
            <div className="flex gap-6 mt-4 text-[10px] text-blue-200/50">
              <span>Date: 2 September 2026</span>
              <span>Classification: Confidential</span>
              <span>Applications: 5</span>
              <span>Version: 1.0</span>
            </div>
          </div>

          <div className="px-8 py-6 space-y-8">

            {/* 1 Executive summary */}
            <section>
              <ReportSection n={1} title="Executive Summary" />
              <div className="border-l-2 border-[#1e3a5f]/15 pl-4 text-[12px] text-[#1a1d23] leading-relaxed space-y-2">
                <p>CRYPTAVISTA performed a comprehensive cryptographic analysis across <strong>5 enterprise applications</strong>, identifying <strong>90 cryptographic artefacts</strong> from source code, binaries, libraries, container images, and dependencies. Of these, <strong>312 cryptographic operations</strong> were verified through runtime evidence collection.</p>
                <p>The analysis identified <strong>34 high quantum-risk assets</strong>, primarily RSA-2048 and ECDSA P-256 implementations vulnerable to Shor's algorithm. Using Mosca's framework, Authentication Service and Payment Service require immediate migration planning — their combined data protection lifetime and migration duration exceed the modeled quantum risk horizon.</p>
                <p>Authentication Service (Priority 1) and Payment Service (Priority 3) are the highest-urgency systems. All 5 applications have been classified, risk-assessed, and prioritized for PQC or hybrid cryptography transition.</p>
              </div>
            </section>

            <div className="border-t border-[#f0f2f5]" />

            {/* 2 Applications */}
            <section>
              <ReportSection n={2} title="Applications Analyzed" />
              <div className="grid grid-cols-5 gap-3">
                {applications.map(app => (
                  <div key={app.id} className="bg-[#f5f6f8] rounded-md p-3">
                    <div className="text-[11px] font-semibold text-[#1a1d23] mb-2 leading-tight">{app.name}</div>
                    <div className="text-[10px] text-[#6b7589] space-y-0.5">
                      <div>{app.assets} assets</div>
                      <div>{app.runtimeCoverage}% runtime</div>
                    </div>
                    <span className={`mt-2 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${riskBadge[app.quantumRisk]}`}>{app.quantumRisk}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-[#f0f2f5]" />

            {/* 3 Quantum risk */}
            <section>
              <ReportSection n={3} title="Quantum Risk Assessment" />
              <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 flex items-start gap-3 mb-4">
                <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-red-800 leading-relaxed">
                  <strong>Mosca's Inequality applied:</strong> For Authentication Service and Payment Service, combined data protection lifetime and migration duration exceed the modeled risk horizon. Immediate migration planning is recommended for these Priority 1–3 systems.
                </div>
              </div>
            </section>

            <div className="border-t border-[#f0f2f5]" />

            {/* 4 Priority */}
            <section>
              <ReportSection n={4} title="Priority Analysis" />
              <div className="space-y-3">
                {applications.map(app => {
                  const assets = assetPriorities[app.id] ?? [];
                  return (
                    <div key={app.id}>
                      <div className="text-[11px] font-semibold text-[#1a1d23] mb-1.5">{app.name}</div>
                      <div className="space-y-1.5 pl-2">
                        {assets.map(row => (
                          <div key={row.rank} className="flex items-center gap-3 p-2.5 bg-[#f9fafb] rounded-md border border-[#f0f2f5]">
                            <div className="w-5 h-5 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[9px] font-bold">{row.rank}</span>
                            </div>
                            <div className="flex-1 text-[12px] font-medium text-[#1a1d23]">{row.asset}</div>
                            <span className="text-[10px] text-[#6b7589]">{row.component}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${riskBadge[row.urgency === "Urgent" ? "High" : row.urgency === "Monitor" ? "Medium" : "Lower"]}`}>{row.urgency}</span>
                            <div className="flex items-center gap-2 w-28">
                              <div className="flex-1 h-1.5 bg-[#eef0f3] rounded-full overflow-hidden">
                                <div className="h-full bg-[#1e3a5f] rounded-full" style={{ width: `${row.score}%` }} />
                              </div>
                              <span className="text-[11px] font-bold text-[#1e3a5f] mono">{row.score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="border-t border-[#f0f2f5]" />

            {/* 5 Recommendations */}
            <section>
              <ReportSection n={5} title="PQC / Hybrid Recommendations" />
              <div className="space-y-3">
                {recommendations.slice(0, 3).map((rec, i) => (
                  <div key={i} className="flex gap-4 p-3 bg-[#f9fafb] rounded-md border border-[#f0f2f5]">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">{rec.priority}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-[#1a1d23]">{rec.app}</div>
                      <div className="text-[11px] mono text-[#6b7589]">{rec.asset}</div>
                      <div className="text-[11px] text-[#1a1d23] mt-1">{rec.direction}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="bg-[#f5f6f8] border border-[#dde1e9] rounded-md px-4 py-3 text-[10px] text-[#6b7589]">
              Generated by CRYPTAVISTA ECDAT. All findings are based on automated static analysis and monitored runtime observation. This report provides analysis and recommendations to support decision-making. All recommendations should be reviewed by qualified security professionals before implementation.
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function ReportSection({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded bg-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{n}</div>
      <h2 className="text-[14px] font-bold text-[#1a1d23]">{title}</h2>
    </div>
  );
}
