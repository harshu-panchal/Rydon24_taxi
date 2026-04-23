
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../Backend/.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/appzeto_taxi';

async function checkData() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Check TaxiVehicle count
    const count = await mongoose.connection.db.collection('taxivehicles').countDocuments();
    console.log('TaxiVehicle count:', count);
    
    const sample = await mongoose.connection.db.collection('taxivehicles').find().limit(2).toArray();
    console.log('Sample Data:', JSON.stringify(sample, null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkData();
