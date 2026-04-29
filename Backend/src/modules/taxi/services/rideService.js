import mongoose from 'mongoose';
import { ApiError } from '../../../utils/ApiError.js';
import { normalizePoint, toPoint } from '../../../utils/geo.js';
import { RIDE_LIVE_STATUS, RIDE_STATUS } from '../constants/index.js';
import { SetPrice } from '../admin/models/SetPrice.js';
import { Vehicle } from '../admin/models/Vehicle.js';
import { Driver } from '../driver/models/Driver.js';
import { ensureDriverWalletCanAcceptRide, settleCompletedRideWallet } from '../driver/services/walletService.js';
import { Delivery } from '../user/models/Delivery.js';
import { Ride } from '../user/models/Ride.js';
import { User } from '../user/models/User.js';
import { applyPromoToRideInTransaction } from './promoService.js';
import { getTipSettings } from './appSettingsService.js';

const clearUserActiveRideIfPresent = async (user) => {
  if (!user?.currentRideId) {
    return;
  }

  const activeRide = await Ride.findById(user.currentRideId);

  if (!activeRide) {
    user.currentRideId = null;
    await user.save();
    return;
  }

  if ([RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED].includes(activeRide.status)) {
    user.currentRideId = null;
    await user.save();
    return;
  }

  activeRide.status = RIDE_STATUS.CANCELLED;
  activeRide.liveStatus = RIDE_LIVE_STATUS.CANCELLED;
  await activeRide.save();
  await syncDeliveryWithRide(activeRide);

  await Promise.all([
    activeRide.driverId ? Driver.findByIdAndUpdate(activeRide.driverId, { isOnRide: false }) : Promise.resolve(),
    User.findByIdAndUpdate(activeRide.userId, { currentRideId: null }),
  ]);

  user.currentRideId = null;
};

export const clearDriverActiveRideIfStale = async (driverOrId) => {
  const driver =
    typeof driverOrId === 'object' && driverOrId?._id
      ? driverOrId
      : await Driver.findById(driverOrId);

  if (!driver?.isOnRide) {
    return driver;
  }

  const activeRide = await Ride.findOne({
    driverId: driver._id,
    status: { $in: activeRideStatuses },
  }).select('_id status liveStatus');

  if (activeRide) {
    return driver;
  }

  driver.isOnRide = false;
  await driver.save();

  return driver;
};

const normalizeRidePaymentMethod = (paymentMethod) => (
  !paymentMethod || String(paymentMethod).trim().toLowerCase() === 'cash' ? 'cash' : 'online'
);

const normalizeServiceType = (serviceType) => {
  const normalized = String(serviceType || 'ride').trim().toLowerCase();
  return ['parcel', 'intercity'].includes(normalized) ? normalized : 'ride';
};

const normalizeAddress = (value = '') => String(value || '').trim();
const generateRideOtp = () => String(Math.floor(1000 + Math.random() * 9000));

const normalizeParcelPayload = (parcel = {}) => ({
  category: String(parcel.category || '').trim(),
  weight: String(parcel.weight || '').trim(),
  description: String(parcel.description || '').trim(),
  deliveryScope: String(parcel.deliveryScope || (parcel.isOutstation ? 'outstation' : 'city')).trim().toLowerCase() === 'outstation'
    ? 'outstation'
    : 'city',
  isOutstation: Boolean(parcel.isOutstation || String(parcel.deliveryScope || '').trim().toLowerCase() === 'outstation'),
  senderName: String(parcel.senderName || '').trim(),
  senderMobile: String(parcel.senderMobile || '').trim(),
  receiverName: String(parcel.receiverName || '').trim(),
  receiverMobile: String(parcel.receiverMobile || '').trim(),
});

const normalizeIntercityPayload = (intercity = {}) => ({
  bookingId: String(intercity.bookingId || '').trim(),
  fromCity: String(intercity.fromCity || '').trim(),
  toCity: String(intercity.toCity || '').trim(),
  tripType: String(intercity.tripType || '').trim(),
  travelDate: String(intercity.travelDate || intercity.date || '').trim(),
  passengers: Math.max(Number(intercity.passengers || 1), 1),
  distance: Math.max(Number(intercity.distance || 0), 0),
  vehicleName: String(intercity.vehicleName || '').trim(),
});

