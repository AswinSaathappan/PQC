import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ScatterChart, Scatter, Cell, PieChart, Pie, Legend } from "recharts";
import { applications } from "../data/mock";

const riskColors: Record<string, string> = {
  Critical: "#c0392b", High: "#e05252", Medium: "#d97706", Lower: "#0d7a6b",
};

const riskScore: Record<string, number> = {
  Critical: 95, High: 80, Medium: 45, Lower: 20,
};

const critScore: Record<string, number> = {
  Critical: 100, High: 80, Medium: 50, Low: 20,
};

const chartData = applications.map(a => ({
  name: a.name.split(" ").slice(0, 2).join(" "),
  fullName: a.name,
  quantumRisk: riskScore[a.quantumRisk],
  criticality: critScore[a.criticality],
  migrationDuration: a.migrationDuration,
  dataLifetime: a.dataLifetime,
  color: riskColors[a.quantumRisk],
}));

const distData = [
  { name: "Critical", value: 1, color: "#c0392b" },
  { name: "High", value: 2, color: "#e05252" },
  { name: "Medium", value: 1, color: "#d97706" },
  { name: "Lower", value: 1, color: "#0d7a6b" },
];

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const r = 8 + payload.migrationDuration * 4;
  return <circle cx={cx} cy={cy} r={r} fill={payload.color} fillOpacity={0.7} stroke={payload.color} strokeWidth={1.5} />;
};

export default function QuantumRisk() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* App risk bars */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
          <div className="text-[13px] font-semibold text-[#1a1d23] mb-1">Quantum Risk by Application</div>
          <div className="text-[11px] text-[#6b7589] mb-4">Normalized quantum risk score across analyzed enterprise applications</div>
          <ResponsiveContainer width="100%" height={192}>
              <BarChart data={chartData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7589" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9aa1b1" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderColor: "#dde1e9", borderRadius: 6 }}
                  formatter={(v, n) => [v, "Risk Score"]}
                  labelFormatter={(l, p) => p[0]?.payload?.fullName ?? l} />
                <Bar dataKey="quantumRisk" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Scatter: Risk vs Criticality */}
          <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
            <div className="text-[13px] font-semibold text-[#1a1d23] mb-1">Risk vs Business Criticality</div>
            <div className="text-[11px] text-[#6b7589] mb-4">Bubble size = migration duration · Color = quantum risk level</div>
              <ResponsiveContainer width="100%" height={208}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                  <XAxis dataKey="criticality" name="Business Criticality" domain={[0, 110]} tick={{ fontSize: 10, fill: "#9aa1b1" }} label={{ value: "Criticality →", position: "insideBottom", offset: -4, fontSize: 10, fill: "#9aa1b1" }} />
                  <YAxis dataKey="quantumRisk" name="Quantum Risk" domain={[0, 110]} tick={{ fontSize: 10, fill: "#9aa1b1" }} label={{ value: "Quantum Risk →", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9aa1b1" }} />
                  <Tooltip cursor={false} content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-[#dde1e9] rounded-md p-2.5 text-[11px] shadow-md">
                        <div className="font-semibold text-[#1a1d23] mb-1">{d.fullName}</div>
                        <div className="text-[#6b7589]">Risk Score: {d.quantumRisk}</div>
                        <div className="text-[#6b7589]">Migration: {d.migrationDuration}yr</div>
                      </div>
                    );
                  }} />
                  <Scatter data={chartData} shape={<CustomDot />} />
                </ScatterChart>
              </ResponsiveContainer>
          </div>

          {/* Risk distribution */}
          <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
            <div className="text-[13px] font-semibold text-[#1a1d23] mb-1">Risk Distribution</div>
            <div className="text-[11px] text-[#6b7589] mb-4">Applications by quantum risk level</div>
              <ResponsiveContainer width="100%" height={208}>
                <PieChart>
                  <Pie data={distData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" stroke="none">
                    {distData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} application${Number(v) > 1 ? "s" : ""}`, ""]} contentStyle={{ fontSize: 12, borderColor: "#dde1e9", borderRadius: 6 }} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "#6b7589" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
          </div>
        </div>

        {/* Per-app risk cards */}
        <div className="grid grid-cols-5 gap-3">
          {applications.map(app => (
            <div key={app.id} className="bg-white border border-[#dde1e9] rounded-lg p-4">
              <div className="text-[11px] font-semibold text-[#1a1d23] mb-2 leading-tight">{app.name}</div>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { label: "Quantum Risk", value: app.quantumRisk, risk: app.quantumRisk },
                  { label: "Data Lifetime", value: `${app.dataLifetime} yr` },
                  { label: "Criticality", value: app.criticality },
                  { label: "Runtime Coverage", value: `${app.runtimeCoverage}%` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-[#6b7589]">{item.label}</span>
                    <span className={`font-semibold ${item.risk ? `text-[${riskColors[item.risk]}]` : "text-[#1a1d23]"}`} style={item.risk ? { color: riskColors[item.risk] } : undefined}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
