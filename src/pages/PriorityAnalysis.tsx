import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { assetPriorities, applications, type AssetPriority } from "../data/mock";

const urgencyColors: Record<string, string> = {
  Urgent: "#c0392b",
  Monitor: "#d97706",
  Lower: "#0d7a6b",
};

const urgencyBadge: Record<string, string> = {
  Urgent: "bg-red-50 text-red-700 border border-red-200",
  Monitor: "bg-amber-50 text-amber-700 border border-amber-200",
  Lower: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const rankBadge: Record<number, string> = {
  1: "bg-red-100 text-red-800 border border-red-300",
  2: "bg-orange-50 text-orange-700 border border-orange-200",
  3: "bg-amber-50 text-amber-700 border border-amber-200",
  4: "bg-slate-50 text-slate-600 border border-slate-200",
};

export default function PriorityAnalysis() {
  const [selectedAppIdx, setSelectedAppIdx] = useState(0);
  const [selectedAssetIdx, setSelectedAssetIdx] = useState(0);

  const app = applications[selectedAppIdx];
  const assets: AssetPriority[] = assetPriorities[app.id] ?? [];
  const sel = assets[selectedAssetIdx];

  const barData = assets.map(a => ({
    name: a.asset,
    score: a.score,
    fill: urgencyColors[a.urgency],
    urgency: a.urgency,
  }));

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* Priority formula */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
          <div className="text-[13px] font-semibold text-[#1a1d23] mb-3">Migration Priority Calculation</div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {[
              { label: "Quantum Risk", cls: "bg-red-50 border-red-200 text-red-700" },
              "+",
              { label: "Data Lifetime", cls: "bg-orange-50 border-orange-200 text-orange-700" },
              "+",
              { label: "Migration Complexity", cls: "bg-amber-50 border-amber-200 text-amber-700" },
              "+",
              { label: "Business Criticality", cls: "bg-blue-50 border-blue-200 text-blue-700" },
              "+",
              { label: "Dependency Impact", cls: "bg-slate-50 border-slate-200 text-slate-700" },
              "=",
              { label: "Priority Score", cls: "bg-[#1e3a5f] border-[#1e3a5f] text-white" },
            ].map((item, i) => (
              typeof item === "string"
                ? <div key={i} className="text-[16px] font-bold text-[#dde1e9]">{item}</div>
                : <div key={i} className={`text-[12px] font-semibold px-3 py-1.5 rounded-md border ${item.cls}`}>{item.label}</div>
            ))}
          </div>
          <p className="text-[11px] text-[#6b7589]">
            Priority ranking is applied to cryptographic assets <span className="font-semibold text-[#1a1d23]">within the selected application</span> — not across applications. Each application is analysed independently.
          </p>
        </div>

        {/* Application selector */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-4">
          <div className="text-[11px] font-semibold text-[#6b7589] uppercase tracking-wide mb-3">Select Application to Analyse</div>
          <div className="flex gap-3">
            {applications.map((a, i) => (
              <button key={a.id} onClick={() => { setSelectedAppIdx(i); setSelectedAssetIdx(0); }}
                className={`flex-1 text-left px-4 py-3 rounded-lg border transition-all ${
                  selectedAppIdx === i
                    ? "border-[#1e3a5f] bg-[#f0f4fa]"
                    : "border-[#dde1e9] hover:border-[#1e3a5f]/40 hover:bg-[#f9fafb]"
                }`}>
                <div className={`text-[12px] font-bold mb-0.5 ${selectedAppIdx === i ? "text-[#1e3a5f]" : "text-[#1a1d23]"}`}>{a.name}</div>
                <div className="text-[10px] text-[#6b7589]">{a.assets} cryptographic assets · {a.dataLifetimeLabel} data</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {/* Ranked bar chart */}
          <div className="col-span-3 bg-white border border-[#dde1e9] rounded-lg p-5">
            <div className="text-[13px] font-semibold text-[#1a1d23] mb-0.5">
              Cryptographic Asset Priority — {app.name}
            </div>
            <div className="text-[11px] text-[#6b7589] mb-4">Click a bar to view detailed factor breakdown</div>
            <ResponsiveContainer width="100%" height={224}>
              <BarChart
                data={barData}
                layout="vertical"
                barSize={20}
                onClick={(d: any) => {
                  if (d?.activePayload) {
                    const idx = assets.findIndex(a => a.asset === d.activePayload[0].payload.name);
                    if (idx >= 0) setSelectedAssetIdx(idx);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#9aa1b1" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#6b7589" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: "#dde1e9", borderRadius: 6 }}
                  formatter={(v) => [v, "Priority Score"]}
                  labelFormatter={(l, p) => p[0]?.payload?.name ?? l}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Asset selector tabs */}
            <div className="mt-4 pt-3 border-t border-[#f0f2f5]">
              <div className="text-[10px] text-[#6b7589] mb-2 font-medium">Select asset:</div>
              <div className="flex flex-wrap gap-1.5">
                {assets.map((a, i) => (
                  <button key={i} onClick={() => setSelectedAssetIdx(i)}
                    className={`text-[10px] px-2.5 py-0.5 rounded font-medium border transition-colors ${
                      selectedAssetIdx === i ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-[#f5f6f8] text-[#6b7589] border-[#dde1e9] hover:border-[#1e3a5f]/40"
                    }`}>
                    {a.asset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Explanation panel */}
          {sel && (
            <div className="col-span-2 bg-white border border-[#dde1e9] rounded-lg p-5">
              <div className="text-[10px] text-[#6b7589] uppercase tracking-wide font-medium mb-1">Cryptographic Asset</div>
              <div className="text-[14px] font-bold text-[#1a1d23] mb-0.5">{sel.asset}</div>
              <div className="text-[11px] text-[#6b7589] mb-3">{sel.component}</div>

              <div className="flex items-center gap-2 mb-4">
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rankBadge[sel.rank]}`}>Migration Priority {sel.rank}</div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyBadge[sel.urgency]}`}>{sel.urgency}</span>
              </div>

              <div className="text-[11px] font-semibold text-[#1a1d23] mb-2">Factor Breakdown</div>
              <div className="space-y-2 mb-4">
                {[
                  { label: "Quantum Risk", value: sel.quantumRisk, color: "bg-red-400" },
                  { label: "Business Criticality", value: sel.criticality, color: "bg-orange-400" },
                  { label: "Dependency Impact", value: sel.depImpact, color: "bg-blue-400" },
                  { label: "Data Lifetime Exposure", value: sel.dataLifetime, color: "bg-amber-400" },
                  { label: "Migration Complexity", value: sel.migrationComplexity, color: "bg-slate-400" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#6b7589]">{item.label}</span>
                      <span className="font-medium text-[#1a1d23]">{item.value}</span>
                    </div>
                    <div className="h-1.5 bg-[#eef0f3] rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px] bg-[#f9fafb] border border-[#dde1e9] rounded-md p-3">
                {[
                  sel.quantumVuln ? "✓ Quantum-vulnerable algorithm (Shor's algorithm applicable)" : null,
                  sel.dataLifetime >= 80 ? "✓ Long data protection lifetime — high exposure window" : null,
                  sel.criticality >= 80 ? "✓ Critical or high business criticality system" : null,
                  sel.depImpact >= 70 ? "✓ High dependency impact — migration affects downstream services" : null,
                  sel.urgency === "Urgent" ? "✓ Migration urgency: Urgent — action recommended" : null,
                ].filter(Boolean).map((reason, i) => (
                  <div key={i} className="text-[#0d7a6b]">{reason}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Asset table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg">
          <div className="px-5 py-4 border-b border-[#dde1e9]">
            <div className="text-[13px] font-semibold text-[#1a1d23]">Migration Priority Table — {app.name}</div>
            <div className="text-[11px] text-[#6b7589] mt-0.5">Cryptographic assets ranked by combined migration urgency score within this application</div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#dde1e9] bg-[#f9fafb]">
                {["Rank", "Cryptographic Asset", "Component", "Quantum Risk", "Data Lifetime", "Criticality", "Dep. Impact", "Score", "Action"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <tr key={i}
                  onClick={() => setSelectedAssetIdx(i)}
                  className={`border-b border-[#f0f2f5] cursor-pointer transition-colors ${selectedAssetIdx === i ? "bg-blue-50/50" : "hover:bg-blue-50/30"}`}>
                  <td className="px-4 py-3">
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block ${rankBadge[a.rank]}`}>P{a.rank}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[12px] font-bold text-[#1e3a5f]">{a.asset}</div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[#6b7589]">{a.component}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${a.quantumRisk >= 80 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {a.quantumRisk >= 80 ? "High" : "Medium"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] font-medium text-[#1a1d23]">{app.dataLifetimeLabel}</td>
                  <td className="px-4 py-3 text-[11px] font-medium text-[#1a1d23]">{app.criticality}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-[#eef0f3] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#1e3a5f]/60" style={{ width: `${a.depImpact}%` }} />
                      </div>
                      <span className="text-[11px] font-medium text-[#1a1d23]">{a.depImpact}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-[#eef0f3] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.score}%`, backgroundColor: urgencyColors[a.urgency] }} />
                      </div>
                      <span className="text-[12px] font-bold text-[#1a1d23]">{a.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyBadge[a.urgency]}`}>{a.urgency}</span>
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
