import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 5,
      select: false,
    },
    role: {
      type: String,
      default: 'admin',
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  { 
    timestamps: true,
  },
);

export const Admin = mongoose.models.TaxiAdmin || mongoose.model('TaxiAdmin', adminSchema);
