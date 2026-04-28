import mongoose from 'mongoose';

const poolingVehicleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleModel: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    vehicleType: {
      type: String,
      enum: ['bike', 'sedan', 'hatchback', 'suv', 'van', 'luxury'],
      default: 'sedan',
    },
    blueprint: {
      type: Object, // JSON layout of seats
      default: {},
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
    },
    poolingEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

poolingVehicleSchema.index({ vehicleNumber: 1 });
poolingVehicleSchema.index({ status: 1 });

export const PoolingVehicle =
  mongoose.models.TaxiPoolingVehicle ||
  mongoose.model('TaxiPoolingVehicle', poolingVehicleSchema);
