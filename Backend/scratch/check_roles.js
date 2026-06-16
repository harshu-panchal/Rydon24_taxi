import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Owner } from '../src/modules/taxi/admin/models/Owner.js';
import { ServiceCenterStaff } from '../src/modules/taxi/admin/models/ServiceCenterStaff.js';
import { ServiceStore } from '../src/modules/taxi/admin/models/ServiceStore.js';
import { Driver } from '../src/modules/taxi/driver/models/Driver.js';
import { BusDriver } from '../src/modules/taxi/driver/models/BusDriver.js';
import { PoolingVehicle } from '../src/modules/taxi/admin/models/PoolingVehicle.js';

const connect = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== 'production',
    dbName: env.mongoDbName,
  });
};

const buildPhoneCandidates = (phone) => {
  const normalizedPhone = String(phone || '').replace(/\D/g, '').trim();
  const candidates = new Set();
  if (normalizedPhone) {
    candidates.add(normalizedPhone);
    candidates.add(`91${normalizedPhone}`);
    candidates.add(`+91${normalizedPhone}`);
  }
  return [...candidates];
};

async function main() {
  await connect();
  const phone = '9389394808';
  const candidates = buildPhoneCandidates(phone);

  const results = {
    driver: await Driver.findOne({ phone: { $in: candidates } }).lean(),
    owner: await Owner.findOne({ $or: [{ mobile: { $in: candidates } }, { phone: { $in: candidates } }] }).lean(),
    service_center: await ServiceStore.findOne({ owner_phone: { $in: candidates } }).lean(),
    service_center_staff: await ServiceCenterStaff.findOne({ phone: { $in: candidates } }).lean(),
    bus_driver: await BusDriver.findOne({ phone: { $in: candidates } }).lean(),
    pooling_driver: await PoolingVehicle.findOne({ driverPhone: { $in: candidates } }).lean(),
  };

  console.log('--- Search Results for 9389394808 ---');
  for (const [role, account] of Object.entries(results)) {
    if (account) {
      console.log(`Role: ${role} -> Found account ID: ${account._id}`);
    } else {
      console.log(`Role: ${role} -> NOT FOUND`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
