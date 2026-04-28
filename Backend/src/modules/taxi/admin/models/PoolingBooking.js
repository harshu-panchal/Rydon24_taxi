import mongoose from 'mongoose';

const poolingBookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiPoolingRoute',
      required: true,
    },
    scheduleId: {
      type: String,
      required: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiPoolingVehicle',
    },
    pickupStopId: {
      type: String,
      required: true,
    },
    dropStopId: {
      type: String,
      required: true,
    },
    seatsBooked: {
      type: Number,
      default: 1,
      min: 1,
    },
    fare: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    bookingStatus: {
      type: String,
      enum: ['confirmed', 'cancelled', 'completed', 'no_show'],
      default: 'confirmed',
    },
    travelDate: {
      type: Date,
      required: true,
    },
    otp: {
      type: String,
    },
  },
  { timestamps: true },
);

poolingBookingSchema.index({ bookingId: 1 });
poolingBookingSchema.index({ user: 1 });
poolingBookingSchema.index({ route: 1 });
poolingBookingSchema.index({ travelDate: 1 });

export const PoolingBooking =
  mongoose.models.TaxiPoolingBooking ||
  mongoose.model('TaxiPoolingBooking', poolingBookingSchema);
