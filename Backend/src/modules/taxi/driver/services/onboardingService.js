import crypto from 'node:crypto';
import { ApiError } from '../../../../utils/ApiError.js';
import { normalizePoint, toPoint } from '../../../../utils/geo.js';
import { uploadDataUrlToCloudinary } from '../../../../utils/cloudinaryUpload.js';
import { Driver } from '../models/Driver.js';
import { DriverRegistrationSession } from '../models/DriverRegistrationSession.js';
import { ServiceLocation } from '../../admin/models/ServiceLocation.js';
import { Vehicle } from '../../admin/models/Vehicle.js';
import { listDriverDocumentUploadFields } from '../../admin/services/adminService.js';
import { hashPassword, signAccessToken } from './authService.js';
import { findZoneByPickup } from './locationService.js';
import { sendOtpSms } from '../../services/smsService.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DRIVER_NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;

const VEHICLE_TYPE_MAP = {
  v1: 'bike',
  v2: 'car',
  v3: 'auto',
  bike: 'bike',
  cab: 'car',
  car: 'car',
  auto: 'auto',
  taxi: 'car',
};

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').trim();

const normalizeRole = (role) => (String(role || 'driver').toLowerCase() === 'owner' ? 'owner' : 'driver');
const matchesDocumentRole = (accountType, role) => {
  const normalizedAccountType = String(accountType || 'individual').trim().toLowerCase();
  const normalizedRole = normalizeRole(role);

  if (normalizedAccountType === 'both') {
    return true;
  }

  if (normalizedRole === 'owner') {
    return normalizedAccountType === 'fleet_drivers';
  }

  return normalizedAccountType === 'individual';
};

const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const getVehicleType = (vehicleTypeId, registerFor = '') => {
  const type = VEHICLE_TYPE_MAP[String(vehicleTypeId || registerFor || '').trim().toLowerCase()];
  return type || 'car';
};

const getGenericVehicleTypeFromCatalog = (vehicle = {}) => {
  const value = String(vehicle.icon_types || vehicle.name || '').trim().toLowerCase();

  if (value.includes('bike')) {
    return 'bike';
  }

  if (value.includes('auto')) {
    return 'auto';
  }

  return 'car';
};

const getServiceLocationName = (serviceLocation = {}) =>
  String(serviceLocation.service_location_name || serviceLocation.name || '').trim();

const getServiceLocationCoordinates = (serviceLocation = {}) => {
  if (Array.isArray(serviceLocation?.location?.coordinates) && serviceLocation.location.coordinates.length === 2) {
    return serviceLocation.location.coordinates;
  }

  if (
    typeof serviceLocation?.longitude === 'number' &&
    typeof serviceLocation?.latitude === 'number'
  ) {
    return [serviceLocation.longitude, serviceLocation.latitude];
  }

  if (Array.isArray(serviceLocation?.coordinates) && serviceLocation.coordinates.length === 2) {
    return serviceLocation.coordinates;
  }

  return null;
};

const normalizeStoredDocument = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return {
      secureUrl: value,
      previewUrl: value,
      uploaded: true,
    };
  }

  return {
    ...value,
    previewUrl: value.previewUrl || value.secureUrl || '',
    uploaded: value.uploaded ?? Boolean(value.secureUrl || value.previewUrl),
  };
};

const publicSessionPayload = (session, debugOtp = null) => ({
  registrationId: session.registrationId,
  phone: session.phone,
  role: session.role,
  status: session.status,
  otpVerified: Boolean(session.otpVerifiedAt),
  documentsUploaded: Object.keys(session.documents || {}).filter((key) => Boolean(session.documents?.[key])),
  debugOtp,
});

const publicDriverPayload = (driver) => {
  if (!driver) {
    return null;
  }

  return {
    id: driver._id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    gender: driver.gender,
    vehicleType: driver.vehicleType,
    registerFor: driver.registerFor,
    vehicleNumber: driver.vehicleNumber,
    vehicleColor: driver.vehicleColor,
    city: driver.city,
    approve: driver.approve,
    status: driver.status,
    rating: driver.rating,
  };
};

