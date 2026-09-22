import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { GlobalAnalysis } from "../App";

interface Props {
  analyses?: GlobalAnalysis[];
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
  className?: string;
}

export default function ApplicationSelector({
  analyses = [],
  selectedAnalysisId,
  onSelectAnalysis,
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and deduplicate valid application entries:
  // - Only include entries with a non-empty name
  // - De-duplicate by name (case-insensitive trim)
  // - Prioritize completed analyses over failed or unstarted runs
  const dedupedAnalyses = useMemo(() => {
    const seen = new Set<string>();
    const list: GlobalAnalysis[] = [];

    const sorted = [...analyses].sort((a, b) => {
      const aComp = a.status === "COMPLETED" ? 1 : 0;
      const bComp = b.status === "COMPLETED" ? 1 : 0;
      return bComp - aComp;
    });

    for (const a of sorted) {
      const name = (a.applicationName || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(a);
    }
    return list;
  }, [analyses]);

  const currentApp = useMemo(() => {
    if (selectedAnalysisId) {
      const direct = analyses.find((a) => a.analysisId === selectedAnalysisId);
      if (direct) return direct;
    }
    return dedupedAnalyses[0];
  }, [selectedAnalysisId, analyses, dedupedAnalyses]);

  const filteredAnalyses = useMemo(() => {
    if (!searchQuery.trim()) return dedupedAnalyses;
    const q = searchQuery.toLowerCase();
    return dedupedAnalyses.filter((a) =>
      a.applicationName.toLowerCase().includes(q)
    );
  }, [dedupedAnalyses, searchQuery]);

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!analyses || analyses.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 relative ${className}`} ref={containerRef}>
      <span className="text-[12px] font-semibold text-[#475569] whitespace-nowrap">
        Application:
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="bg-white hover:bg-[#f8fafc] text-[#1e3a5f] border border-[#dde1e9] hover:border-[#cbd5e1] rounded-md px-3 py-1.5 text-xs font-semibold shadow-xs flex items-center justify-between gap-2 min-w-[160px] max-w-[240px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] cursor-pointer"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="truncate flex-1 text-left">
            {currentApp ? currentApp.applicationName : "Select application"}
          </span>
          <ChevronDown
            size={14}
            className={`text-[#64748b] transition-transform duration-150 shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-[#dde1e9] rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
            {/* Search Box */}
            <div className="px-2.5 py-1.5 border-b border-gray-100">
              <div className="flex items-center gap-1.5 bg-[#f8fafc] border border-gray-200 rounded px-2 py-1">
                <Search size={12} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter applications..."
                  className="text-xs bg-transparent outline-none w-full text-[#1a1d23] placeholder:text-gray-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Application Options */}
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
              {filteredAnalyses.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-gray-400">
                  No matching application found
                </div>
              ) : (
                filteredAnalyses.map((a) => {
                  const isSelected =
                    a.analysisId === currentApp?.analysisId ||
                    a.applicationName.toLowerCase() === currentApp?.applicationName?.toLowerCase();
                  return (
                    <button
                      key={a.analysisId}
                      type="button"
                      onClick={() => {
                        if (onSelectAnalysis) {
                          onSelectAnalysis(a.analysisId);
                        }
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs text-left w-full transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#eff6ff] text-[#1e3a5f] font-bold"
                          : "text-[#334155] hover:bg-[#f8fafc] font-normal"
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                        {isSelected && <Check size={13} className="text-[#1e3a5f]" />}
                      </div>
                      <span className="truncate flex-1">{a.applicationName}</span>
                      {a.status === "COMPLETED" && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 shrink-0">
                          ready
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-gray-100 bg-[#f8fafc] text-[10px] text-gray-400 flex justify-between items-center">
              <span>{filteredAnalyses.length} application{filteredAnalyses.length === 1 ? "" : "s"}</span>
              <span>Select to change context</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
