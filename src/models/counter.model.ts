import { Schema, model, models, type Model } from "mongoose";

/**
 * Atomic sequence counter (used for human-readable invoice numbers). Using
 * findOneAndUpdate($inc) gives a race-free monotonic sequence even under
 * concurrent webhook deliveries.
 */
type CounterDoc = { _id: string; seq: number };

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) ||
  model<CounterDoc>("Counter", counterSchema);

export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc!.seq;
}
