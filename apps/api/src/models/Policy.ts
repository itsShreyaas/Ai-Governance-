import mongoose, { Schema, Types, model, type Document, type Model } from "mongoose";
import { DataSensitivity, PolicyVerdict } from "@aegisai/shared";

export interface IPolicy extends Document {
  toolCategory: string;
  department: string;
  sensitivityTier: string;
  verdict: string;
  conditions?: string;
  version: number;
  effectiveFrom: Date;
  author: Types.ObjectId;
  personalData: boolean;
}

const PolicySchema = new Schema<IPolicy>(
  {
    toolCategory: { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    sensitivityTier: {
      type: String,
      required: true,
      enum: Object.values(DataSensitivity),
    },
    verdict: {
      type: String,
      required: true,
      enum: Object.values(PolicyVerdict),
    },
    conditions: { type: String, maxlength: 2000 },
    version: { type: Number, required: true, default: 1, min: 1 },
    effectiveFrom: { type: Date, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    personalData: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, strict: true }
);

// Indexes from DATABASE.md
PolicySchema.index({ toolCategory: 1, department: 1, sensitivityTier: 1 });
PolicySchema.index({ effectiveFrom: 1 });

export const Policy: Model<IPolicy> =
  (mongoose.models["Policy"] as Model<IPolicy>) ??
  model<IPolicy>("Policy", PolicySchema);
