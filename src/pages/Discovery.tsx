import { useState } from "react";
import { Search, Download, CheckCircle } from "lucide-react";
import { discoveryFindings, applications } from "../data/mock";

const confBadge: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-slate-100 text-slate-600 border border-slate-200",
};

const sourceStats = [
  { label: "Source Code", count: 1240, found: 423 },
  { label: "Binaries", count: 34, found: 187 },
  { label: "Libraries", count: 89, found: 388 },
  { label: "Container Images", count: 12, found: 328 },
  { label: "Dependencies", count: 312, found: 521 },
];

const artefactTypes = ["Algorithms", "Keys", "Certificates", "Protocols", "Crypto Libraries", "HSMs", "Cloud Crypto Services"];

export default function Discovery() {
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("All Applications");
  const [typeFilter, setTypeFilter] = useState("All Types");

  const appOptions = ["All Applications", ...applications.map(a => a.name)];
  const typeOptions = ["All Types", "Algorithm", "Crypto Library", "Protocol"];

  const filtered = discoveryFindings.filter(f => {
    const matchSearch = !search || f.artefact.toLowerCase().includes(search.toLowerCase()) || f.algorithm.toLowerCase().includes(search.toLowerCase()) || f.app.toLowerCase().includes(search.toLowerCase());
    const matchApp = appFilter === "All Applications" || f.app === appFilter;
    const matchType = typeFilter === "All Types" || f.type === typeFilter;
    return matchSearch && matchApp && matchType;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* Discovery sources */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-semibold text-[#1a1d23]">Discovery Sources</div>
              <div className="text-[11px] text-[#6b7589]">All sources scanned across 5 applications</div>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
              <CheckCircle size={12} /> Complete
            </span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {sourceStats.map((s, i) => (
              <div key={i} className="bg-[#f5f6f8] rounded-md p-3">
                <div className="text-[10px] text-[#6b7589] font-medium mb-1">{s.label}</div>
                <div className="text-xl font-bold text-[#1e3a5f]">{s.found}</div>
                <div className="text-[10px] text-[#6b7589]">{s.count} files scanned</div>
              </div>
            ))}
          </div>
        </div>

        {/* Artefact types */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-4">
          <div className="text-[11px] text-[#6b7589] font-medium uppercase tracking-wide mb-3">Discovered Artefact Categories</div>
          <div className="flex gap-2 flex-wrap">
            {artefactTypes.map(t => (
              <span key={t} className="text-[11px] bg-[#f5f6f8] border border-[#dde1e9] text-[#1a1d23] px-3 py-1 rounded-full font-medium">{t}</span>
            ))}
          </div>
        </div>

        {/* Findings table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg">
          <div className="px-5 py-4 border-b border-[#dde1e9] flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1a1d23]">Discovery Findings</div>
              <div className="text-[11px] text-[#6b7589]">{filtered.length} artefacts</div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#f5f6f8] border border-[#dde1e9] rounded-md px-3 py-1.5 w-44">
              <Search size={12} className="text-[#6b7589]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artefacts..." className="bg-transparent text-[12px] outline-none flex-1 placeholder-[#9aa1b1]" />
            </div>
            <select value={appFilter} onChange={e => setAppFilter(e.target.value)} className="text-[12px] border border-[#dde1e9] rounded-md px-2 py-1.5 bg-white outline-none text-[#1a1d23]">
              {appOptions.map(o => <option key={o}>{o}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="text-[12px] border border-[#dde1e9] rounded-md px-2 py-1.5 bg-white outline-none text-[#1a1d23]">
              {typeOptions.map(o => <option key={o}>{o}</option>)}
            </select>
            <button className="flex items-center gap-1.5 text-[11px] text-[#6b7589] border border-[#dde1e9] px-3 py-1.5 rounded-md hover:bg-[#f5f6f8]">
              <Download size={12} /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dde1e9] bg-[#f9fafb]">
                  {["Artefact", "Type", "Algorithm / Tech", "Version", "Mode", "Source", "Location", "Application", "Confidence"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors">
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-[#1e3a5f] mono">{row.artefact}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[#6b7589]">{row.type}</td>
                    <td className="px-3 py-2.5 text-[11px] mono text-[#1a1d23]">{row.algorithm}</td>
                    <td className="px-3 py-2.5 text-[10px] mono text-[#6b7589]">{row.version}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[#6b7589]">{row.mode}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[#6b7589]">{row.source}</td>
                    <td className="px-3 py-2.5 text-[10px] mono text-[#6b7589] max-w-[160px] truncate">{row.location}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[#1a1d23] font-medium whitespace-nowrap">{row.app}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${confBadge[row.confidence]}`}>{row.confidence}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
