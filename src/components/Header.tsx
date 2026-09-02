import { Search, Bell, User, Plus, ChevronDown } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  onNewAnalysis?: () => void;
}

export default function Header({ title, subtitle, onNewAnalysis }: Props) {
  return (
    <header className="h-14 border-b border-[#dde1e9] bg-white flex items-center px-5 gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-[#6b7589] font-medium">CRYPTAVISTA</span>
          <span className="text-[10px] text-[#dde1e9]">/</span>
          <span className="text-[13px] font-semibold text-[#1a1d23] truncate">{title}</span>
        </div>
        {subtitle && <div className="text-[10px] text-[#6b7589] truncate mt-0.5">{subtitle}</div>}
      </div>

      {/* Project selector */}
      <button className="flex items-center gap-1.5 border border-[#dde1e9] rounded-md px-2.5 py-1.5 text-[11px] text-[#1a1d23] hover:bg-[#f5f6f8] font-medium">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Enterprise Q4 2026
        <ChevronDown size={11} className="text-[#9aa1b1]" />
      </button>

      <div className="flex items-center gap-1.5 bg-[#f5f6f8] border border-[#dde1e9] rounded-md px-3 py-1.5 w-52">
        <Search size={12} className="text-[#6b7589] flex-shrink-0" />
        <input placeholder="Search assets, applications..." className="bg-transparent text-[12px] text-[#1a1d23] placeholder-[#9aa1b1] outline-none flex-1 min-w-0" />
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
