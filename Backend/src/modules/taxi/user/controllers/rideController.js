import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { ApiError } from '../../../../utils/ApiError.js';
import { normalizePoint } from '../../../../utils/geo.js';
import { ensureThirdPartySettings } from '../../admin/services/adminService.js';
import { Driver } from '../../driver/models/Driver.js';
import { WalletTransaction } from '../../driver/models/WalletTransaction.js';
import { applyDriverWalletAdjustment, serializeDriverWallet } from '../../driver/services/walletService.js';
import { RIDE_LIVE_STATUS } from '../../constants/index.js';
import {
  createRideRecord,
  ensureRideParticipantAccess,
  getAllowedRidePaymentMethodsForPricing,
  getActiveRideForIdentity,
  getRideDetails,
  getRideRoom,
  listRideHistoryForIdentity,
  serializeRideRealtime,
  submitRideFeedback,
  updateRideLifecycle,
} from '../../services/rideService.js';
import { cancelRideByUser, emitToDriver, startDispatchFlow } from '../../services/dispatchService.js';
import { getTipSettings } from '../../services/appSettingsService.js';
import { Ride } from '../models/Ride.js';

const EARTH_RADIUS_METERS = 6371000;
const AVERAGE_CITY_SPEED_KMPH = 24;

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const calculateDistanceMeters = (fromCoords = [], toCoords = []) => {
  const [fromLng, fromLat] = fromCoords;
  const [toLng, toLat] = toCoords;

  if (![fromLng, fromLat, toLng, toLat].every((value) => Number.isFinite(Number(value)))) {
    return null;
  }

  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const startLat = toRadians(fromLat);
  const endLat = toRadians(toLat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
};

const estimateEtaMinutes = (distanceMeters) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return 1;
  }

  const metersPerMinute = (AVERAGE_CITY_SPEED_KMPH * 1000) / 60;
  return Math.max(1, Math.round(distanceMeters / metersPerMinute));
};

const normalizeMoneyAmount = (value, fieldName = 'amount') => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, `${fieldName} must be greater than zero`);
  }

  return Math.round(amount * 100) / 100;
};

const resolveRazorpayCredentials = async () => {
  const envKeyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const envKeySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  const envEnabled = String(process.env.RAZORPAY_ENABLED || '').trim();

  if (envEnabled !== '0' && envKeyId && envKeySecret) {
    return { keyId: envKeyId, keySecret: envKeySecret };
  }

  const settings = await ensureThirdPartySettings();
  const razorpay = settings?.payment?.razor_pay || {};
  const enabled = String(razorpay.enabled ?? '0') === '1';

  if (!enabled) {
    throw new ApiError(403, 'Razorpay gateway is disabled');
  }

  const environment = String(razorpay.environment || 'test').toLowerCase();
  const isLive = environment === 'live';
  const keyId = String(isLive ? razorpay.live_api_key : razorpay.test_api_key || '');
  const keySecret = String(isLive ? razorpay.live_secret_key : razorpay.test_secret_key || '');

  if (!keyId || !keySecret) {
    throw new ApiError(500, 'Razorpay credentials are not configured');
  }

  if (keyId.toLowerCase().includes('demo') || keySecret.toLowerCase().includes('demo')) {
    throw new ApiError(500, 'Razorpay keys are demo placeholders. Configure real keys in Admin > Payment Gateways');
  }

  return { keyId, keySecret };
};

const razorpayRequest = async ({ method, path, body, keyId, keySecret }) => {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status || 502, payload?.error?.description || payload?.error?.message || 'Razorpay request failed');
  }

  return payload;
};

