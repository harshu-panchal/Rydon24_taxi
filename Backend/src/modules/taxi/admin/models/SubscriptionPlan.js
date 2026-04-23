import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
  name: String,
  description: String,
  amount: Number,
  duration: Number, // in days
  transport_type: String,
  vehicle_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxiVehicle' },
  how_it_works: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const SubscriptionPlan = mongoose.models.TaxiSubscriptionPlan || mongoose.model('TaxiSubscriptionPlan', subscriptionPlanSchema);
