import mongoose, { Schema, model, type Document, type Model } from "mongoose";
import { ApprovalStatus, DataSensitivity, RiskLevel } from "@aegisai/shared";

export interface ITool extends Document {
  name: string;
  vendor: string;
  category: string;
  description?: string;
  approvalStatus: string;
  riskLevel: string;
  ownerDepartment: string;
  dataSensitivity: string;
  userCount: number;
  complianceScore: number;
  lastReviewed?: Date;
  personalData: boolean;
  archivedAt?: Date | null;
}

const ToolSchema = new Schema<ITool>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    vendor: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 2000 },
    approvalStatus: {
      type: String,
      required: true,
      enum: Object.values(ApprovalStatus),
      default: ApprovalStatus.PendingReview,
    },
    riskLevel: {
      type: String,
      required: true,
      enum: Object.values(RiskLevel),
      default: RiskLevel.Medium,
    },
    ownerDepartment: { type: String, required: true, trim: true, maxlength: 100 },
    dataSensitivity: {
      type: String,
      required: true,
      enum: Object.values(DataSensitivity),
    },
    userCount: { type: Number, required: true, min: 0, default: 0 },
    complianceScore: { type: Number, required: true, min: 0, max: 100, default: 0 },
    lastReviewed: { type: Date },
    personalData: { type: Boolean, required: true, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);

// Indexes from DATABASE.md
ToolSchema.index(
  { name: "text", vendor: "text", description: "text" },
  { name: "tools_text" }
);
ToolSchema.index({ approvalStatus: 1, riskLevel: 1 });

export const Tool: Model<ITool> =
  (mongoose.models["Tool"] as Model<ITool>) ?? model<ITool>("Tool", ToolSchema);