const getSession = async (registrationId, phone = '') => {
  const query = registrationId
    ? { registrationId: String(registrationId) }
    : { phone: normalizePhone(phone) };

  const session = await DriverRegistrationSession.findOne(query).select('+otpHash +personal.passwordHash');

  if (!session) {
    throw new ApiError(404, 'Registration session not found');
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await DriverRegistrationSession.deleteOne({ _id: session._id });
    throw new ApiError(410, 'Registration session expired');
  }

  return session;
};

const uploadRegistrationDocument = async (documentKey, value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value.secureUrl) {
    return normalizeStoredDocument(value);
  }

  const dataUrl = typeof value === 'string' ? value : value.dataUrl;
  const originalFilename = typeof value === 'object'
    ? value.fileName || value.originalFilename || documentKey
    : documentKey;

  if (!dataUrl) {
    throw new ApiError(400, `${documentKey} must contain an image data URL`);
  }

  const safeSuffix = String(originalFilename)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '');

  const uploaded = await uploadDataUrlToCloudinary({
    dataUrl,
    folder: `${documentKey}/driver-documents`,
    publicIdPrefix: `driver-${documentKey}`,
    publicIdSuffix: safeSuffix,
  });

  return {
    key: documentKey,
    fileName: originalFilename,
    uploaded: true,
    uploadedAt: new Date().toISOString(),
    previewUrl: uploaded.secureUrl,
    secureUrl: uploaded.secureUrl,
    publicId: uploaded.publicId,
    resourceType: uploaded.resourceType,
    format: uploaded.format,
    bytes: uploaded.bytes,
    width: uploaded.width,
    height: uploaded.height,
    cloudinary: uploaded,
  };
};

