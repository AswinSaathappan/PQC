import React, { useState, useEffect } from "react";
import { Search, Download, ChevronRight, ChevronDown } from "lucide-react";

interface Props {
  selectedAnalysisId?: string;
  analyses?: any[];
  onSelectAnalysis?: (id: string) => void;
}

export default function Discovery({ selectedAnalysisId: propSelectedId, analyses: propAnalyses = [], onSelectAnalysis }: Props) {
  const [search, setSearch] = useState("");
  const [localAnalyses, setLocalAnalyses] = useState<any[]>([]);
  const [localSelectedId, setLocalSelectedId] = useState<string>("");
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const analysesList = propAnalyses.length > 0 ? propAnalyses : localAnalyses;
  const activeSelectedId = propSelectedId || localSelectedId || (analysesList[0]?.analysisId ?? "");

  useEffect(() => {
    if (propAnalyses.length === 0) {
      fetch("http://localhost:3001/api/analyses")
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setLocalAnalyses(data);
          if (data.length > 0 && !propSelectedId) setLocalSelectedId(data[0].analysisId);
        })
        .catch(() => {});
    }
  }, [propAnalyses.length, propSelectedId]);

  useEffect(() => {
    if (!activeSelectedId) { setLoading(false); return; }
    setLoading(true);
    setExpandedRows(new Set());
    fetch(`http://localhost:3001/api/analyses/${activeSelectedId}/assets`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setAssets(data); setLoading(false); })
      .catch(() => { setAssets([]); setLoading(false); });
  }, [activeSelectedId]);

  const filtered = assets.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.assetName?.toLowerCase().includes(q) ||
      a.assetType?.toLowerCase().includes(q) ||
      a.primitive?.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q)
    );
  });

  const toggleRow = (id: string) => {
    const s = new Set(expandedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRows(s);
  };

  const displayPrimitive = (p: string | null | undefined) => {
    if (!p) return "Unspecified";
    const map: Record<string, string> = {
      "block-cipher": "Block Cipher",
      "hash": "Hash Function",
      "pke": "Public Key Encryption",
      "ae": "Authenticated Encryption",
      "signature": "Digital Signature",
      "mac": "MAC",
      "dh": "Key Agreement",
      "kdf": "Key Derivation",
      "xof": "Extendable Output Function",
      "pbkdf": "Password-Based KDF",
    };
    return map[p.toLowerCase()] ?? p;
  };

  const displayType = (t: string | null | undefined) => {
    if (!t) return "-";
    const map: Record<string, string> = {
      "algorithm": "Algorithm",
      "related-crypto-material": "Related Crypto Material",
      "certificate": "Certificate",
      "protocol": "Protocol",
      "library": "Library",
    };
    return map[t.toLowerCase()] ?? t;
  };

  const handleExportCsv = () => {
    const headers = ["Cryptographic Asset", "Type", "Primitive", "File", "Line", "Offset", "Reference", "Quantum Safety Status"];
    const rows: string[][] = [];

    assets.forEach(asset => {
      const qStatus = asset.quantumSafe === true ? "Quantum Safe" : (asset.quantumSafe === false ? "Not Quantum Safe" : "Unknown");
      const occurrences = asset.occurrences && asset.occurrences.length > 0 ? asset.occurrences : [{ location: asset.location }];
      
      occurrences.forEach((occ: any) => {
        rows.push([
          asset.assetName || asset.assetId || "",
          displayType(asset.assetType),
          displayPrimitive(asset.primitive),
          occ.location || "",
          occ.line ? occ.line.toString() : "",
          occ.offset ? occ.offset.toString() : "",
          occ.additionalContext || "",
          qStatus
        ]);
      });
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `cbom-export-${activeSelectedId || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-4">

        {/* Header */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold text-[#1a1d23]">Cryptographic Asset Discovery</div>
            <div className="text-[12px] text-[#6b7589] mt-0.5">
              Discovered cryptographic asset occurrences — sourced directly from scanner results
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-gray-600 font-medium">Application:</span>
            <select
              value={activeSelectedId}
              onChange={e => {
                const val = e.target.value;
                setLocalSelectedId(val);
                if (onSelectAnalysis) onSelectAnalysis(val);
              }}
              className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 bg-white outline-none text-[#1a1d23] font-medium min-w-[220px]"
            >
              {analysesList.length === 0 && <option value="">No applications found</option>}
              {analysesList.map(a => (
                <option key={a.analysisId} value={a.analysisId}>{a.applicationName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden">
          {/* Table toolbar */}
          <div className="px-5 py-3 border-b border-[#dde1e9] flex items-center gap-3 bg-white">
            <div className="flex-1">
              <span className="text-[13px] font-semibold text-[#1a1d23]">
                Total Cryptographic Asset Occurrences ({loading ? "…" : filtered.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#f5f6f8] border border-[#dde1e9] rounded-md px-3 py-1.5 w-60">
              <Search size={12} className="text-[#9aa1b1] shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search assets, type, location…"
                className="bg-transparent text-[12px] outline-none flex-1 placeholder-[#9aa1b1]"
              />
            </div>
            <button onClick={handleExportCsv} className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#1e3a5f] px-3 py-1.5 rounded-md hover:bg-[#162e4d] transition-colors">
              <Download size={12} /> Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#dde1e9]">
                  <th className="px-5 py-3 text-[11px] font-semibold text-[#6b7589] uppercase tracking-wide">
                    Cryptographic Asset
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[#6b7589] uppercase tracking-wide">
                    Asset Type
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[#6b7589] uppercase tracking-wide">
                    Primitive
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[#6b7589] uppercase tracking-wide">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-[13px] text-gray-400">
                      Loading assets…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-[13px] text-gray-400">
                      <div className="text-[#6b7589] text-[13px]">
                        {analysesList.length === 0 
                          ? "No applications analyzed yet. Run a cryptographic scan to discover assets."
                          : "No cryptographic assets were detected for this application."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row._id || row.assetId || idx} className="hover:bg-blue-50/30 transition-colors">
                      {/* Asset name */}
                      <td className="px-5 py-3">
                        <span className="font-mono text-[12px] font-semibold text-[#1e3a5f]">
                          {row.assetName || "-"}
                        </span>
                      </td>

                      {/* Asset Type */}
                      <td className="px-5 py-3 text-[12px] text-gray-700">
                        {displayType(row.assetType)}
                      </td>

                      {/* Primitive */}
                      <td className="px-5 py-3 text-[12px] text-gray-700">
                        {displayPrimitive(row.primitive)}
                      </td>

                      {/* Location */}
                      <td className="px-5 py-3">
                        <span className="font-mono text-[12px] text-gray-600">
                          {row.location || "-"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
