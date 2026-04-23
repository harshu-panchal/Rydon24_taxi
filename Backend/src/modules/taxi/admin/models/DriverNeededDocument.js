import mongoose from 'mongoose';

const driverNeededDocumentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    account_type: {
      type: String,
      enum: ['individual', 'fleet_drivers', 'both'],
      default: 'individual',
      trim: true,
    },
    image_type: {
      type: String,
      enum: ['front_back', 'front', 'back', 'image'],
      default: 'front_back',
      trim: true,
    },
    has_expiry_date: {
      type: Boolean,
      default: false,
    },
    has_identify_number: {
      type: Boolean,
      default: false,
    },
    identify_number_key: {
      type: String,
      default: '',
      trim: true,
    },
    is_editable: {
      type: Boolean,
      default: false,
    },
    is_required: {
      type: Boolean,
      default: false,
    },
    key: {
      type: String,
      default: '',
      trim: true,
    },
    front_key: {
      type: String,
      default: '',
      trim: true,
    },
    back_key: {
      type: String,
      default: '',
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

driverNeededDocumentSchema.index({ name: 1 });
driverNeededDocumentSchema.index({ active: 1, image_type: 1 });

export const DriverNeededDocument =
  mongoose.models.TaxiDriverNeededDocument || mongoose.model('TaxiDriverNeededDocument', driverNeededDocumentSchema);
