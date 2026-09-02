import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Overview from "./pages/Overview";
import Applications from "./pages/Applications";
import Discovery from "./pages/Discovery";
import CBOM from "./pages/CBOM";
import RuntimeEvidence from "./pages/RuntimeEvidence";
import Classification from "./pages/Classification";
import QuantumRisk from "./pages/QuantumRisk";
import RiskTimeline from "./pages/RiskTimeline";
import PriorityAnalysis from "./pages/PriorityAnalysis";
import Recommendations from "./pages/Recommendations";
import DependencyGraph from "./pages/DependencyGraph";
import Report from "./pages/Report";
import NewAnalysis from "./pages/NewAnalysis";
import Settings from "./pages/Settings";

const pageConfig: Record<string, { title: string; subtitle?: string; component: React.ElementType }> = {
  overview: { title: "Overview", subtitle: "Cryptographic visibility across your enterprise", component: Overview },
  applications: { title: "Applications & Targets", subtitle: "Manage analyzed applications and scan targets", component: Applications },
  discovery: { title: "Cryptographic Artefact Discovery", subtitle: "Identify cryptographic artefacts across enterprise software and infrastructure", component: Discovery },
  cbom: { title: "Cryptographic Bill of Materials", subtitle: "Structured cryptographic inventory across all applications", component: CBOM },
  runtime: { title: "Runtime Evidence", subtitle: "Validate static findings with observed cryptographic operations", component: RuntimeEvidence },
  classification: { title: "Cryptographic Asset Classification", subtitle: "Classify artefacts by type, lifetime, and business criticality", component: Classification },
  quantumrisk: { title: "Quantum Risk Assessment", subtitle: "Risk analysis across all applications and cryptographic assets", component: QuantumRisk },
  risktimeline: { title: "Quantum Risk Timeline", subtitle: "Mosca-based timeline comparing data lifetime and migration duration", component: RiskTimeline },
  priority: { title: "Enterprise Priority Analysis", subtitle: "Rank systems by combined risk, urgency, impact, and migration effort", component: PriorityAnalysis },
  recommendations: { title: "PQC / Hybrid Decision Support", subtitle: "Evidence-based recommendations for quantum-safe migration planning", component: Recommendations },
  dependency: { title: "Dependency Impact Analysis", subtitle: "Interactive network visualization of cryptographic dependencies", component: DependencyGraph },
  reports: { title: "Analysis Report", subtitle: "Consolidated enterprise cryptographic security assessment", component: Report },
  settings: { title: "Settings", component: Settings },
  newanalysis: { title: "New Analysis", subtitle: "Configure and run a cryptographic discovery analysis", component: NewAnalysis },
};

export default function App() {
  const [activePage, setActivePage] = useState("overview");
  const page = pageConfig[activePage] ?? pageConfig.overview;
  const PageComponent = page.component as React.ComponentType<{ onNavigate?: (id: string) => void; onNewAnalysis?: () => void; onComplete?: () => void }>;

  const handleNewAnalysis = () => setActivePage("newanalysis");
  const handleComplete = () => setActivePage("overview");

  return (
    <div className="flex h-full bg-[#f5f6f8] overflow-hidden">
      <Sidebar active={activePage} onNavigate={setActivePage} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={page.title} subtitle={page.subtitle} onNewAnalysis={handleNewAnalysis} />
        <PageComponent onNavigate={setActivePage} onNewAnalysis={handleNewAnalysis} onComplete={handleComplete} />
      </div>
    </div>
  );
}
