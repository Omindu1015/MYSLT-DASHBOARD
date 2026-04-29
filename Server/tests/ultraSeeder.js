/**
 * ULTRA SEEDER v2
 * 
 * Target: 6,000,000 logs
 * Target: 400,000+ distinct customers
 * Period: 90 days
 * API Format: A01 - A126
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { apiMapping } from '../src/config/apiMapping.js';
dotenv.config();

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myslt_dashboard';

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

const HourlyStats = mongoose.models.HourlyStats || mongoose.model('HourlyStats', hourlyStatsSchema);

// ─── CONFIG ──────────────────────────────────────────────────────────
const TOTAL_LOGS = 6_000_000;
const TOTAL_CUSTOMERS = 450_000;
const BATCH_SIZE = 40_000; 
const API_IDS = Object.keys(apiMapping);
const SERVERS = ['137', '113', '114'];
const METHODS = ['Web', 'Mobile', 'API'];
const STATUSES = ['Information', 'Warning', 'Error', 'Critical'];
const WEIGHTS = [0.88, 0.07, 0.04, 0.01];

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

const generateEmail = (id) => {
    const mod = id % 3;
    if (mod === 0) return `cust_${id}@slt.lk`;
    if (mod === 1) return `user_${id}@gmail.com`;
    return `077${String(id).padStart(7, '0')}`;
};

// ─── MAIN SEEDER ─────────────────────────────────────────────────────
const seed = async () => {
    console.log(`\n🚀 ULTRA SEEDER STARTING...`);
    console.log(`📊 Target: ${TOTAL_LOGS.toLocaleString()} logs`);
    console.log(`👤 Target: ${TOTAL_CUSTOMERS.toLocaleString()} distinct customers`);
    console.log(`⏳ Period: 90 Days\n`);

    await ApiLog.deleteMany({});
    await HourlyStats.deleteMany({});
    console.log('🗑️  Collections cleared.\n');

    const now = new Date();
    const ninetyDaysAgo = now.getTime() - (90 * 24 * 60 * 60 * 1000);
    
    let logsGenerated = 0;
    const start = Date.now();

    while (logsGenerated < TOTAL_LOGS) {
        const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_LOGS - logsGenerated);
        const docs = [];

        for (let i = 0; i < currentBatchSize; i++) {
            const customerId = Math.floor(Math.random() * TOTAL_CUSTOMERS);
            const randomTime = ninetyDaysAgo + Math.random() * (now.getTime() - ninetyDaysAgo);
            
            docs.push({
                accessMethod: pick(METHODS),
                customerEmail: generateEmail(customerId),
                status: weightedPick(STATUSES, WEIGHTS),
                apiNumber: pick(API_IDS),
                responseTime: 20 + Math.floor(Math.random() * 800),
                serverIdentifier: pick(SERVERS),
                date: new Date(randomTime)
            });
        }

        await ApiLog.insertMany(docs, { ordered: false });
        logsGenerated += currentBatchSize;
        
        const elapsed = (Date.now() - start) / 1000;
        const rate = Math.floor(logsGenerated / elapsed);
        process.stdout.write(`\r  📝 Progress: ${logsGenerated.toLocaleString()} / ${TOTAL_LOGS.toLocaleString()} (${Math.floor(logsGenerated/TOTAL_LOGS*100)}%) | Rate: ${rate.toLocaleString()} logs/sec`);
    }

    console.log(`\n\n✅ Log seeding complete in ${((Date.now() - start) / 1000).toFixed(2)}s`);

    // ── Aggregation Phase ──
    console.log('\n📊 STARTING HOURLY AGGREGATION (Building Graphs)...');
    const aggStart = Date.now();

    const stats = await ApiLog.aggregate([
        {
            $group: {
                _id: {
                    date: {
                        $dateFromParts: {
                            year: { $year: '$date' },
                            month: { $month: '$date' },
                            day: { $dayOfMonth: '$date' },
                            hour: { $hour: '$date' }
                        }
                    },
                    apiNumber: '$apiNumber',
                    serverIdentifier: '$serverIdentifier',
                    accessMethod: '$accessMethod'
                },
                totalRequests: { $sum: 1 },
                successCount: { $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'information'] }, 1, 0] } },
                warningCount: { $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'warning'] }, 1, 0] } },
                errorCount: { $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'error'] }, 1, 0] } },
                criticalCount: { $sum: { $cond: [{ $eq: [{ $toLower: '$status' }, 'critical'] }, 1, 0] } },
                totalResponseTime: { $sum: '$responseTime' },
                minResponseTime: { $min: '$responseTime' },
                maxResponseTime: { $max: '$responseTime' },
                uniqueCustomers: { $addToSet: '$customerEmail' }
            }
        },
        {
            $project: {
                _id: 0,
                date: '$_id.date',
                apiNumber: '$_id.apiNumber',
                serverIdentifier: '$_id.serverIdentifier',
                accessMethod: '$_id.accessMethod',
                totalRequests: 1,
                successCount: 1,
                warningCount: 1,
                errorCount: 1,
                criticalCount: 1,
                totalResponseTime: 1,
                minResponseTime: 1,
                maxResponseTime: 1,
                uniqueCustomersCount: { $size: '$uniqueCustomers' }
            }
        }
    ]).allowDiskUse(true);

    console.log(`  🔄 Built aggregation results (${stats.length.toLocaleString()} hourly buckets)`);

    const bulkSize = 5000;
    for (let i = 0; i < stats.length; i += bulkSize) {
        const chunk = stats.slice(i, i + bulkSize);
        const ops = chunk.map(s => ({
            updateOne: {
                filter: { date: s.date, apiNumber: s.apiNumber, serverIdentifier: s.serverIdentifier, accessMethod: s.accessMethod },
                update: { $set: s },
                upsert: true
            }
        }));
        await HourlyStats.bulkWrite(ops);
        process.stdout.write(`\r  📉 Writing HourlyStats: ${Math.min(i + bulkSize, stats.length)} / ${stats.length}`);
    }

    console.log(`\n✅ Aggregation complete in ${((Date.now() - aggStart) / 1000).toFixed(2)}s\n`);
};

const run = async () => {
    try {
        await mongoose.connect(DB_URI);
        await seed();
        console.log('🌟 ULTRA STRESS TEST READY 🌟\n');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
