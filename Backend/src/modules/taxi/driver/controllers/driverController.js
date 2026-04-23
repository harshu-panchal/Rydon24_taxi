import crypto from "node:crypto";
import QRCode from "qrcode";
import { ApiError } from "../../../../utils/ApiError.js";
import { normalizePoint, toPoint } from "../../../../utils/geo.js";
import { Driver } from "../models/Driver.js";
import { DriverLoginSession } from "../models/DriverLoginSession.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { Ride } from "../../user/models/Ride.js";
import { Owner } from "../../admin/models/Owner.js";
import { ServiceLocation } from "../../admin/models/ServiceLocation.js";
import { Vehicle } from "../../admin/models/Vehicle.js";
import { Notification } from "../../admin/promotions/models/Notification.js";
import { FleetVehicle } from "../../admin/models/FleetVehicle.js";
import {
  comparePassword,
  hashPassword,
  signAccessToken,
} from "../services/authService.js";
import { emitToDriver } from "../../services/dispatchService.js";
import { findZoneByPickup } from "../services/locationService.js";
import { listDriverServiceLocations } from "../services/serviceLocationService.js";
import {
  serializeDriverWallet,
  topUpDriverWallet,
} from "../services/walletService.js";
import {
  startDriverLoginOtp,
  verifyDriverLoginOtp,
} from "../services/loginOtpService.js";
import { verifyAccessToken } from "../../services/tokenService.js";
import { clearDriverActiveRideIfStale } from "../../services/rideService.js";
import { getWalletSettings } from "../../services/appSettingsService.js";
import { RIDE_STATUS } from "../../constants/index.js";
import {
  ensureThirdPartySettings,
  listDriverNeededDocuments,
} from "../../admin/services/adminService.js";
import { assignPushTokenToEntity } from "../../services/pushTokenService.js";
import {
  completeDriverOnboarding,
  getDriverOnboardingSession,
  saveDriverDocuments,
  saveDriverPersonalDetails,
  saveDriverReferral,
  saveDriverVehicle,
  startDriverOnboarding,
  verifyDriverOtp,
} from "../services/onboardingService.js";

const generateDriverReferralCode = (driver) => {
  const idPart = String(driver?._id || "")
    .slice(-6)
    .toUpperCase();
  const phonePart = String(driver?.phone || "").slice(-4);
  return `DRV${phonePart}${idPart}`.replace(/\W/g, "");
};

const MAX_EMERGENCY_CONTACTS = 5;
const EMERGENCY_CONTACT_NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const DRIVER_NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RAZORPAY_QR_MAX_AMOUNT = 500000;

const normalizePaymentAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "amount must be a positive number");
  }

  if (amount > RAZORPAY_QR_MAX_AMOUNT) {
    throw new ApiError(400, "amount is too large for QR collection");
  }

  return Math.round(amount * 100);
};

const getRazorpayEnvCredentials = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    throw new ApiError(500, "Razorpay credentials are not configured in backend .env");
  }

  return { keyId, keySecret };
};

const razorpayRequest = async ({ method, path, body }) => {
  const { keyId, keySecret } = getRazorpayEnvCredentials();
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status || 502,
      payload?.error?.description ||
        payload?.error?.message ||
        "Razorpay QR request failed",
      {
        provider: "razorpay",
        path,
        code: payload?.error?.code || null,
      },
    );
  }

  return payload;
};

const shouldFallbackToPaymentLinkQr = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.statusCode === 404 ||
    message.includes("requested url was not found") ||
    message.includes("qr") && message.includes("not") && message.includes("enabled")
  );
};

const shouldFallbackToStandardPaymentLink = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("upi payment links are not supported in test mode") ||
    message.includes("upi payment link") && message.includes("test mode")
  );
};

const buildPaymentLinkBody = ({ amountInPaise, rideId, driverId, serviceType, expireBy, referenceId, upiLink }) => ({
  ...(upiLink ? { upi_link: true } : {}),
  amount: amountInPaise,
  currency: "INR",
  accept_partial: false,
  expire_by: expireBy,
  reference_id: referenceId,
  description: `Taxi fare for ride ${rideId}`,
  reminder_enable: false,
  notes: {
    rideId: String(rideId),
    driverId: String(driverId),
    serviceType: serviceType || "ride",
    source: "driver_collect_amount",
    fallback: upiLink ? "upi_payment_link_qr" : "standard_payment_link_qr",
  },
});

const createPaymentLinkQr = async ({ amountInPaise, rideId, driverId, serviceType }) => {
  const referenceId = `ride_${String(rideId).slice(-18)}_${Date.now().toString(36)}`.slice(0, 40);
  const expireBy = Math.floor(Date.now() / 1000) + 30 * 60;
  let providerMode = "upi_payment_link_qr";
  let paymentLink;

  try {
    paymentLink = await razorpayRequest({
      method: "POST",
      path: "/payment_links",
      body: buildPaymentLinkBody({
        amountInPaise,
        rideId,
        driverId,
        serviceType,
        expireBy,
        referenceId,
        upiLink: true,
      }),
    });
  } catch (error) {
    if (!shouldFallbackToStandardPaymentLink(error)) {
      throw error;
    }

    providerMode = "standard_payment_link_qr";
    paymentLink = await razorpayRequest({
      method: "POST",
      path: "/payment_links",
      body: buildPaymentLinkBody({
        amountInPaise,
        rideId,
        driverId,
        serviceType,
        expireBy,
        referenceId: `${referenceId}_std`.slice(0, 40),
        upiLink: false,
      }),
    });
  }

  const paymentUrl = paymentLink.short_url || paymentLink.shortUrl || paymentLink.url;

  if (!paymentUrl) {
    throw new ApiError(502, "Razorpay payment link was created without a payment URL");
  }

  const imageUrl = await QRCode.toDataURL(paymentUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
  });

  return {
    id: paymentLink.id,
    entity: paymentLink.entity || "payment_link",
    status: paymentLink.status || "created",
    imageUrl,
    linkUrl: paymentUrl,
    amount: amountInPaise / 100,
    currency: "INR",
    description: paymentLink.description,
    closeBy: paymentLink.expire_by || expireBy,
    rawStatus: paymentLink.status || "created",
    providerMode,
  };
};

