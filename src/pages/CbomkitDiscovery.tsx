import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react';

interface CbomkitDiscoveryProps {
  onNavigate?: (id: string) => void;
  analysisId?: string;
}

const CBOMKIT_URL = 'http://localhost:8001/';

export default function CbomkitDiscovery({ onNavigate, analysisId }: CbomkitDiscoveryProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [runtimeEnabled, setRuntimeEnabled] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    if (!analysisId) return;

    let pollInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/analyses/${analysisId}/status`);
        if (response.ok) {
          const data = await response.json();
          const discoverStatus = data.stages?.discover?.status;

          if (data.runtimeEnabled !== undefined) {
            setRuntimeEnabled(data.runtimeEnabled);
          }

          if (discoverStatus === 'COMPLETED') {
            setIsCompleted(true);
            clearInterval(pollInterval);

            // Auto transition after 5 seconds
            setTimeout(() => {
              if (onNavigate) {
                if (data.runtimeEnabled) {
                  onNavigate('runtime');
                } else {
                  onNavigate('classification');
                }
              }
            }, 5000);
          } else if (discoverStatus === 'FAILED') {
            clearInterval(pollInterval);
            setHasFailed(true);
          }
        }
      } catch (err) {
        console.error('Failed to poll analysis status', err);
      }
    };

    // Start polling immediately, then every 3 seconds
    pollStatus();
    pollInterval = setInterval(pollStatus, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [analysisId, onNavigate]);

  // Detect iframe load timeout (5s) — if it doesn't fire onLoad, likely blocked
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!iframeLoaded) setIframeError(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [iframeLoaded]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#0e1c2f] relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#1e3a5f] border-b border-white/10 flex-shrink-0">
        <div>
          <div className="text-white font-bold text-[13px]">Cryptographic Discovery</div>
          <div className="text-blue-200/60 text-[10px] mt-0.5">
            Scan your project in the discovery interface below, then wait for CRYPTAVISTA to detect the result.
          </div>
        </div>
        <a
          href={CBOMKIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors"
        >
          <ExternalLink size={12} />
          Open in New Tab
        </a>
      </div>

      {/* Iframe area */}
      <div className="flex-1 relative">
        {!iframeLoaded && !iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0e1c2f] z-10">
            <Loader2 className="animate-spin text-blue-400 mb-3" size={32} />
            <div className="text-white text-[13px] font-semibold">Loading discovery interface...</div>
            <div className="text-blue-200/60 text-[11px] mt-1">Connecting to scanner</div>
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
            <div className="mt-4 text-blue-200/50 text-[11px]">
              CRYPTAVISTA is polling for results in the background.
            </div>
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

      {/* Floating Status Overlay */}
      <div className="absolute bottom-6 left-6 bg-white shadow-xl border border-gray-200 rounded-xl p-4 flex flex-col gap-2 min-w-[320px] z-50">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <h3 className="font-bold text-gray-900 text-[13px]">Discovery Stage</h3>
        </div>

        {!isCompleted && !hasFailed ? (
          <>
            <div className="flex items-center gap-2 text-blue-600 text-[12px] font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running cryptographic discovery...</span>
            </div>
            <div className="text-[11px] text-gray-500">
              CRYPTAVISTA is analyzing the selected target. The next stage will continue automatically when discovery is complete.
            </div>
          </>
        ) : hasFailed ? (
          <div className="text-red-600 text-[12px] font-medium">
            Scan failed. Please check logs or try again.
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 text-[13px] font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed</span>
            </div>
            <div className="text-[12px] text-gray-700 leading-relaxed">
              <p>CBOM generated successfully.</p>
              <p className="mt-1.5 text-emerald-600 font-semibold">
                {runtimeEnabled
                  ? 'Continuing to Runtime Evidence...'
                  : 'Runtime Disabled. Proceeding to Classification...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
