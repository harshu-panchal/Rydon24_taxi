import mongoose from 'mongoose';

const rentalBookingRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiUser',
      default: null,
    },
    bookingReference: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    vehicleTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiRentalVehicleType',
      required: true,
    },
    vehicleName: {
      type: String,
      default: '',
      trim: true,
    },
    vehicleCategory: {
      type: String,
      default: '',
      trim: true,
    },
    vehicleImage: {
      type: String,
      default: '',
      trim: true,
    },
    selectedPackage: {
      packageId: {
        type: String,
        default: '',
        trim: true,
      },
      label: {
        type: String,
        default: '',
        trim: true,
      },
      durationHours: {
        type: Number,
        default: 0,
        min: 0,
      },
      price: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    serviceLocation: {
      locationId: {
        type: String,
        default: '',
        trim: true,
      },
      name: {
        type: String,
        default: '',
        trim: true,
      },
      address: {
        type: String,
        default: '',
        trim: true,
      },
      city: {
        type: String,
        default: '',
        trim: true,
      },
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      distanceKm: {
        type: Number,
        default: null,
      },
    },
    pickupDateTime: {
      type: Date,
      required: true,
    },
    returnDateTime: {
      type: Date,
      required: true,
    },
    requestedHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    payableNow: {
      type: Number,
      default: 0,
      min: 0,
    },
    advancePaymentLabel: {
      type: String,
      default: '',
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'not_required', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: '',
      trim: true,
    },
    paymentMethodLabel: {
      type: String,
      default: '',
      trim: true,
    },
    payment: {
      provider: {
        type: String,
        default: '',
        trim: true,
      },
      status: {
        type: String,
        default: '',
        trim: true,
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
      currency: {
        type: String,
        default: 'INR',
        trim: true,
      },
      orderId: {
        type: String,
        default: '',
        trim: true,
      },
      paymentId: {
        type: String,
        default: '',
        trim: true,
      },
      signature: {
        type: String,
        default: '',
        trim: true,
      },
    },
    contactName: {
      type: String,
      default: '',
      trim: true,
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: '',
      trim: true,
    },
    kycCompleted: {
      type: Boolean,
      default: false,
    },
    assignedVehicle: {
      vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaxiRentalVehicleType',
        default: null,
      },
      name: {
        type: String,
        default: '',
        trim: true,
      },
      vehicleCategory: {
        type: String,
        default: '',
        trim: true,
      },
      image: {
        type: String,
        default: '',
        trim: true,
      },
    },
    serviceCenterIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'TaxiServiceStore',
      default: [],
    },
    assignedStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiServiceCenterStaff',
      default: null,
    },
    assignedStaffName: {
      type: String,
      default: '',
      trim: true,
    },
    assignedStaffPhone: {
      type: String,
      default: '',
      trim: true,
    },
    serviceCenterNote: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'assigned', 'end_requested', 'completed', 'cancelled'],
      default: 'pending',
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    completionRequestedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    finalCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalElapsedMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: '',
      trim: true,
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  { timestamps: true },
);

rentalBookingRequestSchema.index({ status: 1, createdAt: -1 });
rentalBookingRequestSchema.index({ userId: 1, createdAt: -1 });
rentalBookingRequestSchema.index({ vehicleTypeId: 1, createdAt: -1 });

export const RentalBookingRequest =
  mongoose.models.TaxiRentalBookingRequest ||
  mongoose.model('TaxiRentalBookingRequest', rentalBookingRequestSchema);