const PAYMENT_PAID_STATUSES = new Set(["paid", "captured", "completed"]);
const PAYMENT_OPEN_STATUSES = new Set(["created", "active", "issued", "partially_paid"]);

const normalizeCollectionStatus = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (PAYMENT_PAID_STATUSES.has(normalized)) {
    return "paid";
  }

  if (PAYMENT_OPEN_STATUSES.has(normalized)) {
    return normalized === "partially_paid" ? "active" : normalized;
  }

  if (normalized === "closed") {
    return "closed";
  }

  if (["cancelled", "canceled", "expired", "failed"].includes(normalized)) {
    return normalized === "canceled" ? "cancelled" : normalized;
  }

  return normalized || "pending";
};

const getPaymentCollectionPath = ({ providerId, providerMode }) => {
  if (!providerId) {
    throw new ApiError(400, "payment collection id is required");
  }

  if (String(providerMode || "").includes("payment_link")) {
    return `/payment_links/${providerId}`;
  }

  return `/payments/qr_codes/${providerId}`;
};

const serializeDriverPaymentCollection = (collection = {}) => {
  const status = normalizeCollectionStatus(collection.status);

  return {
    provider: collection.provider || "razorpay",
    id: collection.providerId || collection.id || "",
    providerMode: collection.providerMode || "",
    status,
    paid: PAYMENT_PAID_STATUSES.has(status),
    amount: Number(collection.amount || 0),
    currency: collection.currency || "INR",
    linkUrl: collection.linkUrl || "",
    paidAt: collection.paidAt || null,
    updatedAt: collection.updatedAt || null,
  };
};

const refreshDriverPaymentCollection = async (ride) => {
  const collection = ride?.driverPaymentCollection || {};
  const providerId = String(collection.providerId || "").trim();

  if (!providerId) {
    return serializeDriverPaymentCollection(collection);
  }

  const providerMode = collection.providerMode || "";
  const providerPayload = await razorpayRequest({
    method: "GET",
    path: getPaymentCollectionPath({ providerId, providerMode }),
  });
  const receivedAmount = Number(
    providerPayload?.amount_paid ||
      providerPayload?.amount_paid_total ||
      providerPayload?.payments_amount_received ||
      providerPayload?.amount_received ||
      0,
  );
  const expectedAmount = Number(collection.amount || 0) * 100;
  const isProviderAmountPaid = expectedAmount > 0 && receivedAmount >= expectedAmount;
  const providerStatus = normalizeCollectionStatus(providerPayload?.status);
  const isPaid = PAYMENT_PAID_STATUSES.has(providerStatus) || isProviderAmountPaid;
  const nextStatus = isPaid ? "paid" : providerStatus;
  const nextCollection = {
    provider: "razorpay",
    providerId,
    providerMode,
    status: nextStatus,
    amount: Number(collection.amount || 0),
    currency: collection.currency || "INR",
    linkUrl: collection.linkUrl || providerPayload?.short_url || providerPayload?.url || "",
    paidAt: isPaid ? collection.paidAt || new Date() : collection.paidAt || null,
    updatedAt: new Date(),
  };

  ride.driverPaymentCollection = nextCollection;
  await ride.save();

  return serializeDriverPaymentCollection(nextCollection);
};

const sanitizeEmergencyPhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(-10);

const serializeEmergencyContact = (contact = {}) => ({
  id: String(contact._id || contact.id || ""),
  name: String(contact.name || "").trim(),
  phone: sanitizeEmergencyPhone(contact.phone),
  source:
    String(contact.source || "manual").toLowerCase() === "device"
      ? "device"
      : "manual",
});

const resolveVehicleMapIcon = async (vehicleTypeId) => {
  if (!vehicleTypeId) {
    return "";
  }

  const vehicle = await Vehicle.findById(vehicleTypeId).select("icon map_icon image").lean();
  return vehicle?.map_icon || vehicle?.icon || vehicle?.image || "";
};

const normalizePhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

const isOwnerApproved = (owner) =>
  Boolean(owner) &&
  owner.active !== false &&
  (owner.approve === true ||
    String(owner.status || "").toLowerCase() === "approved");

const resolveOwnerForFleet = async (requester = {}) => {
  const onboardingRole = String(
    requester?.onboarding?.role || "",
  ).toLowerCase();
  const convertedOwnerId = requester?.onboarding?.convertedOwnerId || null;

  if (onboardingRole === "owner" && convertedOwnerId) {
    const owner = await Owner.findById(convertedOwnerId)
      .select("service_location_id active approve status")
      .lean();
    if (isOwnerApproved(owner)) return owner;
  }

  const mobile = String(requester?.phone || "").trim();
  const email = String(requester?.email || "")
    .trim()
    .toLowerCase();

  if (!mobile && !email) {
    return null;
  }

  const owner = await Owner.findOne({
    $or: [...(mobile ? [{ mobile }] : []), ...(email ? [{ email }] : [])],
  })
    .select("service_location_id active approve status")
    .lean();

  return isOwnerApproved(owner) ? owner : null;
};

