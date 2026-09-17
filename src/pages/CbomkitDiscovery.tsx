import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  GitBranch, 
  FolderOpen, 
  Search, 
  ChevronRight, 
  Shield, 
  Cpu, 
  Key, 
  Layers,
  ExternalLink,
  Play
} from 'lucide-react';
import JSZip from 'jszip';

interface CbomkitDiscoveryProps {
  onNavigate?: (id: string) => void;
  analysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  refreshAnalyses?: (preferredId?: string) => void;
}

const CBOMKIT_URL = 'http://localhost:8001/';

export default function CbomkitDiscovery({ 
  onNavigate, 
  analysisId, 
  onSelectAnalysis, 
  refreshAnalyses 
}: CbomkitDiscoveryProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [runtimeEnabled, setRuntimeEnabled] = useState(false);
  const [targetType, setTargetType] = useState<string>('source_code');
  const [appName, setAppName] = useState<string>('');
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [gitBranch, setGitBranch] = useState<string>('main');
  const [gitCommit, setGitCommit] = useState<string>('HEAD');
  const [scannedLines, setScannedLines] = useState<number>(0);
  const [scannedFiles, setScannedFiles] = useState<number>(0);
  const [assets, setAssets] = useState<any[]>([]);
  const [hasCbom, setHasCbom] = useState(false);
  const [search, setSearch] = useState('');
  const [isDownloadingCbom, setIsDownloadingCbom] = useState(false);

  // Tab & embedded iframe state
  const [activeTab, setActiveTab] = useState<'scanner' | 'assets'>('scanner');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Folder upload fallback state (when targetType === 'folder')
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<File[]>([]);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [isScanningFolder, setIsScanningFolder] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Synchronize selection & localStorage
  useEffect(() => {
    if (!analysisId) return;
    if (onSelectAnalysis) onSelectAnalysis(analysisId);
    try {
      localStorage.setItem('cryptavista_selected_analysis_id', analysisId);
    } catch {}
  }, [analysisId, onSelectAnalysis]);

  // Fetch initial analysis metadata
  const fetchMetadata = async () => {
    if (!analysisId) return;
    try {
      const res = await fetch(`http://localhost:3001/api/analyses/${analysisId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.targetType) setTargetType(data.targetType);
        if (data.applicationName) setAppName(data.applicationName);
        if (data.repositoryUrl) setRepoUrl(data.repositoryUrl);
        if (data.gitBranch) setGitBranch(data.gitBranch);
        if (data.gitCommit) setGitCommit(data.gitCommit);
        if (data.scannedLines) setScannedLines(data.scannedLines);
        if (data.scannedFiles) setScannedFiles(data.scannedFiles);
        if (data.runtimeEnabled !== undefined) setRuntimeEnabled(data.runtimeEnabled);
      }
    } catch (err) {
      console.warn('Failed to load analysis metadata', err);
    }
  };

  // Fetch discovered assets from backend
  const fetchAssets = async () => {
    if (!analysisId) return;
    try {
      const res = await fetch(`http://localhost:3001/api/analyses/${analysisId}/assets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAssets(data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch assets', err);
    }
  };

  // Check if raw CBOM is available for download
  const checkCbomAvailability = async () => {
    if (!analysisId) return;
    try {
      const res = await fetch(`http://localhost:3001/api/analyses/${analysisId}/cbom`);
      if (res.ok) {
        setHasCbom(true);
      }
    } catch {}
  };

  // Status polling & lifecycle management
  useEffect(() => {
    if (!analysisId) return;

    fetchMetadata();
    fetchAssets();
    checkCbomAvailability();

    let pollInterval: NodeJS.Timeout;
    let transitionTimer: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/analyses/${analysisId}/status`);
        if (response.ok) {
          const data = await response.json();
          const normalizedStatus = String(data.status ?? '').toUpperCase();
          const discoverStatus = String(data.stages?.discover?.status ?? '').toUpperCase();

          if (data.runtimeEnabled !== undefined) {
            setRuntimeEnabled(data.runtimeEnabled);
          }
          if (data.scannedLines) setScannedLines(data.scannedLines);
          if (data.scannedFiles) setScannedFiles(data.scannedFiles);
          if (data.gitBranch) setGitBranch(data.gitBranch);
          if (data.gitCommit) setGitCommit(data.gitCommit);
          if (data.repositoryUrl) setRepoUrl(data.repositoryUrl);
          if (data.applicationName) setAppName(data.applicationName);

          // Update live findings dynamically
          fetchAssets();
          checkCbomAvailability();

          if (discoverStatus === 'COMPLETED' || normalizedStatus === 'COMPLETED') {
            setIsCompleted(true);
            setHasFailed(false);
            clearInterval(pollInterval);

            // Final data sync
            fetchAssets();
            checkCbomAvailability();
            if (refreshAnalyses) refreshAnalyses(analysisId);

            // Proceed to Classification after a brief delay
            transitionTimer = setTimeout(() => {
              if (onNavigate) {
                if (data.runtimeEnabled) {
                  onNavigate('runtime');
                } else {
                  onNavigate('classification');
                }
              }
            }, 3000);
          } else if (discoverStatus === 'FAILED' || normalizedStatus === 'FAILED') {
            clearInterval(pollInterval);
            setHasFailed(true);
            setErrorMessage(data.errorMessage || 'Discovery encountered an unexpected error.');
          }
        }
      } catch (err) {
        console.error('Failed to poll analysis status', err);
      }
    };

    pollStatus();
    pollInterval = setInterval(pollStatus, 2000);

    return () => {
      clearInterval(pollInterval);
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, [analysisId, onNavigate]);

  // Real CBOM Download Handler
  const handleDownloadCbom = async () => {
    if (!analysisId) return;
    try {
      setIsDownloadingCbom(true);
      const res = await fetch(`http://localhost:3001/api/analyses/${analysisId}/cbom`);
      if (!res.ok) throw new Error('CBOM is still being compiled by CBOMKit.');
      const cbomJson = await res.json();
      const blob = new Blob([JSON.stringify(cbomJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${analysisId}-cyclonedx-cbom.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('CBOM Download: ' + e.message);
    } finally {
      setIsDownloadingCbom(false);
    }
  };

  // Folder Scan Handler (Fallback for Project Folder target)
  const handleStartFolderScan = async () => {
    if (!analysisId || selectedFolderFiles.length === 0) return;
    try {
      setIsScanningFolder(true);
      const zip = new JSZip();
      for (const file of selectedFolderFiles) {
        const relPath = file.webkitRelativePath || file.name;
        const sanitizedPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
        zip.file(sanitizedPath, file);
      }
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const formData = new FormData();
      formData.append('file', zipBlob, `${selectedFolderName || 'project'}.zip`);

      const res = await fetch(`http://localhost:3001/api/analyses/${analysisId}/scan`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start folder scan');
      }
    } catch (err: any) {
      alert('Folder Scan Error: ' + err.message);
    } finally {
      setIsScanningFolder(false);
    }
  };

  // Helper formatters
  const formatPrimitive = (p?: string | null) => {
    if (!p) return 'Unspecified';
    const map: Record<string, string> = {
      'block-cipher': 'Block Cipher',
      'hash': 'Hash Function',
      'pke': 'Public Key Encryption',
      'ae': 'Authenticated Encryption',
      'signature': 'Digital Signature',
      'mac': 'MAC',
      'dh': 'Key Agreement',
      'key-agree': 'Key Agreement',
      'kdf': 'Key Derivation',
      'xof': 'Extendable Output Function',
      'pbkdf': 'Password-Based KDF',
    };
    return map[p.toLowerCase()] ?? p;
  };

  const formatAssetType = (t?: string | null) => {
    if (!t) return '-';
    const map: Record<string, string> = {
      'algorithm': 'Algorithm',
      'related-crypto-material': 'Related Crypto Material',
      'certificate': 'Certificate',
      'protocol': 'Protocol',
      'library': 'Library',
    };
    return map[t.toLowerCase()] ?? t;
  };

  // Dynamic Analytics Calculation from REAL backend data
  const { primitiveCounts, functionCounts, typeCounts, algoCount, keyCount } = useMemo(() => {
    const pMap = new Map<string, number>();
    const fMap = new Map<string, number>();
    const tMap = new Map<string, number>();
    let algos = 0;
    let keys = 0;

    assets.forEach(a => {
      // Type breakdown
      const t = formatAssetType(a.assetType);
      tMap.set(t, (tMap.get(t) || 0) + 1);
      if (a.assetType === 'algorithm') algos++;
      else keys++;

      // Primitive breakdown
      const p = formatPrimitive(a.primitive);
      pMap.set(p, (pMap.get(p) || 0) + 1);

      // Functions breakdown
      const primLower = (a.primitive || '').toLowerCase();
      const nameLower = (a.assetName || a.algorithm || '').toLowerCase();
      if (primLower === 'pke' || primLower === 'signature') {
        fMap.set('Sign / Verify', (fMap.get('Sign / Verify') || 0) + 1);
      } else if (primLower === 'block-cipher' || primLower === 'ae') {
        fMap.set('Encrypt / Decrypt', (fMap.get('Encrypt / Decrypt') || 0) + 1);
      } else if (primLower === 'hash') {
        fMap.set('Digest / Hash', (fMap.get('Digest / Hash') || 0) + 1);
      } else if (primLower === 'kdf' || primLower === 'pbkdf' || primLower === 'dh' || primLower === 'key-agree') {
        fMap.set('Key Exchange / KDF', (fMap.get('Key Exchange / KDF') || 0) + 1);
      } else if (nameLower.includes('key') || a.assetType === 'related-crypto-material') {
        fMap.set('Key Generation', (fMap.get('Key Generation') || 0) + 1);
      } else {
        fMap.set('Crypto Operations', (fMap.get('Crypto Operations') || 0) + 1);
      }
    });

    return {
      primitiveCounts: Array.from(pMap.entries()).sort((a, b) => b[1] - a[1]),
      functionCounts: Array.from(fMap.entries()).sort((a, b) => b[1] - a[1]),
      typeCounts: Array.from(tMap.entries()).sort((a, b) => b[1] - a[1]),
      algoCount: algos,
      keyCount: keys
    };
  }, [assets]);

  // Filtered Assets for Table
  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(a => 
      (a.assetName && a.assetName.toLowerCase().includes(q)) ||
      (a.assetType && a.assetType.toLowerCase().includes(q)) ||
      (a.primitive && a.primitive.toLowerCase().includes(q)) ||
      (a.location && a.location.toLowerCase().includes(q))
    );
  }, [assets, search]);

  const isFolder = targetType === 'folder';

  return (
    <div className="flex flex-col w-full h-full bg-[#0b1523] text-white select-none overflow-y-auto">
      {/* Top bar matching CRYPTAVISTA dark discovery workspace */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-[#132338] border-b border-white/10 shrink-0 sticky top-0 z-30 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <h1 className="text-white font-bold text-[14px] tracking-wide">Cryptographic Discovery</h1>
          </div>
          <div className="text-blue-200/60 text-[11px] mt-0.5">
            Scan your project using the discovery interface below, then wait for CRYPTAVISTA to detect the result.
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          {assets.length > 0 && (
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
              <button
                onClick={() => setActiveTab('scanner')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  activeTab === 'scanner'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-blue-200/70 hover:text-white'
                }`}
              >
                CBOM Interface
              </button>
              <button
                onClick={() => setActiveTab('assets')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  activeTab === 'assets'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-blue-200/70 hover:text-white'
                }`}
              >
                Discovered Assets ({assets.length})
              </button>
            </div>
          )}

          <button
            onClick={handleDownloadCbom}
            disabled={!hasCbom || isDownloadingCbom}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md border transition-all ${
              hasCbom 
                ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-sm cursor-pointer' 
                : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
            }`}
            title={hasCbom ? 'Download authentic CycloneDX CBOM JSON' : 'CBOM is compiling...'}
          >
            <Download size={13} />
            {isDownloadingCbom ? 'Downloading...' : 'Download CBOM'}
          </button>

          {isCompleted && (
            <button
              onClick={() => onNavigate && onNavigate(runtimeEnabled ? 'runtime' : 'classification')}
              className="flex items-center gap-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer"
            >
              Proceed to Classification <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'scanner' ? (
        <div className="flex-1 w-full flex flex-col relative bg-[#0b1523] pb-24">
          {/* Subheader Strip */}
          <div className="px-6 py-2.5 bg-[#0e1c2f] border-b border-white/10 flex items-center justify-between text-[11px] text-blue-200/70 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Target Application:</span>
              <span className="font-mono text-blue-300 font-bold">{appName || 'Application'}</span>
              <span className="text-white/30">•</span>
              <span>{isFolder ? 'Project Folder' : 'Git Repository'}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Analysis ID: <strong className="font-mono text-blue-300">{analysisId || '—'}</strong></span>
              <a
                href={CBOMKIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 underline font-medium"
              >
                <span>Open in Tab</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* If Folder and not scanned yet, show folder picker */}
          {isFolder && assets.length === 0 && !isCompleted ? (
            <div className="max-w-xl mx-auto my-auto p-8 bg-[#132338] border border-white/10 rounded-2xl shadow-2xl text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mx-auto flex items-center justify-center text-blue-400">
                <FolderOpen size={32} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Select Project Folder to Scan</h3>
                <p className="text-xs text-blue-200/70 mt-1">
                  CRYPTAVISTA will analyze your local directory, discover cryptographic primitives, and compile a CycloneDX CBOM.
                </p>
              </div>

              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={e => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  const fArray = Array.from(files);
                  setSelectedFolderFiles(fArray);
                  const sampleRel = fArray[0]?.webkitRelativePath || '';
                  setSelectedFolderName(sampleRel.split('/')[0] || 'ProjectFolder');
                }}
              />

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <FolderOpen size={15} />
                  {selectedFolderFiles.length > 0 ? "Change Folder" : "Choose Folder"}
                </button>

                <button
                  type="button"
                  onClick={handleStartFolderScan}
                  disabled={selectedFolderFiles.length === 0 || isScanningFolder}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  {isScanningFolder ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  <span>Start Scan</span>
                </button>
              </div>

              {selectedFolderFiles.length > 0 && (
                <div className="text-[11px] text-emerald-400">
                  Selected: <strong>{selectedFolderName}</strong> ({selectedFolderFiles.length} files ready)
                </div>
              )}
            </div>
          ) : (
            /* Live Embedded CBOMKit Interface */
            <div className="flex-1 w-full h-[calc(100vh-7.5rem)] relative bg-[#0b1523]">
              {!iframeLoaded && !iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b1523] z-10">
                  <Loader2 className="animate-spin text-blue-400 mb-3" size={32} />
                  <div className="text-white text-[13px] font-semibold">Loading Discovery Interface...</div>
                  <div className="text-blue-200/50 text-[11px] mt-1">Connecting to CBOM scanner on port 8001</div>
                </div>
              )}

              {iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0e1c2f] z-10 px-8">
                  <AlertTriangle className="text-amber-400 mb-3" size={32} />
                  <div className="text-white text-[14px] font-bold mb-2">Discovery UI Not Loading in Iframe</div>
                  <div className="text-blue-200/70 text-[12px] text-center mb-5 max-w-md">
                    The scanner interface may be blocking embedded display. Use the button below to open it in a new tab — scan your project there, then return here and CRYPTAVISTA will automatically detect the result.
                  </div>
                  <a
                    href={CBOMKIT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[13px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg transition-colors"
                  >
                    <ExternalLink size={14} />
                    Open Scanner in New Tab
                  </a>
                </div>
              )}

              <iframe
                src={CBOMKIT_URL}
                className={`w-full h-full border-none ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
                title="Cryptographic Discovery"
                onLoad={() => { setIframeLoaded(true); setIframeError(false); }}
                onError={() => setIframeError(true)}
              />
            </div>
          )}
        </div>
      ) : (
        /* Discovered Assets & Metrics View */
        <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-5 space-y-4 pb-28">

        {/* Source Information Card */}
        <div className="bg-[#132338] border border-white/10 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              {isFolder ? <FolderOpen size={20} /> : <GitBranch size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-[13px]">
                  {appName || (isFolder ? 'Project Folder Target' : 'Git Repository Target')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {isFolder ? 'Project Folder' : 'Git Repository'}
                </span>
              </div>
              <div className="text-blue-200/60 text-[11px] font-mono mt-0.5">
                {isFolder 
                  ? `Application Name: ${appName || 'Local Project'} | Source Type: Folder Archive`
                  : (repoUrl || 'https://github.com/repository.git')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-blue-200/70">
            {!isFolder && (
              <>
                <div className="flex flex-col">
                  <span className="text-blue-200/40 text-[10px] uppercase font-semibold">Revision / Branch</span>
                  <span className="font-mono text-white font-medium">{gitBranch || 'main'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-blue-200/40 text-[10px] uppercase font-semibold">Commit</span>
                  <span className="font-mono text-white font-medium">{gitCommit ? gitCommit.substring(0, 7) : 'HEAD'}</span>
                </div>
              </>
            )}
            <div className="flex flex-col">
              <span className="text-blue-200/40 text-[10px] uppercase font-semibold">Analysis ID</span>
              <span className="font-mono text-blue-300 font-bold">{analysisId || '—'}</span>
            </div>
          </div>
        </div>

        {/* Live Discovery Status Banner */}
        <div className={`border rounded-xl p-4 transition-all shadow-md relative overflow-hidden ${
          isCompleted 
            ? 'bg-emerald-950/20 border-emerald-500/40' 
            : hasFailed 
            ? 'bg-red-950/20 border-red-500/40' 
            : 'bg-[#152740] border-blue-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-lg shrink-0 ${
                isCompleted 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : hasFailed 
                  ? 'bg-red-500/20 text-red-400' 
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 size={22} className="text-emerald-400" />
                ) : hasFailed ? (
                  <AlertTriangle size={22} className="text-red-400" />
                ) : (
                  <Loader2 size={22} className="animate-spin text-blue-400" />
                )}
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-white">
                  {isCompleted ? (
                    <span>{assets.length} cryptographic assets found.</span>
                  ) : hasFailed ? (
                    <span className="text-red-300">Discovery failed</span>
                  ) : (
                    <span>
                      Scanning code for cryptographic assets...{' '}
                      {assets.length > 0 && (
                        <span className="text-blue-300 font-normal">
                          ({assets.length} cryptographic assets found...)
                        </span>
                      )}
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-blue-200/70 mt-0.5">
                  {isCompleted ? (
                    scannedLines > 0 
                      ? `Scanned ${scannedLines.toLocaleString()} lines of code across ${scannedFiles} files. CycloneDX CBOM components generated.`
                      : 'Cryptographic Bill of Materials (CBOM) generated and ingested successfully.'
                  ) : hasFailed ? (
                    errorMessage || 'The scanner encountered an issue. Please verify scanner logs.'
                  ) : (
                    scannedLines > 0
                      ? `Scanned ${scannedLines.toLocaleString()} lines of code across ${scannedFiles} files... extracting primitives.`
                      : 'Extracting cryptographic algorithms, key material, and operational usages from codebase.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isCompleted 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                  : hasFailed 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
              }`}>
                {isCompleted ? 'Completed' : hasFailed ? 'Failed' : 'Running'}
              </span>
            </div>
          </div>

          {!isCompleted && !hasFailed && (
            <div className="w-full bg-blue-950/40 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-blue-500 h-full w-1/3 rounded-full animate-pulse" />
            </div>
          )}
        </div>

        {/* Discovery Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Crypto Assets */}
          <div className="bg-[#132338] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-blue-200/60 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Crypto Assets</span>
                <Cpu size={15} className="text-blue-400" />
              </div>
              <div className="text-[26px] font-bold text-white tracking-tight">
                {assets.length}
              </div>
              <div className="text-[11px] text-blue-200/60 mt-0.5">
                Total detected cryptographic asset occurrences
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-blue-200/70">Algorithms: <strong className="text-white">{algoCount}</strong></span>
              <span className="text-blue-200/70">Keys: <strong className="text-white">{keyCount}</strong></span>
            </div>
          </div>

          {/* Card 2: Crypto Primitives */}
          <div className="bg-[#132338] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-blue-200/60 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Crypto Primitives</span>
                <Shield size={15} className="text-indigo-400" />
              </div>
              <div className="text-[26px] font-bold text-white tracking-tight">
                {primitiveCounts.length}
              </div>
              <div className="text-[11px] text-blue-200/60 mt-0.5">
                Distinct primitive categories detected
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5 max-h-14 overflow-y-auto">
              {primitiveCounts.length === 0 ? (
                <span className="text-[10px] text-white/40">Detecting primitives...</span>
              ) : (
                primitiveCounts.slice(0, 3).map(([prim, count]) => (
                  <span key={prim} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-blue-200">
                    {prim}: <strong className="text-white">{count}</strong>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Card 3: Crypto Functions */}
          <div className="bg-[#132338] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-blue-200/60 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Crypto Functions</span>
                <Layers size={15} className="text-emerald-400" />
              </div>
              <div className="text-[26px] font-bold text-white tracking-tight">
                {functionCounts.length}
              </div>
              <div className="text-[11px] text-blue-200/60 mt-0.5">
                Active cryptographic operation categories
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5 max-h-14 overflow-y-auto">
              {functionCounts.length === 0 ? (
                <span className="text-[10px] text-white/40">Analyzing functions...</span>
              ) : (
                functionCounts.slice(0, 3).map(([fn, count]) => (
                  <span key={fn} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-emerald-200">
                    {fn}: <strong className="text-white">{count}</strong>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Card 4: Asset Types */}
          <div className="bg-[#132338] border border-white/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-blue-200/60 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Asset Types</span>
                <Key size={15} className="text-amber-400" />
              </div>
              <div className="text-[26px] font-bold text-white tracking-tight">
                {typeCounts.length}
              </div>
              <div className="text-[11px] text-blue-200/60 mt-0.5">
                CycloneDX cryptographic component types
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5 max-h-14 overflow-y-auto">
              {typeCounts.length === 0 ? (
                <span className="text-[10px] text-white/40">Classifying types...</span>
              ) : (
                typeCounts.map(([typ, count]) => (
                  <span key={typ} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-amber-200">
                    {typ}: <strong className="text-white">{count}</strong>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cryptographic Asset Table */}
        <div className="bg-[#132338] border border-white/10 rounded-xl overflow-hidden shadow-lg">
          {/* Table Toolbar */}
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#152740]">
            <div>
              <span className="text-[13px] font-bold text-white">
                Cryptographic Assets ({filteredAssets.length})
              </span>
              <span className="text-[11px] text-blue-200/60 ml-2 hidden sm:inline">
                Real scan findings extracted into CycloneDX CBOM
              </span>
            </div>

            <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 w-64">
              <Search size={13} className="text-blue-200/50 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search assets, type, location..."
                className="bg-transparent text-[11px] text-white outline-none w-full placeholder-blue-200/40"
              />
            </div>
          </div>

          {/* Table Contents */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-[#0e1c2f]/80 border-b border-white/10 text-blue-200/70 text-[10px] uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3">Cryptographic Asset</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Primitive</th>
                  <th className="px-5 py-3">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assets.length === 0 && !isCompleted ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-blue-200/50">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-blue-400" size={24} />
                        <span className="text-[12px] font-medium text-white/70">
                          Scanning code for cryptographic assets...
                        </span>
                        <span className="text-[10px] text-blue-200/40">
                          Discovered algorithms, keys, and usages will appear dynamically.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-blue-200/50">
                      No cryptographic assets found matching &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset, index) => (
                    <tr key={asset.assetId || index} className="hover:bg-white/5 transition-colors">
                      {/* Asset Name */}
                      <td className="px-5 py-3 font-mono font-bold text-blue-300">
                        {asset.assetName || asset.algorithm || '-'}
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 border border-white/10 text-blue-200">
                          {formatAssetType(asset.assetType)}
                        </span>
                      </td>

                      {/* Primitive */}
                      <td className="px-5 py-3 text-white/90">
                        {formatPrimitive(asset.primitive)}
                      </td>

                      {/* Location */}
                      <td className="px-5 py-3 font-mono text-[11px] text-blue-200/70 max-w-md truncate">
                        {asset.location || asset.sourceLocation || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      )}

      {/* Floating Status Overlay (Discovery Stage) - Exact Reference Styling */}
      <div className="fixed bottom-6 left-6 bg-white shadow-2xl border border-gray-200 rounded-xl p-4 flex flex-col gap-2 min-w-[340px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="font-bold text-gray-900 text-[13px]">Discovery Stage</h3>
        </div>

        {!isCompleted && !hasFailed ? (
          <>
            <div className="flex items-center gap-2 text-blue-600 text-[12px] font-semibold">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Running cryptographic discovery...</span>
            </div>
            <div className="text-[11px] text-gray-500 leading-relaxed">
              CRYPTAVISTA is analyzing the selected target. The next stage will continue automatically when discovery is complete.
            </div>
          </>
        ) : hasFailed ? (
          <div className="text-red-600 text-[12px] font-medium">
            <div className="font-bold">Discovery failed</div>
            <div className="text-[11px] text-gray-600 mt-0.5">{errorMessage}</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-600 text-[13px] font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Completed</span>
            </div>
            <div className="text-[12px] text-gray-700 leading-relaxed">
              <p className="font-medium">CBOM generated successfully.</p>
              <p className="mt-1 text-emerald-600 font-semibold flex items-center gap-1">
                <span>Proceeding to Classification...</span>
                <Loader2 className="w-3 h-3 animate-spin inline" />
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
