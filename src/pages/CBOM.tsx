import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Download, Search, Box, HelpCircle, ShieldCheck, ShieldAlert, ChevronRight, ChevronDown, RefreshCw, AlertTriangle, Loader2, Play, UploadCloud, PlusCircle, FileText, Sun } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { classifyAsset, calculateClassificationStats, ClassificationStats } from "../utils/quantumClassification";

interface CBOMProps {
  analysisId?: string;
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  analyses?: any[];
  onNavigate?: (route: string) => void;
}

interface CbomSummaryCardProps {
  icon: React.ReactNode;
  title: string;
  titleColorClass: string;
  badgeText: string;
  badgeClass: string;
  mainValue: number | string;
  description: string;
  descriptionColorClass: string;
  borderColorClass: string;
  hoverBorderClass: string;
  secondaryContent?: React.ReactNode;
}

function CbomSummaryCard({
  icon,
  title,
  titleColorClass,
  badgeText,
  badgeClass,
  mainValue,
  description,
  descriptionColorClass,
  borderColorClass,
  hoverBorderClass,
  secondaryContent
}: CbomSummaryCardProps) {
  return (
    <div className={`bg-white border ${borderColorClass} ${hoverBorderClass} rounded-lg p-5 shadow-sm flex flex-col h-full transition-colors`}>
      {/* 1. Header / Icon / Title / Badge */}
      <div className="h-[54px] flex items-start justify-between gap-1.5 shrink-0">
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="shrink-0 mt-0.5">{icon}</span>
          <span className={`text-[11px] xl:text-xs font-semibold uppercase tracking-wider leading-tight break-words ${titleColorClass}`}>
            {title}
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      {/* 2. Dedicated Main Number & Description Area */}
      <div className="flex flex-col items-center justify-center pt-3 pb-1 text-center">
        <div className="text-3xl font-bold text-[#1a1d23] leading-none text-center">
          {mainValue}
        </div>
        <div className={`text-[11px] font-medium mt-1.5 text-center min-h-[30px] flex items-center justify-center ${descriptionColorClass}`}>
          {description}
        </div>
      </div>

      {/* 3. Optional Secondary Content or Flex Spacer */}
      {secondaryContent ? (
        <div className="mt-auto pt-2.5 border-t border-[#e2e8f0] w-full">
          {secondaryContent}
        </div>
      ) : (
        <div className="mt-auto" />
      )}
    </div>
  );
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
  const [cbomKitOnline, setCbomKitOnline] = useState<boolean | null>(true);
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
      if (e.data && (e.data.type === 'SCAN_STARTED' || e.data.type === 'FOLDER_SCAN_STARTED' || e.data.type === 'BINARY_SCAN_STARTED' || e.data.type === 'CONTAINER_SCAN_STARTED' || e.data.type === 'GIT_SCAN_STARTED')) {
        setAnalysis((prev: any) => ({ ...prev, status: 'RUNNING' }));
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const resolvedTargetType = 
    (analysis?.targetType) || 
    (analyses.find(a => a.analysisId === currentAnalysisId)?.targetType) || 
    (currentAnalysisId ? localStorage.getItem(`cryptavista_target_type_${currentAnalysisId}`) : null) || 
    localStorage.getItem('cryptavista_selected_target_type') || 
    '';

  // Use a ref-based mount timestamp so the iframe src changes on every component mount
  // This ensures CBOMKit is always loaded fresh when navigating to the CBOM page
  const iframeMountKeyRef = useRef<number>(Date.now());
  useEffect(() => {
    iframeMountKeyRef.current = Date.now();
  }, [currentAnalysisId]);

  const iframeSrc = React.useMemo(() => {
    if (!currentAnalysisId) return '';
    return `http://localhost:8001/?analysisId=${encodeURIComponent(currentAnalysisId)}&targetType=${encodeURIComponent(resolvedTargetType)}&v=${iframeMountKeyRef.current}`;
  }, [currentAnalysisId, resolvedTargetType]);

  // Send LOAD_ANALYSIS to the iframe whenever the analysis ID, target type, or completion status changes
  const lastSentAnalysisRef = useRef<string>('');
  useEffect(() => {
    if (!currentAnalysisId || !iframeRef.current?.contentWindow) return;
    const key = `${currentAnalysisId}:${resolvedTargetType}:${analysis?.status}`;
    if (key === lastSentAnalysisRef.current) return;
    lastSentAnalysisRef.current = key;
    try {
      iframeRef.current.contentWindow.postMessage({
        type: 'LOAD_ANALYSIS',
        analysisId: currentAnalysisId,
        targetType: resolvedTargetType,
        status: analysis?.status,
        assets: assets
      }, '*');
    } catch { }
  }, [currentAnalysisId, resolvedTargetType, analysis?.status, assets]);

  // Send UPDATE_ASSETS when assets become available
  useEffect(() => {
    if (currentAnalysisId && iframeRef.current?.contentWindow && assets.length > 0) {
      try {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_ASSETS',
          analysisId: currentAnalysisId,
          assets: assets
        }, '*');
      } catch { }
    }
  }, [currentAnalysisId, assets]);


  // State calculations
  const isCompleted = !loading && (analysis?.status === 'COMPLETED' || (assets.length > 0 && analysis?.status !== 'RUNNING' && analysis?.status !== 'FAILED'));
  const isRunning = isScanning || (!loading && analysis?.status === 'RUNNING');
  const isFailed = !loading && (analysis?.status === 'FAILED' || !!scanError) && !isRunning;
  const isWaitingForInput = !loading && !isCompleted && !isRunning && !isFailed;

  // Background status polling when analysis is in progress
  useEffect(() => {
    if (!currentAnalysisId || isCompleted || isFailed || isWaitingForInput) return;

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
  }, [currentAnalysisId, isCompleted, isFailed, isWaitingForInput, fetchData, fetchIncrementalData]);

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
  const checkCBOMKit = async (retries = 2) => {
    setIsCheckingCbomKit(true);
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        await fetch("http://localhost:8001/", { mode: "no-cors", signal: controller.signal });
        clearTimeout(timeoutId);
        setCbomKitOnline(true);
        setIsCheckingCbomKit(false);
        return;
      } catch {
        if (i === retries) {
          // If the iframe already mounted and fired onLoad, keep online
          if (!iframeRef.current) {
            setCbomKitOnline(false);
          }
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    setIsCheckingCbomKit(false);
  };

  useEffect(() => {
    checkCBOMKit();
  }, []);

  // Unified Authoritative CRYPTAVISTA Quantum Classification Model (Single Source of Truth)
  const cbomClassification = useMemo(() => {
    const stats = calculateClassificationStats(assets);

    // If assets list is populated, use exact occurrence counts from centralized engine
    if (assets.length > 0) {
      return {
        totalAssets: stats.totalOccurrences,
        quantumSafe: stats.quantumSafe,
        quantumSafePct: stats.quantumSafePct,
        quantumVulnerable: stats.quantumVulnerable,
        quantumVulnerablePct: stats.quantumVulnerablePct,
        quantumWeakened: stats.quantumWeakened,
        quantumWeakenedPct: stats.quantumWeakenedPct,
        unknown: stats.unknown,
        unknownPct: stats.unknownPct,
        isConsistent: stats.isConsistent,
        uniqueLogicalAssets: stats.uniqueAssets
      };
    }

    // Fallback if assets are not yet loaded: parse summaryData or analysis.cbomSummary
    let total = summaryData?.totalCryptoAssets ?? (analysis?.cbomSummary?.totalCryptoAssets ?? (analysis?.detectedCryptoAssetCount ?? 0));
    let qs = summaryData?.quantumSafe ?? (analysis?.cbomSummary?.quantumSafe ?? 0);
    let qv = summaryData?.quantumVulnerable ?? (analysis?.cbomSummary?.notQuantumSafe ?? 0);
    let qw = summaryData?.quantumWeakened ?? (summaryData?.notApplicable ?? (analysis?.cbomSummary?.notApplicable ?? 0));
    let unk = summaryData?.unknown ?? (analysis?.cbomSummary?.unknown ?? 0);

    const sum = qs + qv + qw + unk;
    if (total === 0 && sum > 0) total = sum;
    else if (sum > 0 && total !== sum) total = sum;

    const calcPct = (count: number) => {
      if (total === 0) return "0.0%";
      return `${((count / total) * 100).toFixed(1)}%`;
    };

    return {
      totalAssets: total,
      quantumSafe: qs,
      quantumSafePct: calcPct(qs),
      quantumVulnerable: qv,
      quantumVulnerablePct: calcPct(qv),
      quantumWeakened: qw,
      quantumWeakenedPct: calcPct(qw),
      unknown: unk,
      unknownPct: calcPct(unk),
      isConsistent: true,
      uniqueLogicalAssets: 0
    };
  }, [summaryData, analysis, assets]);

  const cbomSummary = {
    totalCryptoAssets: cbomClassification.totalAssets,
    quantumSafe: cbomClassification.quantumSafe,
    quantumVulnerable: cbomClassification.quantumVulnerable,
    quantumWeakened: cbomClassification.quantumWeakened,
    unknown: cbomClassification.unknown,
    notApplicable: 0,
    notQuantumSafe: 0
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

    // Summary Blocks (Exact 4 CRYPTAVISTA classifications with authoritative counts & percentages)
    const summaryTableData = [
      ["Total Cryptographic Asset Occurrences", `${cbomClassification.totalAssets} (100%)`],
      ["Unique Logical Cryptographic Assets", (cbomClassification.uniqueLogicalAssets > 0 ? cbomClassification.uniqueLogicalAssets.toString() : "-")],
      ["Quantum Safe", `${cbomClassification.quantumSafe} (${cbomClassification.quantumSafePct})`],
      ["Quantum Vulnerable", `${cbomClassification.quantumVulnerable} (${cbomClassification.quantumVulnerablePct})`],
      ["Quantum-Weakened", `${cbomClassification.quantumWeakened} (${cbomClassification.quantumWeakenedPct})`],
      ["Unknown", `${cbomClassification.unknown} (${cbomClassification.unknownPct})`]
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
              <span className="flex items-center gap-1">
                Scan Status:{" "}
                <span className={`font-medium ${isCompleted ? "text-emerald-600" : isRunning ? "text-blue-600" : isFailed ? "text-red-600" : "text-amber-600"
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
            {isCompleted && (
              <button onClick={handleDownloadPdf} className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#162e4d] text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
                <Download size={16} /> Download CBOM PDF
              </button>
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


        {/* Consistency Notification if reconciliation was required */}
        {!cbomClassification.isConsistent && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              Authoritative CBOM classification counts were reconciled with discovered inventory occurrences.
            </span>
          </div>
        )}

        {/* Dynamic CBOM Stats: Exactly 5 cards (Total + 4 Authoritative CRYPTAVISTA Quantum Classifications) */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {/* CARD 1: Total Cryptographic Asset Occurrences */}
          <CbomSummaryCard
            icon={<Box size={18} strokeWidth={2} className="w-[18px] h-[18px] shrink-0 text-blue-600" />}
            title="Total Cryptographic Asset Occurrences"
            titleColorClass="text-[#6b7589]"
            badgeText={isWaitingForInput ? "-" : "100%"}
            badgeClass="bg-blue-50 text-blue-700 border border-blue-200"
            mainValue={loading ? "…" : isWaitingForInput || (!analysis && assets.length === 0) ? "-" : cbomClassification.totalAssets}
            description="Total occurrences"
            descriptionColorClass="text-[#6b7589]"
            borderColorClass="border-[#dde1e9]"
            hoverBorderClass="hover:border-gray-300"
            secondaryContent={
              <div className="bg-[#f0f5fc] border border-[#d3e2f5] rounded-md px-3 py-2 text-center">
                <div className="text-xl font-bold text-[#1e3a5f] leading-none">
                  {loading ? "…" : isWaitingForInput || (!analysis && assets.length === 0) ? "-" : (cbomClassification.uniqueLogicalAssets || 0)}
                </div>
                <div className="text-[10px] font-semibold text-[#1e3a5f] mt-1">
                  Unique Cryptographic Assets
                </div>
              </div>
            }
          />

          {/* CARD 2: Quantum Safe */}
          <CbomSummaryCard
            icon={<ShieldCheck size={18} className="w-[18px] h-[18px] shrink-0 text-emerald-600" />}
            title="Quantum Safe"
            titleColorClass="text-emerald-800"
            badgeText={isWaitingForInput ? "-" : cbomClassification.quantumSafePct}
            badgeClass="bg-emerald-50 text-emerald-700 border border-emerald-200"
            mainValue={loading ? "…" : isWaitingForInput || (!analysis && assets.length === 0) ? "-" : cbomClassification.quantumSafe}
            description="Post-quantum algorithms"
            descriptionColorClass="text-emerald-700/80"
            borderColorClass="border-emerald-200"
            hoverBorderClass="hover:border-emerald-300"
          />

          {/* CARD 3: Quantum Vulnerable */}
          <CbomSummaryCard
            icon={<ShieldAlert size={18} className="w-[18px] h-[18px] shrink-0 text-red-600" />}
            title="Quantum Vulnerable"
            titleColorClass="text-red-800"
            badgeText={isWaitingForInput ? "-" : cbomClassification.quantumVulnerablePct}
            badgeClass="bg-red-50 text-red-700 border border-red-200"
            mainValue={loading ? "…" : isWaitingForInput || (!analysis && assets.length === 0) ? "-" : cbomClassification.quantumVulnerable}
            description="Classical public-key algorithms"
            descriptionColorClass="text-red-700/80"
            borderColorClass="border-red-200"
            hoverBorderClass="hover:border-red-300"
          />

          {/* CARD 4: Quantum-Weakened */}
          <CbomSummaryCard
            icon={<AlertTriangle size={18} className="w-[18px] h-[18px] shrink-0 text-amber-600" />}
            title="Quantum-Weakened"
            titleColorClass="text-amber-800"
            badgeText={isWaitingForInput ? "-" : cbomClassification.quantumWeakenedPct}
            badgeClass="bg-amber-50 text-amber-700 border border-amber-200"
            mainValue={loading ? "…" : isWaitingForInput || (!analysis && assets.length === 0) ? "-" : cbomClassification.quantumWeakened}
            description="Classical symmetric cryptography"
            descriptionColorClass="text-amber-700/80"
            borderColorClass="border-amber-200"
            hoverBorderClass="hover:border-amber-300"
          />

          {/* CARD 5: Unknown */}
          <CbomSummaryCard
            icon={<HelpCircle size={18} className="w-[18px] h-[18px] shrink-0 text-gray-500" />}
            title="Unknown"
            titleColorClass="text-[#6b7589]"
            badgeText={isWaitingForInput ? "-" : cbomClassification.unknownPct}
            badgeClass="bg-gray-50 text-gray-700 border border-gray-200"
            mainValue={loading ? "…" : isWaitingForInput || (!analysis && assets.length === 0) ? "-" : cbomClassification.unknown}
            description="Unrecognized / insufficient evidence"
            descriptionColorClass="text-[#6b7589]"
            borderColorClass="border-[#dde1e9]"
            hoverBorderClass="hover:border-gray-300"
          />
        </div>

        {/* Cryptographic Visualization (Dark-Themed) */}
        <div className="bg-white border border-[#dde1e9] rounded-lg flex flex-col overflow-hidden shadow-sm h-[620px]">
          <div className="px-5 py-3 border-b border-[#dde1e9] bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-[#1a1d23]">Cryptographic Visualization</div>
              <span className="text-xs text-gray-500 font-normal">
                {cbomClassification.totalAssets} Cryptographic Asset Occurrences Mapped
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
                    onClick={() => checkCBOMKit()}
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
                      // Reset the deduplication ref so the useEffect can re-fire after the iframe reloads
                      lastSentAnalysisRef.current = '';
                      iframe.contentWindow.postMessage({
                        type: 'LOAD_ANALYSIS',
                        analysisId: currentAnalysisId,
                        targetType: resolvedTargetType,
                        status: analysis?.status,
                        assets: assets
                      }, '*');
                    }
                  } catch { }
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
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cryptographic Classification</th>
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
                ) : isRunning ? (
                  <tr><td colSpan={6} className="p-8 text-center text-blue-600">
                    <Loader2 className="animate-spin inline mr-2" size={16} />Cryptographic discovery in progress...
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">
                    {isWaitingForInput ? "Awaiting input. Please provide scan configuration in the CBOM interface above and click Scan." : "No cryptographic assets detected in this application."}
                  </td></tr>
                ) : (
                  filtered.map((rawAsset, idx) => {
                    const norm = classifyAsset(rawAsset);
                    const qClass = norm.quantumClassification;
                    const badgeStyle =
                      qClass === 'Quantum Safe'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                        : qClass === 'Quantum Vulnerable'
                          ? 'bg-red-50 text-red-800 border-red-300 font-semibold'
                          : qClass === 'Quantum-Weakened'
                            ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                            : 'bg-slate-50 text-slate-700 border-slate-300';

                    const riskColors: Record<string, string> = {
                      Low: '#16A34A',
                      Medium: '#D97706',
                      High: '#DC2626',
                      Unknown: '#64748B',
                      'Unknown / Review': '#64748B'
                    };
                    const hex = riskColors[norm.quantumRisk] || riskColors.Unknown;

                    return (
                      <tr key={norm.assetId || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-mono text-sm text-[#1e3a5f] font-semibold">{norm.assetName || "-"}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">{norm.assetType || "-"}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{norm.primitive || "-"}</td>
                        <td className="px-5 py-4 text-sm whitespace-nowrap">
                          <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
                            {qClass}
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
                            {norm.quantumRisk === 'Unknown' ? 'Unknown / Review' : norm.quantumRisk} {norm.quantumRiskScore !== null ? `(${norm.quantumRiskScore})` : '(-)'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500 font-mono">
                          <span className="truncate max-w-[240px] block" title={norm.sourceLocation}>{norm.sourceLocation || "-"}</span>
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