export const createRide = async (req, res) => {
  const { pickup, drop, pickupAddress, dropAddress, fare, estimatedDistanceMeters, estimatedDurationMinutes, vehicleTypeId, vehicleIconType, vehicleIconUrl, paymentMethod, serviceType, intercity, promo_code, service_location_id, transport_type } =
    req.body;

  if (!pickup || !drop) {
    throw new ApiError(400, 'pickup and drop are required');
  }

  const ride = await createRideRecord({
    userId: req.auth.sub,
    pickupCoords: normalizePoint(pickup, 'pickup'),
    dropCoords: normalizePoint(drop, 'drop'),
    pickupAddress,
    dropAddress,
    fare: Number(fare || 0),
    estimatedDistanceMeters: Number(estimatedDistanceMeters || 0),
    estimatedDurationMinutes: Number(estimatedDurationMinutes || 0),
    vehicleTypeId,
    vehicleIconType,
    vehicleIconUrl,
    paymentMethod,
    serviceType,
    intercity,
    promo_code,
    service_location_id,
    transport_type,
  });

  await startDispatchFlow(ride);

  res.status(201).json({
    success: true,
    data: {
      ride,
      realtime: {
        room: getRideRoom(ride._id),
        rideId: String(ride._id),
      },
    },
  });
};

export const getRideById = async (req, res) => {
  await ensureRideParticipantAccess({
    rideId: req.params.rideId,
    role: req.auth.role,
    entityId: req.auth.sub,
  });

  const ride = await getRideDetails(req.params.rideId);

  res.json({
    success: true,
    data: ride,
  });
};

export const getMyActiveRide = async (req, res) => {
  const ride = await getActiveRideForIdentity({
    role: req.auth.role,
    entityId: req.auth.sub,
  });

  res.json({
    success: true,
    data: ride ? serializeRideRealtime(ride) : null,
  });
};

export const listMyRides = async (req, res) => {
  const history = await listRideHistoryForIdentity({
    role: req.auth.role,
    entityId: req.auth.sub,
    limit: req.query.limit,
    page: req.query.page,
  });

  res.json({
    success: true,
    data: {
      results: history.results,
      total: history.pagination.total,
      pagination: history.pagination,
    },
  });
};

export const updateRideStatus = async (req, res) => {
  if (req.auth.role !== 'driver') {
    throw new ApiError(403, 'Only drivers can update ride status');
  }

  const nextStatus = String(req.body.status || '').trim().toLowerCase();

  if (![RIDE_LIVE_STATUS.ACCEPTED, RIDE_LIVE_STATUS.ARRIVING, RIDE_LIVE_STATUS.STARTED, RIDE_LIVE_STATUS.COMPLETED].includes(nextStatus)) {
    throw new ApiError(400, 'status must be accepted, arriving, started, or completed');
  }

  const ride = await updateRideLifecycle({
    rideId: req.params.rideId,
    driverId: req.auth.sub,
    nextStatus,
    paymentMethod: req.body.paymentMethod,
  });

  res.json({
    success: true,
    data: serializeRideRealtime(ride),
  });
};

export const submitRideReview = async (req, res) => {
  if (req.auth.role !== 'user') {
    throw new ApiError(403, 'Only users can rate completed rides');
  }

  const ride = await submitRideFeedback({
    rideId: req.params.rideId,
    userId: req.auth.sub,
    rating: req.body.rating,
    comment: req.body.comment,
    tipAmount: req.body.tipAmount,
  });

  res.json({
    success: true,
    data: serializeRideRealtime(ride),
  });
};

export const createRazorpayRideTipOrder = async (req, res) => {
  const rideId = String(req.params.rideId || '').trim();
  const tipAmount = normalizeMoneyAmount(req.body?.tipAmount, 'tipAmount');
  const tipSettings = await getTipSettings();
  const tipsEnabled = String(tipSettings.enable_tips || '1') === '1';
  const minimumTipAmount = Number(tipSettings.min_tip_amount || 0);

  if (!tipsEnabled) {
    throw new ApiError(403, 'Tips are currently disabled');
  }

  if (minimumTipAmount > 0 && tipAmount < minimumTipAmount) {
    throw new ApiError(400, `tipAmount must be at least ${minimumTipAmount}`);
  }

  const ride = await Ride.findOne({
    _id: rideId,
    userId: req.auth.sub,
    status: 'completed',
  }).select('_id driverId feedback');

  if (!ride) {
    throw new ApiError(404, 'Completed ride not found');
  }

  if (!ride.driverId) {
    throw new ApiError(409, 'Ride has no assigned driver');
  }

  if (ride.feedback?.submittedAt) {
    throw new ApiError(409, 'Feedback already submitted for this ride');
  }

  const { keyId, keySecret } = await resolveRazorpayCredentials();
  const amountPaise = Math.round(tipAmount * 100);
  const compactRideId = rideId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'ride';
  const compactUserId = String(req.auth?.sub || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'usr';
  const receipt = `utip_${compactUserId}_${compactRideId}_${Date.now().toString(36)}`;

  const order = await razorpayRequest({
    method: 'POST',
    path: '/orders',
    body: {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        rideId,
        userId: String(req.auth.sub),
        driverId: String(ride.driverId),
        kind: 'ride_tip',
      },
    },
    keyId,
    keySecret,
  });

  res.status(201).json({
    success: true,
    data: {
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || 'INR',
      tipAmount,
    },
  });
};

