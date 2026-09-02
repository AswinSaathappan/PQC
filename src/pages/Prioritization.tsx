import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

const fullData = [
  { rank: 1, system: "Authentication Service", asset: "RSA-2048", risk: "High", criticality: "Critical", depImpact: "High", complexity: "High", score: 92, action: "Immediate PQC Migration" },
  { rank: 2, system: "Payment Gateway", asset: "ECDSA P-256", risk: "High", criticality: "Critical", depImpact: "High", complexity: "High", score: 78, action: "Plan PQC Migration" },
  { rank: 3, system: "Session Manager", asset: "RSA-2048", risk: "High", criticality: "Critical", depImpact: "High", complexity: "Medium", score: 74, action: "Plan PQC Migration" },
  { rank: 4, system: "Document Encryption Svc", asset: "RSA-2048", risk: "High", criticality: "High", depImpact: "Medium", complexity: "Medium", score: 68, action: "Hybrid Cryptography" },
  { rank: 5, system: "VPN Daemon", asset: "DH-1024", risk: "High", criticality: "High", depImpact: "Medium", complexity: "High", score: 65, action: "Immediate PQC Migration" },
  { rank: 6, system: "API Gateway", asset: "TLS 1.2", risk: "Medium", criticality: "High", depImpact: "Medium", complexity: "Low", score: 45, action: "Upgrade to TLS 1.3 + Hybrid" },
  { rank: 7, system: "Legacy API", asset: "HMAC-SHA1", risk: "Medium", criticality: "Medium", depImpact: "Medium", complexity: "Low", score: 38, action: "Monitor & Schedule" },
  { rank: 8, system: "Reporting Service", asset: "SHA-256", risk: "Low", criticality: "Low", depImpact: "Low", complexity: "Low", score: 22, action: "Lower Priority" },
];

const riskBadge: Record<string, string> = {
  High: "bg-red-50 text-red-700 border border-red-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Critical: "bg-red-100 text-red-800 border border-red-300",
};

const actionBadge: Record<string, string> = {
  "Immediate PQC Migration": "bg-red-50 text-red-700",
  "Plan PQC Migration": "bg-orange-50 text-orange-700",
  "Hybrid Cryptography": "bg-amber-50 text-amber-700",
  "Upgrade to TLS 1.3 + Hybrid": "bg-blue-50 text-blue-700",
  "Monitor & Schedule": "bg-slate-50 text-slate-700",
  "Lower Priority": "bg-emerald-50 text-emerald-700",
};

export default function Prioritization() {
  const [sortField, setSortField] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterRisk, setFilterRisk] = useState("All");

  const sorted = [...fullData]
    .filter(d => filterRisk === "All" || d.risk === filterRisk)
    .sort((a, b) => {
      const va = a[sortField as keyof typeof a];
      const vb = b[sortField as keyof typeof b];
      const cmp = typeof va === "number" ? va - (vb as number) : String(va).localeCompare(String(vb));
      return sortDir === "desc" ? -cmp : cmp;
    });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-5">

        {/* Formula */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
          <div className="text-[13px] font-semibold text-[#1a1d23] mb-4">Priority Score Formula</div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Quantum Risk", color: "bg-red-50 border-red-200 text-red-700" },
              { label: "+", color: "" },
              { label: "System Criticality", color: "bg-amber-50 border-amber-200 text-amber-700" },
              { label: "+", color: "" },
              { label: "Dependency Impact", color: "bg-blue-50 border-blue-200 text-blue-700" },
              { label: "+", color: "" },
              { label: "Migration Complexity", color: "bg-slate-50 border-slate-200 text-slate-700" },
              { label: "=", color: "" },
              { label: "Priority Score", color: "bg-[#1e3a5f] border-[#1e3a5f] text-white" },
            ].map((item, i) => (
              item.color ? (
                <div key={i} className={`text-[12px] font-semibold px-3 py-1.5 rounded-md border ${item.color}`}>{item.label}</div>
              ) : (
                <div key={i} className="text-[14px] font-bold text-[#dde1e9]">{item.label}</div>
              )
            ))}
          </div>
          <div className="mt-3 text-[11px] text-[#6b7589]">
            Priority scores are calculated using normalized risk weights. Higher scores indicate greater urgency for migration planning. CRYPTAVISTA uses this ranking to help organizations focus limited resources on the highest-impact systems.
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg">
          <div className="px-5 py-4 border-b border-[#dde1e9] flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1a1d23]">Migration Priority Ranking</div>
              <div className="text-[11px] text-[#6b7589]">{sorted.length} systems ranked</div>
            </div>
            <div className="flex gap-2">
              {["All", "High", "Medium", "Low"].map(r => (
                <button key={r} onClick={() => setFilterRisk(r)}
                  className={`text-[11px] px-3 py-1 rounded-md font-medium transition-colors ${filterRisk === r ? "bg-[#1e3a5f] text-white" : "bg-[#f5f6f8] text-[#6b7589] hover:bg-[#eef0f3] border border-[#dde1e9]"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#dde1e9] bg-[#f9fafb]">
                {[
                  { key: "rank", label: "Rank" },
                  { key: "system", label: "System" },
                  { key: "risk", label: "Risk Level" },
                  { key: "criticality", label: "Criticality" },
                  { key: "depImpact", label: "Dep. Impact" },
                  { key: "complexity", label: "Migration Complexity" },
                  { key: "score", label: "Priority Score" },
                  { key: "action", label: "Recommended Action" },
                ].map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide cursor-pointer hover:text-[#1a1d23] select-none">
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && (sortDir === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={i} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">{row.rank}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[12px] font-semibold text-[#1a1d23]">{row.system}</div>
                    <div className="text-[10px] mono text-[#6b7589]">{row.asset}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${riskBadge[row.risk]}`}>{row.risk}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${riskBadge[row.criticality]}`}>{row.criticality}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${riskBadge[row.depImpact]}`}>{row.depImpact}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${riskBadge[row.complexity]}`}>{row.complexity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#eef0f3] rounded-full overflow-hidden w-16">
                        <div className="h-full rounded-full bg-[#1e3a5f]" style={{ width: `${row.score}%` }} />
                      </div>
                      <span className="text-[12px] font-bold text-[#1e3a5f] mono w-6">{row.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-1 rounded ${actionBadge[row.action] || "bg-slate-50 text-slate-700"}`}>{row.action}</span>
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
