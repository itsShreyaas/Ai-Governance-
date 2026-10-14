import mongoose, { Schema, Types, model, type Document, type Model } from "mongoose";
import { RequestStatus } from "@aegisai/shared";

export interface IRequest extends Document {
  toolId?: Types.ObjectId;
  toolName?: string;
  requester: Types.ObjectId;
  useCase: string;
  dataTypes: string[];
  status: string;
  reviewer?: Types.ObjectId;
  submittedAt: Date;
  decidedAt?: Date;
}

const RequestSchema = new Schema<IRequest>(
  {
    toolId: { type: Schema.Types.ObjectId, ref: "Tool" }, // optional per U4
    toolName: { type: String, maxlength: 200 },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
    useCase: { type: String, required: true, maxlength: 2000 },
    dataTypes: { type: [String], required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(RequestStatus),
      default: RequestStatus.Submitted,
    },
    reviewer: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date, required: true, default: Date.now },
    decidedAt: { type: Date },
  },
  { timestamps: true, strict: true }
);

// Indexes from DATABASE.md
RequestSchema.index({ status: 1 });
RequestSchema.index({ requester: 1 });

export const Request: Model<IRequest> =
  (mongoose.models["Request"] as Model<IRequest>) ??
  model<IRequest>("Request", RequestSchema);
