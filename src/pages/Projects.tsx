import { FolderOpen, Plus, Clock, CheckCircle, AlertCircle } from "lucide-react";

const projects = [
  { name: "Enterprise Portal 2024", apps: 24, assets: 1847, risk: "High", status: "Complete", updated: "2 Sep 2026", active: true },
  { name: "Customer-Facing API v3", apps: 8, assets: 412, risk: "Medium", status: "Complete", updated: "28 Aug 2026", active: false },
  { name: "Internal HR Platform", apps: 5, assets: 189, risk: "Low", status: "In Progress", updated: "1 Sep 2026", active: false },
  { name: "Mobile Backend Services", apps: 12, assets: 634, risk: "High", status: "Complete", updated: "20 Aug 2026", active: false },
];

const statusConfig: Record<string, { icon: React.ElementType; cls: string }> = {
  Complete: { icon: CheckCircle, cls: "text-emerald-600" },
  "In Progress": { icon: Clock, cls: "text-amber-600" },
  Pending: { icon: AlertCircle, cls: "text-[#6b7589]" },
};

const riskBadge: Record<string, string> = {
  High: "bg-red-50 text-red-700 border border-red-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

export default function Projects() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold text-[#1a1d23]">{projects.length} projects</div>
          <button className="flex items-center gap-1.5 text-[12px] text-white bg-[#1e3a5f] px-3 py-1.5 rounded-md hover:bg-[#162e4d] font-medium">
            <Plus size={13} /> New Project
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {projects.map((p, i) => {
            const cfg = statusConfig[p.status];
            const Icon = cfg.icon;
            return (
              <div key={i} className={`bg-white border rounded-lg p-5 cursor-pointer hover:shadow-sm transition-shadow ${p.active ? "border-[#1e3a5f]" : "border-[#dde1e9]"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-[#1e3a5f]" />
                    <div className="text-[13px] font-semibold text-[#1a1d23]">{p.name}</div>
                    {p.active && <span className="text-[10px] bg-[#1e3a5f] text-white px-1.5 py-0.5 rounded font-medium">Active</span>}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${riskBadge[p.risk]}`}>{p.risk} Risk</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: "Applications", value: p.apps },
                    { label: "Asset Occurrences", value: p.assets.toLocaleString() },
                    { label: "Last Updated", value: p.updated },
                  ].map(item => (
                    <div key={item.label} className="bg-[#f5f6f8] rounded-md p-2">
                      <div className="text-[10px] text-[#6b7589]">{item.label}</div>
                      <div className="text-[12px] font-semibold text-[#1a1d23]">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Icon size={12} className={cfg.cls} />
                  <span className={cfg.cls + " font-medium"}>{p.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
