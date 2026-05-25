import mongoose from 'mongoose';
import { Driver } from '../src/modules/taxi/driver/models/Driver.js';
import { Owner } from '../src/modules/taxi/admin/models/Owner.js';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const phone = '7223077890';
    const driver = await Driver.findOne({ phone }).lean();
    const owner = await Owner.findOne({ $or: [{ mobile: phone }, { phone }] }).lean();
    console.log('--- DB Check for 7223077890 ---');
    console.log('Driver:', driver ? { id: driver._id, name: driver.name, phone: driver.phone, approve: driver.approve } : 'Not found');
    console.log('Owner:', owner ? { id: owner._id, name: owner.name, mobile: owner.mobile, phone: owner.phone } : 'Not found');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
