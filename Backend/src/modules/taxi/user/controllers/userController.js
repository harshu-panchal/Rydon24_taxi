import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { ApiError } from '../../../../utils/ApiError.js';
import { User } from '../models/User.js';
import { UserWallet } from '../models/UserWallet.js';
import { Notification } from '../../admin/promotions/models/Notification.js';
import { BusService } from '../../admin/models/BusService.js';
import { Driver } from '../../driver/models/Driver.js';
import { comparePassword, hashPassword, signAccessToken } from '../services/authService.js';
import { env } from '../../../../config/env.js';
import { uploadDataUrlToCloudinary } from '../../../../utils/cloudinaryUpload.js';
import { ensureThirdPartySettings } from '../../admin/services/adminService.js';
import { getTransportRideSettings } from '../../services/transportSettingsService.js';
import {
  consumeUserSignupSession,
  requireVerifiedUserSignupSession,
  startUserOtp,
  verifyUserOtp,
} from '../services/userOtpService.js';
import { assignPushTokenToEntity } from '../../services/pushTokenService.js';
import { BusSeatHold } from '../models/BusSeatHold.js';
import { BusBooking } from '../models/BusBooking.js';
import { RentalBookingRequest } from '../../admin/models/RentalBookingRequest.js';
import { RentalQuoteRequest } from '../../admin/models/RentalQuoteRequest.js';
import { RentalVehicleType } from '../../admin/models/RentalVehicleType.js';
import { applyDriverWalletAdjustment } from '../../driver/services/walletService.js';
import { emitToDriver } from '../../services/dispatchService.js';
import { sendPushNotificationToEntities } from '../../services/pushNotificationService.js';

const VALID_GENDERS = new Set(['male', 'female', 'other', 'prefer-not-to-say', '']);

const toCleanString = (value) => String(value || '').trim();

const normalizePhone = (value) => {
  const digits = toCleanString(value).replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

const normalizeEmail = (value) => toCleanString(value).toLowerCase();

const normalizeGender = (value) => {
  const gender = toCleanString(value).toLowerCase();
  return VALID_GENDERS.has(gender) ? gender : 'prefer-not-to-say';
};

const validatePhone = (phone) => {
  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError(400, 'A valid 10-digit phone number is required');
  }
};

const validateName = (name) => {
  if (!name || name.length < 2 || name.length > 80) {
    throw new ApiError(400, 'name must be between 2 and 80 characters');
  }
};

const validateEmail = (email) => {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'A valid email address is required');
  }
};

const normalizeMoneyAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'amount must be a positive number');
  }
  return Math.round(amount * 100) / 100;
};

const ensureUserWallet = async (userId) => {
  if (!userId) return;
  await UserWallet.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true });
};

const serializeUserWalletTransaction = (entry = {}) => ({
  id: entry._id,
  kind: entry.kind,
  amount: Number(entry.amount || 0),
  title: entry.title || '',
  counterpartyPhone: entry.counterpartyPhone || '',
  createdAt: entry.createdAt || null,
});

const buildUserWalletPayload = (wallet) => {
  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];

  return {
    balance: Number(wallet?.balance || 0),
    currency: 'INR',
    recentTransactions: transactions
      .slice()
      .reverse()
      .map(serializeUserWalletTransaction),
  };
};

const resolveRazorpayCredentials = async () => {
  const envKeyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const envKeySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  const envEnabled = String(process.env.RAZORPAY_ENABLED || '').trim();

  // Prefer backend .env credentials when present unless they are explicitly disabled.
  if (envEnabled !== '0' && envKeyId && envKeySecret) {
    return { keyId: envKeyId, keySecret: envKeySecret };
  }

  const settings = await ensureThirdPartySettings();
  const razorpay = settings?.payment?.razor_pay || {};

  const enabled = String(razorpay.enabled ?? '0') === '1';
  if (!enabled) {
    settings.payment = settings.payment || {};
    settings.payment.razor_pay = {
      ...razorpay,
      enabled: '1',
      environment: razorpay.environment || 'test',
    };
    settings.markModified('payment');
    await settings.save();
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
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status || 502, payload?.error?.description || payload?.error?.message || 'Razorpay request failed');
  }

  return payload;
};

const BUS_HOLD_MINUTES = 10;
const BUS_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeBusTravelDate = (value) => {
  const rawValue = toCleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    throw new ApiError(400, 'travelDate must be in YYYY-MM-DD format');
  }

  return rawValue;
};

