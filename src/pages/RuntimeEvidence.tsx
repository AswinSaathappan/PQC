import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { Activity, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { runtimeEvents, applications } from "../data/mock";

const statusConfig: Record<string, { cls: string; dot: string; icon: React.ElementType }> = {
  "Observed": { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle },
  "Not Observed in Current Execution": { cls: "bg-slate-100 text-slate-600 border border-slate-200", dot: "bg-slate-400", icon: AlertCircle },
  "Inconclusive": { cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-400", icon: HelpCircle },
};

function TimelineChart({ events, appFilter }: { events: typeof runtimeEvents; appFilter: string }) {
  const ref = useRef<SVGSVGElement>(null);

  const filtered = events.filter(e => appFilter === "All" || e.app === appFilter);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const W = ref.current.clientWidth || 700;
    const H = 160;
    const margin = { left: 60, right: 20, top: 20, bottom: 30 };

    // Parse times
    const parseTime = (t: string) => {
      const [h, m, s] = t.split(":").map(Number);
      return h * 3600 + m * 60 + s;
    };

    const times = filtered.map(e => parseTime(e.time));
    const minT = Math.min(...times);
    const maxT = Math.max(...times) + 60;

    const x = d3.scaleLinear().domain([minT, maxT]).range([margin.left, W - margin.right]);
    const y = d3.scaleBand().domain(filtered.map((_, i) => String(i))).range([margin.top, H - margin.bottom]).padding(0.3);

    const g = svg.append("g");

    // Gridlines
    g.append("g").attr("class", "grid")
      .selectAll("line")
      .data(x.ticks(6))
      .join("line")
      .attr("x1", d => x(d)).attr("x2", d => x(d))
      .attr("y1", margin.top).attr("y2", H - margin.bottom)
      .attr("stroke", "#dde1e9").attr("stroke-dasharray", "3 3");

    // X axis
    g.append("g").attr("transform", `translate(0,${H - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((d) => {
        const t = Number(d);
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = t % 60;
        return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
      }))
      .call(g => g.select(".domain").attr("stroke", "#dde1e9"))
      .call(g => g.selectAll(".tick line").attr("stroke", "#dde1e9"))
      .call(g => g.selectAll(".tick text").style("font-size", "9px").style("fill", "#9aa1b1").style("font-family", "JetBrains Mono, monospace"));

    // Event dots
    filtered.forEach((ev, i) => {
      const t = parseTime(ev.time);
      const fill = ev.status === "Observed" ? "#0d7a6b" : ev.status === "Inconclusive" ? "#d97706" : "#94a3b8";

      g.append("circle")
        .attr("cx", x(t)).attr("cy", (y(String(i)) ?? 0) + y.bandwidth() / 2)
        .attr("r", 6).attr("fill", fill).attr("stroke", "white").attr("stroke-width", 2);

      g.append("text")
        .attr("x", x(t) + 10).attr("y", (y(String(i)) ?? 0) + y.bandwidth() / 2 + 3)
        .style("font-size", "9px").style("fill", "#6b7589").style("font-family", "Inter, sans-serif")
        .text(`${ev.algorithm} · ${ev.operation}`);
    });

  }, [filtered]);

  return (
    <svg ref={ref} className="w-full" style={{ height: 160 }} />
  );
}

export default function RuntimeEvidence() {
  const [appFilter, setAppFilter] = useState("All");
  const [selected, setSelected] = useState(0);

  const filtered = runtimeEvents.filter(e => appFilter === "All" || e.app === appFilter);
  const sel = filtered[selected] ?? filtered[0];

  const counts = { obs: runtimeEvents.filter(e => e.status === "Observed").length, not: runtimeEvents.filter(e => e.status === "Not Observed in Current Execution").length, inc: runtimeEvents.filter(e => e.status === "Inconclusive").length };

  return (
    <div className="relative flex-1 h-full overflow-hidden bg-[#f5f6f8]">
      {/* ============================================================ */}
      {/* UNDER DEVELOPMENT OVERLAY                                    */}
      {/* Fully obscures the underlying page and prevents interaction.  */}
      {/* ============================================================ */}
      <div 
        className="absolute inset-0 z-50 flex items-center justify-center p-4 select-none"
        style={{ backgroundColor: "rgba(248, 250, 252, 0.98)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="runtime-dev-title"
      >
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          {/* Progress / Development Icon */}
          <div className="w-12 h-12 rounded-xl bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 flex items-center justify-center text-[#1e3a5f] mx-auto mb-4">
            <Activity className="w-6 h-6 text-[#1e3a5f]" />
          </div>

          {/* Modal Header */}
          <h2 id="runtime-dev-title" className="text-lg font-bold text-[#1a1d23] mb-3">
            Runtime Evidence Under Development
          </h2>

          {/* Main Message */}
          <p className="text-[13px] font-medium text-[#334155] mb-2 leading-relaxed">
            Runtime evidence analysis is currently under development.
          </p>

          {/* Secondary Message */}
          <p className="text-[12px] text-[#64748b] mb-6 leading-relaxed">
            Runtime evidence collection and validation are being integrated with the cryptographic analysis pipeline.
          </p>

          {/* Status Label */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            In Progress
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* EXISTING RUNTIME EVIDENCE PAGE CONTENT                      */}
      {/* Preserved completely intact; obscured and non-interactive.  */}
      {/* ============================================================ */}
      <div 
        className="h-full overflow-hidden pointer-events-none select-none opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      >
        <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* Key distinction */}
        <div className="bg-[#1e3a5f] rounded-lg px-5 py-4">
          <div className="text-white text-[13px] font-semibold mb-2">Static Discovery ≠ Runtime Observation</div>
          <div className="grid grid-cols-3 gap-4 text-[11px]">
            <div className="bg-white/5 rounded-md px-3 py-2">
              <div className="text-white font-semibold mb-0.5">Static Discovery</div>
              <div className="text-blue-200/60">Cryptographic artefacts found in scanned source code, binaries, and dependencies.</div>
            </div>
            <div className="bg-white/5 rounded-md px-3 py-2">
              <div className="text-white font-semibold mb-0.5">Runtime Evidence</div>
              <div className="text-blue-200/60">Cryptographic operations observed during a specific monitored execution scenario.</div>
            </div>
            <div className="bg-white/5 rounded-md px-3 py-2">
              <div className="text-white font-semibold mb-0.5">Not Observed ≠ Not Used</div>
              <div className="text-blue-200/60">An artefact not observed in the current execution may be used in other execution paths.</div>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Monitoring Status", value: "Active", sub: "Enterprise Portal session" },
            { label: "Observed", value: counts.obs, sub: "operations confirmed" },
            { label: "Not Observed (Current)", value: counts.not, sub: "in this execution path" },
            { label: "Inconclusive", value: counts.inc, sub: "insufficient data" },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-[#dde1e9] rounded-lg p-4">
              <div className="text-[10px] text-[#6b7589] uppercase tracking-wide font-medium mb-1">{item.label}</div>
              <div className="flex items-center gap-2">
                {i === 0 && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                <span className="text-xl font-bold text-[#1a1d23]">{item.value}</span>
              </div>
              <div className="text-[10px] text-[#6b7589] mt-0.5">{item.sub}</div>
            </div>
          ))}
        </div>

        {/* D3 event timeline */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-semibold text-[#1a1d23]">Cryptographic Operation Timeline</div>
              <div className="text-[11px] text-[#6b7589]">Operations observed during the monitored execution window</div>
            </div>
            <div className="flex gap-2">
              {["All", ...applications.map(a => a.name)].map(opt => (
                <button key={opt} onClick={() => { setAppFilter(opt); setSelected(0); }}
                  className={`text-[10px] px-2.5 py-1 rounded font-medium transition-colors ${appFilter === opt ? "bg-[#1e3a5f] text-white" : "bg-[#f5f6f8] text-[#6b7589] border border-[#dde1e9] hover:bg-[#eef0f3]"}`}>
                  {opt === "All" ? "All Apps" : opt.split(" ").slice(0, 2).join(" ")}
                </button>
              ))}
            </div>
          </div>
          <TimelineChart events={runtimeEvents} appFilter={appFilter === "All" ? "All" : appFilter} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Events table */}
          <div className="col-span-2 bg-white border border-[#dde1e9] rounded-lg">
            <div className="px-5 py-3 border-b border-[#dde1e9] text-[12px] font-semibold text-[#1a1d23]">Observed Operations</div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dde1e9] bg-[#f9fafb]">
                  {["Time", "Application", "Component", "Operation", "Algorithm", "Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row: any, i: number) => {
                  const cfg = statusConfig[row.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={i} onClick={() => setSelected(i)}
                      className={`border-b border-[#f0f2f5] cursor-pointer transition-colors ${selected === i ? "bg-blue-50" : "hover:bg-[#f9fafb]"}`}>
                      <td className="px-3 py-2.5 text-[10px] mono text-[#6b7589]">{row.time}</td>
                      <td className="px-3 py-2.5 text-[11px] text-[#1a1d23] font-medium">{row.app.split(" ").slice(0,2).join(" ")}</td>
                      <td className="px-3 py-2.5 text-[11px] text-[#6b7589]">{row.component}</td>
                      <td className="px-3 py-2.5 text-[11px] text-[#1a1d23]">{row.operation}</td>
                      <td className="px-3 py-2.5 text-[10px] mono text-[#1e3a5f] font-medium">{row.algorithm}</td>
                      <td className="px-3 py-2.5">
                        <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${cfg.cls}`}>
                          <Icon size={9} />
                          {row.status === "Not Observed in Current Execution" ? "Not Observed" : row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Evidence link panel */}
          {sel && (
            <div className="bg-white border border-[#dde1e9] rounded-lg p-5 space-y-4">
              <div className="text-[12px] font-semibold text-[#1a1d23]">Evidence Chain</div>
              {[
                { label: "Static Discovery", value: `${sel.algorithm} found in scanned artefacts`, dot: "bg-[#1e3a5f]" },
                { label: "Runtime Event", value: `${sel.operation} at ${sel.time}`, dot: "bg-emerald-500" },
                { label: "Evidence Status", value: sel.status, dot: statusConfig[sel.status].dot },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full ${item.dot} flex-shrink-0`} />
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-[#6b7589]">{item.label}</div>
                  </div>
                  <div className={`bg-[#f5f6f8] rounded-md px-3 py-2 text-[11px] text-[#1a1d23] ${i < 2 ? "mb-2" : ""}`}>{item.value}</div>
                  {i < 2 && <div className="text-center text-[#dde1e9] text-lg leading-none">↓</div>}
                </div>
              ))}
              <div className="border-t border-[#f0f2f5] pt-3">
                <div className="text-[10px] text-[#6b7589] mb-1 font-medium">Application</div>
                <div className="text-[12px] font-medium text-[#1a1d23]">{sel.app}</div>
                <div className="text-[10px] text-[#6b7589] mt-1">{sel.component}</div>
              </div>
            </div>
          )}
        </div>

        </div>
      </div>
    </div>
  );
}