const normalizeScheduledAt = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeVehicleTypeIds = (vehicleTypeIds = [], vehicleTypeId = null) => {
  const values = Array.isArray(vehicleTypeIds) ? vehicleTypeIds : [vehicleTypeIds];

  if (vehicleTypeId) {
    values.push(vehicleTypeId);
  }

  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
};

const normalizeVehicleKey = (value = '') => String(value || '').trim().toLowerCase();

const normalizeVehicleKeys = (vehicles = []) => {
  const keys = vehicles.flatMap((vehicle) => [
    vehicle?.name,
    vehicle?.vehicle_type,
    vehicle?.icon_types,
    String(vehicle?.name || '').replace(/\s+/g, '_'),
    String(vehicle?.icon_types || '').replace(/\s+/g, '_'),
  ]);

  return [...new Set(keys.map(normalizeVehicleKey).filter(Boolean))];
};

export const normalizeAllowedRidePaymentMethods = (paymentTypes = []) => {
  const rawItems = Array.isArray(paymentTypes)
    ? paymentTypes
    : typeof paymentTypes === 'string'
      ? paymentTypes.split(',')
      : [];

  const normalized = rawItems
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean)
    .map((item) => (item === 'cash' ? 'cash' : item === 'online' || item === 'wallet' ? 'online' : null))
    .filter(Boolean);

  const unique = [...new Set(normalized)];
  return unique.length ? unique : ['cash', 'online'];
};