const getBusTravelDayLabel = (travelDate) => {
  const parsed = new Date(`${travelDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, 'Invalid travelDate');
  }

  return BUS_DAY_LABELS[parsed.getUTCDay()];
};

const normalizeBusCity = (value) => toCleanString(value).toLowerCase();

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildBusCityRegex = (value) => new RegExp(`^${escapeRegex(toCleanString(value))}$`, 'i');

const flattenBusBlueprintSeats = (blueprint = {}) =>
  ['lowerDeck', 'upperDeck']
    .flatMap((deckKey) => Array.isArray(blueprint?.[deckKey]) ? blueprint[deckKey] : [])
    .flatMap((row) => (Array.isArray(row) ? row : []))
    .filter((cell) => cell?.kind === 'seat' && cell?.id);

const findBusSchedule = (busService, scheduleId) =>
  (Array.isArray(busService?.schedules) ? busService.schedules : []).find(
    (item) => String(item?.id || '') === String(scheduleId || ''),
  );

const isScheduleAvailableOnDate = (schedule, travelDate) => {
  if (!schedule || String(schedule.status || 'active') !== 'active') {
    return false;
  }

  const activeDays = Array.isArray(schedule.activeDays) ? schedule.activeDays : [];
  if (activeDays.length === 0) {
    return true;
  }

  return activeDays.includes(getBusTravelDayLabel(travelDate));
};

const ensureBusServiceEnabled = async () => {
  const transportSettings = await getTransportRideSettings();
  if (String(transportSettings.enable_bus_service || '0') !== '1') {
    throw new ApiError(403, 'Bus service is currently disabled');
  }
};

const cleanupExpiredBusSeatHolds = async () => {
  const now = new Date();

  const expiredBookings = await BusBooking.find({
    status: 'pending',
    expiresAt: { $lte: now },
  })
    .select('_id')
    .lean();

  if (expiredBookings.length > 0) {
    const bookingIds = expiredBookings.map((item) => item._id);
    await BusBooking.updateMany(
      { _id: { $in: bookingIds } },
      { $set: { status: 'expired' } },
    );
    await BusSeatHold.deleteMany({
      bookingId: { $in: bookingIds },
      status: 'held',
      expiresAt: { $lte: now },
    });
  }

  await BusSeatHold.deleteMany({
    status: 'held',
    expiresAt: { $lte: now },
  });
};

const createBusBookingCode = () =>
  `BUS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const serializeBusSearchResult = ({ busService, schedule, availableSeats, travelDate }) => ({
  id: `${String(busService._id)}:${String(schedule.id)}:${travelDate}`,
  busServiceId: String(busService._id),
  scheduleId: String(schedule.id || ''),
  operator: busService.operatorName || '',
  operatorName: busService.operatorName || '',
  busName: busService.busName || '',
  type: busService.coachType || busService.busCategory || 'Bus',
  coachType: busService.coachType || '',
  busCategory: busService.busCategory || '',
  departure: schedule.departureTime || '',
  arrival: schedule.arrivalTime || '',
  duration: busService.route?.durationHours || '',
  routeName: busService.route?.routeName || '',
  fromCity: busService.route?.originCity || '',
  toCity: busService.route?.destinationCity || '',
  seats: Math.max(0, Number(availableSeats || 0)),
  availableSeats: Math.max(0, Number(availableSeats || 0)),
  price: Number(busService.seatPrice || 0),
  fareCurrency: busService.fareCurrency || 'INR',
  amenities: Array.isArray(busService.amenities) ? busService.amenities : [],
  boardingPolicy: busService.boardingPolicy || '',
  cancellationPolicy: busService.cancellationPolicy || '',
  registrationNumber: busService.registrationNumber || '',
  busColor: busService.busColor || '#1f2937',
});

const serializeBusRouteSuggestion = (busService) => ({
  id: String(busService._id),
  fromCity: busService.route?.originCity || '',
  toCity: busService.route?.destinationCity || '',
  routeName: busService.route?.routeName || '',
  duration: busService.route?.durationHours || '',
  startingPrice: Number(busService.seatPrice || 0),
  operator: busService.operatorName || '',
});

const serializeBusBooking = (booking) => ({
  id: String(booking._id),
  bookingCode: booking.bookingCode || '',
  status: booking.status || 'pending',
  travelDate: booking.travelDate || '',
  scheduleId: booking.scheduleId || '',
  seatIds: Array.isArray(booking.seatIds) ? booking.seatIds : [],
  seatLabels: Array.isArray(booking.seatLabels) ? booking.seatLabels : [],
  amount: Number(booking.amount || 0),
  currency: booking.currency || 'INR',
  passenger: booking.passenger || {},
  payment: {
    provider: booking.payment?.provider || 'razorpay',
    orderId: booking.payment?.orderId || '',
    paymentId: booking.payment?.paymentId || '',
    status: booking.payment?.status || 'pending',
    paidAt: booking.payment?.paidAt || null,
  },
  bus: {
    operator: booking.routeSnapshot?.operatorName || '',
    busName: booking.routeSnapshot?.busName || '',
    type: booking.routeSnapshot?.coachType || booking.routeSnapshot?.busCategory || 'Bus',
    departure: booking.routeSnapshot?.departureTime || '',
    arrival: booking.routeSnapshot?.arrivalTime || '',
    duration: booking.routeSnapshot?.durationHours || '',
    fromCity: booking.routeSnapshot?.originCity || '',
    toCity: booking.routeSnapshot?.destinationCity || '',
  },
  createdAt: booking.createdAt || null,
});

const serializeRentalQuoteRequest = (item = {}) => ({
  id: String(item._id || item.id || ''),
  vehicleTypeId: item.vehicleTypeId ? String(item.vehicleTypeId) : '',
  vehicleName: item.vehicleName || '',
  contactName: item.contactName || '',
  contactPhone: item.contactPhone || '',
  contactEmail: item.contactEmail || '',
  requestedHours: Number(item.requestedHours || 0),
  pickupDateTime: item.pickupDateTime || null,
  returnDateTime: item.returnDateTime || null,
  seatsNeeded: Number(item.seatsNeeded || 1),
  luggageNeeded: Number(item.luggageNeeded || 0),
  pickupLocation: item.pickupLocation || '',
  dropLocation: item.dropLocation || '',
  specialRequirements: item.specialRequirements || '',
  status: item.status || 'pending',
  adminQuotedAmount: Number(item.adminQuotedAmount || 0),
  adminNote: item.adminNote || '',
  createdAt: item.createdAt || null,
});

const serializeRentalBookingRequest = (item = {}) => ({
  id: String(item._id || item.id || ''),
  bookingReference: item.bookingReference || '',
  userId: item.userId ? String(item.userId) : '',
  vehicleTypeId: item.vehicleTypeId ? String(item.vehicleTypeId) : '',
  vehicleName: item.vehicleName || '',
  vehicleCategory: item.vehicleCategory || '',
  vehicleImage: item.vehicleImage || '',
  selectedPackage: {
    packageId: item.selectedPackage?.packageId || '',
    label: item.selectedPackage?.label || '',
    durationHours: Number(item.selectedPackage?.durationHours || 0),
    price: Number(item.selectedPackage?.price || 0),
  },
  serviceLocation: {
    locationId: item.serviceLocation?.locationId || '',
    name: item.serviceLocation?.name || '',
    address: item.serviceLocation?.address || '',
    city: item.serviceLocation?.city || '',
    latitude: item.serviceLocation?.latitude ?? null,
    longitude: item.serviceLocation?.longitude ?? null,
    distanceKm: item.serviceLocation?.distanceKm ?? null,
  },
  pickupDateTime: item.pickupDateTime || null,
  returnDateTime: item.returnDateTime || null,
  requestedHours: Number(item.requestedHours || 0),
  totalCost: Number(item.totalCost || 0),
  payableNow: Number(item.payableNow || 0),
  advancePaymentLabel: item.advancePaymentLabel || '',
  paymentStatus: item.paymentStatus || 'pending',
  paymentMethod: item.paymentMethod || '',
  paymentMethodLabel: item.paymentMethodLabel || '',
  payment: {
    provider: item.payment?.provider || '',
    status: item.payment?.status || '',
    amount: Number(item.payment?.amount || 0),
    currency: item.payment?.currency || 'INR',
    orderId: item.payment?.orderId || '',
    paymentId: item.payment?.paymentId || '',
    signature: item.payment?.signature || '',
  },
  contactName: item.contactName || '',
  contactPhone: item.contactPhone || '',
  contactEmail: item.contactEmail || '',
  kycCompleted: Boolean(item.kycCompleted),
  assignedVehicle: {
    vehicleId: item.assignedVehicle?.vehicleId ? String(item.assignedVehicle.vehicleId) : '',
    name: item.assignedVehicle?.name || '',
    vehicleCategory: item.assignedVehicle?.vehicleCategory || '',
    image: item.assignedVehicle?.image || '',
  },
  status: item.status || 'pending',
  adminNote: item.adminNote || '',
  assignedAt: item.assignedAt || null,
  completedAt: item.completedAt || null,
  finalCharge: Number(item.finalCharge || 0),
  finalElapsedMinutes: Number(item.finalElapsedMinutes || 0),
  createdAt: item.createdAt || null,
  updatedAt: item.updatedAt || null,
});

const computeRentalRideMetrics = (item = {}, endedAt = null) => {
  const startDate = item.assignedAt || item.pickupDateTime || item.createdAt;
  const startMs = startDate ? new Date(startDate).getTime() : NaN;
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();

  const safeRequestedHours = Math.max(
    Number(item.requestedHours || 0),
    Number(item.selectedPackage?.durationHours || 0),
    1,
  );
  const hourlyRate = Number(item.totalCost || item.selectedPackage?.price || 0) / safeRequestedHours;

  if (!Number.isFinite(startMs)) {
    return {
      hourlyRate: Math.max(0, hourlyRate),
      elapsedMinutes: 0,
      elapsedHours: 0,
      currentCharge: Math.max(0, Number(item.payableNow || 0)),
      remainingDue: Math.max(0, Number(item.totalCost || 0) - Number(item.payableNow || 0)),
    };
  }

  const elapsedMs = Math.max(0, endMs - startMs);
  const elapsedMinutes = Math.max(0, Math.ceil(elapsedMs / 60000));
  const elapsedHours = elapsedMs / 3600000;
  const uncappedCharge = Math.max(Number(item.payableNow || 0), hourlyRate * elapsedHours);
  const currentCharge = Math.min(Number(item.totalCost || 0), Math.round((uncappedCharge + Number.EPSILON) * 100) / 100);
  const remainingDue = Math.max(0, Math.round((currentCharge - Number(item.payableNow || 0) + Number.EPSILON) * 100) / 100);

  return {
    hourlyRate: Math.max(0, Math.round((hourlyRate + Number.EPSILON) * 100) / 100),
    elapsedMinutes,
    elapsedHours: Math.round((elapsedHours + Number.EPSILON) * 100) / 100,
    currentCharge,
    remainingDue,
  };
};

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toUserPayload = (user) => ({
  id: user._id,
  name: user.name || '',
  phone: user.phone || '',
  email: user.email || '',
  gender: user.gender || '',
  profileImage: user.profileImage || '',
  referralCode: user.referralCode || '',
  referralCount: Number(user.referralCount || 0),
  deletionRequestStatus: user.deletionRequest?.status || 'none',
  referralCode: user.referralCode || '',
  referralCount: Number(user.referralCount || 0),
  currentRideId: user.currentRideId || null,
});

const ensureUserCanLogin = (user) => {
  if (user.deletedAt || user.isActive === false || user.active === false) {
    throw new ApiError(403, 'User account is not active');
  }
};

const createUserSession = (user) => ({
  token: signAccessToken({ sub: String(user._id), role: 'user' }),
  user: toUserPayload(user),
});

const generateUserReferralCode = (user) => {
  const idPart = String(user?._id || '').slice(-6).toUpperCase();
  const phonePart = String(user?.phone || '').slice(-4);
  return `USR${phonePart}${idPart}`.replace(/\W/g, '');
};

export const registerUser = async (req, res) => {
  const password = String(req.body.password || '');
  const name = toCleanString(req.body.name);
  const phone = normalizePhone(req.body.phone);
  const email = normalizeEmail(req.body.email);
  const countryCode = toCleanString(req.body.countryCode) || '+91';
  const gender = normalizeGender(req.body.gender);
  const profileImage = toCleanString(req.body.profileImage);

  validateName(name);
  validatePhone(phone);
  validateEmail(email);

  if (!password || password.length < 5) {
    throw new ApiError(400, 'password must be at least 5 characters');
  }

  const existingUser = await User.findOne({ phone });

  if (existingUser) {
    throw new ApiError(409, 'Phone number is already registered');
  }

  const user = await User.create({
    name,
    phone,
    countryCode,
    email,
    gender,
    profileImage,
    password: await hashPassword(password),
  });

  res.status(201).json({
    success: true,
    data: createUserSession(user),
  });
};

const serializeUserNotification = (item = {}) => ({
  id: String(item._id || ''),
  title: String(item.push_title || '').trim(),
  body: String(item.message || '').trim(),
  image: item.image || '',
  sentAt: item.sent_at || item.createdAt || null,
  serviceLocationId: item.service_location_id || null,
});

export const getUserNotifications = async (req, res) => {
  const user = await User.findById(req.auth.sub).lean();

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Users don't typically have a service_location_id in their profile like drivers do in this schema,
  // but if they did, we would use it. For now, we fetch all user-targeted notifications.
  const query = {
    status: 'sent',
    send_to: { $in: ['all', 'users'] },
  };

  const notifications = await Notification.find(query)
    .sort({ sent_at: -1, createdAt: -1 })
    .limit(100)
    .lean();

  res.json({
    success: true,
    data: {
      results: notifications.map(serializeUserNotification),
    },
  });
};

export const deleteUserNotification = async (req, res) => {
  // In a real multi-tenant app, you'd mark it as read/deleted for THIS user in a pivot table.
  // However, the current driver implementation seems to imply a simpler model or global clear for the demo.
  // For consistency with the user's request for "single clear", we'll just return success 
  // as the frontend is already filtering its local state.
  // If we wanted to persist this per user, we'd need a UserNotification model.
  res.json({
    success: true,
    message: 'Notification removed',
  });
};

export const clearAllUserNotifications = async (req, res) => {
  res.json({
    success: true,
    message: 'All notifications cleared',
  });
};

export const signupUser = async (req, res) => {
  const name = toCleanString(req.body.name);
  const phone = normalizePhone(req.body.phone);
  const email = normalizeEmail(req.body.email);
  const countryCode = toCleanString(req.body.countryCode) || '+91';
  const gender = normalizeGender(req.body.gender);
  const profileImage = toCleanString(req.body.profileImage);
  const password = String(req.body.password || '');

  validateName(name);
  validatePhone(phone);
  validateEmail(email);

  if (!password || password.length < 5) {
    throw new ApiError(400, 'password must be at least 5 characters');
  }

  const signupSession = await requireVerifiedUserSignupSession(phone);

  const existingUser = await User.findOne({ phone });

  if (existingUser) {
    throw new ApiError(409, 'Phone number is already registered');
  }

  const user = await User.create({
    name,
    phone,
    email,
    countryCode,
    gender,
    profileImage,
    password: await hashPassword(password),
    isVerified: true,
  });
  await consumeUserSignupSession(signupSession);

  res.status(201).json({
    success: true,
    data: createUserSession(user),
  });
};

export const startUserOtpRequest = async (req, res) => {
  const result = await startUserOtp(req.body);
  res.status(201).json({ success: true, data: result });
};

export const verifyUserOtpRequest = async (req, res) => {
  const result = await verifyUserOtp(req.body);
  res.json({ success: true, data: result });
};

export const loginUser = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const password = String(req.body.password || '');

  validatePhone(phone);

  if (!password) {
    throw new ApiError(400, 'password is required');
  }

  const user = await User.findOne({ phone }).select('+password');

  if (!user || !user.password || !(await comparePassword(password, user.password))) {
    throw new ApiError(401, 'Invalid phone or password');
  }

  ensureUserCanLogin(user);

  res.json({
    success: true,
    data: createUserSession(user),
  });
};

export const verifyUserPhoneForOtpLogin = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  validatePhone(phone);

  const user = await User.findOne({ phone }).lean();

  if (!user) {
    res.json({
      success: true,
      data: {
        exists: false,
        user: null,
      },
    });
    return;
  }

  ensureUserCanLogin(user);

  res.json({
    success: true,
    data: {
      exists: true,
      ...createUserSession(user),
    },
  });
};

