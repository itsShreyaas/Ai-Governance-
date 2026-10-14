import mongoose, { Schema, Types, model, type Document, type Model } from "mongoose";
import {
  AssessmentFramework,
  AssessmentStatus,
  EuRiskClass,
  RiskLevel,
} from "@aegisai/shared";

interface IAnswer {
  questionId: string;
  value: string | number | boolean;
}

export interface IAssessment extends Document {
  toolId: Types.ObjectId;
  framework: string;
  answers: IAnswer[];
  riskLevel: string;
  score: number;
  euRiskClass?: string;
  assessor: Types.ObjectId;
  status: string;
  reviewDate?: Date;
  evidence: string[];
}

const AnswerSchema = new Schema<IAnswer>(
  {
    questionId: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const AssessmentSchema = new Schema<IAssessment>(
  {
    toolId: { type: Schema.Types.ObjectId, ref: "Tool", required: true },
    framework: {
      type: String,
      required: true,
      enum: Object.values(AssessmentFramework),
    },
    answers: { type: [AnswerSchema], required: true },
    riskLevel: {
      type: String,
      required: true,
      enum: Object.values(RiskLevel),
      default: RiskLevel.Medium,
    },
    score: { type: Number, required: true, min: 0, max: 100, default: 0 },
    euRiskClass: {
      type: String,
      enum: Object.values(EuRiskClass),
    },
    assessor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(AssessmentStatus),
      default: AssessmentStatus.Draft,
    },
    reviewDate: { type: Date },
    evidence: { type: [String], default: [] }, // GridFS file ids
  },
  { timestamps: true, strict: true }
);

// Indexes from DATABASE.md
AssessmentSchema.index({ toolId: 1 });
AssessmentSchema.index({ reviewDate: 1 });

export const Assessment: Model<IAssessment> =
  (mongoose.models["Assessment"] as Model<IAssessment>) ??
  model<IAssessment>("Assessment", AssessmentSchema);