const resolveSetPriceForRide = async ({ serviceLocationId = null, transportType = 'taxi', vehicleTypeId = null }) => {
  if (!vehicleTypeId) {
    return null;
  }

  const normalizedTransportType = String(transportType || 'taxi').trim().toLowerCase() || 'taxi';
  const filters = [
    {
      vehicle_type: vehicleTypeId,
      active: 1,
      status: 'active',
      ...(serviceLocationId ? { service_location_id: serviceLocationId } : {}),
      transport_type: normalizedTransportType,
    },
    {
      vehicle_type: vehicleTypeId,
      active: 1,
      status: 'active',
      ...(serviceLocationId ? { service_location_id: serviceLocationId } : {}),
      transport_type: 'both',
    },
    {
      vehicle_type: vehicleTypeId,
      active: 1,
      status: 'active',
      transport_type: normalizedTransportType,
    },
    {
      vehicle_type: vehicleTypeId,
      active: 1,
      status: 'active',
      transport_type: 'both',
    },
  ];

  for (const filter of filters) {
    const match = await SetPrice.findOne(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();
    if (match) {
      return match;
    }
  }

  return null;
};

export const getAllowedRidePaymentMethodsForPricing = async ({ serviceLocationId = null, transportType = 'taxi', vehicleTypeId = null }) => {
  const pricingRule = await resolveSetPriceForRide({ serviceLocationId, transportType, vehicleTypeId });

  return {
    pricingRule,
    allowedPaymentMethods: normalizeAllowedRidePaymentMethods(pricingRule?.payment_type),
  };
};

const buildDriverVehicleAcceptFilter = async (ride) => {
  const vehicleTypeIds = normalizeVehicleTypeIds(ride.dispatchVehicleTypeIds || [], ride.vehicleTypeId);

  if (vehicleTypeIds.length === 0) {
    return {};
  }

  const vehicles = await Vehicle.find({ _id: { $in: vehicleTypeIds } }).select('name vehicle_type icon_types').lean();
  const vehicleTypeKeys = normalizeVehicleKeys(vehicles);
  const clauses = [
    { vehicleTypeId: { $in: vehicleTypeIds } },
    ...(vehicleTypeKeys.length
      ? [
          { vehicleType: { $in: vehicleTypeKeys } },
          { vehicleIconType: { $in: vehicleTypeKeys } },
        ]
      : []),
  ];

  return clauses.length > 1 ? { $or: clauses } : clauses[0];
};

const syncDeliveryWithRide = async (ride) => {
  if (!ride || (ride.serviceType || 'ride') !== 'parcel') {
    return null;
  }

  const payload = {
    rideId: ride._id,
    userId: ride.userId,
    driverId: ride.driverId || null,
    vehicleTypeId: ride.vehicleTypeId || null,
    vehicleIconType: ride.vehicleIconType || '',
    vehicleIconUrl: ride.vehicleIconUrl || '',
    status: ride.status,
    liveStatus: ride.liveStatus,
    pickupLocation: ride.pickupLocation,
    pickupAddress: normalizeAddress(ride.pickupAddress),
    dropLocation: ride.dropLocation,
    dropAddress: normalizeAddress(ride.dropAddress),
    fare: ride.fare,
    paymentMethod: ride.paymentMethod,
    parcel: normalizeParcelPayload(ride.parcel),
    acceptedAt: ride.acceptedAt || null,
    startedAt: ride.startedAt || null,
    completedAt: ride.completedAt || null,
  };

  if (ride.deliveryId) {
    return Delivery.findByIdAndUpdate(ride.deliveryId, payload, { returnDocument: 'after' });
  }

  const delivery = await Delivery.create(payload);
  ride.deliveryId = delivery._id;
  await ride.save();
  return delivery;
};

export const createRideRecord = async ({
  userId,
  pickupCoords,
  dropCoords,
  pickupAddress,
  dropAddress,
  fare,
  estimatedDistanceMeters,
  estimatedDurationMinutes,
  vehicleTypeId,
  vehicleTypeIds,
  vehicleIconType,
  vehicleIconUrl,
  paymentMethod,
  serviceType,
  parcel,
  intercity,
  promo_code,
  service_location_id,
  transport_type,
  scheduledAt,
}) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  await clearUserActiveRideIfPresent(user);

  const safeFare = Number(fare);
  const safeEstimatedDistanceMeters = Math.max(0, Number(estimatedDistanceMeters || 0));
  const safeEstimatedDurationMinutes = Math.max(0, Number(estimatedDurationMinutes || 0));

  if (!Number.isFinite(safeFare) || safeFare < 0) {
    throw new ApiError(400, 'fare must be a positive number or zero');
  }

  const dispatchVehicleTypeIds = normalizeVehicleTypeIds(vehicleTypeIds, vehicleTypeId);

  if (dispatchVehicleTypeIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new ApiError(400, 'vehicleTypeId is invalid');
  }

  const primaryVehicleTypeId = dispatchVehicleTypeIds[0] || null;
  const primaryVehicle = primaryVehicleTypeId
    ? await Vehicle.findById(primaryVehicleTypeId).select('icon map_icon image').lean()
    : null;
  const resolvedVehicleIconUrl = String(
    vehicleIconUrl || primaryVehicle?.map_icon || primaryVehicle?.icon || primaryVehicle?.image || '',
  ).trim();
  const normalizedTransportType = String(transport_type || 'taxi').trim().toLowerCase() || 'taxi';
  const resolvedServiceLocationId =
    service_location_id && mongoose.Types.ObjectId.isValid(service_location_id)
      ? new mongoose.Types.ObjectId(service_location_id)
      : null;
  const { pricingRule, allowedPaymentMethods } = await getAllowedRidePaymentMethodsForPricing({
    serviceLocationId: resolvedServiceLocationId,
    transportType: normalizedTransportType,
    vehicleTypeId: primaryVehicleTypeId,
  });
  const normalizedPaymentMethod = normalizeRidePaymentMethod(paymentMethod);
  const effectivePaymentMethod = allowedPaymentMethods.includes(normalizedPaymentMethod)
    ? normalizedPaymentMethod
    : (allowedPaymentMethods[0] || 'cash');
  const pricingSnapshot = {
    setPriceId: pricingRule?._id || null,
    admin_commission_type_from_driver: Number(pricingRule?.admin_commission_type_from_driver ?? 1),
    admin_commission_from_driver: Number(pricingRule?.admin_commission_from_driver ?? 0),
    waiting_charge: Number(pricingRule?.waiting_charge ?? 0),
    free_waiting_before: Number(pricingRule?.free_waiting_before ?? 0),
    free_waiting_after: Number(pricingRule?.free_waiting_after ?? 0),
    allowed_payment_methods: allowedPaymentMethods,
    resolvedAt: pricingRule ? new Date() : null,
  };

  const promoCode = typeof promo_code === 'string' ? promo_code.trim() : '';
  const normalizedScheduledAt = normalizeScheduledAt(scheduledAt);

  if (scheduledAt && !normalizedScheduledAt) {
    throw new ApiError(400, 'scheduledAt is invalid');
  }

  if (!promoCode) {
    const ride = await Ride.create({
      userId,
      vehicleTypeId: primaryVehicleTypeId,
      dispatchVehicleTypeIds,
      vehicleIconType: vehicleIconType || '',
      vehicleIconUrl: resolvedVehicleIconUrl,
      serviceType: normalizeServiceType(serviceType),
      pickupLocation: toPoint(pickupCoords, 'pickup'),
      pickupAddress: normalizeAddress(pickupAddress),
      dropLocation: toPoint(dropCoords, 'drop'),
      dropAddress: normalizeAddress(dropAddress),
      fare: safeFare,
      estimatedDistanceMeters: safeEstimatedDistanceMeters,
      estimatedDurationMinutes: safeEstimatedDurationMinutes,
      paymentMethod: effectivePaymentMethod,
      otp: generateRideOtp(),
      service_location_id: resolvedServiceLocationId,
      transport_type: normalizedTransportType,
      pricingSnapshot,
      parcel: normalizeParcelPayload(parcel),
      intercity: normalizeIntercityPayload(intercity),
      scheduledAt: normalizedScheduledAt,
      status: RIDE_STATUS.SEARCHING,
      liveStatus: RIDE_LIVE_STATUS.SEARCHING,
    });

    user.currentRideId = ride._id;
    await user.save();
    await syncDeliveryWithRide(ride);

    return ride;
  }

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const ride = await Ride.create(
        [
          {
            userId,
            vehicleTypeId: primaryVehicleTypeId,
            dispatchVehicleTypeIds,
            vehicleIconType: vehicleIconType || '',
            vehicleIconUrl: resolvedVehicleIconUrl,
            serviceType: normalizeServiceType(serviceType),
            pickupLocation: toPoint(pickupCoords, 'pickup'),
            pickupAddress: normalizeAddress(pickupAddress),
            dropLocation: toPoint(dropCoords, 'drop'),
            dropAddress: normalizeAddress(dropAddress),
            fare: safeFare,
            estimatedDistanceMeters: safeEstimatedDistanceMeters,
            estimatedDurationMinutes: safeEstimatedDurationMinutes,
            paymentMethod: effectivePaymentMethod,
            otp: generateRideOtp(),
            service_location_id: resolvedServiceLocationId,
            transport_type: normalizedTransportType,
            pricingSnapshot,
            parcel: normalizeParcelPayload(parcel),
            intercity: normalizeIntercityPayload(intercity),
            scheduledAt: normalizedScheduledAt,
            status: RIDE_STATUS.SEARCHING,
            liveStatus: RIDE_LIVE_STATUS.SEARCHING,
          },
        ],
        { session },
      );

      const rideDoc = ride[0];

      user.currentRideId = rideDoc._id;
      await user.save({ session });

      await applyPromoToRideInTransaction({
        session,
        ride: rideDoc,
        userId,
        code: promoCode,
        fare: safeFare,
        service_location_id,
        transport_type: transport_type || 'taxi',
      });

      await session.commitTransaction();
      await syncDeliveryWithRide(rideDoc);
      return rideDoc;
    } catch (error) {
      lastError = error;
      await session.abortTransaction();

      const isTransient =
        typeof error?.hasErrorLabel === 'function' &&
        (error.hasErrorLabel('TransientTransactionError') || error.hasErrorLabel('UnknownTransactionCommitResult'));

      if (!isTransient || attempt === 2) {
        throw error;
      }
    } finally {
      session.endSession();
    }
  }

  throw lastError || new ApiError(500, 'Failed to create ride with promo');
};

