import { Bell, User, Plus } from "lucide-react";
import { GlobalAnalysis } from "../App";
import ApplicationSelector from "./ApplicationSelector";

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
    <header className="border-b border-[#dde1e9] bg-white px-6 py-2.5 flex-shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {/* LEFT SIDE: [CRYPTAVISTA / current section title] + descriptive subtitle */}
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-bold text-[#1e3a5f] tracking-wide">CRYPTAVISTA</span>
            <span className="text-gray-300 font-normal">/</span>
            <h1 className="text-[14px] font-bold text-[#1a1d23] truncate">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-[11px] text-[#6b7589] mt-0.5 leading-tight truncate">{subtitle}</p>
          )}
        </div>

        {/* RIGHT SIDE: Application: [Application Dropdown] + Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Application Selector */}
          {analyses.length > 0 && onSelectAnalysis && (
            <ApplicationSelector
              analyses={analyses}
              selectedAnalysisId={selectedAnalysisId}
              onSelectAnalysis={onSelectAnalysis}
            />
          )}

          {/* Global Actions */}
          <div className="flex items-center gap-2.5 pl-1 border-l border-[#dde1e9]">
            <button
              type="button"
              aria-label="Notifications"
              className="relative p-1.5 rounded-md text-[#6b7589] hover:bg-[#f5f6f8] hover:text-[#1a1d23] transition-colors"
            >
              <Bell size={15} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>

            <button
              onClick={onNewAnalysis}
              className="flex items-center gap-1.5 bg-[#1e3a5f] text-white text-[11px] font-semibold px-3 py-1.5 rounded-md hover:bg-[#162e4d] transition-colors shadow-2xs whitespace-nowrap"
            >
              <Plus size={12} /> New Analysis
            </button>

            <button
              type="button"
              aria-label="User Profile"
              className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0 text-white hover:bg-[#162e4d] transition-colors"
            >
              <User size={13} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
