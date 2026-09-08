import mongoose, { Schema, Document } from 'mongoose';

export interface IRuntimeEvent extends Document {
  analysisId: string;
  applicationName: string;
  timestamp: Date;
  className: string;
  methodName: string;
  api: string;
  algorithm: string;
  status: string;
  createdAt: Date;
}

const RuntimeEventSchema: Schema = new Schema({
  analysisId: { type: String, required: true },
  applicationName: { type: String, required: true },
  timestamp: { type: Date, required: true },
  className: { type: String, required: true },
  methodName: { type: String, required: true },
  api: { type: String, required: true },
  algorithm: { type: String, required: true },
  status: { type: String, default: 'captured' },
  createdAt: { type: Date, default: Date.now }
});

export const RuntimeEvent = mongoose.model<IRuntimeEvent>('RuntimeEvent', RuntimeEventSchema);