export const saveUserFcmToken = async (req, res) => {
  const user = await User.findById(req.auth?.sub);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  ensureUserCanLogin(user);

  const saved = assignPushTokenToEntity(user, {
    token: req.body?.token,
    platform: req.body?.platform,
  });

  await user.save();

  res.json({
    success: true,
    data: {
      message: 'FCM token saved successfully',
      platform: saved.platform,
      field: saved.fieldName,
    },
  });
};

export const getCurrentUser = async (req, res) => {
  const user = await User.findById(req.auth?.sub);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!String(user.referralCode || '').trim()) {
    user.referralCode = generateUserReferralCode(user);
    await user.save();
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        gender: user.gender || '',
        profileImage: user.profileImage || '',
        referralCode: user.referralCode || '',
        referralCount: Number(user.referralCount || 0),
        deletionRequestStatus: user.deletionRequest?.status || 'none',
        referralCode: user.referralCode || '',
        referralCount: Number(user.referralCount || 0),
        currentRideId: user.currentRideId || null,
        createdAt: user.createdAt || null,
      },
    },
  });
};

export const uploadUserProfileImage = async (req, res) => {
  const dataUrl = String(req.body?.dataUrl || '');

  if (!dataUrl) {
    throw new ApiError(400, 'dataUrl is required');
  }

  if (dataUrl.length > 12_000_000) {
    throw new ApiError(413, 'Image is too large');
  }

  const uploadResult = await uploadDataUrlToCloudinary({
    dataUrl,
    folder: `${env.cloudinary.folder}/user-profile`,
    publicIdPrefix: 'user-profile',
  });

  res.status(201).json({
    success: true,
    data: {
      secureUrl: uploadResult.secureUrl,
      publicId: uploadResult.publicId,
    },
  });
};

