import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { applications } from "../data/mock";

const TODAY = 2026;

const urgencyConfig: Record<string, { cls: string; dot: string }> = {
  Urgent: { cls: "bg-red-50 text-red-700 border border-red-200", dot: "bg-red-500" },
  Monitor: { cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
  Lower: { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
};

function calcUrgency(app: typeof applications[0], horizon: number): string {
  const migEnd = TODAY + app.migrationDuration;
  const dataEnd = TODAY + app.dataLifetime;
  const riskYear = TODAY + horizon;
  if (migEnd > riskYear || dataEnd > riskYear) return "Urgent";
  if (dataEnd > riskYear - 2) return "Monitor";
  return "Lower";
}

function MoscaTimeline({ horizon }: { horizon: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const W = ref.current.clientWidth || 800;
    const rowH = 64;
    const labelW = 190;
    const H = applications.length * rowH + 60;
    const marginTop = 50;
    const marginRight = 30;

    const endYear = TODAY + Math.max(horizon + 2, ...applications.map(a => Math.max(a.migrationDuration, a.dataLifetime))) + 1;
    const x = d3.scaleLinear().domain([TODAY, endYear]).range([labelW, W - marginRight]);

    svg.attr("height", H);

    // Background
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "none");

    // Gridlines
    const ticks = d3.range(TODAY, endYear + 1, 1);
    ticks.forEach(yr => {
      svg.append("line")
        .attr("x1", x(yr)).attr("x2", x(yr))
        .attr("y1", marginTop - 8).attr("y2", H - 10)
        .attr("stroke", yr === TODAY + horizon ? "none" : "#eef0f3")
        .attr("stroke-dasharray", "3 3");
    });

    // Risk horizon line
    const hx = x(TODAY + horizon);
    svg.append("line").attr("x1", hx).attr("x2", hx).attr("y1", marginTop - 10).attr("y2", H - 10)
      .attr("stroke", "#c0392b").attr("stroke-width", 2).attr("stroke-dasharray", "6 3");

    svg.append("text").attr("x", hx + 5).attr("y", marginTop - 14)
      .attr("fill", "#c0392b").attr("font-size", "10px").attr("font-family", "Inter, sans-serif").attr("font-weight", "600")
      .text("Quantum Risk Horizon (Assumption)");

    // Today label
    svg.append("text").attr("x", x(TODAY)).attr("y", marginTop - 14)
      .attr("fill", "#1e3a5f").attr("font-size", "10px").attr("font-family", "Inter, sans-serif").attr("font-weight", "600")
      .attr("text-anchor", "middle").text("TODAY");

    // X axis years
    ticks.filter(t => t % 2 === 0 || t === TODAY).forEach(yr => {
      svg.append("text").attr("x", x(yr)).attr("y", H - 0)
        .attr("fill", "#9aa1b1").attr("font-size", "9px").attr("font-family", "JetBrains Mono, monospace")
        .attr("text-anchor", "middle").text(yr);
    });

    // Rows
    applications.forEach((app, i) => {
      const y0 = marginTop + i * rowH;
      const urgency = calcUrgency(app, horizon);
      const migColor = urgency === "Urgent" ? "#c0392b" : urgency === "Monitor" ? "#d97706" : "#0d7a6b";

      // App label
      svg.append("text").attr("x", labelW - 10).attr("y", y0 + 20)
        .attr("fill", "#1a1d23").attr("font-size", "11px").attr("font-family", "Inter, sans-serif").attr("font-weight", "600")
        .attr("text-anchor", "end").text(app.name.length > 26 ? app.name.slice(0, 24) + "…" : app.name);

      // Migration bar
      const migStart = x(TODAY);
      const migEnd = x(TODAY + app.migrationDuration);
      svg.append("rect").attr("x", migStart).attr("y", y0 + 6).attr("width", migEnd - migStart).attr("height", 12)
        .attr("fill", migColor).attr("opacity", 0.85).attr("rx", 3);
      svg.append("text").attr("x", (migStart + migEnd) / 2).attr("y", y0 + 15.5)
        .attr("fill", "white").attr("font-size", "8px").attr("font-family", "Inter, sans-serif").attr("font-weight", "600")
        .attr("text-anchor", "middle").text("Migration");

      // Data lifetime bar
      const dataEnd = x(TODAY + app.dataLifetime);
      svg.append("rect").attr("x", migStart).attr("y", y0 + 24).attr("width", dataEnd - migStart).attr("height", 12)
        .attr("fill", "#344c6e").attr("opacity", 0.5).attr("rx", 3);
      svg.append("text").attr("x", (migStart + dataEnd) / 2).attr("y", y0 + 33.5)
        .attr("fill", "white").attr("font-size", "8px").attr("font-family", "Inter, sans-serif")
        .attr("text-anchor", "middle").text("Data Lifetime");

      // Urgency badge
      const badgeX = W - marginRight - 80;
      const urgencyLabel = urgency === "Lower" ? "Lower Urgency" : urgency;
      svg.append("rect").attr("x", badgeX).attr("y", y0 + 8).attr("width", 78).attr("height", 18)
        .attr("fill", urgency === "Urgent" ? "#fee2e2" : urgency === "Monitor" ? "#fef3c7" : "#d1fae5")
        .attr("stroke", urgency === "Urgent" ? "#fca5a5" : urgency === "Monitor" ? "#fcd34d" : "#6ee7b7")
        .attr("stroke-width", 1).attr("rx", 9);
      svg.append("text").attr("x", badgeX + 39).attr("y", y0 + 20)
        .attr("fill", urgency === "Urgent" ? "#b91c1c" : urgency === "Monitor" ? "#b45309" : "#065f46")
        .attr("font-size", "9px").attr("font-family", "Inter, sans-serif").attr("font-weight", "700")
        .attr("text-anchor", "middle").text(urgencyLabel);
    });

  }, [horizon]);

  return <svg ref={ref} className="w-full" />;
}

