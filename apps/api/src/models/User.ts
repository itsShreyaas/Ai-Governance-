import mongoose, { Schema, model, type Document, type Model } from "mongoose";
import { UserRole, type UserRole as UserRoleType } from "@aegisai/shared";

export interface IUser extends Document {
  name: string;
  email: string;
  department: string;
  role: UserRoleType;
  passwordHash?: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: Date | null;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, required: true, enum: Object.values(UserRole), default: UserRole.Employee },
    passwordHash: { type: String },
    isActive: { type: Boolean, required: true, default: true },
    failedLoginAttempts: { type: Number, required: true, default: 0 },
    lockoutUntil: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);

// Index defined in DATABASE.md
UserSchema.index({ email: 1 }, { unique: true });

export const User: Model<IUser> =
  (mongoose.models["User"] as Model<IUser>) ?? model<IUser>("User", UserSchema);