const serializeDriverNotification = (item = {}) => ({
  id: String(item._id || ""),
  title: String(item.push_title || "").trim(),
  body: String(item.message || "").trim(),
  image: String(item.image || "").trim(),
  sendTo: String(item.send_to || "all").trim(),
  serviceLocationName: String(item.service_location_name || "").trim(),
  sentAt: item.sent_at || item.createdAt || null,
  createdAt: item.createdAt || null,
});

export const registerDriver = async (req, res) => {
  const { name, phone, password, vehicleType, location } = req.body;

  if (!name || !phone || !password || !vehicleType || !location) {
    throw new ApiError(
      400,
      "name, phone, password, vehicleType and location are required",
    );
  }

  const existingDriver = await Driver.findOne({ phone });

  if (existingDriver) {
    throw new ApiError(409, "Phone number is already registered");
  }

  const coordinates = normalizePoint(location, "location");
  const zone = await findZoneByPickup(coordinates);

  const driver = await Driver.create({
    name,
    phone,
    password: await hashPassword(password),
    vehicleType,
    approve: true,
    status: "approved",
    zoneId: zone?._id || null,
    location: toPoint(coordinates, "location"),
  });

  const token = signAccessToken({ sub: String(driver._id), role: "driver" });

  res.status(201).json({
    success: true,
    data: {
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        rating: driver.rating,
        status: driver.status,
      },
    },
  });
};

export const loginDriver = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    throw new ApiError(400, "phone and password are required");
  }

  const driver = await Driver.findOne({ phone }).select("+password");

  if (!driver || !(await comparePassword(password, driver.password))) {
    throw new ApiError(401, "Invalid phone or password");
  }

  if (
    driver.approve === false ||
    String(driver.status || "").toLowerCase() === "pending"
  ) {
    throw new ApiError(403, "Driver account is pending approval");
  }

  await clearDriverActiveRideIfStale(driver);

  const token = signAccessToken({ sub: String(driver._id), role: "driver" });

  res.json({
    success: true,
    data: {
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        isOnline: driver.isOnline,
        isOnRide: driver.isOnRide,
        status: driver.status,
      },
    },
  });
};

export const goOnline = async (req, res) => {
  const { location } = req.body;

  const coordinates = normalizePoint(location, "location");
  const zone = await findZoneByPickup(coordinates);
  const existingDriver = await Driver.findById(req.auth.sub);

  if (!existingDriver) {
    throw new ApiError(404, "Driver not found");
  }

  await clearDriverActiveRideIfStale(existingDriver);

  const driver = await Driver.findByIdAndUpdate(
    req.auth.sub,
    {
      isOnline: true,
      zoneId: zone?._id || null,
      location: toPoint(coordinates, "location"),
    },
    { returnDocument: 'after' },
  );

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const vehicleIconUrl = await resolveVehicleMapIcon(driver.vehicleTypeId);

  res.json({
    success: true,
    data: {
      ...driver.toObject(),
      vehicleIconUrl,
    },
  });
};

export const getCurrentDriver = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  if (!String(driver.referralCode || "").trim()) {
    driver.referralCode = generateDriverReferralCode(driver);
    await driver.save();
  }

  await clearDriverActiveRideIfStale(driver);
  const vehicleIconUrl = await resolveVehicleMapIcon(driver.vehicleTypeId);

  res.json({
    success: true,
    data: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      profileImage: driver.profileImage || "",
      gender: driver.gender,
      vehicleType: driver.vehicleType,
      vehicleTypeId: driver.vehicleTypeId,
      vehicleIconType: driver.vehicleIconType,
      vehicleIconUrl,
      vehicleMake: driver.vehicleMake,
      vehicleModel: driver.vehicleModel,
      registerFor: driver.registerFor,
      vehicleNumber: driver.vehicleNumber,
      vehicleColor: driver.vehicleColor,
      vehicleImage: driver.vehicleImage || "",
      city: driver.city,
      approve: driver.approve,
      status: driver.status,
      rating: driver.rating,
      wallet: await serializeDriverWallet(driver),
      referralCode: driver.referralCode || "",
      deletionRequest: driver.deletionRequest || { status: "none" },
      isOnline: driver.isOnline,
      isOnRide: driver.isOnRide,
      location: driver.location,
      zoneId: driver.zoneId,
      documents: driver.documents || {},
      emergencyContacts: Array.isArray(driver.emergencyContacts)
        ? driver.emergencyContacts.map(serializeEmergencyContact)
        : [],
      onboarding: driver.onboarding || {},
    },
  });
};

export const getDriverEmergencyContacts = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub).lean();

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  res.json({
    success: true,
    data: {
      results: Array.isArray(driver.emergencyContacts)
        ? driver.emergencyContacts.map(serializeEmergencyContact)
        : [],
      limit: MAX_EMERGENCY_CONTACTS,
    },
  });
};

export const getDriverNotifications = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub).lean();

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const serviceLocationId = driver.service_location_id || null;
  const query = {
    status: "sent",
    send_to: { $in: ["all", "drivers"] },
  };

  if (serviceLocationId) {
    query.$or = [
      { service_location_id: serviceLocationId },
      { send_to: "all" },
      { send_to: "drivers" },
    ];
  }

  const notifications = await Notification.find(query)
    .sort({ sent_at: -1, createdAt: -1 })
    .limit(100)
    .lean();

  res.json({
    success: true,
    data: {
      results: notifications.map(serializeDriverNotification),
    },
  });
};