export const updateCurrentUser = async (req, res) => {
  const userId = req.auth?.sub;

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
    const name = toCleanString(req.body.name);
    validateName(name);
    user.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'email')) {
    const email = normalizeEmail(req.body.email);
    validateEmail(email);
    user.email = email;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'profileImage')) {
    user.profileImage = toCleanString(req.body.profileImage);
  }

  await user.save();

  res.json({
    success: true,
    data: {
      user: toUserPayload(user),
    },
  });
};

export const requestAccountDeletion = async (req, res) => {
  const userId = req.auth?.sub;
  const reason = toCleanString(req.body?.reason);

  if (!reason) {
    throw new ApiError(400, 'Deletion reason is required');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.deletedAt || user.isActive === false || user.active === false) {
    throw new ApiError(400, 'Account is already inactive');
  }

  if (user.deletionRequest?.status === 'pending') {
    res.json({
      success: true,
      data: {
        deletionRequestStatus: 'pending',
        requestedAt: user.deletionRequest.requestedAt || null,
      },
      message: 'Deletion request is already pending admin review',
    });
    return;
  }

  user.deletionRequest = {
    status: 'pending',
    reason: reason.slice(0, 300),
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    adminNote: '',
  };

  await user.save();

  res.status(201).json({
    success: true,
    data: {
      deletionRequestStatus: user.deletionRequest.status,
      requestedAt: user.deletionRequest.requestedAt,
    },
  });
};

export const getUserWallet = async (req, res) => {
  const userId = req.auth?.sub;
  const user = await User.findById(userId).select('_id').lean();

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  await ensureUserWallet(userId);
  const wallet = await UserWallet.findOne({ userId }).select('balance transactions').slice('transactions', -10).lean();
  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];

  res.json({
    success: true,
    data: buildUserWalletPayload({ ...wallet, transactions }),
  });
};

export const topupUserWallet = async (req, res) => {
  const amount = normalizeMoneyAmount(req.body?.amount);
  const userId = req.auth?.sub;
  const user = await User.findById(userId).select('_id').lean();

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const tx = {
    kind: 'credit',
    amount,
    title: 'Wallet Refilled',
    provider: 'manual',
  };

  await ensureUserWallet(userId);

  await UserWallet.updateOne(
    { userId },
    {
      $inc: { balance: amount },
      $push: { transactions: { $each: [tx], $slice: -50 } },
    },
  );

  const updatedWallet = await UserWallet.findOne({ userId }).select('balance transactions').slice('transactions', -10).lean();
  const transactions = Array.isArray(updatedWallet?.transactions) ? updatedWallet.transactions : [];

  res.status(201).json({
    success: true,
    data: buildUserWalletPayload({ ...updatedWallet, transactions }),
  });
};

export const transferUserWallet = async (req, res) => {
  const amount = normalizeMoneyAmount(req.body?.amount);
  const recipientPhone = normalizePhone(req.body?.phone);
  validatePhone(recipientPhone);

  const senderId = req.auth?.sub;

  const sender = await User.findById(senderId).select({ phone: 1 }).lean();
  if (!sender) {
    throw new ApiError(404, 'User not found');
  }

  if (sender.phone === recipientPhone) {
    throw new ApiError(400, 'Cannot transfer to same phone number');
  }

  const recipient = await User.findOne({ phone: recipientPhone }).select({ _id: 1 }).lean();
  if (!recipient) {
    throw new ApiError(404, 'Recipient not found');
  }

  await ensureUserWallet(senderId);
  await ensureUserWallet(recipient._id);

  const transferId = crypto.randomUUID();

  const debitTx = {
    kind: 'debit',
    amount,
    title: 'Wallet Transfer',
    counterpartyPhone: recipientPhone,
    provider: 'internal',
    providerPaymentId: transferId,
  };

  const creditTx = {
    kind: 'credit',
    amount,
    title: 'Wallet Received',
    counterpartyPhone: sender.phone || '',
    provider: 'internal',
    providerPaymentId: transferId,
  };

  const senderUpdate = await UserWallet.updateOne(
    { userId: senderId, balance: { $gte: amount } },
    { $inc: { balance: -amount }, $push: { transactions: { $each: [debitTx], $slice: -50 } } },
  );

  if (!senderUpdate?.modifiedCount) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }

  const recipientUpdate = await UserWallet.updateOne(
    { userId: recipient._id },
    { $inc: { balance: amount }, $push: { transactions: { $each: [creditTx], $slice: -50 } } },
  );

  if (!recipientUpdate?.modifiedCount) {
    await UserWallet.updateOne(
      { userId: senderId },
      { $inc: { balance: amount }, $pull: { transactions: { providerPaymentId: transferId } } },
    );
    throw new ApiError(500, 'Transfer failed');
  }

  const wallet = await UserWallet.findOne({ userId: senderId }).select('balance transactions').slice('transactions', -10).lean();

  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];

  res.status(201).json({
    success: true,
    data: buildUserWalletPayload({ ...wallet, transactions }),
  });
};

