import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Overview from "./pages/Overview";
import Applications from "./pages/Applications";
import Discovery from "./pages/Discovery";
import CBOM from "./pages/CBOM";
import RuntimeEvidence from "./pages/RuntimeEvidence";
import Classification from "./pages/Classification";

import RiskTimeline from "./pages/RiskTimeline";
import PriorityAnalysis from "./pages/PriorityAnalysis";
import Recommendations from "./pages/Recommendations";
import DependencyGraph from "./pages/DependencyGraph";
import Report from "./pages/Report";
import NewAnalysis from "./pages/NewAnalysis";


import CbomkitDiscovery from "./pages/CbomkitDiscovery";

const pageConfig: Record<string, { title: string; subtitle?: string; component: React.ElementType }> = {
  overview: { title: "Overview", subtitle: "Cryptographic visibility across your enterprise", component: Overview },
  applications: { title: "Applications & Targets", subtitle: "Manage analyzed applications and scan targets", component: Applications },
  discovery: { title: "Cryptographic Artefact Discovery", subtitle: "Identify cryptographic artefacts across enterprise software and infrastructure", component: Discovery },
  cbom: { title: "Cryptographic Bill of Materials", subtitle: "Structured cryptographic inventory across all applications", component: CBOM },
  runtime: { title: "Runtime Evidence", subtitle: "Validate static findings with observed cryptographic operations", component: RuntimeEvidence },
  classification: { title: "Cryptographic Asset Classification", subtitle: "Classify artefacts by type, lifetime, and business criticality", component: Classification },

  risktimeline: { title: "Application Priority", subtitle: "Application migration priority based on Mosca Urgency, Data Sensitivity, and Business Criticality", component: RiskTimeline },
  priority: { title: "Enterprise Priority Analysis", subtitle: "Rank systems by combined risk, urgency, impact, and migration effort", component: PriorityAnalysis },
  recommendations: { title: "PQC / Hybrid Decision Support", subtitle: "Evidence-based recommendations for quantum-safe migration planning", component: Recommendations },
  dependency: { title: "Dependency Impact Analysis", subtitle: "Interactive network visualization of cryptographic dependencies", component: DependencyGraph },
  reports: { title: "Analysis Report", subtitle: "Consolidated enterprise cryptographic security assessment", component: Report },

  newanalysis: { title: "New Analysis", subtitle: "Configure and run a cryptographic discovery analysis", component: NewAnalysis },
  cbomkit_discovery: { title: "Cryptographic Discovery", subtitle: "Discovering cryptographic assets", component: CbomkitDiscovery },
};

export interface GlobalAnalysis {
  analysisId: string;
  applicationName: string;
  status: string;
}

export default function App() {
  const [activePage, setActivePage] = useState("overview");
  const [analyses, setAnalyses] = useState<GlobalAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>("");

  const refreshAnalyses = () => {
    fetch("http://localhost:3001/api/analyses")
      .then(r => r.json())
      .then(data => {
        setAnalyses(data);
        if (data.length > 0 && !selectedAnalysisId) {
          setSelectedAnalysisId(data[0].analysisId);
        }
      })
      .catch(err => console.error("Failed to load analyses", err));
  };

  useEffect(() => {
    refreshAnalyses();
  }, []);
  
  let activePageKey = activePage;
  let pageParam = "";
  if (activePage.startsWith("cbomkit_discovery:")) {
    activePageKey = "cbomkit_discovery";
    pageParam = activePage.split(":")[1];
  } else if (activePage.startsWith("cbom:")) {
    activePageKey = "cbom";
    pageParam = activePage.split(":")[1];
  }

  const page = pageConfig[activePageKey] ?? pageConfig.overview;
  
  // Expose global state to the active component
  const PageComponent = page.component as React.ComponentType<{ 
    onNavigate?: (id: string) => void; 
    onNewAnalysis?: () => void; 
    onComplete?: () => void; 
    analysisId?: string; // from route param (cbomkit_discovery:id)
    selectedAnalysisId?: string; // from global dropdown
    analyses?: GlobalAnalysis[];
    onSelectAnalysis?: (id: string) => void;
    refreshAnalyses?: () => void;
  }>;

  const handleNewAnalysis = () => setActivePage("newanalysis");
  const handleComplete = () => {
    refreshAnalyses();
    setActivePage("overview");
  };

  return (
    <div className="flex h-full bg-[#f5f6f8] overflow-hidden">
      <Sidebar active={activePageKey} onNavigate={setActivePage} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {activePageKey !== 'cbomkit_discovery' && (
          <Header 
            title={page.title} 
            subtitle={page.subtitle} 
            onNewAnalysis={handleNewAnalysis}
            analyses={analyses}
            selectedAnalysisId={selectedAnalysisId}
            onSelectAnalysis={setSelectedAnalysisId}
          />
        )}
        <PageComponent 
          onNavigate={setActivePage} 
          onNewAnalysis={handleNewAnalysis} 
          onComplete={handleComplete} 
          analysisId={pageParam} 
          selectedAnalysisId={selectedAnalysisId}
          onSelectAnalysis={setSelectedAnalysisId}
          analyses={analyses}
          refreshAnalyses={refreshAnalyses}
        />
      </div>
    </div>
  );
}