export const saveDriverFcmToken = async (req, res) => {
  const driver = await Driver.findById(req.auth?.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  if (
    driver.approve === false ||
    String(driver.status || "").toLowerCase() === "pending"
  ) {
    throw new ApiError(403, "Driver account is pending approval");
  }

  const saved = assignPushTokenToEntity(driver, {
    token: req.body?.token,
    platform: req.body?.platform,
  });

  await driver.save();

  res.json({
    success: true,
    data: {
      message: "FCM token saved successfully",
      platform: saved.platform,
      field: saved.fieldName,
    },
  });
};

export const addDriverEmergencyContact = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const phone = sanitizeEmergencyPhone(req.body?.phone);
  const source =
    String(req.body?.source || "manual").toLowerCase() === "device"
      ? "device"
      : "manual";

  if (!name) {
    throw new ApiError(400, "Contact name is required");
  }

  if (!EMERGENCY_CONTACT_NAME_REGEX.test(name)) {
    throw new ApiError(400, "Contact name can contain alphabets only");
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError(400, "A valid 10-digit contact number is required");
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const existingContacts = Array.isArray(driver.emergencyContacts)
    ? driver.emergencyContacts
    : [];

  if (existingContacts.length >= MAX_EMERGENCY_CONTACTS) {
    throw new ApiError(
      400,
      `You can add up to ${MAX_EMERGENCY_CONTACTS} emergency contacts`,
    );
  }

  if (
    existingContacts.some(
      (contact) => sanitizeEmergencyPhone(contact.phone) === phone,
    )
  ) {
    throw new ApiError(409, "This contact number is already added");
  }

  driver.emergencyContacts = [
    ...existingContacts,
    {
      name: name.slice(0, 80),
      phone,
      source,
    },
  ];

  await driver.save();

  const addedContact =
    driver.emergencyContacts[driver.emergencyContacts.length - 1];

  res.status(201).json({
    success: true,
    data: serializeEmergencyContact(addedContact),
  });
};

export const deleteDriverEmergencyContact = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const existingContacts = Array.isArray(driver.emergencyContacts)
    ? driver.emergencyContacts
    : [];
  const nextContacts = existingContacts.filter(
    (contact) => String(contact._id) !== String(req.params.contactId),
  );

  if (nextContacts.length === existingContacts.length) {
    throw new ApiError(404, "Emergency contact not found");
  }

  driver.emergencyContacts = nextContacts;
  await driver.save();

  res.json({
    success: true,
    data: {
      deleted: true,
      results: driver.emergencyContacts.map(serializeEmergencyContact),
    },
  });
};

export const updateCurrentDriver = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
    const name = String(req.body.name || "").trim();
    if (!DRIVER_NAME_REGEX.test(name)) {
      throw new ApiError(400, "Full name can contain alphabets only");
    }
    driver.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "email")) {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    if (email && !EMAIL_REGEX.test(email)) {
      throw new ApiError(400, "Enter a valid email address");
    }
    driver.email = email;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "profileImage")) {
    driver.profileImage = String(req.body.profileImage || "").trim();
  }

  await driver.save();

  res.json({
    success: true,
    data: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      profileImage: driver.profileImage || "",
    },
  });
};

export const requestDriverAccountDeletion = async (req, res) => {
  const driverId = req.auth?.sub;
  const reason = String(req.body?.reason || "").trim();

  if (!reason) {
    throw new ApiError(400, "Deletion reason is required");
  }

  const driver = await Driver.findById(driverId);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  if (
    driver.deletedAt ||
    driver.approve === false ||
    String(driver.status || "").toLowerCase() === "inactive"
  ) {
    throw new ApiError(400, "Account is already inactive");
  }

  if (driver.deletionRequest?.status === "pending") {
    res.json({
      success: true,
      data: {
        deletionRequestStatus: "pending",
        requestedAt: driver.deletionRequest.requestedAt || null,
      },
      message: "Deletion request is already pending admin review",
    });
    return;
  }

  driver.deletionRequest = {
    status: "pending",
    reason: reason.slice(0, 300),
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    adminNote: "",
  };

  await driver.save();

  res.status(201).json({
    success: true,
    data: {
      deletionRequestStatus: driver.deletionRequest.status,
      requestedAt: driver.deletionRequest.requestedAt,
    },
  });
};

export const updateCurrentDriverDocument = async (req, res) => {
  const documentKey = String(req.params.documentKey || "").trim();
  const document = req.body?.document || {};

  if (!documentKey) {
    throw new ApiError(400, "Document key is required");
  }

  const previewUrl = String(
    document.previewUrl || document.secureUrl || document.url || "",
  ).trim();

  if (!previewUrl) {
    throw new ApiError(400, "Uploaded document image URL is required");
  }

  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const updatedDocument = {
    ...(typeof document === "object" ? document : {}),
    key: documentKey,
    fileName: String(document.fileName || documentKey).trim(),
    uploaded: true,
    uploadedAt: new Date().toISOString(),
    previewUrl,
    secureUrl: String(document.secureUrl || previewUrl).trim(),
  };

  driver.documents = {
    ...(driver.documents || {}),
    [documentKey]: updatedDocument,
  };

  driver.markModified("documents");
  await driver.save();

  res.json({
    success: true,
    data: {
      document: updatedDocument,
      documents: driver.documents || {},
    },
  });
};

