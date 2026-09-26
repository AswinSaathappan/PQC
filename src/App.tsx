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
  cbom: { title: "CBOM", subtitle: "Structured cryptographic inventory across all applications", component: CBOM },
  runtime: { title: "Runtime Evidence", subtitle: "Validate static findings with observed cryptographic operations", component: RuntimeEvidence },
  classification: { title: "Classification", subtitle: "Classify artefacts by type, lifetime, and business criticality", component: Classification },

  risktimeline: { title: "Application Priority", subtitle: "Application migration priority based on Mosca Urgency, Data Sensitivity, and Business Criticality", component: RiskTimeline },
  priority: { title: "Priority Analysis", subtitle: "Rank systems by combined risk, urgency, impact, and migration effort", component: PriorityAnalysis },
  recommendations: { title: "Recommendations", subtitle: "Evidence-based recommendations for quantum-safe migration planning", component: Recommendations },
  dependency: { title: "Dependency Impact", subtitle: "Interactive network visualization of cryptographic dependencies", component: DependencyGraph },
  reports: { title: "Analysis Report", subtitle: "Consolidated enterprise cryptographic security assessment", component: Report },

  newanalysis: { title: "New Analysis", subtitle: "Configure and run a cryptographic discovery analysis", component: NewAnalysis },
  cbomkit_discovery: { title: "Cryptographic Discovery", subtitle: "Discovering cryptographic assets", component: CbomkitDiscovery },
};

export interface GlobalAnalysis {
  analysisId: string;
  applicationName: string;
  status: string;
}

const STORAGE_KEY = "cryptavista_selected_analysis_id";

export default function App() {
  const [activePage, setActivePage] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let p = params.get("page");
      if (p) return decodeURIComponent(p);
      if (window.location.hash) {
        return decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
      }
    } catch {
      // ignore
    }
    return "overview";
  });
  const [analyses, setAnalyses] = useState<GlobalAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let p = params.get("page");
      if (p) {
        p = decodeURIComponent(p);
        if (p.startsWith("cbom:")) return p.split(":")[1];
        if (p.startsWith("cbomkit_discovery:")) return p.split(":")[1];
      }
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const handleSelectAnalysis = (id: string) => {
    if (!id) return;
    setSelectedAnalysisId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      console.warn("Could not save selected analysis to localStorage", e);
    }
    const decodedActive = decodeURIComponent(activePage);
    if (decodedActive.startsWith("cbom")) {
      setActivePage(`cbom:${id}`);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("page", `cbom:${id}`);
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore
      }
    }
  };

  const refreshAnalyses = (preferredId?: string) => {
    fetch("http://localhost:3001/api/analyses")
      .then(r => r.json())
      .then((data: GlobalAnalysis[]) => {
        setAnalyses(data);
        if (data.length > 0) {
          let targetId: string | null = null;
          try {
            const params = new URLSearchParams(window.location.search);
            let p = params.get("page");
            if (p) p = decodeURIComponent(p);
            const urlId = p && (p.startsWith("cbom:") || p.startsWith("cbomkit_discovery:")) ? p.split(":")[1] : null;
            targetId = preferredId || urlId || localStorage.getItem(STORAGE_KEY) || selectedAnalysisId;
          } catch {
            targetId = preferredId || selectedAnalysisId;
          }

          if (targetId) {
            const matched = data.find(a => a.analysisId === targetId);
            if (matched) {
              handleSelectAnalysis(matched.analysisId);
              return;
            }
          }

          handleSelectAnalysis(data[0].analysisId);
        }
      })
      .catch(err => console.error("Failed to load analyses", err));
  };

  useEffect(() => {
    refreshAnalyses();
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        let p = params.get("page");
        if (p) {
          const decoded = decodeURIComponent(p);
          setActivePage(decoded);
          if (decoded.startsWith("cbom:") || decoded.startsWith("cbomkit_discovery:")) {
            const id = decoded.split(":")[1];
            if (id) setSelectedAnalysisId(id);
          }
        } else if (window.location.hash) {
          const decoded = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
          setActivePage(decoded);
          if (decoded.startsWith("cbom:") || decoded.startsWith("cbomkit_discovery:")) {
            const id = decoded.split(":")[1];
            if (id) setSelectedAnalysisId(id);
          }
        }
      } catch {}
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  
  const decodedActivePage = decodeURIComponent(activePage);
  let activePageKey = decodedActivePage;
  let pageParam = "";
  if (decodedActivePage.startsWith("cbomkit_discovery:")) {
    activePageKey = "cbomkit_discovery";
    pageParam = decodedActivePage.split(":")[1];
  } else if (decodedActivePage.startsWith("cbom:")) {
    activePageKey = "cbom";
    pageParam = decodedActivePage.split(":")[1];
  }

  // Synchronize route param analysis ID with global selected analysis only when pageParam changes
  useEffect(() => {
    if (pageParam && pageParam !== selectedAnalysisId) {
      setSelectedAnalysisId(pageParam);
      try {
        localStorage.setItem(STORAGE_KEY, pageParam);
      } catch (e) {
        console.warn("Could not save selected analysis to localStorage", e);
      }
      refreshAnalyses(pageParam);
    }
  }, [pageParam]);

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
    refreshAnalyses?: (preferredId?: string) => void;
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
            onSelectAnalysis={handleSelectAnalysis}
          />
        )}
        <PageComponent 
          onNavigate={setActivePage} 
          onNewAnalysis={handleNewAnalysis} 
          onComplete={handleComplete} 
          analysisId={pageParam} 
          selectedAnalysisId={selectedAnalysisId}
          onSelectAnalysis={handleSelectAnalysis}
          analyses={analyses}
          refreshAnalyses={refreshAnalyses}
        />
      </div>
    </div>
  );
}
