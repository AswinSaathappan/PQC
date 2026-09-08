import React, { useEffect, useState } from "react";
import { Download, Search, Box, HelpCircle, ShieldCheck, ShieldAlert, ChevronRight, ChevronDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CBOMProps {
  analysisId?: string;
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  analyses?: any[];
}

export default function CBOM({ 
  analysisId, 
  selectedAnalysisId: propSelectedId, 
  onSelectAnalysis,
  analyses: propAnalyses 
}: CBOMProps) {
  const [analyses, setAnalyses] = useState<any[]>(propAnalyses || []);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(propSelectedId || analysisId || "");
  const [assets, setAssets] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Keep analyses list synchronized
  useEffect(() => {
    if (propAnalyses && propAnalyses.length > 0) {
      setAnalyses(propAnalyses);
      if (!selectedAnalysisId) {
        setSelectedAnalysisId(propSelectedId || propAnalyses[0].analysisId);
      }
    } else {
      async function fetchAnalyses() {
        try {
          const res = await fetch("http://localhost:3001/api/analyses");
          if (res.ok) {
            const data = await res.json();
            setAnalyses(data);
            if (data.length > 0 && !selectedAnalysisId) {
              setSelectedAnalysisId(data[0].analysisId);
            }
          }
        } catch (err) {
          console.error("Failed to fetch analyses:", err);
        }
      }
      fetchAnalyses();
    }
  }, [propAnalyses]);

  // Keep selectedAnalysisId synchronized with parent
  useEffect(() => {
    if (propSelectedId && propSelectedId !== selectedAnalysisId) {
      setSelectedAnalysisId(propSelectedId);
    }
  }, [propSelectedId]);

  const handleSelectApp = (newId: string) => {
    setSelectedAnalysisId(newId);
    if (onSelectAnalysis) {
      onSelectAnalysis(newId);
    }
  };

  // Fetch application CBOM, summary, & asset inventory (clean reset on application switch)
  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      if (!selectedAnalysisId) {
        setLoading(false);
        setAnalysis(null);
        setAssets([]);
        setSummaryData(null);
        return;
      }
      setLoading(true);
      setAnalysis(null);
      setAssets([]);
      setSummaryData(null);

      try {
        const aRes = await fetch(`http://localhost:3001/api/analyses/${selectedAnalysisId}`);
        if (!isCancelled && aRes.ok) {
          const aData = await aRes.json();
          setAnalysis(aData);
        }

        const sRes = await fetch(`http://localhost:3001/api/analyses/${selectedAnalysisId}/cbom-summary`);
        if (!isCancelled && sRes.ok) {
          const sData = await sRes.json();
          setSummaryData(sData);
        }

        const res = await fetch(`http://localhost:3001/api/analyses/${selectedAnalysisId}/assets`);
        if (!isCancelled && res.ok) {
          const assetsData = await res.json();
          setAssets(assetsData);
        } else if (!isCancelled) {
          setAssets([]);
        }
      } catch (err) {
        console.error("Failed to fetch CBOM data", err);
        if (!isCancelled) {
          setAssets([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      isCancelled = true;
    };
  }, [selectedAnalysisId]);

  const filtered = assets.filter(a => 
    !search || 
    a.assetName?.toLowerCase().includes(search.toLowerCase()) ||
    a.primitive?.toLowerCase().includes(search.toLowerCase()) ||
    a.assetType?.toLowerCase().includes(search.toLowerCase()) ||
    a.location?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  // Summary Data Model (Authoritative 5 CBOMKit compliance counts from backend response)
  const totalCryptoAssets = summaryData?.totalCryptoAssets ?? (analysis?.detectedCryptoAssetCount ?? assets.length);
  let unknown = summaryData?.unknown ?? 0;
  let notApplicable = summaryData?.notApplicable ?? 0;
  let notQuantumSafe = summaryData?.notQuantumSafe ?? 0;
  let quantumSafe = summaryData?.quantumSafe ?? 0;
  const complianceStatus = summaryData?.complianceStatus ?? 'completed';

  // Fallback tally across assets if summaryData not yet returned
  if (!summaryData && assets.length > 0) {
    unknown = 0;
    notApplicable = 0;
    notQuantumSafe = 0;
    quantumSafe = 0;
    assets.forEach(a => {
      if (a.cbomKitClassification === 'Quantum Safe') {
        quantumSafe += 1;
      } else if (a.cbomKitClassification === 'Not Quantum Safe') {
        notQuantumSafe += 1;
      } else if (a.cbomKitClassification === 'Not Applicable') {
        notApplicable += 1;
      } else {
        unknown += 1;
      }
    });
  }

  const cbomSummary = {
    totalCryptoAssets,
    unknown,
    notApplicable,
    notQuantumSafe,
    quantumSafe
  };

  // Generate PDF logic
  const handleDownloadPdf = () => {
    if (!analysis) return;
    
    const doc = new jsPDF();
    
    // Page 1: Header & Summary
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 95); // #1e3a5f
    doc.text("Cryptography Bill of Materials (CBOM)", 14, 25);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Application: ${analysis.applicationName}`, 14, 35);
    doc.text(`Analysis ID: ${analysis.analysisId}`, 14, 41);
    doc.text(`Generated: ${analysis.stages?.discover?.completedAt ? new Date(analysis.stages.discover.completedAt).toLocaleString() : new Date().toLocaleString()}`, 14, 47);
    
    doc.setDrawColor(220);
    doc.line(14, 55, 196, 55);

    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text("Executive Summary", 14, 68);
    
    // Summary Blocks (Exact 5 CBOM metrics)
    const summaryTableData = [
      ["Total Cryptographic Assets", cbomSummary.totalCryptoAssets.toString()],
      ["Unknown", cbomSummary.unknown.toString()],
      ["Not Applicable", cbomSummary.notApplicable.toString()],
      ["Not Quantum Safe", cbomSummary.notQuantumSafe.toString()],
      ["Quantum Safe", cbomSummary.quantumSafe.toString()]
    ];

    autoTable(doc, {
      startY: 75,
      body: summaryTableData,
      theme: 'grid',
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: { 
        0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 100 }, 
        1: { fontStyle: 'bold', textColor: [30, 58, 95], cellWidth: 40 } 
      }
    });

    // Page 2: Assets
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 95);
    doc.text("Cryptographic Asset Inventory", 14, 20);
    
    const tableData = assets.map(a => [
      a.assetName || a.assetId || "-",
      a.assetType || "-",
      a.primitive || "-",
      a.occurrences && a.occurrences.length > 1 ? `${a.location} (+${a.occurrences.length - 1})` : (a.location || "-")
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Asset', 'Type', 'Primitive', 'Primary Location']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 50 }, 3: { cellWidth: 70 } }
    });

    // Page 3+: Locations Detail
    const multiOccurrences = assets.filter(a => a.occurrences && a.occurrences.length > 1);
    if (multiOccurrences.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text("Detailed Location Breakdowns", 14, 20);

      let currentY = 30;
      
      multiOccurrences.forEach(asset => {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(`${asset.assetName || asset.assetId}`, 14, currentY);
        currentY += 8;

        const locData = asset.occurrences.map((o: any) => [
          o.location || "unknown",
          o.line ? o.line.toString() : "-",
          o.additionalContext ? (o.additionalContext.length > 60 ? o.additionalContext.substring(0, 57) + "..." : o.additionalContext) : "-"
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['File', 'Line', 'Context']],
          body: locData,
          theme: 'plain',
          headStyles: { fillColor: [240, 240, 240], textColor: [100, 100, 100] },
          styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 15 }, 2: { cellWidth: 80 } }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      });
    }
    
    doc.save(`CBOM-${analysis.applicationName.replace(/\s+/g, '_')}-${new Date().getTime()}.pdf`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        
        {/* Header */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1a1d23] flex items-center gap-2">
              Cryptography Bill of Materials (CBOM)
            </h1>
            <div className="text-sm text-[#6b7589] mt-1 flex flex-wrap items-center gap-3">
              <span>Application: <strong className="text-gray-900">{analysis?.applicationName || 'Unknown'}</strong></span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span className="flex items-center gap-1">
                Scan Status: <span className="text-emerald-600 font-medium">Completed</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span>Generated: {analysis?.stages?.discover?.completedAt ? new Date(analysis.stages.discover.completedAt).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex flex-col items-end">
               <span className="text-[10px] uppercase font-bold text-gray-500 mb-1">Target Application</span>
               <select 
                  value={selectedAnalysisId} 
                  onChange={e => handleSelectApp(e.target.value)} 
                  className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 bg-gray-50 outline-none text-[#1a1d23] font-medium min-w-[200px]"
                >
                  {analyses.length === 0 && <option value="">No applications found</option>}
                  {analyses.map(a => (
                    <option key={a.analysisId} value={a.analysisId}>
                      {a.applicationName}
                    </option>
                  ))}
                </select>
            </div>
            
            <div className="h-10 w-px bg-gray-200 mx-2"></div>

            <button onClick={handleDownloadPdf} className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#162e4d] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
              <Download size={16} /> Download CBOM PDF
            </button>
          </div>
        </div>

        {/* Dynamic CBOM Stats: Exactly 5 cards */}
        {!loading && !selectedAnalysisId ? (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-6 text-center text-gray-500 text-sm">
            CBOM data unavailable
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {/* CARD 1: Total Crypto Assets */}
            <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Box size={18} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7589]">Total Crypto Assets</div>
                </div>
                <div className="text-3xl font-bold text-[#1a1d23] mt-2">
                  {loading ? "…" : (!analysis && assets.length === 0) ? "CBOM data unavailable" : cbomSummary.totalCryptoAssets}
                </div>
              </div>
              <div className="text-[10px] text-[#6b7589] mt-3">
                Authoritative CBOM count
              </div>
            </div>

            {/* CARD 2: Unknown */}
            <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <HelpCircle size={18} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7589]">Unknown</div>
                </div>
                <div className="text-3xl font-bold text-[#1a1d23] mt-2">
                  {loading ? "…" : (!analysis && assets.length === 0) ? "—" : cbomSummary.unknown}
                </div>
              </div>
              <div className="text-[10px] text-[#6b7589] mt-3">
                Unclassified primitives
              </div>
            </div>

            {/* CARD 3: Not Applicable */}
            <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <ShieldCheck size={18} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7589]">Not Applicable</div>
                </div>
                <div className="text-3xl font-bold text-[#1a1d23] mt-2">
                  {loading ? "…" : (!analysis && assets.length === 0) ? "—" : cbomSummary.notApplicable}
                </div>
              </div>
              <div className="text-[10px] text-[#6b7589] mt-3">
                Symmetric / non-asymmetric
              </div>
            </div>

            {/* CARD 4: Not Quantum Safe */}
            <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <ShieldAlert size={18} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7589]">Not Quantum Safe</div>
                </div>
                <div className="text-3xl font-bold text-[#1a1d23] mt-2">
                  {loading ? "…" : (!analysis && assets.length === 0) ? "—" : cbomSummary.notQuantumSafe}
                </div>
              </div>
              <div className="text-[10px] text-[#6b7589] mt-3">
                Quantum-vulnerable algorithms
              </div>
            </div>

            {/* CARD 5: Quantum Safe */}
            <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm flex flex-col justify-between relative">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <ShieldCheck size={18} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7589]">Quantum Safe</div>
                </div>
                <div className="text-3xl font-bold text-[#1a1d23] mt-2">
                  {loading ? (
                    "…"
                  ) : complianceStatus === 'analyzing' ? (
                    <span className="text-xs font-medium text-blue-600">Analyzing quantum safety...</span>
                  ) : complianceStatus === 'failed' ? (
                    <span className="text-xs font-medium text-amber-600">Quantum safety analysis unavailable</span>
                  ) : (
                    cbomSummary.quantumSafe
                  )}
                </div>
              </div>
              <div className="text-[10px] text-[#6b7589] mt-3 font-medium">
                Source: CBOM compliance analysis
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic Visualization (Dark-Themed) */}
        <div className="bg-white border border-[#dde1e9] rounded-lg flex flex-col overflow-hidden shadow-sm h-[600px]">
          <div className="px-5 py-3 border-b border-[#dde1e9] bg-gray-50 flex items-center justify-between">
            <div className="text-sm font-semibold text-[#1a1d23]">Cryptographic Visualization</div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-600">
                CBOM Graph Explorer
              </span>
            </div>
          </div>
          <div className="flex-1 w-full bg-[#1e1e1e] relative overflow-hidden">
            <iframe 
              key={selectedAnalysisId}
              src="http://localhost:8001/" 
              title="CBOMKit Visualization"
              className="w-full h-full border-none"
            />
          </div>
        </div>

        {/* Assets Table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#dde1e9] flex items-center justify-between">
            <div className="text-sm font-semibold text-[#1a1d23]">Cryptographic Assets ({loading ? "…" : filtered.length})</div>
            <div className="flex items-center gap-2 bg-[#f5f6f8] border border-[#dde1e9] rounded-md px-3 py-1.5 w-64">
              <Search size={14} className="text-[#6b7589]" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search assets..." 
                className="bg-transparent text-sm outline-none flex-1 placeholder-[#9aa1b1]" 
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[#dde1e9]">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Primitive</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CBOMKit Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantum Risk</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading assets...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No cryptographic assets found.</td></tr>
                ) : (
                  filtered.map((asset, idx) => {
                    const rawCbom = (asset.cbomkitClassification || '').toLowerCase();
                    const cbomLabel = (rawCbom === 'quantum-safe' || rawCbom === 'quantum_safe') ? 'Quantum Safe' :
                      (rawCbom === 'quantum-vulnerable' || rawCbom === 'quantum_vulnerable') ? 'Not Quantum Safe' :
                      (rawCbom === 'na' || rawCbom === 'not-applicable') ? 'Not Applicable' :
                      (rawCbom === 'unknown') ? 'Unknown' : (asset.cbomKitClassification || 'Unknown');

                    let r = (asset.cryptavistaQuantumRisk || '').toUpperCase();
                    let s = asset.cryptavistaScore;
                    if (!r) {
                      const name = (asset.assetName || asset.algorithm || '').toUpperCase();
                      if (name.includes('ML-KEM') || name.includes('ML-DSA') || name.includes('SLH-DSA')) { r = 'LOW'; s = 20; }
                      else if (name.includes('RSA') || name.includes('ECDSA') || name.includes('ECDH') || name.includes('DH') || name.includes('DSA')) { r = 'HIGH'; s = 100; }
                      else if (name.includes('AES-128') || name.includes('AES128')) { r = 'MEDIUM'; s = 60; }
                      else if (name.includes('AES-192') || name.includes('AES-256') || name.includes('AES192') || name.includes('AES256') || name.includes('SHA') || name.includes('HMAC') || name.includes('CHACHA20')) { r = 'LOW'; s = 20; }
                      else { r = 'UNKNOWN'; s = null; }
                    }

                    const riskColors: Record<string, string> = {
                      LOW: '#16A34A',
                      MEDIUM: '#D97706',
                      HIGH: '#DC2626',
                      UNKNOWN: '#64748B'
                    };
                    const hex = riskColors[r] || riskColors.UNKNOWN;
                    const displayRisk = r === 'LOW' ? 'Low' : r === 'MEDIUM' ? 'Medium' : r === 'HIGH' ? 'High' : 'Unknown';

                    return (
                      <tr key={asset._id || asset.assetId || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-mono text-sm text-[#1e3a5f] font-semibold">{asset.assetName || asset.assetId || "—"}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">{asset.assetType || "—"}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{asset.primitive || "—"}</td>
                        <td className="px-5 py-4 text-sm">
                          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                            {cbomLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm whitespace-nowrap">
                          <span 
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border"
                            style={{
                              color: hex,
                              backgroundColor: `${hex}14`,
                              borderColor: `${hex}40`
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }}></span>
                            {displayRisk} {s !== null ? `(${s})` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 font-mono">
                          <span className="truncate max-w-[240px] block" title={asset.location}>{asset.location || "—"}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