export const deleteCurrentDriverAccount = async (req, res) => {
  const driverId = req.auth?.sub;

  const activeRide = await Ride.findOne({
    driverId,
    status: { $in: [RIDE_STATUS.ACCEPTED, RIDE_STATUS.ONGOING] },
  }).select("_id status");

  if (activeRide) {
    throw new ApiError(409, "Complete or cancel your active ride before deleting your account");
  }

  const deletedDriver = await Driver.findByIdAndDelete(driverId);

  if (!deletedDriver) {
    throw new ApiError(404, "Driver not found");
  }

  await DriverLoginSession.deleteMany({
    $or: [
      { driverId: deletedDriver._id },
      { phone: deletedDriver.phone },
    ],
  });

  res.json({
    success: true,
    data: {
      deleted: true,
      driverId: String(deletedDriver._id),
    },
    message: "Driver account deleted successfully",
  });
};

export const getMyWallet = async (req, res) => {
  const driver = await Driver.findById(req.auth.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const transactions = await WalletTransaction.find({ driverId: req.auth.sub })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const walletSettings = await getWalletSettings();

  res.json({
    success: true,
    data: {
      wallet: await serializeDriverWallet(driver),
      transactions,
      settings: walletSettings,
    },
  });
};

export const topUpMyWallet = async (req, res) => {
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "amount must be greater than zero");
  }

  const result = await topUpDriverWallet({
    driverId: req.auth.sub,
    amount,
    metadata: {
      source: req.body.source || "manual",
      referenceId: req.body.referenceId || null,
    },
  });

  const payload = {
    wallet: result.wallet,
    transaction: result.transaction,
  };

  emitToDriver(req.auth.sub, "driver:wallet:updated", payload);

  res.json({
    success: true,
    data: payload,
  });
};

export const createDriverPaymentQr = async (req, res) => {
  const amountInPaise = normalizePaymentAmount(req.body.amount);
  const rideId = String(req.body.rideId || "").trim();

  if (!rideId) {
    throw new ApiError(400, "rideId is required");
  }

  const ride = await Ride.findOne({
    _id: rideId,
    driverId: req.auth.sub,
  })
    .select("_id fare paymentMethod serviceType driverPaymentCollection");

  if (!ride) {
    throw new ApiError(404, "Ride not found for this driver");
  }

  let payload;

  try {
    const qr = await razorpayRequest({
      method: "POST",
      path: "/payments/qr_codes",
      body: {
        type: "upi_qr",
        name: "Appzeto Taxi Fare",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: amountInPaise,
        description: `Taxi fare for ride ${rideId}`,
        close_by: Math.floor(Date.now() / 1000) + 30 * 60,
        notes: {
          rideId,
          driverId: String(req.auth.sub),
          serviceType: ride.serviceType || "ride",
          source: "driver_collect_amount",
        },
      },
    });

    payload = {
      id: qr.id,
      entity: qr.entity,
      status: qr.status,
      imageUrl: qr.image_url,
      linkUrl: qr.image_url,
      amount: amountInPaise / 100,
      currency: "INR",
      description: qr.description,
      closeBy: qr.close_by || null,
      rawStatus: qr.status,
      providerMode: "razorpay_qr",
    };
  } catch (error) {
    if (!shouldFallbackToPaymentLinkQr(error)) {
      throw error;
    }

    payload = await createPaymentLinkQr({
      amountInPaise,
      rideId,
      driverId: req.auth.sub,
      serviceType: ride.serviceType,
    });
  }

  ride.driverPaymentCollection = {
    provider: "razorpay",
    providerId: payload.id,
    providerMode: payload.providerMode,
    status: normalizeCollectionStatus(payload.rawStatus || payload.status),
    amount: payload.amount,
    currency: payload.currency || "INR",
    linkUrl: payload.linkUrl || "",
    paidAt: null,
    updatedAt: new Date(),
  };
  await ride.save();

  res.json({
    success: true,
    data: payload,
  });
};

const resolveRazorpayCredentials = async () => {
  const envKeyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const envKeySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  const envEnabled = String(process.env.RAZORPAY_ENABLED || "").trim();

  // Prefer backend .env credentials when present unless they are explicitly disabled.
  if (envEnabled !== "0" && envKeyId && envKeySecret) {
    return { keyId: envKeyId, keySecret: envKeySecret };
  }

  const settings = await ensureThirdPartySettings();
  const razorpay = settings?.payment?.razor_pay || {};

  const enabled = String(razorpay.enabled ?? "0") === "1";
  if (!enabled) {
    settings.payment = settings.payment || {};
    settings.payment.razor_pay = {
      ...razorpay,
      enabled: "1",
      environment: razorpay.environment || "test",
    };
    settings.markModified("payment");
    await settings.save();
  }

  const environment = String(razorpay.environment || "test").toLowerCase();
  const isLive = environment === "live";

  const keyId = String(
    isLive ? razorpay.live_api_key : razorpay.test_api_key || "",
  );
  const keySecret = String(
    isLive ? razorpay.live_secret_key : razorpay.test_secret_key || "",
  );

  if (!keyId || !keySecret) {
    throw new ApiError(500, "Razorpay credentials are not configured");
  }

  if (
    keyId.toLowerCase().includes("demo") ||
    keySecret.toLowerCase().includes("demo")
  ) {
    throw new ApiError(
      500,
      "Razorpay keys are demo placeholders. Configure real keys in Admin > Payment Gateways",
    );
  }

  return { keyId, keySecret };
};

const fetchRazorpay = async ({ method, path, body, keyId, keySecret }) => {
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status || 502,
      payload?.error?.description ||
        payload?.error?.message ||
        "Razorpay request failed",
    );
  }

  return payload;
};

