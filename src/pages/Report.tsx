import React, { useState, useEffect } from "react";
import axios from "axios";
import { Download, ChevronDown, ChevronRight, Activity, ShieldAlert, CheckCircle2, Loader2, Info } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  selectedAnalysisId?: string;
  analyses?: any[];
  onSelectAnalysis?: (id: string) => void;
}

export default function Report({ selectedAnalysisId, analyses = [], onSelectAnalysis }: Props) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchAssets() {
      if (selectedAnalysisId) {
        setLoading(true);
        try {
          const response = await axios.get(`http://localhost:3001/api/analyses/${selectedAnalysisId}/scored-assets`);
          setAssets(response.data);
          setExpandedAsset(null);
        } catch (err) {
          console.error("Failed to load scored assets", err);
        } finally {
          setLoading(false);
        }
      } else {
        setAssets([]);
      }
    }
    fetchAssets();
  }, [selectedAnalysisId]);

  const selectedApp = analyses.find(a => a.analysisId === selectedAnalysisId);

  // Transform backend data to expected report format
  const data = React.useMemo(() => {
    if (!selectedApp) return null;
    
    // Sort assets by priority descending to assign rank
    const sortedAssets = [...assets].sort((a, b) => (b.scores.priorityScore ?? -1) - (a.scores.priorityScore ?? -1));
    
    return {
      analysisId: selectedApp.analysisId,
      analysisName: selectedApp.applicationName,
      date: new Date(selectedApp.createdAt || Date.now()).toLocaleDateString(),
      configuration: {
        runtimeEnabled: selectedApp.runtimeEnabled,
        monitoringDuration: "N/A",
        totalEventsCollected: 0,
        baselineAnalysisTime: "N/A"
      },
      applicationPriority: {
        moscaVariables: { 
          dataProtectionLifetime: selectedApp.dataProtectionDuration || 0, 
          migrationDuration: selectedApp.migrationDuration || 0, 
          quantumThreatHorizon: selectedApp.threatHorizonYear || (selectedApp.quantumRiskHorizon ? 2026 + selectedApp.quantumRiskHorizon : 2036)
        },
        moscaUrgency: selectedApp.moscaUrgency || 0,
        dataSensitivity: selectedApp.dataSensitivity || 0,
        businessCriticality: selectedApp.businessCriticality || 0,
        aps: selectedApp.apsScore || 0,
        overallPriority: `P${selectedApp.apsScore >= 2.5 ? 1 : selectedApp.apsScore >= 1.5 ? 2 : selectedApp.apsScore >= 1.0 ? 3 : 4}`
      },
      discoveredAssets: sortedAssets.map((a, i) => {
        let usage = "key_exchange";
        if (a.primitive === "hash" || a.primitive === "mac" || a.primitive === "kdf" || a.primitive === "symmetric") {
          usage = "symmetric_encryption";
        } else if (a.primitive === "signature") {
          usage = "digital_signature";
        }

        return {
          asset: a.assetName || a.algorithm,
          usage: usage,
          algorithm: a.algorithm,
          version: a.version || "Unknown",
          component: a.assetType || "Unknown",
          discoverySource: "Static Source Code",
          location: a.location,
          quantumRisk: a.scores.quantumRisk !== null ? (a.scores.quantumRisk >= 80 ? "High" : a.scores.quantumRisk >= 50 ? "Medium" : "Low") : "Unavailable",
          riskScore: a.scores.quantumRisk,
          migrationComplexity: 50, // mock for now
          dependencyImpact: a.scores.dependencyImpact,
          runtimeStatus: selectedApp.runtimeEnabled ? "Not Observed" : "Disabled",
          priorityScore: a.scores.priorityScore !== null ? Number(a.scores.priorityScore.toFixed(0)) : 0,
          priorityRank: i + 1
        };
      })
    };
  }, [selectedApp, assets]);

  const getRecommendation = (asset: any) => {
    if (asset.usage === "symmetric_encryption") {
      return {
        issue: "No immediate public-key cryptography replacement requirement. Quantum considerations may reduce the effective security margin for some symmetric cryptography.",
        approach: "Retain and monitor cryptographic guidance.",
        target: `Continue using ${asset.asset} where appropriate.`,
        guidance: "Review key management, key rotation, nonce handling and implementation configuration. Focus PQC migration effort first on vulnerable public-key dependencies.",
        standard: "Current NIST symmetric cryptography guidance."
      };
    }
    if (asset.usage === "digital_signature") {
      return {
        issue: "Quantum-vulnerable signature algorithm.",
        approach: "Transition digital signatures toward a PQC signature approach.",
        target: "ML-DSA where appropriate.",
        guidance: "Identify all signature producers and verifiers. Test compatibility and coordinated rollout before replacing the existing signature mechanism.",
        standard: "NIST FIPS 204"
      };
    }
    // Default to key exchange
    return {
      issue: "Quantum-vulnerable public-key cryptography.",
      approach: "Transition key establishment toward a PQC-capable approach.",
      target: "ML-KEM-based key establishment where appropriate.",
      guidance: "Identify all communicating systems and cryptographic libraries. Validate interoperability. Perform compatibility testing before retiring the existing mechanism.",
      standard: "NIST FIPS 203"
    };
  };

  const getPhases = () => {
    if (!data) return { phase1: [], phase2: [], phase3: [] };
    const phase1 = data.discoveredAssets.filter(a => a.priorityScore >= 75 && a.usage !== "symmetric_encryption").sort((a,b) => b.priorityScore - a.priorityScore);
    const phase2 = data.discoveredAssets.filter(a => a.priorityScore < 75 && a.usage !== "symmetric_encryption").sort((a,b) => b.priorityScore - a.priorityScore);
    const phase3 = data.discoveredAssets.filter(a => a.usage === "symmetric_encryption");
    return { phase1, phase2, phase3 };
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const phases = getPhases();
    
    const addHeading = (text: string, yPos: number, level = 1) => {
      if (level === 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 95);
        doc.text(text, 14, yPos);
        return yPos + 8;
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(text, 14, yPos);
        return yPos + 6;
      }
    };

    const addText = (text: string, yPos: number, isBold = false) => {
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const splitText = doc.splitTextToSize(text, 180);
      doc.text(splitText, 14, yPos);
      return yPos + (splitText.length * 5);
    };

    // 1. Cover
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(30, 58, 95);
    doc.text("CRYPTAVISTA", 105, 100, { align: "center" });
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text("Cryptographic Discovery & PQC Readiness Assessment", 105, 115, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(data.analysisName, 105, 140, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 105, 160, { align: "center" });
    doc.text(`Analysis ID: ${data.analysisId}`, 105, 167, { align: "center" });
    doc.addPage();
    
    // 1. Exec Summary
    let y = 20;
    y = addHeading("1. EXECUTIVE SUMMARY", y);
    y = addText(`Total Cryptographic Assets Discovered: ${data.discoveredAssets.length}`, y);
    y = addText(`Quantum-Vulnerable Assets: ${data.discoveredAssets.filter(a => a.quantumRisk === "High").length}`, y);
    y = addText(`Public-Key Assets: ${data.discoveredAssets.filter(a => a.usage !== "symmetric_encryption").length}`, y);
    y = addText(`Symmetric Cryptographic Assets: ${data.discoveredAssets.filter(a => a.usage === "symmetric_encryption").length}`, y);
    
    if (data.configuration.runtimeEnabled) {
      y = addText(`Runtime Verified Assets: ${data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}`, y);
      y = addText(`Not Runtime Observed Assets: ${data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}`, y);
    } else {
      y = addText(`Runtime Analysis: Disabled`, y);
    }
    y += 10;

    // 2. CBOM
    y = addHeading("2. DISCOVERY AND CBOM SUMMARY", y);
    autoTable(doc, {
      startY: y,
      head: [['Asset', 'Usage', 'Component', 'Source', 'Location']],
      body: data.discoveredAssets.map(a => [a.asset, a.usage, a.component, a.discoverySource, a.location]),
      headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
      theme: 'grid'
    });
    y = (doc as any).lastAutoTable.finalY + 15;

    if (y > 230) { doc.addPage(); y = 20; }

    // 3. Runtime Evidence
    y = addHeading("3. RUNTIME EVIDENCE SUMMARY", y);
    if (data.configuration.runtimeEnabled) {
      y = addText(`Runtime Verified Assets: ${data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}`, y);
      y = addText(`Assets Not Observed During Monitoring: ${data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}`, y);
      y = addText(`Runtime Events Collected: ${data.configuration.totalEventsCollected?.toLocaleString()}`, y);
      y = addText(`Monitoring Duration: ${data.configuration.monitoringDuration}`, y);
      y += 5;
      y = addText("Note: Runtime evidence is verification metadata and does not reduce the theoretical cryptographic risk of an asset.", y, true);
    } else {
      y = addText("Runtime Analysis: Disabled", y, true);
      y = addText("Explanation: Runtime verification was not performed for this analysis. Static discovery findings remain included in the assessment.", y);
    }
    y += 15;

    // 4. App Priority
    if (y > 200) { doc.addPage(); y = 20; }
    y = addHeading("4. APPLICATION-LEVEL PRIORITY ASSESSMENT", y);
    y = addText(`Mosca Urgency (M): ${data.applicationPriority.moscaUrgency.toFixed(2)}`, y);
    y = addText(`Data Sensitivity (D): ${data.applicationPriority.dataSensitivity.toFixed(2)}`, y);
    y = addText(`Business Criticality (B): ${data.applicationPriority.businessCriticality.toFixed(2)}`, y);
    y += 5;
    y = addText(`APS = (${data.applicationPriority.moscaUrgency.toFixed(2)} + ${data.applicationPriority.dataSensitivity.toFixed(2)} + ${data.applicationPriority.businessCriticality.toFixed(2)}) / 3`, y);
    y = addText(`Application Priority Score (APS) = ${data.applicationPriority.aps.toFixed(2)}`, y, true);
    y = addText(`Application Priority = ${data.applicationPriority.overallPriority}`, y, true);
    y += 10;
    y = addText(`Mosca Variables used for Urgency (M):`, y);
    y = addText(`Data Protection Lifetime (X): ${data.applicationPriority.moscaVariables.dataProtectionLifetime} years`, y);
    y = addText(`Migration Duration (Y): ${data.applicationPriority.moscaVariables.migrationDuration} years`, y);
    y = addText(`Quantum Horizon (Z): ${data.applicationPriority.moscaVariables.quantumThreatHorizon} years`, y);
    const zDuration = Math.max(0, data.applicationPriority.moscaVariables.quantumThreatHorizon - new Date().getFullYear());
    const moscaMargin = (data.applicationPriority.moscaVariables.dataProtectionLifetime + data.applicationPriority.moscaVariables.migrationDuration) - zDuration;
    y = addText(`Mosca Margin (X + Y - Z) = ${moscaMargin} years.`, y, true);
    y += 10;

    // 5. Component Priority
    if (y > 200) { doc.addPage(); y = 20; }
    y = addHeading("5. COMPONENT-LEVEL PRIORITY ASSESSMENT", y);
    autoTable(doc, {
      startY: y,
      head: [['Rank', 'Asset', 'Component', 'Quantum Risk', 'Complexity', 'Impact', 'Priority Score']],
      body: data.discoveredAssets.sort((a,b) => a.priorityRank - b.priorityRank).map(a => [
        a.priorityRank.toString(), a.asset, a.component, a.quantumRisk, a.migrationComplexity.toString(), a.dependencyImpact.toString(), a.priorityScore.toString()
      ]),
      headStyles: { fillColor: [245, 246, 248], textColor: [30, 58, 95] },
      theme: 'grid'
    });
    y = (doc as any).lastAutoTable.finalY + 15;
    y = addText("Note: Runtime evidence is verification metadata only. It is not used to silently modify the theoretical risk scores.", y, true);

    // 6. Recommendations
    doc.addPage(); y = 20;
    y = addHeading("6. TECHNICAL MIGRATION RECOMMENDATIONS", y);
    data.discoveredAssets.forEach(a => {
      const rec = getRecommendation(a);
      if (y > 230) { doc.addPage(); y = 20; }
      y = addHeading(`Asset: ${a.asset} (${a.component})`, y, 2);
      y = addText(`Current Usage: ${a.usage}`, y);
      y = addText(`Technical Issue: ${rec.issue}`, y);
      y = addText(`Recommended Approach: ${rec.approach}`, y);
      y = addText(`Suggested Target: ${rec.target}`, y, true);
      y = addText(`Implementation Guidance: ${rec.guidance}`, y);
      y = addText(`Standard Reference: ${rec.standard}`, y);
      y += 10;
    });

    // 7. Roadmap
    if (y > 220) { doc.addPage(); y = 20; }
    y = addHeading("7. MIGRATION ROADMAP", y);
    if (phases.phase1.length > 0) {
      y = addHeading("Phase 1 — Highest Priority Components", y, 2);
      phases.phase1.forEach(a => {
        if (y > 270) { doc.addPage(); y = 20; }
        y = addText(`- ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
      });
      y+=5;
    }
    if (phases.phase2.length > 0) {
      y = addHeading("Phase 2 — Next Priority Components", y, 2);
      phases.phase2.forEach(a => {
        if (y > 270) { doc.addPage(); y = 20; }
        y = addText(`- ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
      });
      y+=5;
    }
    if (phases.phase3.length > 0) {
      y = addHeading("Phase 3 — Retain and Monitor", y, 2);
      phases.phase3.forEach(a => {
        if (y > 270) { doc.addPage(); y = 20; }
        y = addText(`- ${a.asset} (${a.component}) -> Target: ${getRecommendation(a).target}`, y);
      });
      y+=10;
    }

    // 8. Standards
    if (y > 230) { doc.addPage(); y = 20; }
    y = addHeading("8. STANDARDS AND REFERENCES", y);
    y = addText("NIST FIPS 203 (ML-KEM) - Module-Lattice-Based Key-Encapsulation Mechanism Standard", y);
    y = addText("NIST FIPS 204 (ML-DSA) - Module-Lattice-Based Digital Signature Standard", y);
    y = addText("NIST FIPS 205 (SLH-DSA) - Stateless Hash-Based Digital Signature Standard", y);
    y = addText("NIST SP 800-208 - Stateful Hash-Based Signatures", y);
    y += 15;

    // 9. Final Status
    if (y > 220) { doc.addPage(); y = 20; }
    y = addHeading("9. FINAL REPORT STATUS (OVERALL ASSESSMENT)", y);
    y = addText("Cryptographic Inventory: Complete based on available scan data", y);
    y = addText(`Quantum Risk Exposure: ${data.discoveredAssets.some(a=>a.quantumRisk==="High") ? "High (Vulnerable public-key usage detected)" : "Low"}`, y);
    y = addText(`Runtime Verification: ${data.configuration.runtimeEnabled ? "Enabled" : "Disabled"}`, y);
    y = addText(`Highest Priority Area: ${phases.phase1.length > 0 ? phases.phase1[0].component : "None"}`, y);
    y = addText(`Next Technical Action: ${phases.phase1.length > 0 ? getRecommendation(phases.phase1[0]).approach : "Monitor Standards"}`, y, true);

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: "right" });
    }

    doc.save(`${data.analysisId}_Report.pdf`);
  };

  const phases = getPhases();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f5f6f8]">
        <Loader2 className="animate-spin text-[#1e3a5f]" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 p-6 bg-[#f5f6f8]">
        <div className="bg-white border border-[#dde1e9] rounded-lg p-10 text-center">
          <h3 className="text-lg font-semibold text-[#1a1d23] mb-2">No Application Selected</h3>
          <p className="text-[#6b7589] text-[13px] mb-4">Select an application from the dropdown to view its assessment report.</p>
          {analyses.length > 0 && onSelectAnalysis && (
            <select
              value=""
              onChange={(e) => onSelectAnalysis(e.target.value)}
              className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 bg-white text-[#1a1d23] font-semibold outline-none"
            >
              <option value="" disabled>Select Application</option>
              {analyses.map(a => (
                <option key={a.analysisId} value={a.analysisId}>{a.applicationName}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex-1 p-6 bg-[#f5f6f8]">
        <div className="bg-white border border-[#dde1e9] rounded-lg p-10 text-center max-w-xl mx-auto">
          <Info className="mx-auto text-[#6b7589] mb-3" size={28} />
          <h3 className="text-lg font-semibold text-[#1a1d23] mb-2">No cryptographic assets were detected for this application.</h3>
          <p className="text-[#6b7589] text-[13px] mb-4">The discovery scan completed without identifying cryptographic primitives or algorithm calls in this codebase.</p>
          {analyses.length > 1 && onSelectAnalysis && (
            <div className="flex justify-center items-center gap-2">
              <span className="text-xs text-gray-500">Switch Application:</span>
              <select
                value={selectedAnalysisId || ""}
                onChange={(e) => onSelectAnalysis(e.target.value)}
                className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 bg-white text-[#1a1d23] font-semibold outline-none"
              >
                {analyses.map(a => (
                  <option key={a.analysisId} value={a.analysisId}>{a.applicationName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-12">
        
        {/* REPORT SELECTION */}
        <div>
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-[#1e3a5f] text-2xl font-bold mb-1">Cryptographic Analysis Report</h1>
              <p className="text-gray-500 text-sm">Generated assessment report for the selected application.</p>
            </div>
            <div className="flex items-center gap-3">
              {analyses.length > 1 && onSelectAnalysis && (
                <select
                  value={selectedAnalysisId || ""}
                  onChange={(e) => onSelectAnalysis(e.target.value)}
                  className="text-[12px] border border-[#dde1e9] rounded-md px-3 py-2 bg-slate-50 text-[#1a1d23] font-semibold outline-none"
                >
                  {analyses.map(a => (
                    <option key={a.analysisId} value={a.analysisId}>{a.applicationName}</option>
                  ))}
                </select>
              )}
              <button 
                className="flex items-center gap-2 bg-[#1e3a5f] text-white px-5 py-2.5 rounded text-sm font-semibold hover:bg-[#152a44] transition-colors"
                onClick={generatePDF}
              >
                <Download size={16} />
                Export PDF
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-4 text-[13px] grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Application Name</div>
              <div className="font-semibold text-[#1e3a5f]">{data.analysisName}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Analysis ID</div>
              <div className="font-semibold text-[#1e3a5f]">{data.analysisId}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Analysis Date</div>
              <div className="font-semibold text-[#1e3a5f]">{data.date}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px] font-bold">Runtime Analysis Status</div>
              <div className="font-semibold text-[#1e3a5f]">{data.configuration.runtimeEnabled ? "Enabled and Completed" : "Disabled"}</div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-10 space-y-12">
          
          {/* 1. EXECUTIVE SUMMARY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">1. Executive Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-[13px] bg-white border border-gray-200 rounded p-5">
              <div>
                <div className="text-gray-500 mb-1">Total Cryptographic Assets Discovered</div>
                <div className="font-bold text-xl text-[#1e3a5f]">{data.discoveredAssets.length}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Quantum-Vulnerable Assets</div>
                <div className="font-bold text-xl text-red-600">{data.discoveredAssets.filter(a => a.quantumRisk === "High").length}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Public-Key Assets</div>
                <div className="font-bold text-xl text-[#1e3a5f]">{data.discoveredAssets.filter(a => a.usage !== "symmetric_encryption").length}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Symmetric Cryptographic Assets</div>
                <div className="font-bold text-xl text-[#1e3a5f]">{data.discoveredAssets.filter(a => a.usage === "symmetric_encryption").length}</div>
              </div>
              {data.configuration.runtimeEnabled ? (
                <>
                  <div>
                    <div className="text-gray-500 mb-1">Runtime Verified Assets</div>
                    <div className="font-bold text-xl text-emerald-600">{data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Not Runtime Observed Assets</div>
                    <div className="font-bold text-xl text-amber-600">{data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}</div>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">Runtime Analysis</div>
                  <div className="font-bold text-xl text-slate-500">Disabled</div>
                </div>
              )}
            </div>
          </section>

          {/* 2. DISCOVERY AND CBOM SUMMARY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">2. Discovery and CBOM Summary</h2>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f5f6f8] text-[#1e3a5f] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Cryptographic Asset</th>
                    <th className="px-4 py-3">Algorithm / Version</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Discovery Source</th>
                    <th className="px-4 py-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data.discoveredAssets.map((a, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-semibold text-[#1e3a5f]">{a.asset}</td>
                      <td className="px-4 py-3 text-gray-700">{a.algorithm} / {a.version}</td>
                      <td className="px-4 py-3 text-gray-700">{a.usage.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-gray-700">{a.component}</td>
                      <td className="px-4 py-3 text-gray-700">{a.discoverySource}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-[11px]">{a.location || "Location Not Available"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. RUNTIME EVIDENCE SUMMARY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">3. Runtime Evidence Summary</h2>
            <div className="bg-white border border-gray-200 rounded p-5 text-[13px]">
              {data.configuration.runtimeEnabled ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-gray-500 mb-1">Runtime Verified Assets</div>
                      <div className="font-bold text-lg text-emerald-600">{data.discoveredAssets.filter(a => a.runtimeStatus === "Observed").length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Assets Not Observed</div>
                      <div className="font-bold text-lg text-amber-600">{data.discoveredAssets.filter(a => a.runtimeStatus !== "Observed").length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Runtime Events Collected</div>
                      <div className="font-bold text-lg text-[#1e3a5f]">{data.configuration.totalEventsCollected?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Monitoring Duration</div>
                      <div className="font-bold text-lg text-[#1e3a5f]">{data.configuration.monitoringDuration}</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-l-2 border-slate-300 p-3 text-slate-600 italic">
                    Runtime evidence is verification metadata and does not reduce the theoretical cryptographic risk of an asset.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="font-bold text-lg text-slate-600">Runtime Analysis: Disabled</div>
                  <div className="text-gray-600">
                    Runtime verification was not performed for this analysis. Static discovery findings remain included in the assessment.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 4. APPLICATION PRIORITY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">4. Application-Level Priority Assessment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded p-5 text-[13px]">
                <h3 className="font-bold text-[#1e3a5f] mb-4">Application Priority Calculation</h3>
                <div className="space-y-2 mb-4 text-gray-700">
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Mosca Urgency (M):</span> <span className="font-mono">Score: {data.applicationPriority.moscaUrgency.toFixed(2)}</span></div>
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Data Sensitivity (D):</span> <span className="font-mono">Score: {data.applicationPriority.dataSensitivity.toFixed(2)}</span></div>
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Business Criticality (B):</span> <span className="font-mono">Score: {data.applicationPriority.businessCriticality.toFixed(2)}</span></div>
                </div>
                <div className="bg-slate-50 p-3 rounded font-mono text-center text-gray-600 mb-4">
                  APS = (1.00 + 1.00 + 1.00) / 3
                </div>
                <div className="text-center">
                  <div className="text-gray-500 mb-1">Application Priority Score = {data.applicationPriority.aps.toFixed(2)}</div>
                  <div className="font-bold text-lg text-[#1e3a5f]">Application Priority = {data.applicationPriority.overallPriority}</div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded p-5 text-[13px]">
                <h3 className="font-bold text-[#1e3a5f] mb-4">Mosca Variables</h3>
                <div className="space-y-2 mb-4 text-gray-700">
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Data Protection Lifetime (X):</span> <span>{data.applicationPriority.moscaVariables.dataProtectionLifetime} years</span></div>
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Migration Duration (Y):</span> <span>{data.applicationPriority.moscaVariables.migrationDuration} years</span></div>
                  <div className="flex justify-between border-b border-gray-100 pb-2"><span>Quantum Horizon (Z):</span> <span>{data.applicationPriority.moscaVariables.quantumThreatHorizon} years</span></div>
                </div>
                <div className="bg-[#f0f4f8] border border-blue-100 p-3 rounded text-center">
                  <div className="text-[#1e3a5f] font-bold mb-1">
                    Mosca Margin: {(data.applicationPriority.moscaVariables.dataProtectionLifetime + data.applicationPriority.moscaVariables.migrationDuration) - Math.max(0, data.applicationPriority.moscaVariables.quantumThreatHorizon - new Date().getFullYear())} years
                  </div>
                  <div className="text-gray-600 text-[11px]">X + Y - Z. A positive margin indicates the data will still require protection when quantum threats mature, requiring urgent migration.</div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. COMPONENT PRIORITY */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">5. Component-Level Priority Assessment</h2>
            <div className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f5f6f8] text-[#1e3a5f] font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Cryptographic Asset</th>
                    <th className="px-4 py-3">Component / Usage</th>
                    <th className="px-4 py-3">Quantum Risk</th>
                    <th className="px-4 py-3 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.discoveredAssets.sort((a,b) => a.priorityRank - b.priorityRank).map((a, i) => {
                    const isExpanded = expandedAsset === `priority-${a.asset}`;
                    return (
                      <React.Fragment key={i}>
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedAsset(isExpanded ? null : `priority-${a.asset}`)}>
                          <td className="px-4 py-3 font-semibold text-gray-500">#{a.priorityRank}</td>
                          <td className="px-4 py-3 font-semibold text-[#1e3a5f] flex items-center gap-2">
                            {isExpanded ? <ChevronDown size={14} className="text-gray-400"/> : <ChevronRight size={14} className="text-gray-400"/>}
                            {a.asset}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{a.component}</td>
                          <td className="px-4 py-3 text-gray-700">{a.quantumRisk}</td>
                          <td className="px-4 py-3 text-center font-bold text-[#1e3a5f]">{a.priorityScore}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="px-10 py-5 border-b border-gray-200">
                              <h4 className="font-bold text-[#1e3a5f] text-[12px] uppercase tracking-wider mb-3">Component Priority Calculation</h4>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-[12px]">
                                <div>
                                  <div className="text-gray-500 mb-1">Quantum Vulnerability</div>
                                  <div className="font-semibold text-gray-800">{a.quantumRisk}</div>
                                  <div className="text-gray-400 font-mono mt-1">Score: {a.riskScore}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 mb-1">Migration Complexity</div>
                                  <div className="font-semibold text-gray-800">{a.migrationComplexity >= 80 ? "High" : a.migrationComplexity >= 50 ? "Medium" : "Low"}</div>
                                  <div className="text-gray-400 font-mono mt-1">Score: {a.migrationComplexity}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 mb-1">Dependency Impact</div>
                                  <div className="font-semibold text-gray-800">{a.dependencyImpact >= 80 ? "High" : "Medium"}</div>
                                  <div className="text-gray-400 font-mono mt-1">Score: {a.dependencyImpact}</div>
                                </div>
                                <div className="border-l border-slate-200 pl-6">
                                  <div className="text-gray-500 mb-1">Runtime Evidence</div>
                                  <div className="font-semibold text-[#1e3a5f]">{a.runtimeStatus}</div>
                                  <div className="text-[10px] text-gray-400 italic mt-1 leading-tight">Runtime evidence is a verification layer and does not modify the priority score.</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. RECOMMENDATIONS */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">6. Technical Migration Recommendations</h2>
            <div className="space-y-6">
              {data.discoveredAssets.map((a, i) => {
                const rec = getRecommendation(a);
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded p-6 shadow-sm">
                    <div className="flex justify-between border-b border-gray-100 pb-3 mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Current Asset</div>
                        <div className="text-lg font-bold text-[#1e3a5f]">{a.asset}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Usage</div>
                        <div className="text-sm font-semibold text-gray-700">{a.usage.replace("_", " ")} ({a.component})</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-[13px]">
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Technical Issue</h4>
                        <p className="text-gray-600 leading-relaxed">{rec.issue}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Recommended Approach</h4>
                        <p className="text-[#1e3a5f] font-semibold leading-relaxed">{rec.approach}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Suggested Target</h4>
                        <p className="text-emerald-700 font-semibold leading-relaxed">{rec.target}</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">Implementation Guidance</h4>
                        <p className="text-gray-600 leading-relaxed">{rec.guidance}</p>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-gray-100">
                        <span className="font-bold text-gray-800">Standards Reference: </span>
                        <span className="text-gray-600 font-mono text-[12px]">{rec.standard}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 7. ROADMAP */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">7. Migration Roadmap</h2>
            <div className="space-y-4">
              
              <div className="border border-red-200 bg-red-50 rounded p-4">
                <h3 className="font-bold text-red-800 text-[14px] mb-3">Phase 1 — Highest Priority Components</h3>
                <div className="space-y-3">
                  {phases.phase1.map((a,i) => (
                    <div key={i} className="bg-white border border-red-100 rounded p-3 text-[13px] flex flex-col md:flex-row gap-4 justify-between">
                      <div className="font-bold text-red-900 w-1/4">{a.asset}</div>
                      <div className="text-gray-600 w-1/4">{a.component}</div>
                      <div className="text-[#1e3a5f] font-semibold w-1/2">Target: {getRecommendation(a).target}</div>
                    </div>
                  ))}
                  {phases.phase1.length === 0 && <div className="text-sm text-gray-500 italic">No assets in this phase.</div>}
                </div>
              </div>

              <div className="border border-amber-200 bg-amber-50 rounded p-4">
                <h3 className="font-bold text-amber-800 text-[14px] mb-3">Phase 2 — Next Priority Components</h3>
                <div className="space-y-3">
                  {phases.phase2.map((a,i) => (
                    <div key={i} className="bg-white border border-amber-100 rounded p-3 text-[13px] flex flex-col md:flex-row gap-4 justify-between">
                      <div className="font-bold text-amber-900 w-1/4">{a.asset}</div>
                      <div className="text-gray-600 w-1/4">{a.component}</div>
                      <div className="text-[#1e3a5f] font-semibold w-1/2">Target: {getRecommendation(a).target}</div>
                    </div>
                  ))}
                  {phases.phase2.length === 0 && <div className="text-sm text-gray-500 italic">No assets in this phase.</div>}
                </div>
              </div>

              <div className="border border-slate-200 bg-slate-50 rounded p-4">
                <h3 className="font-bold text-slate-800 text-[14px] mb-3">Phase 3 — Retain and Monitor</h3>
                <div className="space-y-3">
                  {phases.phase3.map((a,i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded p-3 text-[13px] flex flex-col md:flex-row gap-4 justify-between">
                      <div className="font-bold text-slate-700 w-1/4">{a.asset}</div>
                      <div className="text-gray-600 w-1/4">{a.component}</div>
                      <div className="text-[#1e3a5f] font-semibold w-1/2">Target: {getRecommendation(a).target}</div>
                    </div>
                  ))}
                  {phases.phase3.length === 0 && <div className="text-sm text-gray-500 italic">No assets in this phase.</div>}
                </div>
              </div>

            </div>
          </section>

          {/* 8. STANDARDS */}
          <section>
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">8. Standards and References</h2>
            <ul className="list-disc list-inside space-y-2 text-[13px] text-gray-700 bg-white border border-gray-200 rounded p-5">
              <li><span className="font-semibold">NIST FIPS 203 (ML-KEM)</span> - Module-Lattice-Based Key-Encapsulation Mechanism Standard</li>
              <li><span className="font-semibold">NIST FIPS 204 (ML-DSA)</span> - Module-Lattice-Based Digital Signature Standard</li>
              <li><span className="font-semibold">NIST FIPS 205 (SLH-DSA)</span> - Stateless Hash-Based Digital Signature Standard</li>
              <li><span className="font-semibold">NIST SP 800-208</span> - Stateful Hash-Based Signatures</li>
            </ul>
          </section>

          {/* 9. FINAL STATUS */}
          <section className="mb-20">
            <h2 className="text-lg font-bold text-[#1e3a5f] mb-4 border-l-4 border-[#1e3a5f] pl-3">9. Final Report Status</h2>
            <div className="bg-[#1e3a5f] text-white rounded p-6 shadow-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Cryptographic Inventory</div>
                <div className="font-semibold text-sm">Complete based on available scan data</div>
              </div>
              <div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Quantum Risk Exposure</div>
                <div className="font-semibold text-sm">{data.discoveredAssets.some(a=>a.quantumRisk==="High") ? "High (Vulnerable public-key usage detected)" : "Low"}</div>
              </div>
              <div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Runtime Verification</div>
                <div className="font-semibold text-sm">{data.configuration.runtimeEnabled ? "Enabled" : "Disabled"}</div>
              </div>
              <div className="lg:col-span-3 pt-4 border-t border-blue-800">
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Highest Priority Area</div>
                <div className="font-semibold text-lg text-white mb-2">{phases.phase1.length > 0 ? phases.phase1[0].component : "None"}</div>
                <div className="text-blue-200 text-[11px] font-bold uppercase tracking-wider mb-1">Recommended Next Technical Action</div>
                <div className="font-semibold text-emerald-300">{phases.phase1.length > 0 ? getRecommendation(phases.phase1[0]).approach : "Monitor Standards"}</div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}