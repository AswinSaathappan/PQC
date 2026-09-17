export default function CbomkitEmbed({ analysisId, mode = 'view' }: { analysisId?: string, mode?: 'scan' | 'view' }) {
  // If mode is scan, we embed the root path so the user can scan via the CBOM UI
  const url = mode === 'scan' ? 'http://localhost:8001/' : `http://localhost:8001/?analysisId=${encodeURIComponent(analysisId || '')}`;
  
  if (mode === 'scan') {
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden rounded-xl border border-[#dde1e9] shadow-sm">
        <div className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center justify-between shadow-md z-10 relative">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              CBOM Discovery Interface
            </span>
          </div>
          <div className="text-[11px] font-medium opacity-80 text-blue-100 max-w-lg text-right">
            Please use the CBOM interface below to scan your repository. CRYPTAVISTA is automatically waiting for the results...
          </div>
        </div>
        <div className="flex-1 w-full bg-[#f9fafb] relative">
          <iframe 
            src={url}
            className="w-full h-full border-none absolute inset-0"
            title="CBOM UI"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white flex flex-col h-full rounded-md border border-[#dde1e9] overflow-hidden">
      <div className="bg-[#1e3a5f] text-white px-4 py-2 border-b border-white/10 flex justify-between items-center flex-shrink-0">
        <span className="text-[12px] font-bold">Cryptographic Discovery Interface</span>
      </div>
      <div className="w-full h-[500px] relative">
        <iframe 
          src={url}
          className="w-full h-full border-none absolute inset-0"
          title="CBOM Visualization"
        />
      </div>
    </div>
  );
}
