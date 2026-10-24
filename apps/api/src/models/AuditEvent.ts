import mongoose, { Schema, Types, model, type Document, type Model } from "mongoose";
import { AuditEventType, AuditSeverity } from "@aegisai/shared";

export interface IAuditEvent extends Document {
  sequence: number;
  timestamp: Date;
  eventType: string;
  severity: string;
  toolId?: Types.ObjectId;
  actor?: Types.ObjectId;
  department?: string;
  details: string;
  previousHash: string;
  hash: string;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    sequence: { type: Number, required: true, unique: true },
    timestamp: { type: Date, required: true },
    eventType: {
      type: String,
      required: true,
      enum: Object.values(AuditEventType),
    },
    severity: {
      type: String,
      required: true,
      enum: Object.values(AuditSeverity),
    },
    toolId: { type: Schema.Types.ObjectId, ref: "Tool" },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    department: { type: String, maxlength: 100 },
    details: { type: String, required: true, maxlength: 5000 },
    previousHash: { type: String, required: true },
    hash: { type: String, required: true },
  },
  {
    // No timestamps — auditEvents use their own `timestamp` field.
    // NO `updatedAt` — this collection is insert-only.
    timestamps: false,
    strict: true,
  }
);

// Indexes from DATABASE.md
AuditEventSchema.index({ toolId: 1, timestamp: -1 });
AuditEventSchema.index({ eventType: 1 });

export const AuditEvent: Model<IAuditEvent> =
  (mongoose.models["AuditEvent"] as Model<IAuditEvent>) ??
  model<IAuditEvent>("AuditEvent", AuditEventSchema);
