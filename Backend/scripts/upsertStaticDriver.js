import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Driver } from '../src/modules/taxi/driver/models/Driver.js';
import { hashPassword } from '../src/modules/taxi/services/passwordService.js';

const STATIC_PHONE = String(env.sms?.staticOtpPhone || '7610416911').trim();
const STATIC_OTP = String(env.sms?.staticOtpCode || '0000').trim();

const connect = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== 'production',
    dbName: env.mongoDbName,
  });
};

const buildReferralCode = (phone) => `DRV${String(phone || '').slice(-4)}STATIC`;

const main = async () => {
  if (!STATIC_PHONE) {
    throw new Error('STATIC_OTP_PHONE is missing');
  }

  await connect();

  const passwordHash = await hashPassword(`static-driver-${STATIC_PHONE}`);
  const now = new Date();

  const update = {
    name: 'Static Test Driver',
    phone: STATIC_PHONE,
    email: `driver.${STATIC_PHONE}@rydon24.local`,
    gender: 'male',
    password: passwordHash,
    vehicleType: 'car',
    vehicleIconType: 'car',
    vehicleMake: 'Maruti Suzuki',
    vehicleModel: 'WagonR',
    registerFor: 'taxi',
    serviceCategories: ['taxi'],
    vehicleNumber: 'MP09AB1234',
    vehicleColor: 'White',
    city: 'Indore',
    approve: true,
    status: 'approved',
    isOnline: false,
    isOnRide: false,
    location: {
      type: 'Point',
      coordinates: [75.8577, 22.7196],
    },
    referralCode: buildReferralCode(STATIC_PHONE),
    documents: {},
    onboarding: {
      registrationId: `static-${STATIC_PHONE}`,
      role: 'driver',
      otpMode: STATIC_OTP ? 'static' : 'generated',
      otpVerifiedAt: now,
      submittedAt: now,
      completedAt: now,
      seededBy: 'Backend/scripts/upsertStaticDriver.js',
      completed: true,
    },
  };

  const driver = await Driver.findOneAndUpdate(
    { phone: STATIC_PHONE },
    {
      $set: update,
      $unset: {
        deletedAt: 1,
        deletion_reason: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        driverId: String(driver._id),
        phone: driver.phone,
        approve: driver.approve,
        status: driver.status,
        staticOtp: STATIC_OTP,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
