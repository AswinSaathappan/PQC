import { useState } from "react";
import { CheckCircle, MapPin, AlertTriangle, GitBranch } from "lucide-react";

const assets = ["AES-256-GCM", "RSA-2048", "ECDSA P-256", "SHA-256", "TLS 1.2"];

const profileData = {
  "RSA-2048": {
    type: "Asymmetric Key Exchange / Digital Signature",
    quantumStatus: "Vulnerable",
    standard: "PKCS#1 v2.2",
    keySize: "2048-bit",
    whereDiscovered: "auth-service/crypto/rsa.py:142",
    library: "cryptography==41.0.7",
    application: "Authentication Service",
    staticStatus: "Confirmed",
    runtimeEvidence: "Observed (10:32:19)",
    observedOps: ["Sign", "Verify", "Key Generation"],
    dependencies: ["Document Service", "API Gateway", "Session Manager"],
    risk: "High — Vulnerable to Shor's algorithm. Immediate migration planning recommended.",
  },
  "AES-256-GCM": {
    type: "Symmetric Encryption",
    quantumStatus: "Safe",
    standard: "NIST FIPS 197",
    keySize: "256-bit",
    whereDiscovered: "document-service/encrypt.py:88",
    library: "cryptography==41.0.7",
    application: "Document Service",
    staticStatus: "Confirmed",
    runtimeEvidence: "Observed (10:32:14)",
    observedOps: ["Encrypt", "Decrypt"],
    dependencies: ["Storage Service", "API Gateway"],
    risk: "Low — AES-256 is considered quantum-safe under Grover's algorithm analysis.",
  },
};

export default function CryptoProfile() {
  const [selected, setSelected] = useState("RSA-2048");
  const profile = profileData[selected as keyof typeof profileData] || profileData["RSA-2048"];

  const riskColor = profile.quantumStatus === "Vulnerable" ? "text-red-700 bg-red-50 border-red-200"
    : profile.quantumStatus === "Safe" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-5">

        {/* Asset selector */}
        <div className="bg-white border border-[#dde1e9] rounded-lg p-4">
          <div className="text-[11px] text-[#6b7589] mb-2 font-medium uppercase tracking-wide">Select Cryptographic Asset</div>
          <div className="flex gap-2 flex-wrap">
            {assets.map(a => (
              <button key={a} onClick={() => setSelected(a)}
                className={`text-[12px] font-medium px-3 py-1.5 rounded-md mono transition-colors ${
                  selected === a ? "bg-[#1e3a5f] text-white" : "bg-[#f5f6f8] text-[#1a1d23] hover:bg-[#eef0f3] border border-[#dde1e9]"
                }`}>{a}</button>
            ))}
          </div>
        </div>

        {/* Evidence model header */}
        <div className="bg-[#1e3a5f] rounded-lg px-6 py-5 flex items-center gap-6">
          <div className="flex-1">
            <div className="text-white/50 text-[10px] uppercase tracking-wider font-medium mb-1">Cryptographic Asset Profile</div>
            <div className="text-white text-xl font-bold mono">{selected}</div>
            <div className="text-blue-200/60 text-[11px] mt-0.5">{profile.type}</div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-white/60">
            <div className="text-center">
              <div className="text-white font-semibold mb-0.5">Discovery</div>
              <div className="w-12 h-0.5 bg-white/20 mx-auto" />
            </div>
            <div className="text-white/30 text-lg">+</div>
            <div className="text-center">
              <div className="text-white font-semibold mb-0.5">Runtime</div>
              <div className="w-12 h-0.5 bg-white/20 mx-auto" />
            </div>
            <div className="text-white/30 text-lg">+</div>
            <div className="text-center">
              <div className="text-white font-semibold mb-0.5">Dependencies</div>
              <div className="w-12 h-0.5 bg-white/20 mx-auto" />
            </div>
            <div className="text-white/30 text-lg">=</div>
            <div className="bg-white/10 rounded-md px-3 py-1.5 text-center">
              <div className="text-white font-bold text-[12px]">Crypto Profile</div>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${riskColor}`}>
            {profile.quantumStatus}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Discovery info */}
          <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={14} className="text-[#1e3a5f]" />
              <div className="text-[13px] font-semibold text-[#1a1d23]">Where Discovered</div>
            </div>
            <div className="space-y-3 text-[12px]">
              {[
                { label: "Source File", value: profile.whereDiscovered },
                { label: "Library", value: profile.library },
                { label: "Application", value: profile.application },
                { label: "Standard", value: profile.standard },
                { label: "Key Size", value: profile.keySize },
                { label: "Static Finding", value: profile.staticStatus },
              ].map(item => (
                <div key={item.label} className="flex justify-between border-b border-[#f0f2f5] pb-2 last:border-0">
                  <span className="text-[#6b7589]">{item.label}</span>
                  <span className="font-medium text-[#1a1d23] mono text-[11px] text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Runtime evidence */}
          <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={14} className="text-emerald-500" />
              <div className="text-[13px] font-semibold text-[#1a1d23]">Runtime Evidence</div>
            </div>
            <div className="mb-3">
              <div className="text-[11px] text-[#6b7589] mb-1">Evidence Status</div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-[12px] text-emerald-700 font-medium">
                {profile.runtimeEvidence}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#6b7589] mb-2">Observed Operations</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.observedOps.map(op => (
                  <span key={op} className="text-[11px] bg-[#f5f6f8] border border-[#dde1e9] text-[#1a1d23] px-2 py-0.5 rounded mono">{op}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Risk & dependencies */}
          <div className="bg-white border border-[#dde1e9] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#d97706]" />
              <div className="text-[13px] font-semibold text-[#1a1d23]">Risk Context & Dependencies</div>
            </div>
            <div className={`rounded-md px-3 py-2 text-[11px] mb-4 border ${
              profile.quantumStatus === "Vulnerable" ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>{profile.risk}</div>
            <div>
              <div className="text-[11px] text-[#6b7589] mb-2 flex items-center gap-1.5"><GitBranch size={11} /> Connected Dependencies</div>
              <div className="space-y-1.5">
                {profile.dependencies.map(dep => (
                  <div key={dep} className="flex items-center gap-2 text-[12px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f]/40 flex-shrink-0" />
                    <span className="text-[#1a1d23]">{dep}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
