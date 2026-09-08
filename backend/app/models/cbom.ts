import mongoose, { Schema, Document } from 'mongoose';

export interface ICbom extends Document {
  analysisId: string;
  cbomId: string;
  rawJson: object;
  cbomSummary?: {
    totalCryptoAssets: number;
    unknown: number;
    notApplicable: number;
    notQuantumSafe: number;
    quantumSafe: number;
    complianceStatus?: string;
  };
  complianceResponse?: object;
  generatedAt: Date;
}

const CbomSchema: Schema = new Schema({
  analysisId: { type: String, required: true, unique: true },
  cbomId: { type: String, required: true, unique: true },
  rawJson: { type: Schema.Types.Mixed, required: true },
  cbomSummary: {
    totalCryptoAssets: { type: Number },
    unknown: { type: Number },
    notApplicable: { type: Number },
    notQuantumSafe: { type: Number },
    quantumSafe: { type: Number, default: 0 },
    complianceStatus: { type: String, default: 'completed' }
  },
  complianceResponse: { type: Schema.Types.Mixed },
  generatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export const Cbom = mongoose.model<ICbom>('Cbom', CbomSchema);
