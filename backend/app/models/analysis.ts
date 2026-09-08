import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalysis extends Document {
  analysisId: string;
  applicationName: string;
  targetType: string;
  repositoryUrl?: string;
  uploadedFileReference?: string;
  dataSensitivity: number;
  businessCriticality: number;
  dataProtectionDuration: number;
  threatHorizonYear?: number;
  quantumRiskHorizon?: number;
  migrationDuration?: number;
  runtimeEnabled: boolean;
  detectedCryptoAssetCount?: number;
  cbomSummary?: {
    totalCryptoAssets: number;
    unknown: number;
    notApplicable: number;
    notQuantumSafe: number;
  };
  status: string; // 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  currentStage: string;
  stages: {
    discover: { status: string, startedAt?: Date, completedAt?: Date, cbomId?: string, assetCount: number },
    verify: { status: string },
    assess: { status: string },
    prioritize: { status: string },
    recommend: { status: string }
  };
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisSchema: Schema = new Schema({
  analysisId: { type: String, required: true, unique: true },
  applicationName: { type: String, required: true },
  targetType: { type: String, required: true },
  repositoryUrl: { type: String },
  uploadedFileReference: { type: String },
  dataSensitivity: { type: Number, required: true },
  businessCriticality: { type: Number, required: true },
  dataProtectionDuration: { type: Number, required: true },
  threatHorizonYear: { type: Number, default: 2036 },
  quantumRiskHorizon: { type: Number },
  migrationDuration: { type: Number, default: 2 },
  runtimeEnabled: { type: Boolean, default: false },
  detectedCryptoAssetCount: { type: Number, default: 0 },
  cbomSummary: {
    totalCryptoAssets: { type: Number, default: 0 },
    unknown: { type: Number, default: 0 },
    notApplicable: { type: Number, default: 0 },
    notQuantumSafe: { type: Number, default: 0 }
  },
  status: { type: String, default: 'CREATED' },
  currentStage: { type: String, default: 'DISCOVER' },
  stages: {
    discover: {
      status: { type: String, default: 'WAITING' },
      startedAt: { type: Date },
      completedAt: { type: Date },
      cbomId: { type: String },
      assetCount: { type: Number, default: 0 }
    },
    verify: {
      status: { type: String, default: 'WAITING' }
    },
    assess: {
      status: { type: String, default: 'WAITING' }
    },
    prioritize: {
      status: { type: String, default: 'WAITING' }
    },
    recommend: {
      status: { type: String, default: 'WAITING' }
    }
  },
  errorMessage: { type: String }
}, {
  timestamps: true
});

export const Analysis = mongoose.model<IAnalysis>('Analysis', AnalysisSchema);
