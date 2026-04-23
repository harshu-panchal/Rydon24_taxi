
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../Backend/.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/appzeto_taxi';

async function checkIds() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Get Service Location
    const sl = await mongoose.connection.db.collection('taxiservicelocations').findOne({ name: 'India' });
    console.log('Service Location India:', sl ? sl._id : 'Not found');
    
    // Get Zone
    const zone = await mongoose.connection.db.collection('taxizones').findOne({ name: 'India' });
    console.log('Zone India:', zone ? zone._id : 'Not found');
    
    // Get Vehicles
    const vehicles = await mongoose.connection.db.collection('taxivehicles').find({}).toArray();
    console.log('Vehicles:', vehicles.map(v => ({ name: v.name, id: v._id })));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkIds();
