import crypto from 'node:crypto';
import { ApiError } from '../../../../utils/ApiError.js';
import { env } from '../../../../config/env.js';
import { Owner } from '../../admin/models/Owner.js';
import { Driver } from '../models/Driver.js';
import { DriverLoginSession } from '../models/DriverLoginSession.js';
import { signAccessToken } from './authService.js';
import { sendOtpSms } from '../../services/smsService.js';

const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '').trim();
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));
const normalizeRole = (role) =>
  String(role || 'driver').toLowerCase() === 'owner' ? 'owner' : 'driver';

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');
const getVisibleOtp = (otp) => (process.env.NODE_ENV !== 'production' ? String(otp) : null);
const TEST_LOGIN_OTP_PHONE = '6268423925';
const TEST_LOGIN_OTP_CODE = '0000';
const getStaticDriverOtpConfig = () => ({
  phone: normalizePhone(env.sms?.staticOtpPhone || TEST_LOGIN_OTP_PHONE),
  otp: String(env.sms?.staticOtpCode || TEST_LOGIN_OTP_CODE).trim(),
});
const resolveDriverLoginOtpForPhone = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const staticOtpConfig = getStaticDriverOtpConfig();

  if (staticOtpConfig.phone && staticOtpConfig.otp && normalizedPhone === staticOtpConfig.phone) {
    return {
      otp: staticOtpConfig.otp,
      isStatic: true,
    };
  }

  return {
    otp: generateOtp(),
    isStatic: false,
  };
};

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

const publicOwnerPayload = (owner) => ({
  id: owner._id,
  name: owner.name || owner.company_name || '',
  company_name: owner.company_name || '',
  phone: owner.mobile || owner.phone || '',
  email: owner.email || '',
  city: owner.city || '',
  approve: owner.approve,
  status: owner.status,
});

const isApprovedDriver = (driver) =>
  Boolean(driver) &&
  driver.approve !== false &&
  String(driver.status || '').toLowerCase() !== 'pending';

const isApprovedOwner = (owner) =>
  Boolean(owner) &&
  owner.active !== false &&
  (owner.approve === true || String(owner.status || '').toLowerCase() === 'approved');

export const startDriverLoginOtp = async ({ phone, role = 'driver' }) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedRole = normalizeRole(role);

  if (!normalizedPhone || normalizedPhone.length !== 10) {
    throw new ApiError(400, 'A valid 10-digit mobile number is required');
  }

  const account =
    normalizedRole === 'owner'
      ? await Owner.findOne({
          $or: [{ mobile: normalizedPhone }, { phone: normalizedPhone }],
        })
      : await Driver.findOne({ phone: normalizedPhone });

  if (!account) {
    throw new ApiError(404, `${normalizedRole === 'owner' ? 'Owner' : 'Driver'} account not found`);
  }

  if (
    (normalizedRole === 'owner' && !isApprovedOwner(account)) ||
    (normalizedRole === 'driver' && !isApprovedDriver(account))
  ) {
    throw new ApiError(403, `${normalizedRole === 'owner' ? 'Owner' : 'Driver'} account is pending approval`);
  }

  const { otp, isStatic } = resolveDriverLoginOtpForPhone(normalizedPhone);
  const now = Date.now();

  const session = await DriverLoginSession.findOneAndUpdate(
    { phone: normalizedPhone },
    {
      phone: normalizedPhone,
      driverId: account._id,
      accountRole: normalizedRole,
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(now + LOGIN_OTP_TTL_MS),
      verifiedAt: null,
      expiresAt: new Date(now + LOGIN_OTP_TTL_MS),
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  const smsDispatch = isStatic
    ? {
        mode: 'static',
        message: 'Static OTP enabled',
      }
    : await sendOtpSms({
        phone: normalizedPhone,
        otp,
        purpose: 'driver login OTP',
      });
  const debugOtp = getVisibleOtp(otp);

  if (debugOtp) {
    console.log(`[loginOtpService] OTP for ${normalizedPhone} = ${debugOtp} (${smsDispatch.mode})`);
  }

  return {
    message: smsDispatch.mode === 'live' ? 'OTP sent successfully' : 'OTP generated successfully',
    session: publicSessionPayload(session, debugOtp),
  };
};

export const verifyDriverLoginOtp = async ({ phone, otp }) => {
  const session = await getSession(phone);
  const normalizedRole = normalizeRole(session.accountRole);

  if (!otp || String(otp).trim().length !== 4) {
    throw new ApiError(400, 'A valid 4-digit OTP is required');
  }

  if (!session.otpExpiresAt || new Date(session.otpExpiresAt).getTime() < Date.now()) {
    throw new ApiError(410, 'OTP has expired');
  }

  if (session.otpHash !== hashOtp(otp)) {
    throw new ApiError(401, 'Invalid OTP');
  }

  const account =
    normalizedRole === 'owner'
      ? await Owner.findById(session.driverId)
      : await Driver.findById(session.driverId);

  if (!account) {
    throw new ApiError(404, `${normalizedRole === 'owner' ? 'Owner' : 'Driver'} account not found`);
  }

  if (
    (normalizedRole === 'owner' && !isApprovedOwner(account)) ||
    (normalizedRole === 'driver' && !isApprovedDriver(account))
  ) {
    throw new ApiError(403, `${normalizedRole === 'owner' ? 'Owner' : 'Driver'} account is pending approval`);
  }

  session.verifiedAt = new Date();
  session.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await session.save();
  await DriverLoginSession.deleteOne({ _id: session._id });

  return {
    message: 'OTP verified successfully',
    token: signAccessToken({ sub: String(account._id), role: normalizedRole }),
    driver: normalizedRole === 'owner' ? publicOwnerPayload(account) : publicDriverPayload(account),
  };
};