export const createDriverWalletTopupOrder = async (req, res) => {
  const settings = await getWalletSettings();
  const minTopUp = Number(settings.minimum_amount_added_to_wallet || 0);
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Invalid top-up amount");
  }

  if (amount < minTopUp) {
    throw new ApiError(400, `Minimum top-up amount is Rs ${minTopUp}`);
  }

  const { keyId, keySecret } = await resolveRazorpayCredentials();

  const amountPaise = Math.round(amount * 100);
  const driverId = String(req.auth?.sub || "");
  const compactDriverId = driverId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "drv";
  const receipt = `dwal_${compactDriverId}_${Date.now().toString(36)}`;

  const order = await fetchRazorpay({
    method: "POST",
    path: "/orders",
    body: {
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { driverId },
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
      currency: order.currency || "INR",
    },
  });
};

export const verifyDriverWalletTopup = async (req, res) => {
  const orderId = String(req.body?.razorpay_order_id || "");
  const paymentId = String(req.body?.razorpay_payment_id || "");
  const signature = String(req.body?.razorpay_signature || "");

  if (!orderId || !paymentId || !signature) {
    throw new ApiError(400, "Payment verification fields are required");
  }

  const { keyId, keySecret } = await resolveRazorpayCredentials();

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new ApiError(400, "Invalid payment signature");
  }

  const order = await fetchRazorpay({
    method: "GET",
    path: `/orders/${encodeURIComponent(orderId)}`,
    keyId,
    keySecret,
  });

  const amountPaise = Number(order?.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new ApiError(400, "Invalid order amount");
  }

  const amount = Math.round(amountPaise) / 100;
  const driverId = req.auth?.sub;

  const alreadyCredited = await WalletTransaction.findOne({
    driverId,
    "metadata.providerPaymentId": paymentId,
  })
    .select("_id")
    .lean();

  if (alreadyCredited) {
    const driver = await Driver.findById(driverId);
    res.json({
      success: true,
      data: {
        wallet: await serializeDriverWallet(driver),
      },
    });
    return;
  }

  const result = await topUpDriverWallet({
    driverId,
    amount,
    metadata: {
      source: "razorpay",
      provider: "razorpay",
      providerOrderId: orderId,
      providerPaymentId: paymentId,
    },
  });

  const payload = {
    wallet: result.wallet,
    transaction: result.transaction,
  };

  emitToDriver(driverId, "driver:wallet:updated", payload);

  res.json({
    success: true,
    data: payload,
  });
};


export const getDriverPaymentQrStatus = async (req, res) => {
  const rideId = String(req.query.rideId || req.params.rideId || "").trim();

  if (!rideId) {
    throw new ApiError(400, "rideId is required");
  }

  const ride = await Ride.findOne({
    _id: rideId,
    driverId: req.auth.sub,
  }).select("_id driverPaymentCollection");

  if (!ride) {
    throw new ApiError(404, "Ride not found for this driver");
  }

  if (!ride.driverPaymentCollection?.providerId) {
    res.json({
      success: true,
      data: serializeDriverPaymentCollection(ride.driverPaymentCollection),
    });
    return;
  }

  const collection = await refreshDriverPaymentCollection(ride);

  res.json({
    success: true,
    data: collection,
  });
};

const getGenericVehicleType = (vehicle = {}) => {
  const value = String(vehicle.icon_types || vehicle.name || "").toLowerCase();

  if (value.includes("bike")) {
    return "bike";
  }

  if (value.includes("auto")) {
    return "auto";
  }

  return "car";
};

export const updateDriverVehicle = async (req, res) => {
  const {
    vehicleTypeId,
    vehicleNumber,
    vehicleColor,
    vehicleMake,
    vehicleModel,
    vehicleImage,
  } = req.body;

  let selectedVehicle = null;

  if (vehicleTypeId) {
    selectedVehicle = await Vehicle.findById(vehicleTypeId);

    if (
      !selectedVehicle ||
      selectedVehicle.active === false ||
      Number(selectedVehicle.status) === 0
    ) {
      throw new ApiError(404, "Active vehicle type not found");
    }
  }

  const update = {};

  if (selectedVehicle) {
    update.vehicleTypeId = selectedVehicle._id;
    update.vehicleType = getGenericVehicleType(selectedVehicle);
    update.vehicleIconType = selectedVehicle.icon_types || update.vehicleType;
  }

  if (vehicleNumber !== undefined) {
    update.vehicleNumber = String(vehicleNumber || "")
      .trim()
      .toUpperCase();
  }
  if (vehicleColor !== undefined) {
    update.vehicleColor = String(vehicleColor || "").trim();
  }
  if (vehicleMake !== undefined) {
    update.vehicleMake = String(vehicleMake || "").trim();
  }
  if (vehicleModel !== undefined) {
    update.vehicleModel = String(vehicleModel || "").trim();
  }
  if (vehicleImage !== undefined) {
    update.vehicleImage = String(vehicleImage || "").trim();
  }

  const driver = await Driver.findByIdAndUpdate(req.auth.sub, update, {
    returnDocument: 'after',
  });

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  const vehicleIconUrl = await resolveVehicleMapIcon(driver.vehicleTypeId);

  res.json({
    success: true,
    data: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      vehicleType: driver.vehicleType,
      vehicleTypeId: driver.vehicleTypeId,
      vehicleIconType: driver.vehicleIconType,
      vehicleIconUrl,
      vehicleMake: driver.vehicleMake,
      vehicleModel: driver.vehicleModel,
      vehicleNumber: driver.vehicleNumber,
      vehicleColor: driver.vehicleColor,
      vehicleImage: driver.vehicleImage || "",
      registerFor: driver.registerFor,
      approve: driver.approve,
      status: driver.status,
      isOnline: driver.isOnline,
      isOnRide: driver.isOnRide,
    },
  });
};