export const startDriverOnboarding = async ({ phone, role = 'driver' }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || normalizedPhone.length !== 10) {
    throw new ApiError(400, 'A valid 10-digit mobile number is required');
  }

  const normalizedRole = normalizeRole(role);
  const existingDriver = await Driver.findOne({ phone: normalizedPhone });

  if (existingDriver) {
    throw new ApiError(409, 'Phone number is already registered');
  }

  const otp = generateOtp();
  const now = Date.now();
  const registrationId = crypto.randomUUID();

  const session = await DriverRegistrationSession.findOneAndUpdate(
    { phone: normalizedPhone },
    {
      registrationId,
      phone: normalizedPhone,
      role: normalizedRole,
      status: 'otp_sent',
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(now + OTP_TTL_MS),
      otpVerifiedAt: null,
      expiresAt: new Date(now + SESSION_TTL_MS),
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  const smsDispatch = await sendOtpSms({
    phone: normalizedPhone,
    otp,
    purpose: 'driver onboarding OTP',
  });
  const debugOtp = smsDispatch.mode === 'debug' && process.env.NODE_ENV !== 'production' ? otp : null;

  if (debugOtp) {
    console.log(`[onboardingService] OTP for ${normalizedPhone} = ${debugOtp} (${smsDispatch.mode})`);
  }

  return {
    message: smsDispatch.mode === 'live' ? 'OTP sent successfully' : 'OTP generated successfully',
    session: publicSessionPayload(session, debugOtp),
  };
};

export const verifyDriverOtp = async ({ registrationId, phone, otp }) => {
  const session = await getSession(registrationId, phone);

  if (!otp || String(otp).trim().length !== 4) {
    throw new ApiError(400, 'A valid 4-digit OTP is required');
  }

  if (!session.otpExpiresAt || new Date(session.otpExpiresAt).getTime() < Date.now()) {
    throw new ApiError(410, 'OTP has expired');
  }

  if (session.otpHash !== hashOtp(otp)) {
    throw new ApiError(401, 'Invalid OTP');
  }

  session.status = 'otp_verified';
  session.otpVerifiedAt = new Date();
  await session.save();

  return {
    message: 'OTP verified successfully',
    session: publicSessionPayload(session),
  };
};

export const saveDriverPersonalDetails = async ({ registrationId, phone, fullName, email, gender, password }) => {
  const session = await getSession(registrationId, phone);
  const isOwner = String(session.role || '').toLowerCase() === 'owner';

  if (!session.otpVerifiedAt) {
    throw new ApiError(400, 'Verify OTP before continuing');
  }

  if (!fullName || !email || !gender || (!isOwner && !password)) {
    throw new ApiError(400, isOwner ? 'fullName, email and gender are required' : 'fullName, email, gender and password are required');
  }

  const normalizedName = String(fullName).trim();
  const normalizedEmail = String(email).trim().toLowerCase();

  if (!DRIVER_NAME_REGEX.test(normalizedName)) {
    throw new ApiError(400, `${isOwner ? 'Owner' : 'Driver'} name should contain alphabets only`);
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, 'A valid email address is required');
  }

  if (!isOwner && String(password).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  session.personal = {
    fullName: normalizedName,
    email: normalizedEmail,
    gender: String(gender).trim(),
    passwordHash: await hashPassword(isOwner ? crypto.randomBytes(24).toString('hex') : password),
  };
  session.status = 'personal_saved';
  await session.save();

  return {
    message: 'Personal details saved',
    personal: {
      fullName: session.personal.fullName,
      email: session.personal.email,
      gender: session.personal.gender,
    },
    session: publicSessionPayload(session),
  };
};

export const saveDriverReferral = async ({ registrationId, phone, referralCode = '' }) => {
  const session = await getSession(registrationId, phone);

  session.referralCode = String(referralCode || '').trim().toUpperCase();
  await session.save();

  return {
    message: 'Referral code saved',
    referralCode: session.referralCode,
    session: publicSessionPayload(session),
  };
};

export const saveDriverVehicle = async ({
  registrationId,
  phone,
  registerFor,
  locationId,
  locationName,
  serviceLocation,
  vehicleTypeId,
  make,
  model,
  year,
  number,
  color,
  companyName,
  companyAddress,
  city,
  postalCode,
  taxNumber,
}) => {
  const session = await getSession(registrationId, phone);

  if (!session.personal?.fullName) {
    throw new ApiError(400, 'Save personal details before vehicle details');
  }

  const selectedServiceLocation = serviceLocation || (locationId ? await ServiceLocation.findById(locationId).lean() : null);
  const selectedLocation = getServiceLocationName(selectedServiceLocation) || String(locationName || city || '').trim();

  if (!selectedLocation) {
    throw new ApiError(400, 'A valid service location is required');
  }

  const isOwner = String(session.role || '').toLowerCase() === 'owner';
  const normalizedYear = String(year || '').trim();
  const normalizedNumber = String(number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const normalizedPostalCode = String(postalCode || '').replace(/\D/g, '');

  if (isOwner) {
    if (!companyName || !companyAddress || !city || !normalizedPostalCode || !taxNumber) {
      throw new ApiError(400, 'Company details are incomplete');
    }

    if (!/^\d{6}$/.test(normalizedPostalCode)) {
      throw new ApiError(400, 'Postal code must be a 6 digit number');
    }
  } else {
    const vehicleYear = Number(normalizedYear);
    const currentYear = new Date().getFullYear();

    if (!vehicleTypeId || !make || !model || !normalizedYear || !normalizedNumber || !color) {
      throw new ApiError(400, 'Vehicle details are incomplete');
    }

    if (!/^\d{4}$/.test(normalizedYear) || vehicleYear < 1980 || vehicleYear > currentYear) {
      throw new ApiError(400, `Vehicle year must be between 1980 and ${currentYear}`);
    }

    if (!VEHICLE_NUMBER_REGEX.test(normalizedNumber)) {
      throw new ApiError(400, 'Vehicle number must be in this format: PP09KK1234');
    }
  }

  session.vehicle = {
    registerFor: String(registerFor || session.role || 'taxi').trim().toLowerCase(),
    locationId: String(locationId || '').trim(),
    locationName: selectedLocation,
    serviceLocation: selectedServiceLocation
      ? {
          _id: selectedServiceLocation._id || locationId || '',
          name: selectedServiceLocation.name || selectedServiceLocation.service_location_name || selectedLocation,
          service_location_name:
            selectedServiceLocation.service_location_name || selectedServiceLocation.name || selectedLocation,
          address: selectedServiceLocation.address || '',
          country: selectedServiceLocation.country || '',
          currency_name: selectedServiceLocation.currency_name || '',
          currency_symbol: selectedServiceLocation.currency_symbol || '',
          currency_code: selectedServiceLocation.currency_code || '',
          timezone: selectedServiceLocation.timezone || '',
          unit: selectedServiceLocation.unit || 'km',
          latitude: selectedServiceLocation.latitude ?? null,
          longitude: selectedServiceLocation.longitude ?? null,
          location: selectedServiceLocation.location || null,
          coordinates: getServiceLocationCoordinates(selectedServiceLocation),
        }
      : null,
    vehicleTypeId: String(vehicleTypeId || '').trim(),
    make: String(make || '').trim(),
    model: String(model || '').trim(),
    year: normalizedYear,
    number: normalizedNumber,
    color: String(color || '').trim(),
    companyName: String(companyName || '').trim(),
    companyAddress: String(companyAddress || '').trim(),
    city: String(city || selectedLocation).trim(),
    postalCode: normalizedPostalCode,
    taxNumber: String(taxNumber || '').trim().toUpperCase(),
  };
  session.status = 'vehicle_saved';
  await session.save();

  return {
    message: 'Vehicle details saved',
    vehicle: session.vehicle,
    session: publicSessionPayload(session),
  };
};

export const saveDriverDocuments = async ({ registrationId, phone, documents = {} }) => {
  const session = await getSession(registrationId, phone);

  const updatedDocuments = {};
  const uploadedDocumentKeys = [];

  for (const [documentKey, value] of Object.entries(documents || {})) {
    const uploadedDocument = await uploadRegistrationDocument(documentKey, value);

    if (uploadedDocument) {
      updatedDocuments[documentKey] = uploadedDocument;
      uploadedDocumentKeys.push(documentKey);
    }
  }

  session.documents = {
    ...(session.documents || {}),
    ...updatedDocuments,
  };
  session.status = 'documents_saved';
  await session.save();

  return {
    message: 'Documents uploaded successfully',
    uploadedDocumentKeys,
    documents: session.documents,
    session: publicSessionPayload(session),
  };
};

export const completeDriverOnboarding = async ({ registrationId, phone, documents = {} }) => {
  const session = await getSession(registrationId, phone);

  if (session.finalDriverId) {
    const existingDriver = await Driver.findById(session.finalDriverId);
    await DriverRegistrationSession.deleteOne({ _id: session._id });
    return {
      message: 'Registration already completed',
      driver: publicDriverPayload(existingDriver),
      documents: session.documents,
      session: publicSessionPayload(session),
    };
  }

  if (!session.otpVerifiedAt) {
    throw new ApiError(400, 'Verify OTP before submission');
  }

  if (!session.personal?.fullName || !session.personal?.passwordHash) {
    throw new ApiError(400, 'Personal details are incomplete');
  }

  if (!session.vehicle?.locationName) {
    throw new ApiError(400, 'Vehicle details are incomplete');
  }

  const finalDocuments = Object.keys(documents || {}).length > 0 ? documents : session.documents || {};
  const normalizedDocuments = {};
  for (const [documentKey, value] of Object.entries(finalDocuments)) {
    normalizedDocuments[documentKey] = normalizeStoredDocument(value);
  }

  const configuredUploadFields = await listDriverDocumentUploadFields({ activeOnly: true });
  const requiredDocuments = configuredUploadFields
    .filter((field) => Boolean(field.required) && matchesDocumentRole(field.account_type, session.role))
    .map((field) => field.key);
  const missingDocuments = requiredDocuments.filter((key) => !normalizedDocuments?.[key]);

  if (missingDocuments.length > 0) {
    throw new ApiError(400, `Missing required documents: ${missingDocuments.join(', ')}`);
  }

  let resolvedServiceLocation = session.vehicle.serviceLocation || null;

  if (!resolvedServiceLocation && session.vehicle.locationId) {
    resolvedServiceLocation = await ServiceLocation.findById(session.vehicle.locationId).lean();
  }

  const serviceLocationCoordinates = getServiceLocationCoordinates(resolvedServiceLocation || {});

  if (!serviceLocationCoordinates) {
    throw new ApiError(400, `Unsupported service location: ${session.vehicle.locationName}`);
  }

  const zone = await findZoneByPickup(serviceLocationCoordinates);
  const selectedVehicle =
    session.vehicle.vehicleTypeId && /^[a-f\d]{24}$/i.test(String(session.vehicle.vehicleTypeId))
      ? await Vehicle.findById(session.vehicle.vehicleTypeId).lean()
      : null;
  const vehicleType = selectedVehicle
    ? getGenericVehicleTypeFromCatalog(selectedVehicle)
    : getVehicleType(session.vehicle.vehicleTypeId, session.vehicle.registerFor);
  const driver = await Driver.create({
    name: session.personal.fullName,
    phone: session.phone,
    email: session.personal.email,
    gender: session.personal.gender,
    password: session.personal.passwordHash,
    vehicleType,
    vehicleTypeId: selectedVehicle?._id || null,
    vehicleIconType: selectedVehicle?.icon_types || vehicleType,
    registerFor: session.vehicle.registerFor,
    vehicleNumber: session.vehicle.number,
    vehicleColor: session.vehicle.color,
    city: session.vehicle.city || session.vehicle.locationName,
    referralCode: session.referralCode,
    approve: false,
    status: 'pending',
    zoneId: zone?._id || null,
    location: toPoint(serviceLocationCoordinates, 'location'),
    documents: normalizedDocuments,
    onboarding: {
      registrationId: session.registrationId,
      role: session.role,
      verifiedAt: session.otpVerifiedAt,
      submittedAt: new Date(),
      ...(session.role === 'owner'
        ? {
            company: {
              name: session.vehicle.companyName || '',
              address: session.vehicle.companyAddress || '',
              city: session.vehicle.city || session.vehicle.locationName || '',
              postalCode: session.vehicle.postalCode || '',
              taxNumber: session.vehicle.taxNumber || '',
              serviceLocationId: session.vehicle.locationId || '',
              serviceLocationName: session.vehicle.locationName || '',
              registerFor: session.vehicle.registerFor || '',
            },
          }
        : {}),
    },
  });

  session.finalDriverId = driver._id;
  session.status = 'completed';
  session.completedAt = new Date();
  await session.save();
  await DriverRegistrationSession.deleteOne({ _id: session._id });

  return {
    message: 'Driver registration completed successfully',
    driver: publicDriverPayload(driver),
    documents: normalizedDocuments,
    token: signAccessToken({ sub: String(driver._id), role: 'driver' }),
    session: publicSessionPayload(session),
  };
};

export const getDriverOnboardingSession = async ({ registrationId, phone }) => {
  const session = await getSession(registrationId, phone);
  return {
    session: publicSessionPayload(session),
    personal: session.personal,
    referralCode: session.referralCode,
    vehicle: session.vehicle,
    documents: session.documents,
    completedAt: session.completedAt,
  };
};