export const transferUserWalletToDriver = async (req, res) => {
  const amount = normalizeMoneyAmount(req.body?.amount);
  const driverPhone = normalizePhone(req.body?.phone);
  validatePhone(driverPhone);

  const senderId = req.auth?.sub;
  const sender = await User.findById(senderId).select({ phone: 1, firstName: 1, lastName: 1, name: 1 }).lean();

  if (!sender) {
    throw new ApiError(404, 'User not found');
  }

  if (sender.phone === driverPhone) {
    throw new ApiError(400, 'Cannot transfer to same phone number');
  }

  const recipientDriver = await Driver.findOne({ phone: driverPhone })
    .select({ _id: 1, phone: 1, firstName: 1, lastName: 1, name: 1 })
    .lean();

  if (!recipientDriver) {
    throw new ApiError(404, 'Driver not found');
  }

  await ensureUserWallet(senderId);
  const transferId = crypto.randomUUID();
  const senderDisplayName = String(
    sender.name || [sender.firstName, sender.lastName].filter(Boolean).join(' ') || 'Rider',
  ).trim();
  const driverDisplayName = String(
    recipientDriver.name || [recipientDriver.firstName, recipientDriver.lastName].filter(Boolean).join(' ') || 'Driver',
  ).trim();

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const senderWallet = await UserWallet.findOne({ userId: senderId }).session(session);
    if (!senderWallet) {
      throw new ApiError(404, 'User wallet not found');
    }

    if (Number(senderWallet.balance || 0) < amount) {
      throw new ApiError(400, 'Insufficient wallet balance');
    }

    senderWallet.balance = Math.round((Number(senderWallet.balance || 0) - amount) * 100) / 100;
    senderWallet.transactions.push({
      kind: 'debit',
      amount,
      title: `Sent to driver ${driverDisplayName}`,
      counterpartyPhone: driverPhone,
      provider: 'internal_driver_wallet_transfer',
      providerPaymentId: transferId,
    });
    senderWallet.transactions = senderWallet.transactions.slice(-50);
    await senderWallet.save({ session });

    const walletUpdate = await applyDriverWalletAdjustment({
      driverId: recipientDriver._id,
      amount,
      type: 'adjustment',
      description: `Received from rider wallet (${senderDisplayName})`,
      metadata: {
        source: 'user_wallet_transfer',
        transferId,
        senderUserId: senderId,
        senderPhone: sender.phone || '',
        senderName: senderDisplayName,
      },
      session,
    });

    await session.commitTransaction();

    emitToDriver(recipientDriver._id, 'driver:wallet:updated', {
      wallet: walletUpdate.wallet,
      transaction: walletUpdate.transaction,
      notification: {
        title: 'Wallet credited',
        body: `Rs ${amount.toFixed(2)} received from rider wallet`,
      },
    });

    sendPushNotificationToEntities({
      driverIds: [recipientDriver._id],
      title: 'Wallet credited',
      body: `Rs ${amount.toFixed(2)} received from rider wallet`,
      data: {
        type: 'driver_wallet_credit',
        amount: String(amount),
        transferId,
      },
    }).catch(() => {});

    const refreshedWallet = await UserWallet.findOne({ userId: senderId })
      .select('balance transactions')
      .slice('transactions', -10)
      .lean();

    res.status(201).json({
      success: true,
      data: {
        ...buildUserWalletPayload(refreshedWallet),
        transfer: {
          id: transferId,
          amount,
          driverPhone,
          driverName: driverDisplayName,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const createRazorpayWalletTopupOrder = async (req, res) => {
  const amount = normalizeMoneyAmount(req.body?.amount);
  const { keyId, keySecret } = await resolveRazorpayCredentials();

  const amountPaise = Math.round(amount * 100);
  const userId = String(req.auth?.sub || '');
  const compactUserId = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'usr';
  const receipt = `uwal_${compactUserId}_${Date.now().toString(36)}`;

  const order = await razorpayRequest({
    method: 'POST',
    path: '/orders',
    body: {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: { userId },
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
    },
  });
};

export const createRentalAdvancePaymentOrder = async (req, res) => {
  const amount = normalizeMoneyAmount(req.body?.amount);
  const vehicleId = String(req.body?.vehicleId || '').trim();
  const vehicleName = String(req.body?.vehicleName || 'Rental booking').trim();
  const pickup = String(req.body?.pickup || '').trim();
  const returnTime = String(req.body?.returnTime || '').trim();
  const { keyId, keySecret } = await resolveRazorpayCredentials();

  const amountPaise = Math.round(amount * 100);
  const userId = String(req.auth?.sub || '');
  const compactUserId = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'guest';
  const receipt = `rentadv_${compactUserId}_${Date.now().toString(36)}`;

  const order = await razorpayRequest({
    method: 'POST',
    path: '/orders',
    body: {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId,
        vehicleId,
        vehicleName,
        pickup,
        returnTime,
        purpose: 'rental_advance_payment',
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
      bookingReference: `RNT-${Date.now().toString(36).slice(-6).toUpperCase()}`,
    },
  });
};

export const verifyRazorpayWalletTopup = async (req, res) => {
  const orderId = String(req.body?.razorpay_order_id || '');
  const paymentId = String(req.body?.razorpay_payment_id || '');
  const signature = String(req.body?.razorpay_signature || '');

  if (!orderId || !paymentId || !signature) {
    throw new ApiError(400, 'Payment verification fields are required');
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

  const amount = Math.round(amountPaise) / 100;
  const userId = req.auth?.sub;

  await ensureUserWallet(userId);

  const alreadyCredited = await UserWallet.findOne({
    userId,
    'transactions.providerPaymentId': paymentId,
  })
    .select('_id')
    .lean();

  if (!alreadyCredited) {
    const tx = {
      kind: 'credit',
      amount,
      title: 'Wallet Refilled',
      provider: 'razorpay',
      providerOrderId: orderId,
      providerPaymentId: paymentId,
    };

    await UserWallet.updateOne(
      { userId },
      {
        $inc: { balance: amount },
        $push: { transactions: { $each: [tx], $slice: -50 } },
      },
    );
  }

  const wallet = await UserWallet.findOne({ userId }).select('balance transactions').slice('transactions', -10).lean();
  if (!wallet) {
    throw new ApiError(404, 'User not found');
  }

  res.status(201).json({
    success: true,
    data: buildUserWalletPayload(wallet),
  });
};

export const verifyRentalAdvancePayment = async (req, res) => {
  const orderId = String(req.body?.razorpay_order_id || '').trim();
  const paymentId = String(req.body?.razorpay_payment_id || '').trim();
  const signature = String(req.body?.razorpay_signature || '').trim();

  if (!orderId || !paymentId || !signature) {
    throw new ApiError(400, 'Payment verification fields are required');
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

  res.status(201).json({
    success: true,
    data: {
      provider: 'razorpay',
      status: 'paid',
      amount: Math.round(amountPaise) / 100,
      currency: order.currency || 'INR',
      orderId,
      paymentId,
      signature,
      notes: order?.notes || {},
    },
    message: 'Rental advance payment verified successfully',
  });
};

export const searchBuses = async (req, res) => {
  await ensureBusServiceEnabled();
  await cleanupExpiredBusSeatHolds();

  const fromCity = toCleanString(req.query?.fromCity);
  const toCity = toCleanString(req.query?.toCity);
  const travelDate = normalizeBusTravelDate(req.query?.date || req.query?.travelDate);

  if (!fromCity || !toCity) {
    throw new ApiError(400, 'fromCity and toCity are required');
  }

  const items = await BusService.find({
    status: 'active',
    'route.originCity': buildBusCityRegex(fromCity),
    'route.destinationCity': buildBusCityRegex(toCity),
  }).lean();

  if (items.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        travelDate,
        results: [],
      },
    });
  }

  const busIds = items.map((item) => item._id);
  const holds = await BusSeatHold.find({
    busServiceId: { $in: busIds },
    travelDate,
    status: { $in: ['held', 'booked'] },
  })
    .select('busServiceId scheduleId seatId')
    .lean();

  const reservedCountMap = new Map();
  holds.forEach((hold) => {
    const key = `${String(hold.busServiceId)}:${String(hold.scheduleId)}`;
    reservedCountMap.set(key, (reservedCountMap.get(key) || 0) + 1);
  });

  const results = items.flatMap((busService) => {
    const schedules = Array.isArray(busService.schedules) ? busService.schedules : [];
    const totalSeats = flattenBusBlueprintSeats(busService.blueprint).filter(
      (seat) => String(seat.status || 'available') !== 'blocked',
    ).length;

    return schedules
      .filter((schedule) => isScheduleAvailableOnDate(schedule, travelDate))
      .map((schedule) => {
        const reservedSeats = reservedCountMap.get(`${String(busService._id)}:${String(schedule.id)}`) || 0;
        return serializeBusSearchResult({
          busService,
          schedule,
          travelDate,
          availableSeats: totalSeats - reservedSeats,
        });
      });
  });

  res.status(200).json({
    success: true,
    data: {
      travelDate,
      results,
    },
  });
};

export const getBusRouteSuggestions = async (_req, res) => {
  await ensureBusServiceEnabled();

  const items = await BusService.find({ status: 'active' })
    .select('route operatorName seatPrice createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const seenRoutes = new Set();
  const results = [];

  items.forEach((busService) => {
    const fromCity = toCleanString(busService.route?.originCity);
    const toCity = toCleanString(busService.route?.destinationCity);

    if (!fromCity || !toCity) {
      return;
    }

    const key = `${normalizeBusCity(fromCity)}::${normalizeBusCity(toCity)}`;
    if (seenRoutes.has(key)) {
      return;
    }

    seenRoutes.add(key);
    results.push(serializeBusRouteSuggestion(busService));
  });

  res.status(200).json({
    success: true,
    data: {
      results,
    },
  });
};

export const getBusSeatLayout = async (req, res) => {
  await ensureBusServiceEnabled();
  await cleanupExpiredBusSeatHolds();

  const busServiceId = String(req.params?.id || '');
  const scheduleId = toCleanString(req.query?.scheduleId);
  const travelDate = normalizeBusTravelDate(req.query?.date || req.query?.travelDate);

  if (!scheduleId) {
    throw new ApiError(400, 'scheduleId is required');
  }

  const busService = await BusService.findById(busServiceId).lean();
  if (!busService || String(busService.status || '') !== 'active') {
    throw new ApiError(404, 'Bus service not found');
  }

  const schedule = findBusSchedule(busService, scheduleId);
  if (!isScheduleAvailableOnDate(schedule, travelDate)) {
    throw new ApiError(404, 'Bus schedule not found for the selected date');
  }

  const holds = await BusSeatHold.find({
    busServiceId,
    scheduleId,
    travelDate,
    status: { $in: ['held', 'booked'] },
  })
    .select('seatId')
    .lean();

  const reservedSeatIds = new Set(holds.map((item) => String(item.seatId)));
  const normalizeDeck = (deckRows = []) =>
    deckRows.map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => {
        if (!cell || cell.kind !== 'seat') {
          return cell;
        }

        const seatId = String(cell.id || '');
        const isBlocked = String(cell.status || 'available') === 'blocked';
        const isReserved = reservedSeatIds.has(seatId);

        return {
          ...cell,
          status: isBlocked || isReserved ? 'booked' : 'available',
        };
      }),
    );

  const blueprint = {
    templateKey: busService.blueprint?.templateKey || 'seater_2_2',
    lowerDeck: normalizeDeck(busService.blueprint?.lowerDeck || []),
    upperDeck: normalizeDeck(busService.blueprint?.upperDeck || []),
  };

  const availableSeats = flattenBusBlueprintSeats(blueprint).filter(
    (seat) => String(seat.status || 'available') === 'available',
  ).length;

  res.status(200).json({
    success: true,
    data: {
      busServiceId: String(busService._id),
      scheduleId,
      travelDate,
      availableSeats,
      bus: serializeBusSearchResult({
        busService,
        schedule,
        travelDate,
        availableSeats,
      }),
      blueprint,
    },
  });
};

export const createBusBookingOrder = async (req, res) => {
  await ensureBusServiceEnabled();
  await cleanupExpiredBusSeatHolds();

  const userId = req.auth?.sub;
  const busServiceId = String(req.body?.busServiceId || '');
  const scheduleId = toCleanString(req.body?.scheduleId);
  const travelDate = normalizeBusTravelDate(req.body?.travelDate || req.body?.date);
  const passenger = {
    name: toCleanString(req.body?.passenger?.name),
    age: Number(req.body?.passenger?.age || 0),
    gender: toCleanString(req.body?.passenger?.gender),
    phone: normalizePhone(req.body?.passenger?.phone),
    email: normalizeEmail(req.body?.passenger?.email),
  };
  const seatIds = Array.isArray(req.body?.seatIds)
    ? [...new Set(req.body.seatIds.map((item) => toCleanString(item)).filter(Boolean))]
    : [];

  if (!busServiceId || !scheduleId || seatIds.length === 0) {
    throw new ApiError(400, 'busServiceId, scheduleId and seatIds are required');
  }

  validateName(passenger.name);
  validatePhone(passenger.phone);
  validateEmail(passenger.email);

  if (!Number.isFinite(passenger.age) || passenger.age < 1 || passenger.age > 120) {
    throw new ApiError(400, 'Passenger age must be valid');
  }

  const busService = await BusService.findById(busServiceId).lean();
  if (!busService || String(busService.status || '') !== 'active') {
    throw new ApiError(404, 'Bus service not found');
  }

  const schedule = findBusSchedule(busService, scheduleId);
  if (!isScheduleAvailableOnDate(schedule, travelDate)) {
    throw new ApiError(404, 'Bus schedule not found for the selected date');
  }

  const availableSeatCells = flattenBusBlueprintSeats(busService.blueprint).filter(
    (seat) => String(seat.status || 'available') !== 'blocked',
  );
  const seatCellMap = new Map(availableSeatCells.map((seat) => [String(seat.id), seat]));
  const invalidSeat = seatIds.find((seatId) => !seatCellMap.has(seatId));
  if (invalidSeat) {
    throw new ApiError(400, `Seat ${invalidSeat} is not available for booking`);
  }

  const amount = Math.round(Number(busService.seatPrice || 0) * seatIds.length * 100) / 100;
  if (amount <= 0) {
    throw new ApiError(400, 'Bus fare is not configured');
  }

  const { keyId, keySecret } = await resolveRazorpayCredentials();
  const amountPaise = Math.round(amount * 100);
  const compactUserId = String(userId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'usr';
  const receipt = `ubus_${compactUserId}_${Date.now().toString(36)}`;

  const order = await razorpayRequest({
    method: 'POST',
    path: '/orders',
    body: {
      amount: amountPaise,
      currency: busService.fareCurrency || 'INR',
      receipt,
      notes: {
        userId: String(userId || ''),
        busServiceId,
        scheduleId,
        travelDate,
        seats: seatIds.join(','),
      },
    },
    keyId,
    keySecret,
  });

  const expiresAt = new Date(Date.now() + BUS_HOLD_MINUTES * 60 * 1000);
  const booking = await BusBooking.create({
    userId,
    busServiceId,
    bookingCode: createBusBookingCode(),
    scheduleId,
    travelDate,
    seatIds,
    seatLabels: seatIds.map((seatId) => seatCellMap.get(seatId)?.label || seatId),
    passenger,
    amount,
    currency: busService.fareCurrency || 'INR',
    status: 'pending',
    expiresAt,
    routeSnapshot: {
      originCity: busService.route?.originCity || '',
      destinationCity: busService.route?.destinationCity || '',
      departureTime: schedule.departureTime || '',
      arrivalTime: schedule.arrivalTime || '',
      durationHours: busService.route?.durationHours || '',
      busName: busService.busName || '',
      operatorName: busService.operatorName || '',
      coachType: busService.coachType || '',
      busCategory: busService.busCategory || '',
    },
    payment: {
      provider: 'razorpay',
      orderId: order.id,
      status: 'created',
    },
  });

  try {
    await BusSeatHold.insertMany(
      seatIds.map((seatId) => ({
        busServiceId,
        bookingId: booking._id,
        userId,
        scheduleId,
        travelDate,
        seatId,
        holdToken: booking.bookingCode,
        status: 'held',
        expiresAt,
      })),
      { ordered: true },
    );
  } catch (error) {
    await BusBooking.deleteOne({ _id: booking._id });
    if (error?.code === 11000) {
      throw new ApiError(409, 'One or more selected seats were just booked by someone else');
    }
    throw error;
  }

  res.status(201).json({
    success: true,
    data: {
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || busService.fareCurrency || 'INR',
      expiresAt,
      booking: serializeBusBooking(booking),
    },
  });
};

export const verifyBusBookingPayment = async (req, res) => {
  await ensureBusServiceEnabled();
  await cleanupExpiredBusSeatHolds();

  const orderId = String(req.body?.razorpay_order_id || '');
  const paymentId = String(req.body?.razorpay_payment_id || '');
  const signature = String(req.body?.razorpay_signature || '');

  if (!orderId || !paymentId || !signature) {
    throw new ApiError(400, 'Payment verification fields are required');
  }

  const { keySecret } = await resolveRazorpayCredentials();
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new ApiError(400, 'Invalid payment signature');
  }

  const booking = await BusBooking.findOne({
    userId: req.auth?.sub,
    'payment.orderId': orderId,
  });

  if (!booking) {
    throw new ApiError(404, 'Bus booking not found');
  }

  if (String(booking.status) === 'confirmed') {
    return res.status(200).json({
      success: true,
      data: serializeBusBooking(booking),
    });
  }

  if (String(booking.status) !== 'pending') {
    throw new ApiError(409, 'Bus booking is no longer payable');
  }

  if (booking.expiresAt && booking.expiresAt <= new Date()) {
    booking.status = 'expired';
    booking.payment.status = 'expired';
    await booking.save();
    await BusSeatHold.deleteMany({ bookingId: booking._id, status: 'held' });
    throw new ApiError(409, 'Seat hold expired before payment verification');
  }

  const holds = await BusSeatHold.find({
    bookingId: booking._id,
    status: 'held',
    expiresAt: { $gt: new Date() },
  }).lean();

  if (holds.length !== booking.seatIds.length) {
    booking.status = 'failed';
    booking.payment.status = 'seat_conflict';
    await booking.save();
    await BusSeatHold.deleteMany({ bookingId: booking._id, status: 'held' });
    throw new ApiError(409, 'Some selected seats are no longer reserved for this payment');
  }

  booking.status = 'confirmed';
  booking.payment.paymentId = paymentId;
  booking.payment.signature = signature;
  booking.payment.status = 'paid';
  booking.payment.paidAt = new Date();
  await booking.save();

  await BusSeatHold.updateMany(
    { bookingId: booking._id, status: 'held' },
    {
      $set: {
        status: 'booked',
        expiresAt: null,
      },
    },
  );

  res.status(201).json({
    success: true,
    data: serializeBusBooking(booking),
  });
};

export const createRentalQuoteRequest = async (req, res) => {
  const payload = req.body || {};
  const vehicleTypeId = String(payload.vehicleTypeId || '').trim();
  const contactName = toCleanString(payload.contactName);
  const contactPhone = normalizePhone(payload.contactPhone);
  const contactEmail = normalizeEmail(payload.contactEmail);
  const specialRequirements = toCleanString(payload.specialRequirements);
  const pickupLocation = toCleanString(payload.pickupLocation);
  const dropLocation = toCleanString(payload.dropLocation);
  const requestedHours = Math.max(0, Number(payload.requestedHours || 0));
  const seatsNeeded = Math.max(1, Number(payload.seatsNeeded || 1));
  const luggageNeeded = Math.max(0, Number(payload.luggageNeeded || 0));

  if (!mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
    throw new ApiError(400, 'Valid rental vehicle is required');
  }

  if (!contactName || contactName.length < 2) {
    throw new ApiError(400, 'Contact name is required');
  }

  validatePhone(contactPhone);
  validateEmail(contactEmail);

  const vehicle = await RentalVehicleType.findById(vehicleTypeId).lean();
  if (!vehicle || vehicle.active === false || vehicle.status !== 'active') {
    throw new ApiError(404, 'Rental vehicle not found');
  }

  const pickupDateTime = payload.pickupDateTime ? new Date(payload.pickupDateTime) : null;
  const returnDateTime = payload.returnDateTime ? new Date(payload.returnDateTime) : null;

  const request = await RentalQuoteRequest.create({
    userId: req.auth?.sub && mongoose.Types.ObjectId.isValid(req.auth.sub) ? req.auth.sub : null,
    vehicleTypeId,
    vehicleName: vehicle.name || '',
    vehicleCategory: vehicle.vehicleCategory || '',
    contactName,
    contactPhone,
    contactEmail,
    requestedHours,
    pickupDateTime: pickupDateTime && !Number.isNaN(pickupDateTime.getTime()) ? pickupDateTime : null,
    returnDateTime: returnDateTime && !Number.isNaN(returnDateTime.getTime()) ? returnDateTime : null,
    seatsNeeded,
    luggageNeeded,
    pickupLocation,
    dropLocation,
    specialRequirements,
    status: 'pending',
  });

  return res.status(201).json({
    success: true,
    data: serializeRentalQuoteRequest(request.toObject()),
    message: 'Rental quote request submitted successfully',
  });
};

export const createRentalBookingRequest = async (req, res) => {
  const payload = req.body || {};
  const vehicleTypeId = String(payload.vehicleTypeId || payload.vehicleId || '').trim();
  const bookingReference = toCleanString(payload.bookingReference) || `RNT-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const paymentStatus = toCleanString(payload.paymentStatus).toLowerCase() || 'pending';
  const paymentMethod = toCleanString(payload.paymentMethod).toLowerCase();
  const paymentMethodLabel = toCleanString(payload.paymentMethodLabel);
  const advancePaymentLabel = toCleanString(payload.advancePaymentLabel) || 'Advance booking payment';
  const totalCost = Math.max(0, Number(payload.totalCost || 0));
  const payableNow = Math.max(0, Number(payload.payableNow || payload.deposit || 0));
  const kycCompleted = Boolean(payload.kycCompleted);

  if (!mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
    throw new ApiError(400, 'Valid rental vehicle is required');
  }

  if (!['pending', 'paid', 'not_required', 'failed'].includes(paymentStatus)) {
    throw new ApiError(400, 'Invalid rental payment status');
  }

  const pickupDateTime = payload.pickupDateTime ? new Date(payload.pickupDateTime) : null;
  const returnDateTime = payload.returnDateTime ? new Date(payload.returnDateTime) : null;

  if (!pickupDateTime || Number.isNaN(pickupDateTime.getTime())) {
    throw new ApiError(400, 'Valid pickup date and time is required');
  }

  if (!returnDateTime || Number.isNaN(returnDateTime.getTime())) {
    throw new ApiError(400, 'Valid return date and time is required');
  }

  if (returnDateTime <= pickupDateTime) {
    throw new ApiError(400, 'Return date and time must be after pickup');
  }

  const [vehicle, user] = await Promise.all([
    RentalVehicleType.findById(vehicleTypeId).lean(),
    User.findById(req.auth?.sub).lean(),
  ]);

  if (!vehicle || vehicle.active === false || vehicle.status !== 'active') {
    throw new ApiError(404, 'Rental vehicle not found');
  }

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const requestedHours = Math.max(
    0,
    Math.round((((returnDateTime.getTime() - pickupDateTime.getTime()) / 3600000) + Number.EPSILON) * 100) / 100,
  );

  const selectedPackage = payload.selectedPackage || {};
  const serviceLocation = payload.serviceLocation || {};
  const paymentPayload = payload.payment || {};

  const update = {
    userId: user._id,
    bookingReference,
    vehicleTypeId,
    vehicleName: vehicle.name || '',
    vehicleCategory: vehicle.vehicleCategory || '',
    vehicleImage: vehicle.image || '',
    selectedPackage: {
      packageId: toCleanString(selectedPackage.id || selectedPackage.packageId || ''),
      label: toCleanString(selectedPackage.label),
      durationHours: Math.max(0, Number(selectedPackage.durationHours || 0)),
      price: Math.max(0, Number(selectedPackage.price || 0)),
    },
    serviceLocation: {
      locationId: toCleanString(serviceLocation.id || serviceLocation._id || serviceLocation.locationId || ''),
      name: toCleanString(serviceLocation.name),
      address: toCleanString(serviceLocation.address),
      city: toCleanString(serviceLocation.city || serviceLocation.country),
      latitude: Number.isFinite(Number(serviceLocation.latitude)) ? Number(serviceLocation.latitude) : null,
      longitude: Number.isFinite(Number(serviceLocation.longitude)) ? Number(serviceLocation.longitude) : null,
      distanceKm: Number.isFinite(Number(serviceLocation.distanceKm)) ? Number(serviceLocation.distanceKm) : null,
    },
    pickupDateTime,
    returnDateTime,
    requestedHours,
    totalCost,
    payableNow,
    advancePaymentLabel,
    paymentStatus,
    paymentMethod,
    paymentMethodLabel,
    payment: {
      provider: toCleanString(paymentPayload.provider),
      status: toCleanString(paymentPayload.status) || paymentStatus,
      amount: Math.max(0, Number(paymentPayload.amount || payableNow || 0)),
      currency: toCleanString(paymentPayload.currency) || 'INR',
      orderId: toCleanString(paymentPayload.orderId || paymentPayload.razorpay_order_id),
      paymentId: toCleanString(paymentPayload.paymentId || paymentPayload.razorpay_payment_id),
      signature: toCleanString(paymentPayload.signature || paymentPayload.razorpay_signature),
    },
    contactName: toCleanString(user.name),
    contactPhone: toCleanString(user.phone),
    contactEmail: toCleanString(user.email),
    kycCompleted,
  };

  const request = await RentalBookingRequest.findOneAndUpdate(
    { bookingReference, userId: user._id },
    {
      $set: update,
      $setOnInsert: {
        status: 'pending',
        adminNote: '',
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return res.status(201).json({
    success: true,
    data: serializeRentalBookingRequest(request),
    message: 'Rental booking request submitted successfully',
  });
};

export const getMyActiveRentalBooking = async (req, res) => {
  const item = await RentalBookingRequest.findOne({
    userId: req.auth?.sub,
    status: { $in: ['assigned', 'confirmed'] },
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  if (!item) {
    return res.status(200).json({
      success: true,
      data: null,
    });
  }

  const metrics = computeRentalRideMetrics(item);

  return res.status(200).json({
    success: true,
    data: {
      ...serializeRentalBookingRequest(item),
      rideMetrics: metrics,
    },
  });
};

export const endMyActiveRentalRide = async (req, res) => {
  const bookingId = String(req.params?.id || '').trim();

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApiError(400, 'Valid rental booking id is required');
  }

  const item = await RentalBookingRequest.findOne({
    _id: bookingId,
    userId: req.auth?.sub,
  });

  if (!item) {
    throw new ApiError(404, 'Rental booking not found');
  }

  if (!['assigned', 'confirmed'].includes(String(item.status || ''))) {
    throw new ApiError(409, 'This rental ride cannot be ended right now');
  }

  const completedAt = new Date();
  const metrics = computeRentalRideMetrics(item, completedAt);

  item.status = 'completed';
  item.completedAt = completedAt;
  item.finalCharge = metrics.currentCharge;
  item.finalElapsedMinutes = metrics.elapsedMinutes;

  await item.save();

  return res.status(200).json({
    success: true,
    data: {
      ...serializeRentalBookingRequest(item.toObject()),
      rideMetrics: {
        ...metrics,
        currentCharge: item.finalCharge,
      },
    },
    message: 'Rental ride ended successfully',
  });
};

export const listMyBusBookings = async (req, res) => {
  await ensureBusServiceEnabled();
  await cleanupExpiredBusSeatHolds();

  const page = toPositiveInteger(req.query?.page, 1);
  const limit = Math.min(20, toPositiveInteger(req.query?.limit, 10));
  const skip = (page - 1) * limit;
  const query = { userId: req.auth?.sub };

  const [total, items] = await Promise.all([
    BusBooking.countDocuments(query),
    BusBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.status(200).json({
    success: true,
    data: {
      results: items.map(serializeBusBooking),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
};
