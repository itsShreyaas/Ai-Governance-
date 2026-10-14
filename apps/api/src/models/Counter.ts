import mongoose, { Schema, model, type Model } from "mongoose";

export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { strict: true }
);

export const Counter: Model<ICounter> =
  (mongoose.models["Counter"] as Model<ICounter>) ??
  model<ICounter>("Counter", CounterSchema);
