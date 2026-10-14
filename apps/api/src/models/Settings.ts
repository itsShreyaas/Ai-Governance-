import mongoose, { Schema, model, type Document, type Model } from "mongoose";
import { AssessmentFramework } from "@aegisai/shared";

interface IScoreWeights {
  nistAiRmf: number;
  iso42001: number;
  euAiAct: number;
}

export interface ISettings extends Document {
  organizationName: string;
  departments: string[];
  sensitivityTiers: string[];
  enabledFrameworks: string[];
  scoreWeights: IScoreWeights;
  slackWebhookUrl?: string | null;
  smtpUrl?: string | null;
}

const SettingsSchema = new Schema<ISettings>(
  {
    organizationName: { type: String, required: true, default: "Acme Global" },
    departments: { type: [String], default: [] },
    sensitivityTiers: {
      type: [String],
      default: ["Internal Only", "Confidential", "Restricted"],
    },
    enabledFrameworks: {
      type: [String],
      enum: Object.values(AssessmentFramework),
      default: Object.values(AssessmentFramework),
    },
    scoreWeights: {
      nistAiRmf: { type: Number, default: 0.4, min: 0, max: 1 },
      iso42001: { type: Number, default: 0.35, min: 0, max: 1 },
      euAiAct: { type: Number, default: 0.25, min: 0, max: 1 },
    },
    slackWebhookUrl: { type: String, default: null },
    smtpUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true }, strict: true }
);

export const Settings: Model<ISettings> =
  (mongoose.models["Settings"] as Model<ISettings>) ??
  model<ISettings>("Settings", SettingsSchema);