export const getRideDetails = async (rideId) => {
  const ride = await Ride.findById(rideId)
    .populate('deliveryId')
    .populate('userId', 'name phone')
    .populate('driverId', 'name phone profileImage vehicleType vehicleIconType vehicleNumber vehicleColor vehicleMake vehicleModel vehicleImage rating');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  return ride;
};

export const getRideRoom = (rideId) => `ride_${rideId}`;

const activeRideStatuses = [RIDE_STATUS.SEARCHING, RIDE_STATUS.ACCEPTED, RIDE_STATUS.ONGOING];

const populateRideRealtime = async (rideId) =>
  Ride.findById(rideId)
    .populate('deliveryId')
    .populate('userId', 'name phone')
    .populate('driverId', 'name phone profileImage vehicleType vehicleIconType vehicleNumber vehicleColor vehicleMake vehicleModel vehicleImage rating');

export const serializeRideRealtime = (ride) => ({
  rideId: String(ride._id),
  room: getRideRoom(ride._id),
  deliveryId: ride.deliveryId?._id ? String(ride.deliveryId._id) : ride.deliveryId ? String(ride.deliveryId) : null,
  type: ride.serviceType || 'ride',
  serviceType: ride.serviceType || 'ride',
  status: ride.status,
  liveStatus: ride.liveStatus,
  fare: ride.fare,
  estimatedDistanceMeters: ride.estimatedDistanceMeters || 0,
  estimatedDurationMinutes: ride.estimatedDurationMinutes || 0,
  paymentMethod: ride.paymentMethod,
  driverPaymentCollection: ride.driverPaymentCollection
    ? {
        provider: ride.driverPaymentCollection.provider || '',
        providerId: ride.driverPaymentCollection.providerId || '',
        providerOrderId: ride.driverPaymentCollection.providerOrderId || '',
        providerPaymentId: ride.driverPaymentCollection.providerPaymentId || '',
        providerMode: ride.driverPaymentCollection.providerMode || '',
        source: ride.driverPaymentCollection.source || '',
        status: ride.driverPaymentCollection.status || 'pending',
        amount: Number(ride.driverPaymentCollection.amount || 0),
        currency: ride.driverPaymentCollection.currency || 'INR',
        linkUrl: ride.driverPaymentCollection.linkUrl || '',
        paidAt: ride.driverPaymentCollection.paidAt || null,
        updatedAt: ride.driverPaymentCollection.updatedAt || null,
      }
    : null,
  otp: ride.otp || '',
  parcel: ride.deliveryId?.parcel || ride.parcel || null,
  intercity: ride.intercity || null,
  commissionAmount: ride.commissionAmount,
  driverEarnings: ride.driverEarnings,
  promo: ride.promo?.code ? ride.promo : null,
  pricingSnapshot: ride.pricingSnapshot
    ? {
        setPriceId: ride.pricingSnapshot.setPriceId || null,
        admin_commission_type_from_driver: Number(ride.pricingSnapshot.admin_commission_type_from_driver ?? 1),
        admin_commission_from_driver: Number(ride.pricingSnapshot.admin_commission_from_driver ?? 0),
        waiting_charge: Number(ride.pricingSnapshot.waiting_charge ?? 0),
        free_waiting_before: Number(ride.pricingSnapshot.free_waiting_before ?? 0),
        free_waiting_after: Number(ride.pricingSnapshot.free_waiting_after ?? 0),
        allowed_payment_methods: normalizeAllowedRidePaymentMethods(ride.pricingSnapshot.allowed_payment_methods),
        resolvedAt: ride.pricingSnapshot.resolvedAt || null,
      }
    : null,
  vehicleIconType: ride.vehicleIconType || '',
  vehicleIconUrl: ride.vehicleIconUrl || '',
  pickupLocation: ride.pickupLocation,
  pickupAddress: ride.pickupAddress || '',
  dropLocation: ride.dropLocation,
  dropAddress: ride.dropAddress || '',
  acceptedAt: ride.acceptedAt,
  arrivedAt: ride.arrivedAt,
  startedAt: ride.startedAt,
  completedAt: ride.completedAt,
  feedback: ride.feedback || null,
  lastDriverLocation: ride.lastDriverLocation?.coordinates?.length
    ? {
        type: ride.lastDriverLocation.type,
        coordinates: ride.lastDriverLocation.coordinates,
        heading: ride.lastDriverLocation.heading,
        speed: ride.lastDriverLocation.speed,
        updatedAt: ride.lastDriverLocation.updatedAt,
      }
    : null,
  user: ride.userId,
  driver: ride.driverId,
  messages: (ride.messages || []).slice(-30).map((message) => ({
    id: String(message._id),
    senderRole: message.senderRole,
    senderId: String(message.senderId),
    message: message.message,
    sentAt: message.sentAt,
  })),
});