export const verifyRazorpayRideTip = async (req, res) => {
  const rideId = String(req.params.rideId || '').trim();
  const rating = Number(req.body?.rating || 0);
  const comment = String(req.body?.comment || '');
  const tipAmount = normalizeMoneyAmount(req.body?.tipAmount, 'tipAmount');
  const orderId = String(req.body?.razorpay_order_id || '');
  const paymentId = String(req.body?.razorpay_payment_id || '');
  const signature = String(req.body?.razorpay_signature || '');

  if (!orderId || !paymentId || !signature) {
    throw new ApiError(400, 'Payment verification fields are required');
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'rating must be between 1 and 5');
  }

  const tipSettings = await getTipSettings();
  const tipsEnabled = String(tipSettings.enable_tips || '1') === '1';
  const minimumTipAmount = Number(tipSettings.min_tip_amount || 0);

  if (!tipsEnabled) {
    throw new ApiError(403, 'Tips are currently disabled');
  }

  if (minimumTipAmount > 0 && tipAmount < minimumTipAmount) {
    throw new ApiError(400, `tipAmount must be at least ${minimumTipAmount}`);
  }

  const ride = await Ride.findOne({
    _id: rideId,
    userId: req.auth.sub,
    status: 'completed',
  });

  if (!ride) {
    throw new ApiError(404, 'Completed ride not found');
  }

  if (!ride.driverId) {
    throw new ApiError(409, 'Ride has no assigned driver');
  }

  if (ride.feedback?.submittedAt && String(ride.feedback?.tipPaymentId || '') === paymentId) {
    const existingRide = await getRideDetails(rideId);
    res.json({
      success: true,
      data: existingRide,
    });
    return;
  }

  if (ride.feedback?.submittedAt) {
    throw new ApiError(409, 'Feedback already submitted for this ride');
  }

  const { keyId, keySecret } = await resolveRazorpayCredentials();
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new ApiError(400, 'Invalid payment signature');
  }

  const order = await razorpayRequest({
    method: 'GET',
    path: `/orders/${encodeURIComponent(orderId)}`,
    keyId,
    keySecret,
  });

  const amountPaise = Number(order?.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new ApiError(400, 'Invalid order amount');
  }

  const verifiedTipAmount = Math.round(amountPaise) / 100;
  if (Math.abs(verifiedTipAmount - tipAmount) > 0.001) {
    throw new ApiError(400, 'Verified tip amount does not match selected tip');
  }

  const driver = await Driver.findById(ride.driverId);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  const existingWalletCredit = await WalletTransaction.findOne({
    driverId: ride.driverId,
    'metadata.providerPaymentId': paymentId,
  })
    .select('_id')
    .lean();

  if (existingWalletCredit && String(ride.feedback?.tipPaymentId || '') !== paymentId) {
    throw new ApiError(409, 'This tip payment was already processed');
  }

  const walletResult = existingWalletCredit
    ? {
        wallet: await serializeDriverWallet(driver),
        transaction: null,
      }
    : await applyDriverWalletAdjustment({
        driverId: ride.driverId,
        rideId: ride._id,
        amount: verifiedTipAmount,
        type: 'adjustment',
        description: 'Ride tip credited from rider',
        metadata: {
          source: 'ride_tip',
          provider: 'razorpay',
          providerOrderId: orderId,
          providerPaymentId: paymentId,
          rideId: String(ride._id),
          userId: String(req.auth.sub),
        },
      });

  ride.feedback = {
    rating,
    comment: comment.trim(),
    tipAmount: verifiedTipAmount,
    tipPaymentId: paymentId,
    tipOrderId: orderId,
    tipPaidAt: new Date(),
    submittedAt: new Date(),
  };

  driver.ratingCount = Number(driver.ratingCount || 0) + 1;
  driver.totalRatingScore = Number(driver.totalRatingScore || 0) + rating;
  driver.rating = Number((driver.totalRatingScore / driver.ratingCount).toFixed(1));

  await Promise.all([ride.save(), driver.save()]);

  if (walletResult.transaction) {
    emitToDriver(ride.driverId, 'driver:wallet:updated', {
      wallet: walletResult.wallet,
      transaction: walletResult.transaction,
    });
  }

  const populatedRide = await getRideDetails(ride._id);

  res.json({
    success: true,
    data: populatedRide,
  });
};

