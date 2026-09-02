import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";

const elements = [
  // Crypto assets (center)
  { data: { id: "rsa", label: "RSA-2048", type: "crypto", impact: "critical" } },
  { data: { id: "ecdsa", label: "ECDSA P-256", type: "crypto", impact: "critical" } },
  { data: { id: "aes", label: "AES-256-GCM", type: "crypto", impact: "low" } },

  // Libraries
  { data: { id: "openssl", label: "OpenSSL 3.x", type: "library", impact: "high" } },
  { data: { id: "pyca", label: "pyca/cryptography", type: "library", impact: "high" } },

  // Applications
  { data: { id: "auth", label: "Auth Service", type: "app", impact: "critical" } },
  { data: { id: "portal", label: "Customer Portal", type: "app", impact: "high" } },
  { data: { id: "payment", label: "Payment Service", type: "app", impact: "critical" } },
  { data: { id: "docs", label: "Document Service", type: "app", impact: "medium" } },
  { data: { id: "legacy", label: "Legacy API", type: "app", impact: "low" } },

  // Infrastructure
  { data: { id: "nginx", label: "nginx:alpine", type: "infra", impact: "medium" } },
  { data: { id: "db", label: "DB Encryption", type: "infra", impact: "high" } },

  // Edges
  { data: { id: "e1", source: "rsa", target: "auth" } },
  { data: { id: "e2", source: "rsa", target: "payment" } },
  { data: { id: "e3", source: "ecdsa", target: "payment" } },
  { data: { id: "e4", source: "ecdsa", target: "auth" } },
  { data: { id: "e5", source: "aes", target: "docs" } },
  { data: { id: "e6", source: "openssl", target: "portal" } },
  { data: { id: "e7", source: "openssl", target: "nginx" } },
  { data: { id: "e8", source: "pyca", target: "auth" } },
  { data: { id: "e9", source: "pyca", target: "docs" } },
  { data: { id: "e10", source: "rsa", target: "db" } },
  { data: { id: "e11", source: "openssl", target: "legacy" } },
  { data: { id: "e12", source: "auth", target: "portal" } },
];

const nodeColors: Record<string, { bg: string; border: string; label: string }> = {
  crypto: { bg: "#fee2e2", border: "#c0392b", label: "Crypto Asset" },
  library: { bg: "#fef3c7", border: "#d97706", label: "Library" },
  app: { bg: "#dbeafe", border: "#1e3a5f", label: "Application" },
  infra: { bg: "#f0fdf4", border: "#0d7a6b", label: "Infrastructure" },
};

const impactBadge: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border border-red-200",
  high: "bg-orange-50 text-orange-700 border border-orange-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

