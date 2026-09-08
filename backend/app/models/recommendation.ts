import mongoose, { Schema, Document } from 'mongoose';

export interface IRecommendation extends Document {
  analysisId: string;
  assetName: string;
  authoritativeReplacement: string;
  standard: string;
  purpose: string;
  strategy: string;
  aiExplanation?: string;
  modelUsed?: string;
  generatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSchema: Schema = new Schema({
  analysisId: { type: String, required: true },
  assetName: { type: String, required: true },
  authoritativeReplacement: { type: String, required: true },
  standard: { type: String, required: true },
  purpose: { type: String, required: true },
  strategy: { type: String, required: true },
  aiExplanation: { type: String },
  modelUsed: { type: String },
  generatedAt: { type: Date }
}, { timestamps: true });

RecommendationSchema.index({ analysisId: 1, assetName: 1 }, { unique: true });

export const Recommendation = mongoose.model<IRecommendation>('Recommendation', RecommendationSchema);