export const ensureRideParticipantAccess = async ({ rideId, role, entityId }) => {
  const ride = await Ride.findById(rideId).select('userId driverId status liveStatus');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  const actorId = String(entityId);
  const isUser = role === 'user' && String(ride.userId) === actorId;
  const isDriver = role === 'driver' && ride.driverId && String(ride.driverId) === actorId;

  if (!isUser && !isDriver) {
    throw new ApiError(403, 'You are not allowed to access this ride room');
  }

  return ride;
};

export const getActiveRideForIdentity = async ({ role, entityId }) => {
  if (role === 'user') {
    const user = await User.findById(entityId).select('currentRideId');

    if (!user?.currentRideId) {
      return null;
    }

    return populateRideRealtime(user.currentRideId);
  }

  if (role === 'driver') {
    return Ride.findOne({
      driverId: entityId,
      status: { $in: activeRideStatuses },
    })
      .sort({ updatedAt: -1 })
      .populate('userId', 'name phone')
      .populate('driverId', 'name phone profileImage vehicleType vehicleIconType vehicleNumber vehicleColor vehicleMake vehicleModel vehicleImage rating');
  }

  return null;
};

export const listRideHistoryForIdentity = async ({ role, entityId, limit = 50, page = 1 }) => {
  if (!['user', 'driver'].includes(role)) {
    throw new ApiError(403, 'Only riders and drivers can access ride history');
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const query = role === 'driver' ? { driverId: entityId } : { userId: entityId };
  const counterpartPath = role === 'driver' ? 'userId' : 'driverId';
  const counterpartSelect =
    role === 'driver'
      ? 'name phone profileImage'
      : 'name phone profileImage vehicleType vehicleIconType vehicleNumber vehicleColor vehicleMake vehicleModel vehicleImage rating';

  const ridesQuery = Ride.find(query)
    .select([
      '_id',
      'deliveryId',
      'serviceType',
      'status',
      'liveStatus',
      'fare',
      'estimatedDistanceMeters',
      'estimatedDurationMinutes',
      'paymentMethod',
      'otp',
      'parcel',
      'intercity',
      'pricingSnapshot',
      'commissionAmount',
      'driverEarnings',
      'vehicleIconType',
      'vehicleIconUrl',
      'pickupLocation',
      'pickupAddress',
      'dropLocation',
      'dropAddress',
      'acceptedAt',
      'arrivedAt',
      'startedAt',
      'completedAt',
      'feedback',
      'createdAt',
      'updatedAt',
      'userId',
      'driverId',
    ].join(' '))
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .populate(counterpartPath, counterpartSelect)
    .lean();

  if (role === 'user') {
    ridesQuery.populate('deliveryId', 'parcel');
  }

  const [rides, total] = await Promise.all([
    ridesQuery,
    Ride.countDocuments(query),
  ]);

  return {
    results: rides.map((ride) => ({
    rideId: String(ride._id),
    deliveryId: ride.deliveryId?._id ? String(ride.deliveryId._id) : ride.deliveryId ? String(ride.deliveryId) : null,
    type: ride.serviceType || 'ride',
    serviceType: ride.serviceType || 'ride',
    status: ride.status,
    liveStatus: ride.liveStatus,
    fare: ride.fare,
    estimatedDistanceMeters: ride.estimatedDistanceMeters || 0,
    estimatedDurationMinutes: ride.estimatedDurationMinutes || 0,
    paymentMethod: ride.paymentMethod,
    otp: ride.otp || '',
    parcel: ride.deliveryId?.parcel || ride.parcel || null,
    intercity: ride.intercity || null,
    pricingSnapshot: ride.pricingSnapshot || null,
    commissionAmount: ride.commissionAmount,
    driverEarnings: ride.driverEarnings,
    vehicleIconType: ride.vehicleIconType,
    // Keep history responses light; giant data URLs can stall the activity screen.
    vehicleIconUrl: String(ride.vehicleIconUrl || '').startsWith('data:') ? '' : (ride.vehicleIconUrl || ''),
    pickupLocation: ride.pickupLocation,
    pickupAddress: ride.pickupAddress || '',
    dropLocation: ride.dropLocation,
    dropAddress: ride.dropAddress || '',
    acceptedAt: ride.acceptedAt,
    arrivedAt: ride.arrivedAt,
    startedAt: ride.startedAt,
    completedAt: ride.completedAt,
    feedback: ride.feedback || null,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
    user: role === 'driver' ? (ride.userId || null) : null,
    driver: role === 'user' ? (ride.driverId || null) : null,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      hasNextPage: safePage * safeLimit < total,
      hasPrevPage: safePage > 1,
    },
  };
};

export const acceptRideAssignment = async ({ rideId, driverId }) => {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const ride = await Ride.findOne({
        _id: rideId,
        status: RIDE_STATUS.SEARCHING,
        driverId: null,
      }).session(session);

      if (!ride) {
        throw new ApiError(409, 'Ride is no longer available for acceptance');
      }

      const driverVehicleFilter = await buildDriverVehicleAcceptFilter(ride);
      const driver = await Driver.findOne({
        _id: driverId,
        isOnline: true,
        isOnRide: false,
        'wallet.isBlocked': { $ne: true },
        ...driverVehicleFilter,
      }).session(session);

      if (!driver) {
        throw new ApiError(409, 'Driver is unavailable to accept this ride');
      }

      await ensureDriverWalletCanAcceptRide(driver, { session });

      ride.driverId = driver._id;
      ride.status = RIDE_STATUS.ACCEPTED;
      ride.liveStatus = RIDE_LIVE_STATUS.ACCEPTED;
      ride.acceptedAt = new Date();
      driver.isOnRide = true;

      await ride.save({ session });
      await driver.save({ session });
      await session.commitTransaction();
      await syncDeliveryWithRide(ride);

      return ride;
    } catch (error) {
      lastError = error;
      await session.abortTransaction();

      const isTransient =
        typeof error?.hasErrorLabel === 'function' &&
        (error.hasErrorLabel('TransientTransactionError') || error.hasErrorLabel('UnknownTransactionCommitResult'));

      if (!isTransient || attempt === 2) {
        throw error;
      }
    } finally {
      session.endSession();
    }
  }

  throw lastError || new ApiError(500, 'Failed to accept ride');
};

const rideStatusConfig = {
  [RIDE_LIVE_STATUS.ACCEPTED]: {
    persistedStatus: RIDE_STATUS.ACCEPTED,
    allowedCurrent: [RIDE_LIVE_STATUS.ACCEPTED, RIDE_LIVE_STATUS.ARRIVING],
  },
  [RIDE_LIVE_STATUS.ARRIVING]: {
    persistedStatus: RIDE_STATUS.ACCEPTED,
    allowedCurrent: [RIDE_LIVE_STATUS.ACCEPTED, RIDE_LIVE_STATUS.ARRIVING],
  },
  [RIDE_LIVE_STATUS.STARTED]: {
    persistedStatus: RIDE_STATUS.ONGOING,
    allowedCurrent: [RIDE_LIVE_STATUS.ACCEPTED, RIDE_LIVE_STATUS.ARRIVING, RIDE_LIVE_STATUS.STARTED],
  },
  [RIDE_LIVE_STATUS.COMPLETED]: {
    persistedStatus: RIDE_STATUS.COMPLETED,
    allowedCurrent: [RIDE_LIVE_STATUS.STARTED, RIDE_LIVE_STATUS.ARRIVING, RIDE_LIVE_STATUS.ACCEPTED],
  },
};

export const updateRideLifecycle = async ({ rideId, driverId, nextStatus, paymentMethod }) => {
  const config = rideStatusConfig[nextStatus];

  if (!config) {
    throw new ApiError(400, 'Unsupported ride status');
  }

  const ride = await Ride.findOne({ _id: rideId, driverId });

  if (!ride) {
    throw new ApiError(404, 'Assigned ride not found');
  }

  if (!config.allowedCurrent.includes(ride.liveStatus)) {
    throw new ApiError(409, `Ride cannot move from ${ride.liveStatus} to ${nextStatus}`);
  }

  ride.liveStatus = nextStatus;
  ride.status = config.persistedStatus;

  if (nextStatus === RIDE_LIVE_STATUS.ACCEPTED) {
    ride.arrivedAt = null;
  }

  if (nextStatus === RIDE_LIVE_STATUS.ARRIVING && !ride.arrivedAt) {
    ride.arrivedAt = new Date();
  }

  if (nextStatus === RIDE_LIVE_STATUS.STARTED && !ride.startedAt) {
    ride.startedAt = new Date();
  }

  if (paymentMethod !== undefined && paymentMethod !== null && String(paymentMethod).trim()) {
    ride.paymentMethod = normalizeRidePaymentMethod(paymentMethod);
  }

  if (nextStatus === RIDE_LIVE_STATUS.COMPLETED) {
    ride.completedAt = new Date();
  }

  await ride.save();
  await syncDeliveryWithRide(ride);

  let walletUpdate = null;

  if (nextStatus === RIDE_LIVE_STATUS.COMPLETED) {
    await Promise.all([
      User.findByIdAndUpdate(ride.userId, { currentRideId: null }),
      Driver.findByIdAndUpdate(driverId, { isOnRide: false }),
    ]);

    walletUpdate = await settleCompletedRideWallet({ rideId: ride._id });
  }

  const populatedRide = await populateRideRealtime(ride._id);
  populatedRide.$locals.walletUpdate = walletUpdate;

  return populatedRide;
};

export const appendRideMessage = async ({ rideId, role, senderId, message }) => {
  const trimmedMessage = String(message || '').trim();

  if (!trimmedMessage) {
    throw new ApiError(400, 'Message is required');
  }

  if (!['user', 'driver'].includes(role)) {
    throw new ApiError(403, 'Only rider and driver can send ride messages');
  }

  await ensureRideParticipantAccess({ rideId, role, entityId: senderId });

  const ride = await Ride.findById(rideId);

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  ride.messages.push({
    senderRole: role,
    senderId,
    message: trimmedMessage,
  });

  if (ride.messages.length > 200) {
    ride.messages = ride.messages.slice(-200);
  }

  await ride.save();

  const latestMessage = ride.messages[ride.messages.length - 1];

  return {
    id: String(latestMessage._id),
    rideId: String(ride._id),
    senderRole: latestMessage.senderRole,
    senderId: String(latestMessage.senderId),
    message: latestMessage.message,
    sentAt: latestMessage.sentAt,
  };
};

export const updateRideDriverLocation = async ({ rideId, driverId, coordinates, heading = null, speed = null }) => {
  const normalizedCoords = normalizePoint(coordinates, 'coordinates');
  const ride = await Ride.findOne({ _id: rideId, driverId });

  if (!ride) {
    throw new ApiError(404, 'Assigned ride not found');
  }

  ride.lastDriverLocation = {
    type: 'Point',
    coordinates: normalizedCoords,
    heading: Number.isFinite(Number(heading)) ? Number(heading) : null,
    speed: Number.isFinite(Number(speed)) ? Number(speed) : null,
    updatedAt: new Date(),
  };

  await ride.save();

  return {
    rideId: String(ride._id),
    coordinates: normalizedCoords,
    heading: ride.lastDriverLocation.heading,
    speed: ride.lastDriverLocation.speed,
    updatedAt: ride.lastDriverLocation.updatedAt,
  };
};

export const submitRideFeedback = async ({ rideId, userId, rating, comment = '', tipAmount = 0 }) => {
  const numericRating = Number(rating);
  const numericTip = Number(tipAmount || 0);

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new ApiError(400, 'rating must be an integer between 1 and 5');
  }

  if (!Number.isFinite(numericTip) || numericTip < 0) {
    throw new ApiError(400, 'tipAmount must be zero or greater');
  }

  const tipSettings = await getTipSettings();
  const tipsEnabled = String(tipSettings.enable_tips || '1') === '1';
  const minimumTipAmount = Number(tipSettings.min_tip_amount || 0);

  if (!tipsEnabled && numericTip > 0) {
    throw new ApiError(400, 'Tips are currently disabled');
  }

  if (
    tipsEnabled &&
    numericTip > 0 &&
    Number.isFinite(minimumTipAmount) &&
    minimumTipAmount > 0 &&
    numericTip < minimumTipAmount
  ) {
    throw new ApiError(400, `tipAmount must be at least ${minimumTipAmount}`);
  }

  const ride = await Ride.findOne({
    _id: rideId,
    userId,
    status: RIDE_STATUS.COMPLETED,
  });

  if (!ride) {
    throw new ApiError(404, 'Completed ride not found');
  }

  if (!ride.driverId) {
    throw new ApiError(409, 'Ride has no assigned driver');
  }

  if (ride.feedback?.submittedAt) {
    throw new ApiError(409, 'Feedback already submitted for this ride');
  }

  const driver = await Driver.findById(ride.driverId);

  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  ride.feedback = {
    rating: numericRating,
    comment: String(comment || '').trim(),
    tipAmount: numericTip,
    submittedAt: new Date(),
  };

  driver.ratingCount = Number(driver.ratingCount || 0) + 1;
  driver.totalRatingScore = Number(driver.totalRatingScore || 0) + numericRating;
  driver.rating = Number((driver.totalRatingScore / driver.ratingCount).toFixed(1));

  await Promise.all([ride.save(), driver.save()]);

  return populateRideRealtime(ride._id);
};
