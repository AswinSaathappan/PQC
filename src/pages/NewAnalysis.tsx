import { useState } from "react";
import { CheckCircle, ChevronRight, FolderOpen, GitBranch, Box, Container, Loader2 } from "lucide-react";

const inputTypes = [
  { id: "source", icon: GitBranch, label: "Git Repository", sub: "Scan a public Git repository via clone URL" },
  { id: "folder", icon: FolderOpen, label: "Project Folder", sub: "Local project directory via folder picker" },
  { id: "binary", icon: Box, label: "Binary / Library", sub: "Compiled binaries or cryptographic library files" },
  { id: "container", icon: Container, label: "Container Image", sub: "OCI / Docker container image" },
];

const stepLabels = ["Add Application", "Application Context", "Analysis Configuration", "Review & Start"];

interface Props {
  onComplete?: () => void;
  onNavigate?: (route: string) => void;
  onSelectAnalysis?: (id: string) => void;
  refreshAnalyses?: (preferredId?: string) => void;
}

export default function NewAnalysis({ onComplete, onNavigate, onSelectAnalysis, refreshAnalyses }: Props) {
  const [step, setStep] = useState(1);

  // Step 1
  const [appName, setAppName] = useState("");
  const [inputType, setInputType] = useState<string | null>(null);

  // Step 2
  const [criticality, setCriticality] = useState("");
  const [sensitivity, setSensitivity] = useState("");
  const [dataLifetime, setDataLifetime] = useState<number | "">(5);

  // Step 3
  const [runtimeEnabled, setRuntimeEnabled] = useState(true);
  const [crqcYear, setCrqcYear] = useState(2036);
  const [isStarting, setIsStarting] = useState(false);

  const canNext1 = appName.trim().length > 0 && inputType !== null;
  const canNext2 = criticality !== "" && sensitivity !== "" && typeof dataLifetime === 'number' && dataLifetime > 0;

  async function startAnalysis() {
    try {
      setIsStarting(true);
      const critVal = criticality === "Critical" ? 4 : criticality === "High" ? 3 : criticality === "Medium" ? 2 : 1;
      const sensVal = sensitivity === "Highly Confidential" ? 4 : sensitivity === "Confidential" ? 3 : sensitivity === "Internal" ? 2 : 1;

      const payload = {
        applicationName: appName.trim(),
        targetType: inputType === "folder" ? "folder" : "source_code",
        businessCriticality: critVal,
        dataSensitivity: sensVal,
        dataProtectionDuration: typeof dataLifetime === "number" ? dataLifetime : 5,
        runtimeEnabled,
        threatHorizonYear: crqcYear,
        quantumRiskHorizon: crqcYear - 2026,
        migrationDuration: 2
      };

      const res = await fetch("http://localhost:3001/api/analyses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create analysis");
      }
      const analysis = await res.json();

      if (onSelectAnalysis && analysis?.analysisId) {
        onSelectAnalysis(analysis.analysisId);
      }
      try {
        if (analysis?.analysisId) {
          localStorage.setItem("cryptavista_selected_analysis_id", analysis.analysisId);
        }
      } catch {}
      if (refreshAnalyses && analysis?.analysisId) {
        refreshAnalyses(analysis.analysisId);
      }

      if (onNavigate) {
        onNavigate(`cbom:${analysis.analysisId}`);
      }
    } catch (e: any) {
      alert("Failed to start analysis: " + e.message);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[800px] mx-auto px-6 py-6">

        {/* Stepper */}
        <div className="flex items-center gap-0 mb-8">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={n} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold border-2 transition-colors ${
                    done ? "bg-emerald-500 border-emerald-500 text-white" : active ? "bg-[#1e3a5f] border-[#1e3a5f] text-white" : "bg-white border-[#dde1e9] text-[#9aa1b1]"
                  }`}>
                    {done ? <CheckCircle size={13} /> : n}
                  </div>
                  <span className={`text-[11px] font-medium whitespace-nowrap ${active ? "text-[#1a1d23]" : done ? "text-emerald-600" : "text-[#9aa1b1]"}`}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && <div className={`flex-1 h-px mx-3 ${done ? "bg-emerald-300" : "bg-[#dde1e9]"}`} />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Add Application ── */}
        {step === 1 && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-6 space-y-5">
            <div>
              <div className="text-[15px] font-bold text-[#1a1d23] mb-0.5">Add Application for Analysis</div>
              <div className="text-[11px] text-[#6b7589]">CRYPTAVISTA will automatically discover all cryptographic artefacts from the provided input.</div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#1a1d23] mb-1.5">Application Name *</label>
              <input value={appName} onChange={e => setAppName(e.target.value)} placeholder="e.g. pt-crypto"
                className="w-full text-[12px] border border-[#dde1e9] rounded-md px-3 py-2 outline-none focus:border-[#1e3a5f] text-[#1a1d23] placeholder-[#9aa1b1] transition-colors" />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#1a1d23] mb-2">Input Source *</label>
              <div className="grid grid-cols-2 gap-2.5">
                {inputTypes.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setInputType(t.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                        inputType === t.id ? "border-[#1e3a5f] bg-[#f0f4fa]" : "border-[#dde1e9] hover:border-[#1e3a5f]/40 hover:bg-[#f9fafb]"
                      }`}>
                      <Icon size={16} className={inputType === t.id ? "text-[#1e3a5f]" : "text-[#6b7589]"} />
                      <div>
                        <div className={`text-[12px] font-semibold ${inputType === t.id ? "text-[#1e3a5f]" : "text-[#1a1d23]"}`}>{t.label}</div>
                        <div className="text-[10px] text-[#9aa1b1]">{t.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 text-[10px] text-[#9aa1b1]">
                Do not manually enter cryptographic algorithms — CRYPTAVISTA discovers these automatically from your input.
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={() => setStep(2)} disabled={!canNext1}
                className="flex items-center gap-1.5 text-[12px] bg-[#1e3a5f] text-white px-5 py-2 rounded-md font-medium hover:bg-[#162e4d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Continue <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Application Context ── */}
        {step === 2 && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-6 space-y-5">
            <div>
              <div className="text-[15px] font-bold text-[#1a1d23] mb-0.5">Application Context</div>
              <div className="text-[11px] text-[#6b7589]">This information helps assess cryptographic migration urgency and long-term quantum risk. Provide only what cannot be discovered automatically.</div>
            </div>

            {/* Business Criticality */}
            <div>
              <label className="block text-[11px] font-semibold text-[#1a1d23] mb-1.5">Business Criticality *</label>
              <div className="flex gap-2">
                {["Low", "Medium", "High", "Critical"].map(c => (
                  <button key={c} onClick={() => setCriticality(c)}
                    className={`flex-1 text-[11px] font-medium py-2 rounded-md border transition-all ${
                      criticality === c ? "border-[#1e3a5f] bg-[#f0f4fa] text-[#1e3a5f] font-bold" : "border-[#dde1e9] text-[#6b7589] hover:border-[#1e3a5f]/40"
                    }`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Data Sensitivity */}
            <div>
              <label className="block text-[11px] font-semibold text-[#1a1d23] mb-1.5">Data Sensitivity *</label>
              <div className="flex gap-2">
                {["Public", "Internal", "Confidential", "Highly Confidential"].map(s => (
                  <button key={s} onClick={() => setSensitivity(s)}
                    className={`flex-1 text-[11px] font-medium py-1.5 rounded-md border transition-all ${
                      sensitivity === s ? "border-[#1e3a5f] bg-[#f0f4fa] text-[#1e3a5f] font-bold" : "border-[#dde1e9] text-[#6b7589] hover:border-[#1e3a5f]/40"
                    }`}>{s}</button>
                ))}
              </div>
            </div>

            {/* Expected Data Lifetime — Numeric input */}
            <div>
              <label className="block text-[11px] font-semibold text-[#1a1d23] mb-1.5">Data Protection Duration (Years) *</label>
              <input 
                type="number" 
                min="1" 
                max="100" 
                value={dataLifetime === '' ? '' : dataLifetime} 
                onChange={e => {
                  const val = e.target.value;
                  if (val === '') {
                    setDataLifetime('');
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setDataLifetime(parsed);
                    }
                  }
                }}
                className="w-full text-[12px] border border-[#dde1e9] rounded-md px-3 py-2 outline-none focus:border-[#1e3a5f] text-[#1a1d23] transition-colors"
              />
              <div className="text-[10px] text-[#9aa1b1] mt-1.5">How many years does this data need to remain secure? (X in Mosca's Theorem)</div>
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => setStep(1)} className="text-[12px] text-[#6b7589] px-3 py-1.5 hover:text-[#1a1d23] transition-colors">Back</button>
              <button onClick={() => setStep(3)} disabled={!canNext2}
                className="flex items-center gap-1.5 text-[12px] bg-[#1e3a5f] text-white px-5 py-2 rounded-md font-medium hover:bg-[#162e4d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Continue <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Analysis Configuration ── */}
        {step === 3 && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-6 space-y-5">
            <div>
              <div className="text-[15px] font-bold text-[#1a1d23] mb-0.5">Analysis Configuration</div>
              <div className="text-[11px] text-[#6b7589]">CRYPTAVISTA will perform the following analysis automatically on your selected input.</div>
            </div>

            {/* Static discovery — always on */}
            <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-bold text-[#1a1d23] mb-1">Static Cryptographic Discovery</div>
                  <div className="text-[10px] text-[#6b7589] leading-relaxed">CRYPTAVISTA will automatically scan for: algorithms, cryptographic libraries, certificates, protocols, keys and key configurations, and cryptographic artefacts.</div>
                </div>
                <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                  <div className="w-8 h-4 rounded-full bg-[#0d7a6b] flex items-center justify-end px-0.5">
                    <div className="w-3 h-3 rounded-full bg-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-[#0d7a6b]">Always enabled</span>
                </div>
              </div>
            </div>

            {/* Runtime verification — optional */}
            <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <div className="text-[12px] font-bold text-[#1a1d23] mb-1">Runtime Evidence Verification <span className="text-[10px] text-[#9aa1b1] font-normal">(Optional)</span></div>
                  <div className="text-[10px] text-[#6b7589] leading-relaxed">Observe cryptographic activity during controlled application execution to validate static findings and confirm which artefacts are actively used.</div>
                </div>
                <button onClick={() => setRuntimeEnabled(e => !e)} className="flex-shrink-0">
                  <div className={`w-9 h-5 rounded-full flex items-center transition-colors ${runtimeEnabled ? "bg-[#1e3a5f] justify-end px-0.5" : "bg-[#dde1e9] justify-start px-0.5"}`}>
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </div>
                </button>
              </div>
            </div>

            {/* CRQC scenario */}
            <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-[#1a1d23] mb-1">CRQC Planning Scenario</div>
                  <div className="text-[10px] text-[#6b7589] leading-relaxed mb-2">This is a configurable planning assumption and not a prediction by NIST. Used to calculate migration urgency in the Mosca timeline.</div>
                  <div className="text-[10px] text-[#9aa1b1]">PQC standards and migration approaches are aligned with applicable NIST guidance.</div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-[22px] font-bold text-[#1e3a5f]">{crqcYear}</div>
                  <input type="range" min={2030} max={2045} value={crqcYear} onChange={e => setCrqcYear(Number(e.target.value))}
                    className="w-36 accent-[#1e3a5f]" />
                  <div className="text-[9px] text-[#9aa1b1]">Configurable Project Planning Scenario</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => setStep(2)} className="text-[12px] text-[#6b7589] px-3 py-1.5 hover:text-[#1a1d23] transition-colors">Back</button>
              <button onClick={() => setStep(4)}
                className="flex items-center gap-1.5 text-[12px] bg-[#1e3a5f] text-white px-5 py-2 rounded-md font-medium hover:bg-[#162e4d] transition-colors">
                Review <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Start ── */}
        {step === 4 && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-6 space-y-5">
            <div>
              <div className="text-[15px] font-bold text-[#1a1d23] mb-0.5">Review & Start Analysis</div>
              <div className="text-[11px] text-[#6b7589]">Confirm your configuration before CRYPTAVISTA begins discovery.</div>
            </div>

            <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-lg divide-y divide-[#eef0f3]">
              {[
                { label: "Application", value: appName },
                { label: "Input Source", value: inputTypes.find(t => t.id === inputType)?.label ?? "—" },
                { label: "Business Criticality", value: criticality },
                { label: "Data Sensitivity", value: sensitivity },
                { label: "Data Protection Duration", value: `${dataLifetime} Years` },
                { label: "Runtime Verification", value: runtimeEnabled ? "Enabled" : "Not Enabled" },
                { label: "CRQC Planning Scenario", value: String(crqcYear) },
              ].map(r => (
                <div key={r.label} className="flex justify-between px-4 py-3">
                  <span className="text-[11px] text-[#6b7589]">{r.label}</span>
                  <span className="text-[11px] font-semibold text-[#1a1d23]">{r.value}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => setStep(3)} disabled={isStarting} className="text-[12px] text-[#6b7589] px-3 py-1.5 hover:text-[#1a1d23] transition-colors">Back</button>
              <button onClick={async () => await startAnalysis()} disabled={isStarting}
                className="flex items-center gap-2 text-[13px] font-bold bg-[#1e3a5f] text-white px-6 py-2.5 rounded-md hover:bg-[#162e4d] disabled:opacity-50 transition-colors">
                {isStarting && <Loader2 size={14} className="animate-spin" />}
                {isStarting ? "Creating Application..." : "Start Analysis"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
