import { Bell, User, Plus, ChevronDown } from "lucide-react";
import { GlobalAnalysis } from "../App";

interface Props {
  title: string;
  subtitle?: string;
  onNewAnalysis?: () => void;
  analyses?: GlobalAnalysis[];
  selectedAnalysisId?: string;
  onSelectAnalysis?: (id: string) => void;
}

export default function Header({ title, subtitle, onNewAnalysis, analyses = [], selectedAnalysisId, onSelectAnalysis }: Props) {
  return (
    <header className="h-14 border-b border-[#dde1e9] bg-white flex items-center px-5 gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-6">
        <div>
          <div className="flex items-center gap-1.5">
            <img src="/logo.png" alt="CryptaVista" className="w-5 h-5 object-contain" />
            <span className="text-[10px] text-[#6b7589] font-medium">CRYPTAVISTA</span>
            <span className="text-[10px] text-[#dde1e9]">/</span>
            <span className="text-[13px] font-semibold text-[#1a1d23] truncate">{title}</span>
          </div>
          {subtitle && <div className="text-[10px] text-[#6b7589] truncate mt-0.5">{subtitle}</div>}
        </div>

        {/* Global Application Selector */}
        {analyses.length > 0 && onSelectAnalysis && (
          <div className="relative">
            <select
              value={selectedAnalysisId || ""}
              onChange={(e) => onSelectAnalysis(e.target.value)}
              className="appearance-none bg-[#f5f6f8] border border-[#dde1e9] text-[#1a1d23] text-[11px] font-semibold py-1.5 pl-3 pr-8 rounded-md outline-none focus:border-[#1e3a5f] cursor-pointer"
            >
              <option value="" disabled>Select Application</option>
              {analyses.map(a => (
                <option key={a.analysisId} value={a.analysisId}>
                  {a.applicationName} ({a.analysisId})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7589] pointer-events-none" />
          </div>
        )}
      </div>

      <button className="relative p-1.5 rounded-md hover:bg-[#f5f6f8] transition-colors">
        <Bell size={15} className="text-[#6b7589]" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
      </button>

      <div className="w-px h-5 bg-[#dde1e9]" />

      <button onClick={onNewAnalysis} className="flex items-center gap-1.5 bg-[#1e3a5f] text-white text-[11px] font-semibold px-3 py-1.5 rounded-md hover:bg-[#162e4d] transition-colors">
        <Plus size={12} /> New Analysis
      </button>

      <button className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
        <User size={13} className="text-white" />
      </button>
    </header>
  );
}
