import { LayoutDashboard, Target, Search, FileCode2, Activity, Tags, AlertTriangle, Clock, BarChart3, Lightbulb, GitBranch, FileText, Settings, ChevronRight, Shield } from "lucide-react";

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { type: "section", label: "ANALYSIS" },
  { id: "applications", label: "Applications & Targets", icon: Target },
  { id: "discovery", label: "Discovery", icon: Search },
  { id: "cbom", label: "CBOM", icon: FileCode2 },
  { type: "section", label: "VALIDATION" },
  { id: "runtime", label: "Runtime Evidence", icon: Activity },
  { type: "section", label: "ASSESSMENT" },
  { id: "classification", label: "Classification", icon: Tags },

  { id: "risktimeline", label: "Application Priority", icon: Clock },
  { type: "section", label: "DECISION SUPPORT" },
  { id: "priority", label: "Priority Analysis", icon: BarChart3 },
  { id: "recommendations", label: "Recommendations", icon: Lightbulb },
  { type: "section", label: "ADVANCED INSIGHTS" },
  { id: "dependency", label: "Dependency Impact", icon: GitBranch },
  { type: "section", label: "OUTPUT" },
  { id: "reports", label: "Reports", icon: FileText },

];

interface Props { active: string; onNavigate: (id: string) => void; }

export default function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="w-60 flex-shrink-0 bg-[#1e3a5f] flex flex-col h-full">
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="CRYPTAVISTA Logo" className="w-10 h-10 object-contain" />
          <div>
            <div className="text-white font-bold text-[13px] tracking-wide">CRYPTAVISTA</div>
            <div className="text-blue-200/50 text-[9px] font-medium tracking-widest uppercase">ECDAT Platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {nav.map((item, i) => {
          if ("type" in item) {
            return (
              <div key={i} className="px-4 pt-4 pb-1 text-[9px] font-semibold text-blue-300/40 tracking-widest uppercase">
                {item.label}
              </div>
            );
          }
          const Icon = item.icon!;
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id!)}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors text-[12px] font-medium ${isActive ? "bg-white/10 text-white" : "text-blue-200/65 hover:text-white hover:bg-white/5"
                }`}>
              <Icon size={14} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={11} className="text-white/30" />}
            </button>
          );
        })}
      </nav>


    </aside>
  );
}
