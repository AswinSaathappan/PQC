export default function Settings() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-[900px] mx-auto px-6 py-6 space-y-4">
        {[
          { section: "Organization", fields: [{ label: "Organization Name", value: "Acme Corp Security" }, { label: "Contact Email", value: "security@acmecorp.com" }] },
          { section: "Analysis Defaults", fields: [{ label: "Quantum Threat Estimate (X)", value: "8 years" }, { label: "Default Migration Window (Y)", value: "4 years" }, { label: "Default Data Lifetime (Z)", value: "5 years" }] },
          { section: "API & Integrations", fields: [{ label: "FastAPI Backend URL", value: "https://api.cryptavista.internal" }, { label: "MongoDB Connection", value: "Connected" }] },
        ].map((group, i) => (
          <div key={i} className="bg-white border border-[#dde1e9] rounded-lg p-5">
            <div className="text-[13px] font-semibold text-[#1a1d23] mb-4">{group.section}</div>
            <div className="space-y-3">
              {group.fields.map(field => (
                <div key={field.label} className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-[12px] text-[#6b7589]">{field.label}</label>
                  <input defaultValue={field.value} className="col-span-2 text-[12px] border border-[#dde1e9] rounded-md px-3 py-1.5 text-[#1a1d23] outline-none focus:border-[#1e3a5f] transition-colors" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <button className="text-[12px] bg-[#1e3a5f] text-white px-4 py-1.5 rounded-md font-medium hover:bg-[#162e4d]">Save Settings</button>
        </div>
      </div>
    </div>
  );
}
