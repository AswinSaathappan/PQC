import mongoose, { Schema, Document } from 'mongoose';

export interface ICryptoAsset extends Document {
  assetId: string;
  analysisId: string;
  assetName?: string;
  assetType?: string;
  primitive?: string;
  location?: string;
  line?: number;
  bomRef?: string;
  occurrences?: any[];
  algorithm: string;
  version?: string;
  mode?: string;
  keySize?: number;
  protocol?: string;
  library?: string;
  sourceLocation?: string;
  discoverySource: string;
  evidence?: string;
  confidence: string; // 'High' | 'Medium' | 'Low'
  rawCBOMReference?: string;
  quantumSafe?: boolean | null;
  cbomKitClassification?: string; // 'Unknown' | 'Not Applicable' | 'Not Quantum Safe' | 'Quantum Safe' (display/legacy)
  cbomkitClassification?: string; // 'quantum-safe' | 'quantum-vulnerable' | 'na' | 'unknown' (exact preserved)
  cryptavistaQuantumRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'NA' | 'CONTEXT_DEPENDENT';
  cryptavistaQuantumClassification?: 'QUANTUM_SAFE' | 'QUANTUM_RESISTANT' | 'NOT_QUANTUM_SAFE' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'CONTEXT_DEPENDENT';
  cryptavistaScore?: number | null; // 20 | 60 | 100 | null
  cryptavistaReason?: string;
  cryptavistaEvidence?: string[];
  dependencyMetrics?: {
    directDependents: number;
    transitiveDependents: number;
    affectedComponents: number;
    totalComponents: number;
    dependencyReach: number; // percentage
    isAvailable: boolean;
  };
  assessmentMetadata?: {
    dataProtectionLifetime?: string;
    businessCriticality?: string;
    dataSensitivity?: string;
  };
}

const CryptoAssetSchema: Schema = new Schema({
  assetId: { type: String, required: true, unique: true },
  analysisId: { type: String, required: true },
  assetName: { type: String },
  assetType: { type: String },
  primitive: { type: String },
  location: { type: String },
  line: { type: Number },
  bomRef: { type: String },
  occurrences: { type: [Schema.Types.Mixed], default: [] },
  algorithm: { type: String, required: true },
  version: { type: String },
  mode: { type: String },
  keySize: { type: Number },
  protocol: { type: String },
  library: { type: String },
  sourceLocation: { type: String },
  discoverySource: { type: String, required: true },
  evidence: { type: String },
  confidence: { type: String, default: 'High' },
  rawCBOMReference: { type: String },
  quantumSafe: { type: Boolean, default: null },
  cbomKitClassification: { type: String },
  cbomkitClassification: { type: String },
  cryptavistaQuantumRisk: { type: String },
  cryptavistaQuantumClassification: { type: String },
  cryptavistaScore: { type: Number, default: null },
  cryptavistaReason: { type: String },
  cryptavistaEvidence: { type: [String], default: [] },
  dependencyMetrics: {
    directDependents: { type: Number, default: 0 },
    transitiveDependents: { type: Number, default: 0 },
    affectedComponents: { type: Number, default: 0 },
    totalComponents: { type: Number, default: 1 },
    dependencyReach: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: false }
  },
  assessmentMetadata: {
    dataProtectionLifetime: { type: String, default: 'Medium' },
    businessCriticality: { type: String, default: 'High' },
    dataSensitivity: { type: String, default: 'Confidential' }
  }
}, {
  timestamps: true
});

export const CryptoAsset = mongoose.model<ICryptoAsset>('CryptoAsset', CryptoAssetSchema);