export const getRideAppTipSettings = async (_req, res) => {
  const tipSettings = await getTipSettings();

  res.json({
    success: true,
    data: {
      settings: tipSettings,
    },
  });
};

export const cancelRide = async (req, res) => {
  const ride = await cancelRideByUser({
    rideId: req.params.rideId,
    userId: req.auth.sub,
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  res.json({
    success: true,
    data: {
      rideId: String(ride._id),
      status: ride.status,
      liveStatus: ride.liveStatus,
    },
  });
};

export const listAvailableDrivers = async (req, res) => {
  const { vehicleTypeId, lat, lng, maxDistance, limit = 30, service_location_id, transport_type } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lng);
  const distance = Number(maxDistance);

  if (!vehicleTypeId) {
    throw new ApiError(400, 'vehicleTypeId is required');
  }

  if (!mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
    throw new ApiError(400, 'vehicleTypeId is invalid');
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ApiError(400, 'lat and lng are required');
  }

  const near = {
    $geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
  };

  if (Number.isFinite(distance) && distance > 0) {
    near.$maxDistance = Math.min(distance, 25000);
  }

  const drivers = await Driver.find({
    isOnline: true,
    isOnRide: false,
    vehicleTypeId,
    location: {
      $near: near,
    },
  })
    .limit(Math.min(Number(limit) || 30, 50))
    .select('name phone vehicleTypeId vehicleType vehicleIconType vehicleNumber vehicleColor vehicleMake vehicleModel rating location')
    .lean();

  const enrichedDrivers = drivers.map((driver) => {
    const distanceMeters = calculateDistanceMeters([longitude, latitude], driver.location?.coordinates || []);
    const etaMinutes = estimateEtaMinutes(distanceMeters);

    return {
      id: driver._id,
      name: driver.name,
      vehicleTypeId: driver.vehicleTypeId,
      vehicleType: driver.vehicleType,
      vehicleIconType: driver.vehicleIconType,
      vehicleNumber: driver.vehicleNumber,
      vehicleColor: driver.vehicleColor,
      vehicleMake: driver.vehicleMake,
      vehicleModel: driver.vehicleModel,
      rating: driver.rating,
      location: driver.location,
      distanceMeters,
      etaMinutes,
    };
  });

  const closestDriver = enrichedDrivers[0] || null;
  const { allowedPaymentMethods } = await getAllowedRidePaymentMethodsForPricing({
    serviceLocationId: service_location_id && mongoose.Types.ObjectId.isValid(service_location_id)
      ? new mongoose.Types.ObjectId(service_location_id)
      : null,
    transportType: transport_type || 'taxi',
    vehicleTypeId,
  });

  res.json({
    success: true,
    data: {
      totalDrivers: enrichedDrivers.length,
      closestDriverDistanceMeters: closestDriver?.distanceMeters ?? null,
      closestDriverEtaMinutes: closestDriver?.etaMinutes ?? null,
      allowedPaymentMethods,
      drivers: enrichedDrivers,
    },
  });
};
