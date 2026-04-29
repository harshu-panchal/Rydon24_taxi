import mongoose from 'mongoose';

const busSeatCellSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['seat', 'aisle'],
      default: 'seat',
    },
    id: {
      type: String,
      default: '',
      trim: true,
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
    variant: {
      type: String,
      default: 'seat',
      trim: true,
    },
    status: {
      type: String,
      enum: ['available', 'blocked'],
      default: 'available',
    },
  },
  { _id: false },
);

const busStopSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    pointName: {
      type: String,
      default: '',
      trim: true,
    },
    stopType: {
      type: String,
      enum: ['pickup', 'drop', 'both'],
      default: 'pickup',
    },
    arrivalTime: {
      type: String,
      default: '',
      trim: true,
    },
    departureTime: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const busScheduleSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
    departureTime: {
      type: String,
      default: '',
      trim: true,
    },
    arrivalTime: {
      type: String,
      default: '',
      trim: true,
    },
    activeDays: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'draft'],
      default: 'active',
    },
  },
  { _id: false },
);

const busCancellationRuleSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
    hoursBeforeDeparture: {
      type: Number,
      default: 0,
    },
    refundType: {
      type: String,
      enum: ['percentage', 'fixed', 'none'],
      default: 'percentage',
    },
    refundValue: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const busServiceSchema = new mongoose.Schema(
  {
    operatorName: {
      type: String,
      required: true,
      trim: true,
    },
    busName: {
      type: String,
      required: true,
      trim: true,
    },
    serviceNumber: {
      type: String,
      default: '',
      trim: true,
    },
    driverName: {
      type: String,
      default: '',
      trim: true,
    },
    driverPhone: {
      type: String,
      default: '',
      trim: true,
    },
    busDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiBusDriver',
      default: null,
      index: true,
    },
    coachType: {
      type: String,
      default: 'AC Sleeper',
      trim: true,
    },
    busCategory: {
      type: String,
      default: 'Sleeper',
      trim: true,
    },
    registrationNumber: {
      type: String,
      default: '',
      trim: true,
    },
    busColor: {
      type: String,
      default: '#1f2937',
      trim: true,
    },
    seatPrice: {
      type: Number,
      default: 0,
    },
    fareCurrency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    boardingPolicy: {
      type: String,
      default: '',
      trim: true,
    },
    cancellationPolicy: {
      type: String,
      default: '',
      trim: true,
    },
    cancellationRules: {
      type: [busCancellationRuleSchema],
      default: [],
    },
    luggagePolicy: {
      type: String,
      default: '',
      trim: true,
    },
    amenities: {
      type: [String],
      default: [],
    },
    blueprint: {
      templateKey: {
        type: String,
        default: 'seater_2_2',
        trim: true,
      },
      lowerDeck: {
        type: [[busSeatCellSchema]],
        default: [],
      },
      upperDeck: {
        type: [[busSeatCellSchema]],
        default: [],
      },
    },
    route: {
      routeName: {
        type: String,
        default: '',
        trim: true,
      },
      originCity: {
        type: String,
        default: '',
        trim: true,
      },
      destinationCity: {
        type: String,
        default: '',
        trim: true,
      },
      distanceKm: {
        type: String,
        default: '',
        trim: true,
      },
      durationHours: {
        type: String,
        default: '',
        trim: true,
      },
      stops: {
        type: [busStopSchema],
        default: [],
      },
    },
    schedules: {
      type: [busScheduleSchema],
      default: [],
    },
    capacity: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused'],
      default: 'draft',
    },
  },
  { timestamps: true },
);

busServiceSchema.index({ operatorName: 1, busName: 1 });
busServiceSchema.index({ serviceNumber: 1 });
busServiceSchema.index({ 'route.originCity': 1, 'route.destinationCity': 1, status: 1 });

export const BusService =
  mongoose.models.TaxiBusService || mongoose.model('TaxiBusService', busServiceSchema);
