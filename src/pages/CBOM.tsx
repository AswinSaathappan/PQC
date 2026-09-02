import { useState } from "react";
import { Download, Search, Filter } from "lucide-react";
import { cbomMatrix, applications, discoveryFindings } from "../data/mock";

const riskByAlgo: Record<string, string> = {
  "RSA-2048": "High", "ECDSA P-256": "High", "3DES": "High",
  "AES-128": "Medium", "TLS 1.2": "Medium", "HMAC-SHA1": "Medium", "MD5": "Medium",
  "AES-256": "Low", "TLS 1.3": "Low", "SHA-256": "Low",
};

const cellColor = (present: number, algo: string) => {
  if (!present) return "bg-[#f5f6f8]";
  const risk = riskByAlgo[algo];
  if (risk === "High") return "bg-red-100";
  if (risk === "Medium") return "bg-amber-50";
  return "bg-emerald-50";
};

export default function CBOM() {
  const [appFilter, setAppFilter] = useState("All Applications");
  const [search, setSearch] = useState("");

  const appOptions = ["All Applications", ...applications.map(a => a.name)];

  const filtered = discoveryFindings.filter(f => {
    const matchSearch = !search || f.artefact.toLowerCase().includes(search.toLowerCase());
    const matchApp = appFilter === "All Applications" || f.app === appFilter;
    return matchSearch && matchApp;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        {/* Intro */}
        <div className="bg-[#1e3a5f] rounded-lg px-5 py-4">
          <div className="text-white text-[13px] font-semibold mb-1">Cryptographic Bill of Materials</div>
          <div className="text-blue-200/65 text-[11px] leading-relaxed">
            The CBOM is the central output of cryptographic discovery. It catalogs every cryptographic artefact found across your enterprise applications — algorithms, protocols, libraries, keys, and certificates — providing the foundation for risk assessment and migration planning.
          </div>
        </div>

        {/* Algorithm × Application heatmap */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-semibold text-[#1a1d23]">Algorithm Coverage Matrix</div>
              <div className="text-[11px] text-[#6b7589] mt-0.5">Which cryptographic algorithms are present in each application</div>
            </div>
            <div className="flex gap-3 text-[10px] text-[#6b7589]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block border border-red-200" /> Quantum-Vulnerable</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 inline-block border border-amber-200" /> Classical Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 inline-block border border-emerald-200" /> Safe</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f5f6f8] inline-block border border-[#dde1e9]" /> Not Present</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide w-40">Algorithm / Tech</th>
                  {cbomMatrix.apps.map(app => (
                    <th key={app} className="px-2 py-2 text-center text-[10px] font-semibold text-[#6b7589] min-w-[120px]">
                      <div className="truncate max-w-[110px] mx-auto" title={app}>{app.split(" ").slice(0, 2).join(" ")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cbomMatrix.algorithms.map((algo, ai) => (
                  <tr key={algo} className="border-t border-[#f0f2f5]">
                    <td className="px-3 py-2.5 font-medium mono text-[#1e3a5f] text-[11px]">{algo}</td>
                    {cbomMatrix.apps.map((app, appi) => {
                      const present = cbomMatrix.matrix[appi][ai];
                      return (
                        <td key={app} className="px-2 py-2.5 text-center">
                          <div className={`mx-auto w-6 h-6 rounded flex items-center justify-center ${cellColor(present, algo)}`}>
                            {present ? <span className="text-[11px] font-bold text-current">✓</span> : <span className="text-[#dde1e9] text-[11px]">—</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full CBOM table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg">
          <div className="px-5 py-4 border-b border-[#dde1e9] flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1a1d23]">Complete CBOM</div>
              <div className="text-[11px] text-[#6b7589]">{filtered.length} entries</div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#f5f6f8] border border-[#dde1e9] rounded-md px-3 py-1.5 w-44">
              <Search size={12} className="text-[#6b7589]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artefacts..." className="bg-transparent text-[12px] outline-none flex-1 placeholder-[#9aa1b1]" />
            </div>
            <select value={appFilter} onChange={e => setAppFilter(e.target.value)} className="text-[12px] border border-[#dde1e9] rounded-md px-2 py-1.5 bg-white outline-none text-[#1a1d23]">
              {appOptions.map(o => <option key={o}>{o}</option>)}
            </select>
            <button className="flex items-center gap-1.5 text-[11px] text-white bg-[#1e3a5f] px-3 py-1.5 rounded-md hover:bg-[#162e4d]">
              <Download size={12} /> Export CBOM
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dde1e9] bg-[#f9fafb]">
                  {["Application", "Artefact", "Type", "Algorithm", "Version", "Mode", "Protocol", "Library", "Location", "Source", "Confidence"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#6b7589] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb]">
                    <td className="px-3 py-2.5 text-[11px] font-medium text-[#1a1d23] whitespace-nowrap">{row.app}</td>
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[#1e3a5f] mono">{row.artefact}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[#6b7589]">{row.type}</td>
                    <td className="px-3 py-2.5 text-[10px] mono text-[#1a1d23]">{row.algorithm}</td>
                    <td className="px-3 py-2.5 text-[10px] mono text-[#6b7589]">{row.version}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[#6b7589]">{row.mode}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[#6b7589]">—</td>
                    <td className="px-3 py-2.5 text-[10px] text-[#6b7589]">—</td>
                    <td className="px-3 py-2.5 text-[10px] mono text-[#6b7589] max-w-[140px] truncate">{row.location}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[#6b7589]">{row.source}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${row.confidence === "High" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>{row.confidence}</span>
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