export const getDriverApprovalStatus = async (req, res) => {
  const authorization = req.headers.authorization || "";
  const [, token] = authorization.split(" ");

  if (!token) {
    throw new ApiError(401, "Authorization token is required");
  }

  const payload = verifyAccessToken(token);

  if (payload.role !== "driver") {
    throw new ApiError(403, "Insufficient permissions for this resource");
  }

  const driver = await Driver.findById(payload.sub);

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  res.json({
    success: true,
    data: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      approve: driver.approve,
      status: driver.status,
      isOnline: driver.isOnline,
      isOnRide: driver.isOnRide,
    },
  });
};

export const getServiceLocations = async (_req, res) => {
  const results = await listDriverServiceLocations();

  res.json({
    success: true,
    data: { results },
  });
};

export const getDriverDocumentTemplates = async (_req, res) => {
  const results = await listDriverNeededDocuments({
    activeOnly: true,
    includeFields: true,
  });

  res.json({
    success: true,
    data: { results },
  });
};

export const addOwnerVehicle = async (req, res) => {
  const requester = await Driver.findById(req.auth.sub)
    .select("onboarding phone email service_location_id")
    .lean();

  if (!requester) {
    throw new ApiError(404, "Driver not found");
  }

  const owner = await resolveOwnerForFleet(requester);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Vehicle addition is only available for owner accounts",
    );
  }

  const { vehicleTypeId, make, model, number, color, rcFile } = req.body;

  if (!make?.trim()) {
    throw new ApiError(400, "Car brand/make is required");
  }

  if (!model?.trim()) {
    throw new ApiError(400, "Car model is required");
  }

  if (!number?.trim()) {
    throw new ApiError(400, "License plate number is required");
  }

  if (!color?.trim()) {
    throw new ApiError(400, "Car color is required");
  }

  const normalizedPlate = String(number).trim().toUpperCase();

  // Check for duplicate license plate for this owner
  const existing = await FleetVehicle.findOne({
    owner_id: owner._id,
    license_plate_number: normalizedPlate,
  }).lean();

  if (existing) {
    throw new ApiError(
      409,
      "Fleet vehicle with this license plate already exists for this owner",
    );
  }

  // Get service location from owner or use first available
  let serviceLocationId = owner.service_location_id;
  if (!serviceLocationId) {
    const defaultLocation = await ServiceLocation.findOne({ active: true })
      .select("_id")
      .lean();
    if (!defaultLocation) {
      throw new ApiError(400, "No service location available");
    }
    serviceLocationId = defaultLocation._id;
  }

  const vehicle = await FleetVehicle.create({
    owner_id: owner._id,
    service_location_id: serviceLocationId,
    transport_type: "taxi",
    vehicle_type_id:
      vehicleTypeId && String(vehicleTypeId).trim() ? vehicleTypeId : null,
    car_brand: String(make).trim(),
    car_model: String(model).trim(),
    license_plate_number: normalizedPlate,
    car_color: String(color).trim(),
    status: "pending",
    active: true,
    documents: rcFile ? { rc: rcFile } : {},
  });

  const populated = await FleetVehicle.findById(vehicle._id)
    .populate("owner_id", "company_name owner_name name email mobile")
    .populate("service_location_id", "service_location_name name country")
    .populate("vehicle_type_id", "name type_name transport_type icon_types")
    .lean();

  res.status(201).json({
    success: true,
    message: "Vehicle added successfully and is pending approval",
    data: {
      id: String(populated._id),
      owner_id: String(populated.owner_id?._id || ""),
      owner_name:
        populated.owner_id?.company_name ||
        populated.owner_id?.owner_name ||
        populated.owner_id?.name ||
        "",
      service_location_id: String(populated.service_location_id?._id || ""),
      service_location_name:
        populated.service_location_id?.service_location_name ||
        populated.service_location_id?.name ||
        "",
      transport_type: populated.transport_type,
      vehicle_type_id: String(populated.vehicle_type_id?._id || ""),
      vehicle_type_name:
        populated.vehicle_type_id?.name ||
        populated.vehicle_type_id?.type_name ||
        "",
      car_brand: populated.car_brand,
      car_model: populated.car_model,
      license_plate_number: populated.license_plate_number,
      car_color: populated.car_color,
      status: populated.status,
      active: populated.active,
      createdAt: populated.createdAt,
    },
  });
};

export const getOwnerFleetVehicles = async (req, res) => {
  const requester = await Driver.findById(req.auth.sub)
    .select("onboarding phone email")
    .lean();

  if (!requester) {
    throw new ApiError(404, "Driver not found");
  }

  const owner = await resolveOwnerForFleet(requester);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet vehicle access is only available for owner accounts",
    );
  }

  const vehicles = await FleetVehicle.find({
    owner_id: owner._id,
    active: true,
  })
    .populate("vehicle_type_id", "name type_name transport_type icon_types")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: {
      results: vehicles.map((vehicle) => ({
        _id: String(vehicle._id),
        id: String(vehicle._id),
        vehicle_type_id: vehicle.vehicle_type_id?._id || null,
        vehicle_type_name:
          vehicle.vehicle_type_id?.name ||
          vehicle.vehicle_type_id?.type_name ||
          "",
        car_brand: vehicle.car_brand || "",
        car_model: vehicle.car_model || "",
        license_plate_number: vehicle.license_plate_number || "",
        car_color: vehicle.car_color || "",
        status: vehicle.status || "pending",
        transport_type: vehicle.transport_type || "taxi",
        active: vehicle.active,
        createdAt: vehicle.createdAt,
      })),
    },
  });
};