export default function RiskTimeline() {
  const [horizon, setHorizon] = useState(8);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* Methodology note */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1a1d23] mb-1">Mosca-Based Risk Timeline</div>
              <p className="text-[11px] text-[#6b7589] leading-relaxed">
                This visualization compares each application's <strong className="text-[#1a1d23]">data protection lifetime</strong> and <strong className="text-[#1a1d23]">estimated migration duration</strong> against a configurable <strong className="text-[#1a1d23]">quantum risk horizon assumption</strong>.
                CRYPTAVISTA does not predict the exact arrival date of a cryptographically relevant quantum computer — it assesses urgency based on configurable scenario assumptions.
                If an application's migration or data lifetime bar extends past the risk horizon line, action is recommended.
              </p>
            </div>
            <div className="flex-shrink-0 bg-[#f5f6f8] rounded-lg px-4 py-3 text-center min-w-[160px]">
              <div className="text-[10px] text-[#6b7589] uppercase tracking-wide font-medium mb-1">Risk Horizon Assumption</div>
              <div className="text-2xl font-bold text-[#1e3a5f]">{horizon} years</div>
              <input type="range" min={4} max={15} value={horizon} onChange={e => setHorizon(Number(e.target.value))}
                className="w-full mt-2 accent-[#1e3a5f]" />
              <div className="text-[9px] text-[#9aa1b1] mt-0.5">{TODAY} → {TODAY + horizon}</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-5 text-[10px] text-[#6b7589]">
          <span className="flex items-center gap-2"><span className="w-8 h-3 rounded bg-red-500 opacity-85 inline-block" /> Migration Duration (Urgent)</span>
          <span className="flex items-center gap-2"><span className="w-8 h-3 rounded bg-[#344c6e] opacity-50 inline-block" /> Data Protection Lifetime</span>
          <span className="flex items-center gap-2"><span className="w-px h-4 bg-red-500 inline-block" style={{ borderStyle: "dashed" }} /> Risk Horizon Assumption</span>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5 overflow-x-auto">
          <MoscaTimeline horizon={horizon} />
        </div>

        {/* Urgency table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg">
          <div className="px-5 py-3 border-b border-[#dde1e9] text-[12px] font-semibold text-[#1a1d23]">Per-Application Urgency Summary</div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#dde1e9] bg-[#f9fafb]">
                {["Application", "Migration Duration", "Data Lifetime", "Migration End", "Data Expires", "Urgency"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((app, i) => {
                const urgency = calcUrgency(app, horizon);
                const cfg = urgencyConfig[urgency];
                return (
                  <tr key={i} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb]">
                    <td className="px-4 py-3 text-[12px] font-medium text-[#1a1d23]">{app.name}</td>
                    <td className="px-4 py-3 text-[12px] mono text-[#6b7589]">~{app.migrationDuration} years</td>
                    <td className="px-4 py-3 text-[12px] mono text-[#6b7589]">{app.dataLifetime} years</td>
                    <td className="px-4 py-3 text-[11px] mono text-[#1a1d23]">{TODAY + app.migrationDuration}</td>
                    <td className="px-4 py-3 text-[11px] mono text-[#1a1d23]">{TODAY + app.dataLifetime}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${cfg.cls}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {urgency === "Lower" ? "Lower Urgency" : urgency}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
