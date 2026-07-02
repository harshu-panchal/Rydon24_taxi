import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI;
const MONGO_DB = process.env.MONGODB_DB_NAME || 'appzeto_taxi';

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI is not set');
  process.exit(1);
}

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    department: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, default: 'Full-time' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);
const CareerJob = mongoose.models.TaxiCareerJob || mongoose.model('TaxiCareerJob', jobSchema);

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxiCareerJob', required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    experience: { type: Number, required: true },
    coverLetter: { type: String },
    resumeUrl: { type: String },
    status: { type: String, default: 'pending' }
  },
  { timestamps: true }
);
const CareerApplication = mongoose.models.TaxiCareerApplication || mongoose.model('TaxiCareerApplication', applicationSchema);

async function main() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log('Connected to MongoDB');

  // Clear existing career data to start clean
  await CareerApplication.deleteMany({});
  await CareerJob.deleteMany({});
  console.log('Cleared existing career jobs and applications.');

  // Create jobs
  const job1 = await CareerJob.create({
    title: 'Senior Node.js Developer',
    description: 'We are looking for a senior backend engineer to join our taxi platform team.',
    department: 'Engineering',
    location: 'Indore, India',
    type: 'Full-time',
    active: true
  });

  const job2 = await CareerJob.create({
    title: 'UI/UX Designer',
    description: 'Help us design the next generation fleet and driver management interfaces.',
    department: 'Design',
    location: 'Remote',
    type: 'Contract',
    active: true
  });

  console.log('Seeded 2 job positions.');

  // Create applications
  await CareerApplication.create({
    jobId: job1._id,
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '9876543210',
    experience: 5,
    coverLetter: 'I would love to join your team. I have 5 years of experience with Node.js and MongoDB.',
    resumeUrl: 'https://portfolio.johndoe.dev',
    status: 'pending'
  });

  await CareerApplication.create({
    jobId: job1._id,
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '9988776655',
    experience: 3,
    coverLetter: 'Backend development is my passion. Hope to hear from you soon!',
    resumeUrl: 'https://resume.janesmith.com',
    status: 'reviewed'
  });

  await CareerApplication.create({
    jobId: job2._id,
    fullName: 'Alice Johnson',
    email: 'alice.j@example.com',
    phone: '9123456780',
    experience: 4,
    coverLetter: 'Hello! I have created designs for multiple ride-hailing apps in the past.',
    resumeUrl: 'https://behance.net/alicejohnson',
    status: 'shortlisted'
  });

  console.log('Seeded 3 applications.');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch(console.error);
