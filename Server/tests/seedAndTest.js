/**
 * Seed & Test Script for Customer Count Accuracy
 * 
 * Creates 400,000 distinct customers in the MAIN database.
 * 
 * Usage: node tests/seedAndTest.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// ─── USE THE MAIN DATABASE ──────────────────────────────────────────
const MAIN_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myslt_dashboard';

// ─── Schema (mirrors production) ─────────────────────────────────────
const apiLogSchema = new mongoose.Schema({
  accessMethod: { type: String, required: true, index: true },
  customerEmail: { type: String, required: true, index: true },
  status: { type: String, required: true, index: true },
  apiNumber: { type: String, required: true, index: true },
  responseTime: { type: Number, required: true },
  serverIdentifier: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true }
}, { timestamps: false });

apiLogSchema.index({ date: -1 });
apiLogSchema.index({ apiNumber: 1, date: -1 });
apiLogSchema.index({ serverIdentifier: 1, date: -1 });
apiLogSchema.index({ customerEmail: 1, date: -1 });

const ApiLog = mongoose.models.ApiLog || mongoose.model('ApiLog', apiLogSchema);

const hourlyStatsSchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },
  apiNumber: { type: String, required: true, index: true },
  serverIdentifier: { type: String, required: true, index: true },
  accessMethod: { type: String, required: true, index: true },
  totalRequests: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  criticalCount: { type: Number, default: 0 },
  totalResponseTime: { type: Number, default: 0 },
  minResponseTime: { type: Number, default: null },
  maxResponseTime: { type: Number, default: 0 },
  uniqueCustomersCount: { type: Number, default: 0 }
}, { timestamps: true });

hourlyStatsSchema.index({ date: 1, apiNumber: 1, serverIdentifier: 1 });
const HourlyStats = mongoose.models.HourlyStats || mongoose.model('HourlyStats', hourlyStatsSchema);

// ─── CONFIG ──────────────────────────────────────────────────────────
const TOTAL_CUSTOMERS = 400_000;
const BATCH_SIZE = 10_000;
const API_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SERVERS = ['137', '113', '114'];
const ACCESS_METHODS = ['Web', 'Mobile', 'API'];
const STATUSES = ['Information', 'Warning', 'Error', 'Critical'];
const STATUS_WEIGHTS = [0.85, 0.08, 0.05, 0.02];

// ─── HELPERS ─────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weightedPick = (arr, weights) => {
  const r = Math.random();
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (r <= sum) return arr[i];
  }
  return arr[arr.length - 1];
};

const generateEmail = (index) => {
  if (index % 3 === 0) return `stress_test_${index}@sltmobitel.lk`;
  if (index % 3 === 1) return `stress_test_cust_${index}@gmail.com`;
  return `0779${String(index).padStart(6, '0')}`;
};

const timer = (label) => {
  const start = Date.now();
  return () => {
    const ms = Date.now() - start;
    console.log(`  ⏱  ${label}: ${ms}ms (${(ms / 1000).toFixed(2)}s)`);
    return ms;
  };
};

// ─── SEEDING ─────────────────────────────────────────────────────────
const seedData = async () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌱 SEEDING ${TOTAL_CUSTOMERS.toLocaleString()} DISTINCT CUSTOMERS INTO MAIN DB`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // We are NOT dropping the database as per user request to use the main db
  // But we will delete previous STRESS TEST data if it exists to allow re-runs
  await ApiLog.deleteMany({ customerEmail: { $regex: '^stress_test|^0779' } });
  console.log('  🧹 Cleaned up existing stress test data');

  const now = new Date();
  let totalDocs = 0;
  const endSeed = timer('Total seed time');

  for (let batchStart = 0; batchStart < TOTAL_CUSTOMERS; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_CUSTOMERS);
    const docs = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const email = generateEmail(i);
      const logsPerCustomer = 1 + Math.floor(Math.random() * 2);

      for (let j = 0; j < logsPerCustomer; j++) {
        const randomMs = Math.floor(Math.random() * 24 * 60 * 60 * 1000);
        const logDate = new Date(now.getTime() - randomMs);

        docs.push({
          accessMethod: pick(ACCESS_METHODS),
          customerEmail: email,
          status: weightedPick(STATUSES, STATUS_WEIGHTS),
          apiNumber: pick(API_NUMBERS),
          responseTime: 50 + Math.floor(Math.random() * 500),
          serverIdentifier: pick(SERVERS),
          date: logDate
        });
      }
    }

    await ApiLog.insertMany(docs, { ordered: false });
    totalDocs += docs.length;
    process.stdout.write(`\r  📝 Progress: ${batchEnd.toLocaleString()}/${TOTAL_CUSTOMERS.toLocaleString()} customers`);
  }

  console.log('');
  endSeed();
  return totalDocs;
};

// ─── MAIN ────────────────────────────────────────────────────────────
const main = async () => {
  try {
    console.log(`\n🔌 Connecting to MAIN database: ${MAIN_DB_URI}`);
    await mongoose.connect(MAIN_DB_URI);
    console.log('✅ Connected\n');

    const totalInserted = await seedData();
    console.log(`\n✅ Successfully seeded ${totalInserted.toLocaleString()} documents.`);
    console.log('✅ 400,000 distinct customers are now in the main database.');
    console.log('✅ You can now refresh your dashboard UI to see the results.\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

main();
