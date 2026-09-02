import { useState } from "react";
import { CheckCircle, ChevronRight, FolderOpen, GitBranch, Box, Container } from "lucide-react";

const inputTypes = [
  { id: "source", icon: GitBranch, label: "Source Code Repository", sub: "Git repository or uploaded code archive" },
  { id: "folder", icon: FolderOpen, label: "Project Folder", sub: "Local project directory or uploaded folder" },
  { id: "binary", icon: Box, label: "Binary / Library", sub: "Compiled binaries or cryptographic library files" },
  { id: "container", icon: Container, label: "Container Image", sub: "OCI / Docker container image" },
];

const stages = [
  { label: "DISCOVER", sub: "Cryptographic artefact discovery" },
  { label: "VERIFY", sub: "Runtime evidence collection" },
  { label: "ASSESS", sub: "Quantum risk assessment" },
  { label: "PRIORITIZE", sub: "Migration ranking" },
  { label: "RECOMMEND", sub: "PQC / Hybrid guidance" },
];

type Status = "pending" | "running" | "done";

const stepLabels = ["Add Application", "Application Context", "Analysis Configuration", "Review & Start"];

interface Props { onComplete?: () => void; }

export default function NewAnalysis({ onComplete }: Props) {
  const [step, setStep] = useState(1);

  // Step 1
  const [appName, setAppName] = useState("");
  const [inputType, setInputType] = useState<string | null>(null);

  // Step 2
  const [criticality, setCriticality] = useState("");
  const [sensitivity, setSensitivity] = useState("");
  const [dataLifetime, setDataLifetime] = useState("");

  // Step 3
  const [runtimeEnabled, setRuntimeEnabled] = useState(true);
  const [crqcYear, setCrqcYear] = useState(2036);

  // Step 4 / Running
  const [running, setRunning] = useState(false);
  const [stageProgress, setStageProgress] = useState<Status[]>(stages.map(() => "pending"));

  const canNext1 = appName.trim().length > 0 && inputType !== null;
  const canNext2 = criticality !== "" && sensitivity !== "" && dataLifetime !== "";

  function startAnalysis() {
    setRunning(true);
    const progress: Status[] = stages.map(() => "pending");
    let i = 0;
    const tick = () => {
      if (i < stages.length) {
        progress[i] = "running";
        setStageProgress([...progress]);
        setTimeout(() => {
          progress[i] = "done";
          i++;
          setStageProgress([...progress]);
          setTimeout(tick, 300);
        }, 800);
      } else {
        setTimeout(() => onComplete?.(), 1200);
      }
    };
    setTimeout(tick, 400);
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
              <input value={appName} onChange={e => setAppName(e.target.value)} placeholder="e.g. Digital Banking Platform"
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

            <div>
              <label className="block text-[11px] font-semibold text-[#1a1d23] mb-1.5">Data Sensitivity *</label>
              <div className="flex gap-2 flex-wrap">
                {["Public", "Internal", "Confidential", "Highly Confidential"].map(s => (
                  <button key={s} onClick={() => setSensitivity(s)}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-md border transition-all flex-1 ${
                      sensitivity === s ? "border-[#1e3a5f] bg-[#f0f4fa] text-[#1e3a5f] font-bold" : "border-[#dde1e9] text-[#6b7589] hover:border-[#1e3a5f]/40"
                    }`}>{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#1a1d23] mb-1.5">Expected Data Lifetime *</label>
              <div className="grid grid-cols-3 gap-2">
                {["Short-term", "Medium-term", "Long-term", "Extended-term", "Custom duration"].map(l => (
                  <button key={l} onClick={() => setDataLifetime(l)}
                    className={`text-[11px] font-medium py-2 px-3 rounded-md border transition-all text-center ${
                      dataLifetime === l ? "border-[#1e3a5f] bg-[#f0f4fa] text-[#1e3a5f] font-bold" : "border-[#dde1e9] text-[#6b7589] hover:border-[#1e3a5f]/40"
                    }`}>{l}</button>
                ))}
              </div>
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
        {step === 4 && !running && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-6 space-y-5">
            <div>
              <div className="text-[15px] font-bold text-[#1a1d23] mb-0.5">Review & Start Analysis</div>
              <div className="text-[11px] text-[#6b7589]">Confirm your configuration before CRYPTAVISTA begins discovery.</div>
            </div>

            <div className="bg-[#f9fafb] border border-[#dde1e9] rounded-lg divide-y divide-[#eef0f3]">
              {[
                { label: "Application", value: appName },
                { label: "Input", value: inputTypes.find(t => t.id === inputType)?.label ?? "—" },
                { label: "Business Criticality", value: criticality },
                { label: "Data Sensitivity", value: sensitivity },
                { label: "Expected Data Lifetime", value: dataLifetime },
                { label: "Runtime Verification", value: runtimeEnabled ? "Enabled" : "Disabled" },
                { label: "CRQC Planning Scenario", value: String(crqcYear) },
              ].map(r => (
                <div key={r.label} className="flex justify-between px-4 py-3">
                  <span className="text-[11px] text-[#6b7589]">{r.label}</span>
                  <span className="text-[11px] font-semibold text-[#1a1d23]">{r.value}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => setStep(3)} className="text-[12px] text-[#6b7589] px-3 py-1.5 hover:text-[#1a1d23] transition-colors">Back</button>
              <button onClick={startAnalysis}
                className="text-[13px] font-bold bg-[#1e3a5f] text-white px-6 py-2.5 rounded-md hover:bg-[#162e4d] transition-colors">
                Start Analysis
              </button>
            </div>
          </div>
        )}

        {/* ── Running: Analysis Progress ── */}
        {running && (
          <div className="bg-white border border-[#dde1e9] rounded-lg p-6">
            <div className="text-[15px] font-bold text-[#1a1d23] mb-1">{appName}</div>
            <div className="text-[11px] text-[#6b7589] mb-6">Analysis in progress — CRYPTAVISTA is running the full ECDAT workflow</div>

            <div className="space-y-3">
              {stages.map((stage, i) => {
                const status = stageProgress[i];
                return (
                  <div key={i} className={`flex items-center gap-4 rounded-lg border px-5 py-3.5 transition-all ${
                    status === "running" ? "border-[#1e3a5f] bg-[#f0f4fa]"
                    : status === "done" ? "border-emerald-200 bg-emerald-50/50"
                    : "border-[#dde1e9] bg-[#f9fafb] opacity-50"
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      status === "done" ? "bg-emerald-500"
                      : status === "running" ? "bg-[#1e3a5f]"
                      : "bg-[#dde1e9]"
                    }`}>
                      {status === "done" ? <CheckCircle size={13} className="text-white" />
                        : status === "running"
                        ? <div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        : <span className="text-[9px] text-white font-bold">{i + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <div className={`text-[12px] font-bold ${status === "running" ? "text-[#1e3a5f]" : status === "done" ? "text-emerald-700" : "text-[#9aa1b1]"}`}>{stage.label}</div>
                      <div className="text-[10px] text-[#9aa1b1]">{stage.sub}</div>
                    </div>
                    <div className={`text-[10px] font-semibold ${
                      status === "done" ? "text-emerald-600"
                      : status === "running" ? "text-[#1e3a5f]"
                      : "text-[#9aa1b1]"
                    }`}>
                      {status === "done" ? "✓ Complete" : status === "running" ? "◐ In Progress" : "○ Pending"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
