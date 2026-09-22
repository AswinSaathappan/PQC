import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { ZoomIn, ZoomOut, RotateCcw, X, Info, Loader2 } from "lucide-react";

interface GlobalAnalysis {
  analysisId: string;
  applicationName: string;
  status?: string;
}

interface Props {
  selectedAnalysisId?: string;
  analyses?: GlobalAnalysis[];
  onSelectAnalysis?: (id: string) => void;
}

export default function DependencyGraph({ selectedAnalysisId, analyses = [], onSelectAnalysis }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [elements, setElements] = useState<any[]>([]);
  const [uniqueAssetsCount, setUniqueAssetsCount] = useState<number>(0);
  const [cbomOccurrencesCount, setCbomOccurrencesCount] = useState<number>(0);
  const [totalEdges, setTotalEdges] = useState<number>(0);
  const [available, setAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  const effectiveAnalysisId = selectedAnalysisId || analyses[0]?.analysisId;

  // 1. Fetch graph data whenever analysis changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchGraph() {
      if (!effectiveAnalysisId) {
        if (!isCancelled) {
          setElements([]);
          setUniqueAssetsCount(0);
          setCbomOccurrencesCount(0);
          setTotalEdges(0);
          setAvailable(false);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setSelectedNode(null);

        const res = await fetch(`http://localhost:3001/api/analyses/${effectiveAnalysisId}/dependency-graph`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            if (data.available && Array.isArray(data.elements) && data.elements.length > 0) {
              setElements(data.elements);
              setUniqueAssetsCount(data.uniqueAssets || data.elements.filter((e: any) => !e.data?.source).length);
              setCbomOccurrencesCount(data.cbomOccurrences || 0);
              const edgesCount = typeof data.summary?.totalEdges === 'number' 
                ? data.summary.totalEdges 
                : data.elements.filter((e: any) => Boolean(e.data?.source)).length;
              setTotalEdges(edgesCount);
              setAvailable(true);
            } else {
              setElements([]);
              setUniqueAssetsCount(0);
              setCbomOccurrencesCount(0);
              setTotalEdges(0);
              setAvailable(false);
            }
          }
        } else {
          if (!isCancelled) {
            setElements([]);
            setAvailable(false);
          }
        }
      } catch (err) {
        console.error("Failed to load dependency graph", err);
        if (!isCancelled) {
          setElements([]);
          setAvailable(false);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchGraph();
    return () => {
      isCancelled = true;
    };
  }, [effectiveAnalysisId]);

  // 2. Initialize Cytoscape once container is mounted and elements are ready
  useEffect(() => {
    if (!containerRef.current) return;

    if (!available || elements.length === 0) {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      return;
    }

    // Destroy existing instance before creating a new one
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: JSON.parse(JSON.stringify(elements)), // fresh clone
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#ffffff",
            "border-color": (ele: any) =>
              ele.data("assetType") === "algorithm" ? "#2563eb" : "#f59e0b",
            "border-width": 2.5,
            label: "data(displayLabel)",
            "font-size": "10px",
            "font-family": "Inter, system-ui, -apple-system, sans-serif",
            "font-weight": 600,
            "text-valign": "center",
            "text-halign": "center",
            color: "#1e293b",
            "text-wrap": "wrap",
            "text-max-width": "82px",
            "line-height": 1.25,
            shape: "ellipse",
            width: 96,
            height: 96,
          },
        },
        {
          selector: "edge",
          style: {
            "line-color": "#94a3b8",
            "target-arrow-color": "#64748b",
            "target-arrow-shape": "triangle",
            "arrow-scale": 1.1,
            "curve-style": "bezier",
            width: 2.2,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#1e3a5f",
            "border-width": 4,
            "shadow-blur": 14,
            "shadow-color": "rgba(30, 58, 95, 0.25)",
            "shadow-opacity": 0.9,
          },
        },
        {
          selector: ".highlighted",
          style: {
            "line-color": "#1e3a5f",
            "target-arrow-color": "#1e3a5f",
            width: 3.5,
          },
        },
        {
          selector: ".dimmed",
          style: { opacity: 0.25 },
        },
      ] as any,
      layout: {
        name: "cose",
        padding: 50,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        edgeElasticity: () => 32,
        gravity: 0.25,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        animate: false,
        fit: true,
      } as any,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.3,
      maxZoom: 2.5,
    });

    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const d = node.data();
      setSelectedNode(d);

      cy.elements().removeClass("highlighted dimmed");
      const connectedEdges = node.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes();
      cy.elements().not(node).not(connectedEdges).not(connectedNodes).addClass("dimmed");
      connectedEdges.addClass("highlighted");
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        cy.elements().removeClass("highlighted dimmed");
      }
    });

    cyRef.current = cy;

    const fitGraph = () => {
      if (!cy) return;
      cy.resize();
      cy.fit(undefined, 40);
      const curZoom = cy.zoom();
      if (!isFinite(curZoom) || curZoom < 0.4 || curZoom > 2.0) {
        cy.zoom(1.0);
        cy.center();
      }
    };

    cy.ready(fitGraph);
    cy.on("layoutstop", fitGraph);

    // Ensure layout fits after initial DOM paint
    const timer = setTimeout(fitGraph, 60);

    // Observe container resizes
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(() => {
        if (cyRef.current) {
          cyRef.current.resize();
        }
      });
      ro.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
      cy.stop(true, true);
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, available]);

  const handleReset = () => {
    if (cyRef.current) {
      cyRef.current.resize();
      cyRef.current.fit(undefined, 40);
      const curZoom = cyRef.current.zoom();
      if (!isFinite(curZoom) || curZoom < 0.4 || curZoom > 2.0) {
        cyRef.current.zoom(1.0);
        cyRef.current.center();
      }
    }
  };

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.25);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-4">

        {/* Clean Header */}
        <div className="bg-white border border-[#dde1e9] rounded-lg px-6 py-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-[#1a1d23]">
              Cryptographic Dependency Network
            </h1>
            <p className="text-sm text-[#6b7589] mt-0.5">
              Relationships between detected cryptographic assets and the software components that use them.
            </p>
            <div className="mt-2 text-xs font-semibold text-[#1e3a5f]">
              Total Cryptographic Asset Occurrences: {cbomOccurrencesCount} • {uniqueAssetsCount} asset nodes • {totalEdges} verified dependency relationships
            </div>
          </div>
        </div>

        {/* Two-Column Main Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

          {/* Left Column: Interactive Node Inspection (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-[#dde1e9] rounded-lg shadow-sm p-5 min-h-[660px] flex flex-col">
            <div className="pb-3 border-b border-[#dde1e9] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1e3a5f]">Interactive Node Inspection</h3>
                <div className="text-[11px] text-[#6b7589] mt-0.5">Asset dependency inspector</div>
              </div>
              {selectedNode && (
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    if (cyRef.current) cyRef.current.elements().removeClass("highlighted dimmed");
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
                  title="Clear Selection"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {!selectedNode ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 text-blue-600">
                  <Info size={20} />
                </div>
                <div className="text-xs font-medium text-gray-600">
                  Click a node to view its dependency information.
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Selected Asset */}
                <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[#6b7589] font-bold">Selected Asset</div>
                  <div className="text-base font-bold text-[#1e3a5f] mt-0.5">{selectedNode.label}</div>
                </div>

                {/* Asset Type & Primitive */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-2.5">
                    <div className="text-[10px] text-[#6b7589] uppercase font-semibold">Asset Type</div>
                    <div className="font-semibold text-gray-900 mt-0.5">{selectedNode.assetType || "algorithm"}</div>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#dde1e9] rounded-md p-2.5">
                    <div className="text-[10px] text-[#6b7589] uppercase font-semibold">Primitive</div>
                    <div className="font-semibold text-gray-900 mt-0.5">{selectedNode.primitive || "—"}</div>
                  </div>
                </div>

                {/* Occurrences & Locations */}
                <div className="border border-[#dde1e9] rounded-md p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">Occurrences</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[11px]">
                      {selectedNode.occurrencesCount}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6b7589] mb-1.5 font-medium">Locations:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedNode.locations && selectedNode.locations.length > 0 ? (
                      selectedNode.locations.map((loc: string, idx: number) => (
                        <div
                          key={idx}
                          className="font-mono text-[11px] bg-[#f8fafc] border border-gray-200 px-2 py-1 rounded text-gray-700 truncate"
                          title={loc}
                        >
                          • {loc}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 italic">No specific locations recorded</div>
                    )}
                  </div>
                </div>

                {/* Dependency Evidence */}
                <div className="border border-[#dde1e9] rounded-md p-3 bg-white space-y-2">
                  <div className="font-semibold text-gray-700">Dependency Evidence</div>

                  {selectedNode.hasDependencyEvidence ? (
                    <>
                      <div className="flex justify-between text-gray-700">
                        <span className="text-gray-500">Direct Dependents:</span>
                        <span className="font-bold text-[#1e3a5f]">{selectedNode.directDependents}</span>
                      </div>
                      {selectedNode.directDependentsList && selectedNode.directDependentsList.length > 0 && (
                        <div className="space-y-1 pl-2">
                          {selectedNode.directDependentsList.map((d: string, idx: number) => (
                            <div key={idx} className="bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-700 text-[11px]">
                              → {d}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between text-gray-700 pt-1">
                        <span className="text-gray-500">Transitive Dependents:</span>
                        <span className="font-bold text-[#1e3a5f]">{selectedNode.transitiveDependents}</span>
                      </div>
                      {selectedNode.transitiveDependentsList && selectedNode.transitiveDependentsList.length > 0 && (
                        <div className="space-y-1 pl-2">
                          {selectedNode.transitiveDependentsList.map((d: string, idx: number) => (
                            <div key={idx} className="bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-600 text-[11px]">
                              ↳ {d}
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedNode.dependsOnList && selectedNode.dependsOnList.length > 0 && (
                        <div className="pt-1">
                          <span className="text-gray-500 block mb-0.5">Depends On:</span>
                          <div className="space-y-1 pl-2">
                            {selectedNode.dependsOnList.map((d: string, idx: number) => (
                              <div key={idx} className="bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-600 text-[11px]">
                                ← {d}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between text-gray-700 pt-1 border-t border-gray-100">
                        <span className="text-gray-500">Dependency Reach:</span>
                        <span className="font-bold text-[#1e3a5f]">{selectedNode.dependencyReach}%</span>
                      </div>

                      <div className="flex justify-between text-gray-700">
                        <span className="text-gray-500">Dependency Impact:</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                          Score: {selectedNode.dependencyImpactScore}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Calculation:</div>
                        <div className="p-2 bg-blue-50/60 border border-blue-100 rounded text-blue-900 text-[11px] font-mono leading-relaxed">
                          {selectedNode.calculation}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between text-gray-700">
                        <span className="text-gray-500">Dependency Impact:</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium text-[11px]">
                          Unavailable
                        </span>
                      </div>
                      <div className="text-gray-500 italic p-2 bg-gray-50 border border-gray-200 rounded">
                        <span className="font-semibold block text-gray-700 not-italic">Reason:</span>
                        No dependency relationship evidence was reported by the available static analysis.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Large Graph (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-[#dde1e9] rounded-lg overflow-hidden shadow-sm flex flex-col min-h-[660px]">
            {/* Graph Toolbar */}
            <div className="px-5 py-3 border-b border-[#dde1e9] flex items-center justify-between bg-[#fafbfc]">
              <div className="flex items-center gap-4 text-xs">
                <span className="font-semibold text-[#1a1d23]">Dependency Map</span>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-white border-2 border-blue-600 inline-block"></span>
                    <span>Algorithm</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-white border-2 border-amber-500 inline-block"></span>
                    <span>Related Key / Material</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center border border-[#dde1e9] rounded-md overflow-hidden bg-white shadow-2xs">
                <button
                  onClick={handleZoomIn}
                  title="Zoom In"
                  className="p-1.5 text-[#6b7589] hover:bg-gray-100 hover:text-[#1a1d23] border-r border-[#dde1e9] transition-colors"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  className="p-1.5 text-[#6b7589] hover:bg-gray-100 hover:text-[#1a1d23] border-r border-[#dde1e9] transition-colors"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={handleReset}
                  title="Fit View"
                  className="p-1.5 text-[#6b7589] hover:bg-gray-100 hover:text-[#1a1d23] flex items-center gap-1 text-xs px-2.5 font-medium transition-colors"
                >
                  <RotateCcw size={13} /> Fit View
                </button>
              </div>
            </div>

            {/* Permanent Graph Container with Overlays for Loading / Unavailable */}
            <div className="relative w-full h-[620px] bg-[#f8fafc] overflow-hidden">
              {/* Cytoscape mounts directly into this div */}
              <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

              {/* Loading State Overlay */}
              {loading && (
                <div className="absolute inset-0 bg-[#f8fafc]/90 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 className="animate-spin text-[#1e3a5f]" size={30} />
                  <span className="text-xs text-[#6b7589] font-medium">Loading dependency graph…</span>
                </div>
              )}

              {/* Unavailable State Overlay */}
              {!loading && (!available || elements.length === 0) && (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center text-center p-8 z-10">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <Info className="text-gray-400 w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Dependency Impact: Unavailable</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    No verified dependency relationship is available from the current static-analysis evidence.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
