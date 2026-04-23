import crypto from 'node:crypto';
import { ApiError } from '../../../../utils/ApiError.js';
import { Driver } from '../models/Driver.js';
import { DriverLoginSession } from '../models/DriverLoginSession.js';
import { signAccessToken } from './authService.js';
import { sendOtpSms } from '../../services/smsService.js';

const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').trim();

const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const getSession = async (phone) => {
  const session = await DriverLoginSession.findOne({ phone: normalizePhone(phone) }).select('+otpHash');

  if (!session) {
    throw new ApiError(404, 'Login session not found');
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await DriverLoginSession.deleteOne({ _id: session._id });
    throw new ApiError(410, 'Login session expired');
  }

  return session;
};

const publicSessionPayload = (session, debugOtp = null) => ({
  phone: session.phone,
  status: 'otp_sent',
  debugOtp,
});

const publicDriverPayload = (driver) => ({
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
  isOnline: driver.isOnline,
  isOnRide: driver.isOnRide,
});

export const startDriverLoginOtp = async ({ phone }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || normalizedPhone.length !== 10) {
    throw new ApiError(400, 'A valid 10-digit mobile number is required');
  }

  const driver = await Driver.findOne({ phone: normalizedPhone });

  if (!driver) {
    throw new ApiError(404, 'Driver account not found');
  }

  if (driver.approve === false || String(driver.status || '').toLowerCase() === 'pending') {
    throw new ApiError(403, 'Driver account is pending approval');
  }

  const otp = generateOtp();
  const now = Date.now();

  const session = await DriverLoginSession.findOneAndUpdate(
    { phone: normalizedPhone },
    {
      phone: normalizedPhone,
      driverId: driver._id,
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(now + LOGIN_OTP_TTL_MS),
      verifiedAt: null,
      expiresAt: new Date(now + LOGIN_OTP_TTL_MS),
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  const smsDispatch = await sendOtpSms({
    phone: normalizedPhone,
    otp,
    purpose: 'driver login OTP',
  });
  const debugOtp = smsDispatch.mode === 'debug' && process.env.NODE_ENV !== 'production' ? otp : null;

  return {
    message: smsDispatch.mode === 'live' ? 'OTP sent successfully' : 'OTP generated successfully',
    session: publicSessionPayload(session, debugOtp),
  };
};

export const verifyDriverLoginOtp = async ({ phone, otp }) => {
  const session = await getSession(phone);

  if (!otp || String(otp).trim().length !== 4) {
    throw new ApiError(400, 'A valid 4-digit OTP is required');
  }

  if (!session.otpExpiresAt || new Date(session.otpExpiresAt).getTime() < Date.now()) {
    throw new ApiError(410, 'OTP has expired');
  }

  if (session.otpHash !== hashOtp(otp)) {
    throw new ApiError(401, 'Invalid OTP');
  }

  const driver = await Driver.findById(session.driverId);

  if (!driver) {
    throw new ApiError(404, 'Driver account not found');
  }

  if (driver.approve === false || String(driver.status || '').toLowerCase() === 'pending') {
    throw new ApiError(403, 'Driver account is pending approval');
  }

  session.verifiedAt = new Date();
  session.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await session.save();
  await DriverLoginSession.deleteOne({ _id: session._id });

  return {
    message: 'OTP verified successfully',
    token: signAccessToken({ sub: String(driver._id), role: 'driver' }),
    driver: publicDriverPayload(driver),
  };
};
