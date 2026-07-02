import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminDeleteApplication } from '../src/modules/taxi/career/controllers/careerController.js';
import { CareerApplication } from '../src/modules/taxi/career/models/CareerApplication.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI;
const MONGO_DB = process.env.MONGODB_DB_NAME || 'appzeto_taxi';

async function test() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log('Connected to MongoDB');

  // Find one application
  const app = await CareerApplication.findOne({ fullName: 'John Doe' });
  if (!app) {
    console.error('❌ John Doe application not found in DB. Make sure seed script was run.');
    await mongoose.disconnect();
    return;
  }
  console.log(`Found application for ${app.fullName} with ID ${app._id}`);

  // Mock Request and Response
  const req = {
    params: {
      id: String(app._id)
    }
  };

  let jsonResponse = null;
  const res = {
    json: (data) => {
      jsonResponse = data;
    }
  };

  // Run the handler
  await adminDeleteApplication(req, res);

  console.log('Response from delete handler:', jsonResponse);

  if (jsonResponse && jsonResponse.success && jsonResponse.data.deleted) {
    console.log('✅ adminDeleteApplication handler responded with success!');
  } else {
    console.error('❌ adminDeleteApplication handler failed to delete or return success.');
  }

  // Verify deletion in DB
  const checkedApp = await CareerApplication.findById(app._id);
  if (!checkedApp) {
    console.log('✅ Confirmed application was removed from the database!');
  } else {
    console.error('❌ Application is still present in the database!');
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

test().catch(console.error);
