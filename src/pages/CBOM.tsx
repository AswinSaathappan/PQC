import React, { useEffect, useState, useRef, useCallback } from "react";
import { Download, Search, Box, HelpCircle, ShieldCheck, ShieldAlert, ChevronRight, ChevronDown, RefreshCw, AlertTriangle, Loader2, Play, UploadCloud, PlusCircle, FileText, Sun } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CBOMProps {
  analysisId?: string;
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  analyses?: any[];
  onNavigate?: (route: string) => void;
}

export default function CBOM({ 
  analysisId, 
  selectedAnalysisId: propSelectedId, 
  onSelectAnalysis,
  analyses: propAnalyses,
  onNavigate
}: CBOMProps) {
  const [analyses, setAnalyses] = useState<any[]>(propAnalyses || []);
  const currentAnalysisId = analysisId || propSelectedId || (propAnalyses && propAnalyses.length > 0 ? propAnalyses[0].analysisId : "");
  const selectedAnalysisId = currentAnalysisId;
  const [assets, setAssets] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Embedded CBOMKit visualization service state
  const [cbomKitOnline, setCbomKitOnline] = useState<boolean | null>(null);
  const [isCheckingCbomKit, setIsCheckingCbomKit] = useState(false);

  const reqIdRef = useRef(0);

  // Keep analyses list synchronized
  useEffect(() => {
    if (propAnalyses && propAnalyses.length > 0) {
      setAnalyses(propAnalyses);
    } else {
      async function fetchAnalyses() {
        try {
          const res = await fetch("http://localhost:3001/api/analyses");
          if (res.ok) {
            const data = await res.json();
            setAnalyses(data);
          }
        } catch (err) {
          console.error("Failed to fetch analyses:", err);
        }
      }
      fetchAnalyses();
    }
  }, [propAnalyses]);

  const handleSelectApp = (newId: string) => {
    if (onSelectAnalysis) {
      onSelectAnalysis(newId);
    }
    if (onNavigate) {
      onNavigate(`cbom:${newId}`);
    }
  };

  // Fetch application CBOM, summary, & asset inventory in parallel
  const fetchData = useCallback(async () => {
    if (!currentAnalysisId) {
      setLoading(false);
      setAnalysis(null);
      setAssets([]);
      setSummaryData(null);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setAnalysis(null);
    setAssets([]);
    setSummaryData(null);

    try {
      const [aRes, sRes, res] = await Promise.all([
        fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}`).catch(() => null),
        fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}/cbom-summary`).catch(() => null),
        fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}/assets`).catch(() => null)
      ]);

      if (reqId !== reqIdRef.current) return;

      if (aRes && aRes.ok) {
        const aData = await aRes.json();
        if (reqId === reqIdRef.current) setAnalysis(aData);
      }

      if (sRes && sRes.ok) {
        const sData = await sRes.json();
        if (reqId === reqIdRef.current) setSummaryData(sData);
      }

      if (res && res.ok) {
        const assetsData = await res.json();
        if (reqId === reqIdRef.current) setAssets(assetsData);
      } else if (reqId === reqIdRef.current) {
        setAssets([]);
      }
    } catch (err) {
      console.error("Failed to fetch CBOM data", err);
      if (reqId === reqIdRef.current) {
        setAssets([]);
      }
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [currentAnalysisId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Incremental data fetch during scan (updates cards and table live without clearing or flicker)
  const fetchIncrementalData = useCallback(async () => {
    if (!currentAnalysisId) return;
    try {
      const [aRes, sRes, res] = await Promise.all([
        fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}`).catch(() => null),
        fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}/cbom-summary`).catch(() => null),
        fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}/assets`).catch(() => null)
      ]);

      if (aRes && aRes.ok) {
        const aData = await aRes.json();
        setAnalysis((prev: any) => ({ ...prev, ...aData }));
      }

      if (sRes && sRes.ok) {
        const sData = await sRes.json();
        setSummaryData(sData);
      }

      if (res && res.ok) {
        const assetsData = await res.json();
        if (Array.isArray(assetsData) && assetsData.length > 0) {
          setAssets(assetsData);
        }
      }
    } catch (err) {
      console.error("Incremental fetch error:", err);
    }
  }, [currentAnalysisId]);

  // Reset/initialize scan status when switching target application
  useEffect(() => {
    setIsScanning(false);
    setScanError(null);
  }, [currentAnalysisId]);

  const handleCbomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentAnalysisId) return;
    try {
      setIsScanning(true);
      setScanError(null);
      const text = await file.text();
      const cbomJson = JSON.parse(text);
      const res = await fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}/cbom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cbomJson),
      });
      if (!res.ok) {
        const formData = new FormData();
        formData.append("file", file);
        await fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}/scan`, {
          method: "POST",
          body: formData,
        });
      }
      fetchData();
    } catch (err: any) {
      setScanError(err.message || "Failed to upload CBOM file");
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && (e.data.type === 'SCAN_STARTED' || e.data.type === 'FOLDER_SCAN_STARTED' || e.data.type === 'BINARY_SCAN_STARTED')) {
        setAnalysis((prev: any) => ({ ...prev, status: 'RUNNING' }));
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const resolvedTargetType = (analysis?.targetType) || (analyses.find(a => a.analysisId === currentAnalysisId)?.targetType) || '';
  const iframeSrc = React.useMemo(() => {
    if (!currentAnalysisId) return '';
    return `http://localhost:8001/?analysisId=${encodeURIComponent(currentAnalysisId)}&targetType=${encodeURIComponent(resolvedTargetType)}&v=20260918v5`;
  }, [currentAnalysisId, resolvedTargetType]);

  const lastLoadedRef = useRef<{ id: string; target: string }>({ id: '', target: '' });
  useEffect(() => {
    if (currentAnalysisId && (currentAnalysisId !== lastLoadedRef.current.id || resolvedTargetType !== lastLoadedRef.current.target) && iframeRef.current?.contentWindow) {
      lastLoadedRef.current = { id: currentAnalysisId, target: resolvedTargetType };
      try {
        iframeRef.current.contentWindow.postMessage({
          type: 'LOAD_ANALYSIS',
          analysisId: currentAnalysisId,
          targetType: resolvedTargetType,
          status: analysis?.status
        }, '*');
      } catch {}
    }
  }, [currentAnalysisId, resolvedTargetType, analysis?.status]);

  // State calculations
  const isCompleted = !loading && (analysis?.status === 'COMPLETED' || (assets.length > 0 && analysis?.status !== 'RUNNING' && analysis?.status !== 'FAILED'));
  const isRunning = isScanning || (!loading && (analysis?.status === 'RUNNING' || analysis?.status === 'CREATED'));
  const isFailed = !loading && (analysis?.status === 'FAILED' || !!scanError) && !isRunning;
  const isNotStarted = !loading && !isCompleted && !isRunning && !isFailed;

  // Background status polling when analysis is in progress
  useEffect(() => {
    if (!currentAnalysisId || isCompleted || isFailed) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/analyses/${currentAnalysisId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'COMPLETED') {
            clearInterval(interval);
            setIsScanning(false);
            fetchData();
          } else if (data.status === 'FAILED') {
            clearInterval(interval);
            setIsScanning(false);
            setAnalysis((prev: any) => ({ ...prev, status: 'FAILED', errorMessage: data.errorMessage }));
          } else if (data.status === 'RUNNING') {
            fetchIncrementalData();
          }
        }
      } catch (err) {
        console.error("Polling status error:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentAnalysisId, isCompleted, isFailed, fetchData, fetchIncrementalData]);

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

  // Check reachability of external CBOMKit service on port 8001
  const checkCBOMKit = async () => {
    setIsCheckingCbomKit(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch("http://localhost:8001/", { mode: "no-cors", signal: controller.signal });
      clearTimeout(timeoutId);
      setCbomKitOnline(true);
    } catch {
      setCbomKitOnline(false);
    } finally {
      setIsCheckingCbomKit(false);
    }
  };

  useEffect(() => {
    checkCBOMKit();
  }, []);

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
    
    // Summary Blocks (Exact CBOM occurrence and unique asset metrics)
    const summaryTableData = [
      ["Total Cryptographic Asset Occurrences", cbomSummary.totalCryptoAssets.toString()],
      ["Unique Logical Cryptographic Assets", (assets.length > 0 ? new Set(assets.map(a => a.assetName || a.algorithm)).size.toString() : "-")],
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
                Scan Status:{" "}
                <span className={`font-medium ${
                  isCompleted ? "text-emerald-600" : isRunning ? "text-blue-600" : isFailed ? "text-red-600" : "text-amber-600"
                }`}>
                  {isCompleted ? "Completed" : isRunning ? "Scanning..." : isFailed ? "Failed" : "Input Required"}
                </span>
              </span>
              {isCompleted && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  <span>Generated: {analysis?.stages?.discover?.completedAt ? new Date(analysis.stages.discover.completedAt).toLocaleString() : 'N/A'}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex flex-col items-end">
               <span className="text-[10px] uppercase font-bold text-gray-500 mb-1">Target Application</span>
                <select 
                  value={currentAnalysisId} 
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
            
            {isCompleted && (
              <>
                <div className="h-10 w-px bg-gray-200 mx-2"></div>
                <button onClick={handleDownloadPdf} className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#162e4d] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
                  <Download size={16} /> Download CBOM PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Loading indicator */}
        {loading && !analysis && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-10 flex flex-col items-center justify-center gap-3 shadow-sm">
            <Loader2 className="animate-spin text-[#1e3a5f]" size={28} />
            <div className="text-xs font-semibold text-[#6b7589]">Loading application analysis...</div>
          </div>
        )}

        {/* Lifecycle Status Banners */}
        {isFailed && (
          <div className="bg-white border border-red-200 rounded-lg p-5 flex items-start justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-full text-red-600 shrink-0 mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-800">Cryptographic Analysis Failed</h4>
                <p className="text-xs text-[#6b7589] mt-1">The analysis encountered an error during cryptographic discovery or processing.</p>
                {(scanError || analysis?.errorMessage) && (
                  <div className="mt-2 text-xs font-mono text-red-700 bg-red-50/80 p-2.5 rounded border border-red-200 break-all">
                    {scanError || analysis?.errorMessage}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setIsScanning(false);
                setScanError(null);
                if (analysis) {
                  setAnalysis({ ...analysis, status: 'CREATED', errorMessage: null });
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold shrink-0 transition-colors"
            >
              Retry Scan
            </button>
          </div>
        )}


        {/* Dynamic CBOM Stats: Exactly 5 cards matching user screenshot */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {/* CARD 1: Total Cryptographic Asset Occurrences */}
            <div className="bg-white border border-[#dde1e9] rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Box size={18} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7589]">Total Cryptographic Asset Occurrences</div>
                </div>
                <div className="text-3xl font-bold text-[#1a1d23] mt-2">
                  {loading ? "…" : (!analysis && assets.length === 0) ? "CBOM data unavailable" : cbomSummary.totalCryptoAssets}
                </div>
              </div>
              <div className="text-[10px] text-[#6b7589] mt-3">
                {assets.length > 0 ? `${cbomSummary.totalCryptoAssets} occurrences across ${new Set(assets.map(a => a.assetName || a.algorithm)).size} unique logical cryptographic assets` : 'Authoritative CBOM count'}
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

        {/* Cryptographic Visualization (Dark-Themed) */}
        <div className="bg-white border border-[#dde1e9] rounded-lg flex flex-col overflow-hidden shadow-sm h-[620px]">
          <div className="px-5 py-3 border-b border-[#dde1e9] bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-[#1a1d23]">Cryptographic Visualization</div>
              <span className="text-xs text-gray-500 font-normal">
                {assets.length} Cryptographic Asset Occurrences Mapped
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <span className={`w-2 h-2 rounded-full ${cbomKitOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                {cbomKitOnline ? 'CBOM Service Online' : 'Checking service...'}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full bg-[#0f172a] relative overflow-hidden">
            {cbomKitOnline === false ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-300">
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-amber-400">
                  <ShieldAlert size={28} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  CBOM visualization service unavailable (Port 8001 is offline)
                </h3>
                <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                  The standalone CBOM visualization service is not responding at <code className="text-amber-300">http://localhost:8001/</code>. Please ensure the CBOM service is running.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={checkCBOMKit}
                    disabled={isCheckingCbomKit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} className={isCheckingCbomKit ? "animate-spin" : ""} />
                    {isCheckingCbomKit ? "Checking..." : "Retry Connection"}
                  </button>
                </div>
              </div>
            ) : !currentAnalysisId ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-300">
                <Loader2 className="animate-spin mb-3 text-blue-400" size={32} />
                <h3 className="text-sm font-semibold text-white mb-1">
                  Loading Cryptographic Visualization...
                </h3>
                <p className="text-xs text-slate-400">Selecting application analysis</p>
              </div>
            ) : (
              <iframe 
                ref={iframeRef}
                key={currentAnalysisId}
                src={iframeSrc} 
                title="CBOM Visualization"
                className="w-full h-full border-none"
                onLoad={(e) => {
                  try {
                    const iframe = e.currentTarget;
                    if (iframe.contentWindow) {
                      iframe.contentWindow.postMessage({ type: 'LOAD_ANALYSIS', analysisId: currentAnalysisId, targetType: resolvedTargetType }, '*');
                    }
                  } catch {}
                }}
              />
            )}
          </div>
        </div>

        {/* Assets Table */}
        <div className="bg-white border border-[#dde1e9] rounded-lg overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#dde1e9] flex items-center justify-between">
            <div className="text-sm font-semibold text-[#1a1d23]">Cryptographic Asset Occurrences ({loading ? "…" : filtered.length})</div>
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
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CBOM Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantum Risk</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline mr-2 text-blue-600" size={16} />Loading cryptographic assets...</td></tr>
                ) : analysis?.status === 'FAILED' ? (
                  <tr><td colSpan={6} className="p-8 text-center text-red-600">
                    <div className="font-semibold mb-1">Cryptographic Analysis Failed</div>
                    <div className="text-xs text-red-500 font-mono">{analysis.errorMessage || 'Error occurred during discovery.'}</div>
                  </td></tr>
                ) : (analysis?.status === 'RUNNING' || analysis?.status === 'CREATED') ? (
                  <tr><td colSpan={6} className="p-8 text-center text-blue-600">
                    <Loader2 className="animate-spin inline mr-2" size={16} />Cryptographic discovery in progress...
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No cryptographic assets detected in this application.</td></tr>
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
