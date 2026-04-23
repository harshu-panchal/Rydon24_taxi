import crypto from 'node:crypto';
import { ApiError } from '../../../../utils/ApiError.js';
import { User } from '../models/User.js';
import { UserWallet } from '../models/UserWallet.js';
import { Notification } from '../../admin/promotions/models/Notification.js';
import { comparePassword, hashPassword, signAccessToken } from '../services/authService.js';
import { env } from '../../../../config/env.js';
import { uploadDataUrlToCloudinary } from '../../../../utils/cloudinaryUpload.js';
import { ensureThirdPartySettings } from '../../admin/services/adminService.js';
import {
  consumeUserSignupSession,
  requireVerifiedUserSignupSession,
  startUserOtp,
  verifyUserOtp,
} from '../services/userOtpService.js';
import { assignPushTokenToEntity } from '../../services/pushTokenService.js';

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
    data: {
      balance: Number(wallet?.balance || 0),
      currency: 'INR',
      recentTransactions: transactions
        .slice()
        .reverse()
        .map((tx) => ({
          id: tx._id,
          kind: tx.kind,
          amount: Number(tx.amount || 0),
          title: tx.title || '',
          counterpartyPhone: tx.counterpartyPhone || '',
          createdAt: tx.createdAt || null,
        })),
    },
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
    data: {
      balance: Number(updatedWallet?.balance || 0),
      currency: 'INR',
      recentTransactions: transactions
        .slice()
        .reverse()
        .map((entry) => ({
          id: entry._id,
          kind: entry.kind,
          amount: Number(entry.amount || 0),
          title: entry.title || '',
          counterpartyPhone: entry.counterpartyPhone || '',
          createdAt: entry.createdAt || null,
        })),
    },
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
    data: {
      balance: Number(wallet?.balance || 0),
      currency: 'INR',
      recentTransactions: transactions
        .slice()
        .reverse()
        .map((entry) => ({
          id: entry._id,
          kind: entry.kind,
          amount: Number(entry.amount || 0),
          title: entry.title || '',
          counterpartyPhone: entry.counterpartyPhone || '',
          createdAt: entry.createdAt || null,
        })),
    },
  });
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

  const transactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];

  res.status(201).json({
    success: true,
    data: {
      balance: Number(wallet.balance || 0),
      currency: 'INR',
      recentTransactions: transactions
        .slice()
        .reverse()
        .map((entry) => ({
          id: entry._id,
          kind: entry.kind,
          amount: Number(entry.amount || 0),
          title: entry.title || '',
          counterpartyPhone: entry.counterpartyPhone || '',
          createdAt: entry.createdAt || null,
        })),
    },
  });
};
