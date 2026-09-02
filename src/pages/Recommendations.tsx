import { recommendations } from "../data/mock";
import { ArrowRight, AlertTriangle, Shield, Clock, ChevronDown } from "lucide-react";

const dirIcon: Record<string, React.ElementType> = {
  "Evaluate Hybrid Cryptography": Shield,
  "Evaluate PQC Transition": ArrowRight,
  "Monitor and Reassess": Clock,
  "Lower Current Priority": ChevronDown,
};

const dirBadge: Record<string, string> = {
  "Evaluate Hybrid Cryptography": "bg-red-50 text-red-700 border border-red-200",
  "Evaluate PQC Transition": "bg-orange-50 text-orange-700 border border-orange-200",
  "Monitor and Reassess": "bg-blue-50 text-blue-700 border border-blue-200",
  "Lower Current Priority": "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const riskBadge: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High: "bg-red-50 text-red-700 border border-red-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

export default function Recommendations() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        <div className="bg-[#1e3a5f] rounded-lg px-5 py-4">
          <div className="text-white text-[13px] font-semibold mb-1">PQC / Hybrid Decision Support</div>
          <div className="text-blue-200/65 text-[11px] leading-relaxed">
            CRYPTAVISTA provides evidence-based decision support to guide cryptographic migration planning. Recommendations are derived from discovery findings, runtime evidence, quantum risk assessment, and organizational context. The platform does not perform automated migration.
          </div>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Evaluate Hybrid Cryptography", count: 2, cls: "border-l-red-400 bg-red-50", text: "text-red-700" },
            { label: "Evaluate PQC Transition", count: 1, cls: "border-l-orange-400 bg-orange-50", text: "text-orange-700" },
            { label: "Monitor and Reassess", count: 1, cls: "border-l-blue-400 bg-blue-50", text: "text-blue-700" },
            { label: "Lower Current Priority", count: 1, cls: "border-l-emerald-400 bg-emerald-50", text: "text-emerald-700" },
          ].map((item, i) => (
            <div key={i} className={`border-l-4 ${item.cls} rounded-r-md px-4 py-3`}>
              <div className={`text-2xl font-bold ${item.text}`}>{item.count}</div>
              <div className={`text-[11px] font-medium ${item.text} mt-0.5`}>{item.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {recommendations.map((rec, i) => {
            const Icon = dirIcon[rec.direction] ?? Shield;
            return (
              <div key={i} className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-[#f0f2f5] flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">{i + 1}</span>
                      </div>
                      <span className="text-[13px] font-bold text-[#1a1d23]">{rec.app}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] mono bg-[#f5f6f8] border border-[#dde1e9] text-[#1e3a5f] px-2 py-0.5 rounded font-medium">{rec.asset}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${riskBadge[rec.risk]}`}>{rec.risk} Risk</span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border flex-shrink-0 ${dirBadge[rec.direction]}`}>
                    <Icon size={12} />{rec.direction}
                  </span>
                </div>
                <div className="px-5 py-4 grid grid-cols-3 gap-5">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-[#6b7589] mb-2">Context</div>
                    <div className="space-y-1.5 text-[11px]">
                      {[
                        { label: "Data Lifetime", value: rec.dataLifetime },
                        { label: "Criticality", value: rec.criticality },
                        { label: "Latency", value: rec.latency },
                        { label: "Migration Cost", value: rec.cost },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between">
                          <span className="text-[#6b7589]">{item.label}</span>
                          <span className="font-medium text-[#1a1d23]">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-[#6b7589] mb-2">Recommendation & Rationale</div>
                    <p className="text-[12px] text-[#1a1d23] leading-relaxed">{rec.reason}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#f5f6f8] border border-[#dde1e9] rounded-lg px-5 py-3 text-[10px] text-[#6b7589]">
          <strong className="text-[#1a1d23]">Referenced Standards:</strong> NIST FIPS 203 (ML-KEM), NIST FIPS 204 (ML-DSA), NIST FIPS 205 (SLH-DSA). Hybrid approaches combine classical and post-quantum algorithms to maintain backward compatibility during transition.
        </div>

      </div>
    </div>
  );
}