export default function DependencyGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string; type: string; impact: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: any) => nodeColors[ele.data("type")]?.bg ?? "#f5f6f8",
            "border-color": (ele: any) => nodeColors[ele.data("type")]?.border ?? "#dde1e9",
            "border-width": 2,
            label: "data(label)",
            "font-size": "10px",
            "font-family": "Inter, sans-serif",
            "font-weight": "600",
            "text-valign": "center",
            "text-halign": "center",
            color: "#1a1d23",
            width: (ele: any) => ele.data("type") === "crypto" ? 80 : ele.data("type") === "library" ? 65 : 55,
            height: (ele: any) => ele.data("type") === "crypto" ? 80 : ele.data("type") === "library" ? 65 : 55,
            "text-wrap": "wrap",
            "text-max-width": "65px",
          },
        } as any,
        {
          selector: "edge",
          style: {
            "line-color": "#dde1e9",
            "target-arrow-color": "#dde1e9",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "bezier",
            width: 1.5,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#1e3a5f",
            "border-width": 4,
            "background-blacken": 0.08,
          },
        },
        {
          selector: ".highlighted",
          style: { "line-color": "#1e3a5f", "target-arrow-color": "#1e3a5f", width: 2.5 },
        },
        {
          selector: ".dimmed",
          style: { opacity: 0.2 },
        },
      ],
      layout: { name: "cose", padding: 30, nodeRepulsion: () => 6000, idealEdgeLength: () => 100 } as any,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.4,
      maxZoom: 3,
    });

    cy.on("tap", "node", (evt) => {
      if (!cyRef.current) return;
      const node = evt.target;
      const d = node.data();
      setSelectedNode({ id: d.id, label: d.label, type: d.type, impact: d.impact });

      cy.elements().removeClass("highlighted dimmed");
      const connectedEdges = node.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes();
      cy.elements().not(node).not(connectedEdges).not(connectedNodes).addClass("dimmed");
      connectedEdges.addClass("highlighted");
    });

    cy.on("tap", (evt) => {
      if (!cyRef.current) return;
      if (evt.target === cy) {
        setSelectedNode(null);
        cy.elements().removeClass("highlighted dimmed");
      }
    });

    cyRef.current = cy;
    return () => {
      cy.stop(true, true);
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  const directDeps = selectedNode
    ? elements.filter(e => "source" in (e.data ?? {}) && (e.data.source === selectedNode.id || e.data.target === selectedNode.id)).length
    : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-5">

        <div className="grid grid-cols-4 gap-4">
          {/* Graph */}
          <div className="col-span-3 bg-white border border-[#dde1e9] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dde1e9] flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-[#1a1d23]">Cryptographic Dependency Network</div>
                <div className="text-[11px] text-[#6b7589]">Click nodes to explore dependencies · Drag to pan · Scroll to zoom</div>
              </div>
              <div className="flex gap-4 text-[10px]">
                {Object.entries(nodeColors).map(([type, cfg]) => (
                  <span key={type} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded inline-block border" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }} />
                    <span className="text-[#6b7589]">{cfg.label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div ref={containerRef} style={{ height: 420 }} />
          </div>

          {/* Info panel */}
          <div className="space-y-4">
            {selectedNode ? (
              <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
                <div className="text-[10px] text-[#6b7589] uppercase tracking-wide font-medium mb-2">Selected Node</div>
                <div className="text-[14px] font-bold text-[#1a1d23] mb-1">{selectedNode.label}</div>
                <div className="flex gap-2 mb-3 flex-wrap">
                  <span className="text-[10px] bg-[#f5f6f8] border border-[#dde1e9] text-[#6b7589] px-2 py-0.5 rounded font-medium capitalize">{selectedNode.type}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${impactBadge[selectedNode.impact]}`}>{selectedNode.impact} impact</span>
                </div>
                <div className="space-y-2 text-[11px]">
                  {[
                    { label: "Direct Dependencies", value: directDeps },
                    { label: "Node Type", value: nodeColors[selectedNode.type]?.label ?? "—" },
                    { label: "Impact Level", value: selectedNode.impact.charAt(0).toUpperCase() + selectedNode.impact.slice(1) },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between border-b border-[#f0f2f5] pb-1.5 last:border-0">
                      <span className="text-[#6b7589]">{item.label}</span>
                      <span className="font-medium text-[#1a1d23]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#dde1e9] rounded-lg p-5 text-center">
                <div className="text-[#9aa1b1] text-[12px] py-8">Click a node to inspect dependencies</div>
              </div>
            )}

            <div className="bg-white border border-[#dde1e9] rounded-lg p-4">
              <div className="text-[11px] font-semibold text-[#1a1d23] mb-3">Network Summary</div>
              {[
                { label: "Crypto Assets", value: 3 },
                { label: "Libraries", value: 2 },
                { label: "Applications", value: 5 },
                { label: "Infrastructure", value: 2 },
                { label: "Total Dependencies", value: 12 },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-[11px] py-1.5 border-b border-[#f0f2f5] last:border-0">
                  <span className="text-[#6b7589]">{item.label}</span>
                  <span className="font-bold text-[#1e3a5f]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