export const deleteOwnerFleetVehicle = async (req, res) => {
  const requester = await Driver.findById(req.auth.sub)
    .select("onboarding phone email")
    .lean();

  if (!requester) {
    throw new ApiError(404, "Driver not found");
  }

  const owner = await resolveOwnerForFleet(requester);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet vehicle access is only available for owner accounts",
    );
  }

  const vehicle = await FleetVehicle.findOne({
    _id: req.params.vehicleId,
    owner_id: owner._id,
  });

  if (!vehicle) {
    throw new ApiError(404, "Fleet vehicle not found");
  }

  await FleetVehicle.deleteOne({ _id: vehicle._id });

  res.json({
    success: true,
    message: "Vehicle deleted successfully",
    data: { deleted: true },
  });
};

export const getOwnerFleetDrivers = async (req, res) => {
  const requester = await Driver.findById(req.auth.sub)
    .select("onboarding phone email")
    .lean();

  if (!requester) {
    throw new ApiError(404, "Driver not found");
  }

  const owner = await resolveOwnerForFleet(requester);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet driver access is only available for owner accounts",
    );
  }

  const drivers = await Driver.find({ owner_id: owner._id, deletedAt: null })
    .sort({ createdAt: -1 })
    .select("name phone email city approve status isOnline isOnRide createdAt")
    .lean();

  res.json({
    success: true,
    data: {
      results: drivers.map((driver) => ({
        id: String(driver._id),
        name: driver.name || "",
        phone: driver.phone || "",
        email: driver.email || "",
        city: driver.city || "",
        approve: driver.approve,
        status: driver.status,
        isOnline: Boolean(driver.isOnline),
        isOnRide: Boolean(driver.isOnRide),
        createdAt: driver.createdAt,
      })),
    },
  });
};

export const createOwnerFleetDriver = async (req, res) => {
  const requester = await Driver.findById(req.auth.sub)
    .select("onboarding phone email")
    .lean();

  if (!requester) {
    throw new ApiError(404, "Driver not found");
  }

  const owner = await resolveOwnerForFleet(requester);

  if (!owner?._id) {
    throw new ApiError(
      403,
      "Fleet driver access is only available for owner accounts",
    );
  }

  const name = String(req.body?.name || "").trim();
  const phone = normalizePhone(req.body?.phone || req.body?.mobile);
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  if (!name) {
    throw new ApiError(400, "name is required");
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError(400, "A valid 10-digit mobile number is required");
  }

  const existing = await Driver.findOne({ phone }).lean();
  if (existing) {
    throw new ApiError(409, "Phone number is already registered");
  }

  const serviceLocation = owner.service_location_id
    ? await ServiceLocation.findById(owner.service_location_id).lean()
    : null;
  const coordinates =
    Array.isArray(serviceLocation?.location?.coordinates) &&
    serviceLocation.location.coordinates.length === 2
      ? serviceLocation.location.coordinates
      : typeof serviceLocation?.longitude === "number" &&
          typeof serviceLocation?.latitude === "number"
        ? [serviceLocation.longitude, serviceLocation.latitude]
        : [75.8577, 22.7196];

  const city =
    String(req.body?.city || "").trim() ||
    String(
      serviceLocation?.service_location_name || serviceLocation?.name || "",
    ).trim() ||
    "";

  const tempPassword = crypto.randomUUID().slice(0, 12);

  const driver = await Driver.create({
    owner_id: owner._id,
    service_location_id: owner.service_location_id || null,
    name,
    phone,
    email,
    gender: "",
    password: await hashPassword(tempPassword),
    vehicleType: "car",
    vehicleIconType: "car",
    registerFor: "taxi",
    vehicleNumber: "",
    vehicleColor: "",
    city,
    approve: false,
    status: "pending",
    location: toPoint(coordinates, "location"),
  });

  res.status(201).json({
    success: true,
    data: {
      id: String(driver._id),
      message: "Fleet driver request created",
    },
  });
};

export const startDriverLoginOtpRequest = async (req, res) => {
  const result = await startDriverLoginOtp(req.body);
  res.status(201).json({ success: true, data: result });
};

export const verifyDriverLoginOtpRequest = async (req, res) => {
  const result = await verifyDriverLoginOtp(req.body);
  res.json({ success: true, data: result });
};

export const startOnboarding = async (req, res) => {
  const result = await startDriverOnboarding(req.body);
  res.status(201).json({ success: true, data: result });
};

export const verifyOnboardingOtp = async (req, res) => {
  const result = await verifyDriverOtp(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingPersonal = async (req, res) => {
  const result = await saveDriverPersonalDetails(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingReferral = async (req, res) => {
  const result = await saveDriverReferral(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingVehicle = async (req, res) => {
  const result = await saveDriverVehicle(req.body);
  res.json({ success: true, data: result });
};

export const saveOnboardingDocuments = async (req, res) => {
  const result = await saveDriverDocuments(req.body);
  res.json({ success: true, data: result });
};

export const completeOnboarding = async (req, res) => {
  const result = await completeDriverOnboarding(req.body);
  res.status(201).json({ success: true, data: result });
};

export const getOnboardingSession = async (req, res) => {
  const result = await getDriverOnboardingSession({
    registrationId: req.params.registrationId,
    phone: req.query.phone,
  });
  res.json({ success: true, data: result });
};

export const goOffline = async (req, res) => {
  const driver = await Driver.findByIdAndUpdate(
    req.auth.sub,
    {
      isOnline: false,
      socketId: null,
    },
    { returnDocument: 'after' },
  );

  if (!driver) {
    throw new ApiError(404, "Driver not found");
  }

  res.json({
    success: true,
    data: driver,
  });
};
