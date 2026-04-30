import mongoose from 'mongoose';

const serviceCenterStaffSchema = new mongoose.Schema(
  {
    serviceCenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiServiceStore',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true },
);

export const ServiceCenterStaff =
  mongoose.models.TaxiServiceCenterStaff ||
  mongoose.model('TaxiServiceCenterStaff', serviceCenterStaffSchema);
