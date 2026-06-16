import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { ServiceLocation } from '../src/modules/taxi/admin/models/ServiceLocation.js';
import { Owner } from '../src/modules/taxi/admin/models/Owner.js';
import { ServiceCenterStaff } from '../src/modules/taxi/admin/models/ServiceCenterStaff.js';
import { ServiceStore } from '../src/modules/taxi/admin/models/ServiceStore.js';
import { Driver } from '../src/modules/taxi/driver/models/Driver.js';
import { BusDriver } from '../src/modules/taxi/driver/models/BusDriver.js';
import { Zone } from '../src/modules/taxi/driver/models/Zone.js';
import { hashPassword } from '../src/modules/taxi/services/passwordService.js';

const STATIC_PHONE = '9389394808';
const STATIC_OTP = '0000';
const SEEDED_BY = 'Backend/scratch/seed_user_phone.js';
const DEFAULT_COORDINATES = [75.8577, 22.7196];

const connect = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== 'production',
    dbName: env.mongoDbName,
  });
};

const buildReferralCode = (phone) => `DRV${String(phone || '').slice(-4)}STATIC`;
const buildRoleEmail = (role) => `${role}.${STATIC_PHONE}@rydon24.local`;
const now = () => new Date();

const ensureServiceLocation = async () => {
  const existing = await ServiceLocation.findOne({
    $or: [
      { legacy_id: 'static-indore' },
      { service_location_name: 'Indore' },
      { name: 'Indore' },
    ],
  });

  if (existing) {
    return existing;
  }

  return ServiceLocation.create({
    name: 'Indore',
    legacy_id: 'static-indore',
    company_key: 'static',
    service_location_name: 'Indore',
    address: 'Indore, Madhya Pradesh, India',
    country: 'India',
    currency_name: 'Indian Rupee',
    currency_symbol: 'Rs',
    currency_code: 'INR',
    timezone: 'Asia/Kolkata',
    unit: 'km',
    latitude: DEFAULT_COORDINATES[1],
    longitude: DEFAULT_COORDINATES[0],
    location: {
      type: 'Point',
      coordinates: DEFAULT_COORDINATES,
    },
    status: 'active',
    active: true,
  });
};

const ensureZone = async (serviceLocationId) => {
  const existing = await Zone.findOne({
    $or: [
      { name: 'Static Seed Zone' },
      { service_location_id: serviceLocationId },
    ],
  });

  if (existing) {
    return existing;
  }

  const [lng, lat] = DEFAULT_COORDINATES;
  const offset = 0.05;

  return Zone.create({
    name: 'Static Seed Zone',
    service_location_id: serviceLocationId,
    unit: 'km',
    active: true,
    status: 'active',
    boundary_mode: 'polygon',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lng - offset, lat - offset],
        [lng + offset, lat - offset],
        [lng + offset, lat + offset],
        [lng - offset, lat + offset],
        [lng - offset, lat - offset],
      ]],
    },
  });
};

const upsertDriver = async (passwordHash, serviceLocationId, zoneId) => {
  const completedAt = now();
  return Driver.findOneAndUpdate(
    { phone: STATIC_PHONE },
    {
      $set: {
        name: 'User Driver',
        phone: STATIC_PHONE,
        email: buildRoleEmail('driver'),
        gender: 'male',
        password: passwordHash,
        service_location_id: serviceLocationId,
        vehicleType: 'car',
        vehicleIconType: 'car',
        vehicleMake: 'Tata',
        vehicleModel: 'Nexon',
        registerFor: 'taxi',
        serviceCategories: ['taxi'],
        vehicleNumber: 'MP09AB9999',
        vehicleColor: 'Black',
        city: 'Indore',
        approve: true,
        status: 'approved',
        isOnline: false,
        isOnRide: false,
        zoneId,
        location: {
          type: 'Point',
          coordinates: DEFAULT_COORDINATES,
        },
        referralCode: buildReferralCode(STATIC_PHONE),
        documents: {},
        onboarding: {
          registrationId: `static-driver-${STATIC_PHONE}`,
          role: 'driver',
          otpMode: 'static',
          otpVerifiedAt: completedAt,
          submittedAt: completedAt,
          completedAt,
          seededBy: SEEDED_BY,
          completed: true,
        },
      },
      $unset: {
        deletedAt: 1,
        deletion_reason: 1,
      },
    },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );
};

const upsertOwner = async (passwordHash, serviceLocationId) => {
  const completedAt = now();
  return Owner.findOneAndUpdate(
    { mobile: STATIC_PHONE },
    {
      $set: {
        company_name: 'User Fleet Owner',
        owner_name: 'User Owner',
        name: 'User Owner',
        mobile: STATIC_PHONE,
        phone: STATIC_PHONE,
        email: buildRoleEmail('owner'),
        password: passwordHash,
        service_location_id: serviceLocationId,
        transport_type: 'taxi',
        address: 'Indore, Madhya Pradesh, India',
        postal_code: '452001',
        city: 'Indore',
        tax_number: 'STATICTAX9389',
        active: true,
        approve: true,
        status: 'approved',
        user_snapshot: {
          source: 'owner_onboarding',
          registrationId: `static-owner-${STATIC_PHONE}`,
          verifiedAt: completedAt,
          submittedAt: completedAt,
          completedAt,
          seededBy: SEEDED_BY,
          completed: true,
        },
      },
    },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );
};

const main = async () => {
  await connect();

  const passwordHash = await hashPassword(`static-driver-${STATIC_PHONE}`);
  const serviceLocation = await ensureServiceLocation();
  const zone = await ensureZone(serviceLocation._id);

  const driver = await upsertDriver(passwordHash, serviceLocation._id, zone._id);
  const owner = await upsertOwner(passwordHash, serviceLocation._id);

  console.log('User phone 9389394808 successfully seeded with driver & owner roles!');
  await mongoose.disconnect();
};

main().catch(console.error);
